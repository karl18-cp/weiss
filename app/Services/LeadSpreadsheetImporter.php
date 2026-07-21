<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadNote;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

class LeadSpreadsheetImporter
{
    private const REQUIRED_HEADERS = [
        'Origin @', 'Agent', 'Customer', 'Lead', 'Address', 'City', 'State',
        'Zip', 'App. Date', 'Lead Results', 'Rep', 'App. Results', 'Mobile',
        'Phone', 'Note',
    ];

    /** @return array{imported:int,notes_updated:int,duplicates:int,skipped:int,total:int,errors:array<int,string>} */
    public function import(UploadedFile $file, int $createdBy): array
    {
        $rows = $this->readRows($file->getRealPath());
        $headers = array_map(fn (mixed $value): string => trim((string) $value), array_shift($rows) ?? []);

        if ($headers !== self::REQUIRED_HEADERS) {
            throw new RuntimeException('The spreadsheet columns do not match the WEISS lead import template.');
        }

        $agents = Agent::query()->get(['agent_id', 'agent_name'])
            ->keyBy(fn (Agent $agent): string => $this->normalizeText($agent->agent_name));
        $knownPhones = [];
        $knownIdentities = [];

        Lead::query()->select(['id', 'customer_name', 'address', 'zip_code', 'primary_number', 'secondary_number', 'mobile_number'])
            ->orderBy('id')->chunk(500, function ($leads) use (&$knownPhones, &$knownIdentities): void {
                foreach ($leads as $lead) {
                    foreach ([$lead->primary_number, $lead->secondary_number, $lead->mobile_number] as $phone) {
                        if ($normalized = $this->normalizePhone($phone)) {
                            $knownPhones[$normalized] = $lead->id;
                        }
                    }

                    $knownIdentities[$this->identityKey($lead->customer_name, $lead->address, $lead->zip_code)] = $lead->id;
                }
            });

        $knownNotes = [];
        if (Schema::hasTable('lead_notes')) {
            LeadNote::query()->where('note_type', 'telemarketer')
                ->select(['lead_id', 'body'])->orderBy('id')->chunk(500, function ($notes) use (&$knownNotes): void {
                    foreach ($notes as $note) {
                        $knownNotes[$note->lead_id][$this->normalizeText($note->body)] = true;
                    }
                });
        }

        $report = ['imported' => 0, 'notes_updated' => 0, 'duplicates' => 0, 'skipped' => 0, 'total' => count($rows), 'errors' => []];
        $movements = [];
        $assignments = [];
        $notes = [];

        foreach ($rows as $offset => $values) {
            $rowNumber = $offset + 2;
            $row = array_combine(self::REQUIRED_HEADERS, array_pad(array_slice($values, 0, 15), 15, ''));

            if (! $row || count(array_filter($row, fn (mixed $value): bool => trim((string) $value) !== '')) === 0) {
                $report['total']--;
                continue;
            }

            $customer = trim((string) $row['Customer']);
            $address = trim((string) $row['Address']);
            $zip = trim((string) $row['Zip']);
            $primary = trim((string) $row['Phone']);
            $mobile = trim((string) $row['Mobile']);
            $phoneKeys = array_values(array_unique(array_filter([
                $this->normalizePhone($primary),
                $this->normalizePhone($mobile),
            ])));

            if ($customer === '' || $phoneKeys === []) {
                $this->skip($report, "Row {$rowNumber}: customer and at least one phone number are required.");
                continue;
            }

            $identity = $this->identityKey($customer, $address, $zip);
            $duplicateLeadId = $knownIdentities[$identity] ?? null;
            foreach ($phoneKeys as $phoneKey) {
                if (isset($knownPhones[$phoneKey])) {
                    $duplicateLeadId = $knownPhones[$phoneKey];
                    break;
                }
            }

            if ($duplicateLeadId) {
                $report['duplicates']++;
                $noteBody = trim((string) $row['Note']);
                $noteKey = $this->normalizeText($noteBody);

                if ($noteBody !== '' && ! isset($knownNotes[$duplicateLeadId][$noteKey])) {
                    Lead::withoutEvents(fn () => Lead::query()->whereKey($duplicateLeadId)->update([
                        'telemarketer_notes' => $noteBody,
                    ]));
                    $notes[] = [
                        'lead_id' => $duplicateLeadId,
                        'note_type' => 'telemarketer',
                        'body' => $noteBody,
                        'created_by' => $createdBy,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    $knownNotes[$duplicateLeadId][$noteKey] = true;
                    $report['notes_updated']++;
                }

                continue;
            }

            $agentName = trim((string) $row['Agent']);
            $agent = $agents->get($this->normalizeText($agentName));
            if (! $agent) {
                $this->skip($report, "Row {$rowNumber}: agent '{$agentName}' was not found in WEISS.");
                continue;
            }

            [$status, $forcedAppointmentResult] = $this->workflow((string) $row['Lead Results']);
            if ($status === null) {
                $this->skip($report, "Row {$rowNumber}: unknown Lead Results value '{$row['Lead Results']}'.");
                continue;
            }

            $originAt = $this->excelDate($row['Origin @']);
            $appointmentAt = $this->excelDate($row['App. Date']);
            $appointmentResult = $forcedAppointmentResult
                ?: $this->nullableResult((string) $row['App. Results']);

            $lead = Lead::withoutEvents(fn (): Lead => Lead::query()->create([
                'customer_name' => $customer,
                'marital_status' => 'Unknown',
                'primary_number' => $primary !== '' ? $primary : $mobile,
                'secondary_number' => null,
                'mobile_number' => $mobile !== '' ? $mobile : null,
                'address' => $address !== '' ? $address : 'Unknown',
                'zip_code' => $zip !== '' ? $zip : 'N/A',
                'city' => trim((string) $row['City']) ?: 'Unknown',
                'county' => 'Unknown',
                'state' => trim((string) $row['State']) ?: 'Unknown',
                'email' => null,
                'years_in_house' => 0,
                'product_id' => null,
                'appointment_at' => $appointmentAt,
                'appointment_result' => $appointmentResult,
                'telemarketer_notes' => trim((string) $row['Note']) ?: 'Imported from WEISS spreadsheet.',
                'company_id' => null,
                'source' => 'Spreadsheet Import',
                'agent_id' => $agent->agent_id,
                'created_by' => $createdBy,
                'status' => $status,
                'rep' => 'N/A',
            ]));

            if ($originAt) {
                $lead->timestamps = false;
                $lead->forceFill(['created_at' => $originAt, 'updated_at' => $originAt])->saveQuietly();
            }

            $eventAt = $originAt ?: now();
            $movements[] = [
                'lead_id' => $lead->id,
                'from_status' => null,
                'to_status' => $status,
                'moved_by' => $createdBy,
                'created_at' => $eventAt,
                'updated_at' => $eventAt,
            ];
            $assignments[] = [
                'lead_id' => $lead->id,
                'agent_id' => $agent->agent_id,
                'assigned_by' => $createdBy,
                'is_original' => true,
                'created_at' => $eventAt,
                'updated_at' => $eventAt,
            ];
            $notes[] = [
                'lead_id' => $lead->id,
                'note_type' => 'telemarketer',
                'body' => $lead->telemarketer_notes,
                'created_by' => $createdBy,
                'created_at' => $eventAt,
                'updated_at' => $eventAt,
            ];

            foreach ($phoneKeys as $phone) {
                $knownPhones[$phone] = $lead->id;
            }
            $knownIdentities[$identity] = $lead->id;
            $report['imported']++;
        }

        if ($movements !== [] && Schema::hasTable('lead_movements')) {
            foreach (array_chunk($movements, 500) as $chunk) {
                DB::table('lead_movements')->insert($chunk);
            }
        }

        if ($assignments !== [] && Schema::hasTable('lead_agent_assignments')) {
            foreach (array_chunk($assignments, 500) as $chunk) {
                DB::table('lead_agent_assignments')->insert($chunk);
            }
        }

        if ($notes !== [] && Schema::hasTable('lead_notes')) {
            foreach (array_chunk($notes, 500) as $chunk) {
                DB::table('lead_notes')->insert($chunk);
            }
        }

        return $report;
    }

    /** @return array<int,array<int,string>> */
    private function readRows(string $path): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('The uploaded workbook could not be opened.');
        }

        try {
            $sharedStrings = [];
            if (($xml = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
                $document = simplexml_load_string($xml);
                foreach ($document?->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main')->si ?? [] as $item) {
                    $sharedStrings[] = $this->sharedString($item);
                }
            }

            $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
            if ($sheetXml === false) {
                throw new RuntimeException('The workbook does not contain the expected first worksheet.');
            }

            $sheet = simplexml_load_string($sheetXml);
            $main = $sheet?->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main');
            $rows = [];

            foreach ($main?->sheetData->row ?? [] as $xmlRow) {
                $values = array_fill(0, 15, '');
                foreach ($xmlRow->c as $cell) {
                    $attributes = $cell->attributes();
                    $column = $this->columnIndex((string) $attributes['r']);
                    if ($column < 0 || $column > 14) {
                        continue;
                    }

                    $type = (string) $attributes['t'];
                    $value = (string) $cell->v;
                    $values[$column] = $type === 's' ? ($sharedStrings[(int) $value] ?? '') : $value;
                }
                $rows[] = $values;

                if (count($rows) > 10001) {
                    throw new RuntimeException('A single import is limited to 10,000 lead rows.');
                }
            }

            return $rows;
        } finally {
            $zip->close();
        }
    }

    private function sharedString(SimpleXMLElement $item): string
    {
        $main = $item->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        if (isset($main->t)) {
            return (string) $main->t;
        }

        $value = '';
        foreach ($main->r as $run) {
            $value .= (string) $run->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main')->t;
        }

        return $value;
    }

    private function columnIndex(string $reference): int
    {
        preg_match('/^[A-Z]+/', $reference, $match);
        $index = 0;
        foreach (str_split($match[0] ?? '') as $letter) {
            $index = ($index * 26) + ord($letter) - 64;
        }

        return $index - 1;
    }

    private function excelDate(mixed $value): ?CarbonImmutable
    {
        if ($value === null || trim((string) $value) === '' || ! is_numeric($value)) {
            return null;
        }

        return CarbonImmutable::create(1899, 12, 30, 0, 0, 0, config('app.timezone'))
            ->addSeconds((int) round((float) $value * 86400));
    }

    /** @return array{0:?string,1:?string} */
    private function workflow(string $result): array
    {
        return match ($this->normalizeText($result)) {
            'freshly in' => ['fresh', null],
            'raw' => ['raw', null],
            'cb' => ['cb', null],
            'naov' => ['naov', null],
            'toss' => ['toss', null],
            'confirmed', 'confirm' => ['confirmed', null],
            'dispatched', 'dispatch' => ['dispatched', null],
            // Salesman Sent is a completed handoff, not a lead waiting in Dispatch.
            'salesman sent' => ['salesman_sent', null],
            '555' => ['555', null],
            'his' => ['his', null],
            'keep in touch' => ['kit', null],
            default => [null, null],
        };
    }

    private function nullableResult(string $result): ?string
    {
        $result = trim($result);

        return $result === '' || strtoupper($result) === 'N/A' ? null : $result;
    }

    private function normalizePhone(mixed $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);

        return $digits !== '' ? $digits : null;
    }

    private function normalizeText(mixed $value): string
    {
        return mb_strtolower(preg_replace('/\s+/', ' ', trim((string) $value)));
    }

    private function identityKey(mixed $customer, mixed $address, mixed $zip): string
    {
        return $this->normalizeText($customer).'|'.$this->normalizeText($address).'|'.$this->normalizeText($zip);
    }

    /** @param array{imported:int,notes_updated:int,duplicates:int,skipped:int,total:int,errors:array<int,string>} $report */
    private function skip(array &$report, string $error): void
    {
        $report['skipped']++;
        if (count($report['errors']) < 25) {
            $report['errors'][] = $error;
        }
    }
}
