<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use DOMDocument;
use DOMElement;
use DOMXPath;
use RuntimeException;
use ZipArchive;

class ProjectAccountingWorkbookExporter
{
    public function export(Project $project, string $type): string
    {
        if (! in_array($type, ['receivable', 'payable'], true)) {
            throw new RuntimeException('Unsupported accounting export type.');
        }

        $template = resource_path('templates/project-management.xlsx');
        abort_unless(is_file($template), 500, 'Project accounting workbook template is missing.');

        $path = tempnam(storage_path('app'), 'project-accounting-');
        if ($path === false || ! copy($template, $path)) {
            throw new RuntimeException('Unable to prepare the accounting workbook.');
        }

        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            @unlink($path);
            throw new RuntimeException('Unable to open the accounting workbook.');
        }

        try {
            $transactions = $project->accountingTransactions
                ->sortBy([['transaction_date', 'asc'], ['id', 'asc']]);
            $payables = $transactions->where('type', 'payable')->values();
            $receivables = $transactions->where('type', 'receivable')->values();
            if ($type === 'payable') {
                $receivables = collect();
            } else {
                $payables = collect();
            }
            $saleAmount = (float) ($project->sales->sum('amount') ?: $project->amount);

            $this->fillTransactionSheet($zip, 'xl/worksheets/sheet2.xml', $payables, 6, 28, 29, 'A3', 'E', [
                'A' => 32, 'B' => 32, 'C' => 32, 'D' => 33, 'E' => 38, 'F' => 32,
            ]);
            $this->fillTransactionSheet($zip, 'xl/worksheets/sheet3.xml', $receivables, 7, 25, 26, 'B4', 'E', [
                'A' => 37, 'B' => 37, 'C' => 37, 'D' => 38, 'E' => 39, 'F' => 37,
            ]);

            $expenseTotal = (float) $payables->sum('amount');
            $incomeTotal = (float) $receivables->sum('amount');
            $this->setSheetValues($zip, 'xl/worksheets/sheet2.xml', [
                'B1' => ['text', strtoupper($project->lead?->company?->company ?? 'SBH CONSTRUCTION INC.')],
                'F1' => ['text', 'JOB #: '.($project->project_number ?: '—')],
                'A3' => ['formula', 'SUM(E6:E'.max(28, 5 + $payables->count()).')', $expenseTotal],
                'F3' => ['formula', 'Income!B4-A3', $incomeTotal - $expenseTotal],
            ]);
            $this->setSheetValues($zip, 'xl/worksheets/sheet3.xml', [
                'A1' => ['text', strtoupper($project->lead?->company?->company ?? 'SBH CONSTRUCTION INC.')],
                'F2' => ['text', 'JOB #: '.($project->project_number ?: '—')],
                'B2' => ['number', $saleAmount],
                'B4' => ['formula', 'SUM(E7:E'.max(25, 6 + $receivables->count()).')', $incomeTotal],
                'E4' => ['formula', 'B2-B4', $saleAmount - $incomeTotal],
            ]);
            $this->forceFormulaRecalculation($zip);
        } finally {
            $zip->close();
        }

        return $path;
    }

    private function fillTransactionSheet(
        ZipArchive $zip,
        string $entry,
        $transactions,
        int $startRow,
        int $defaultEndRow,
        int $defaultTotalRow,
        string $totalCell,
        string $amountColumn,
        array $styles,
    ): void {
        [$document, $xpath] = $this->loadXml($zip, $entry);
        $lastRow = max($defaultEndRow, $startRow + $transactions->count() - 1);
        $totalRow = max($defaultTotalRow, $lastRow + 1);

        if ($totalRow !== $defaultTotalRow) {
            $this->moveTotalRow($document, $xpath, $defaultTotalRow, $totalRow);
        }

        foreach ($transactions as $index => $transaction) {
            $rowNumber = $startRow + $index;
            $row = $this->row($xpath, $rowNumber);
            $row->setAttribute('ht', '30');
            $row->setAttribute('customHeight', '1');
            $values = $this->transactionValues($transaction);

            foreach ($values as $column => [$type, $value]) {
                $cell = $this->cell($document, $xpath, $row, $column.$rowNumber);
                $cell->setAttribute('s', (string) $styles[$column]);
                $this->writeCell($document, $cell, $type, $value);
            }
        }

        $total = (float) $transactions->sum('amount');
        $cell = $this->findCell($xpath, $totalCell);
        $this->writeFormula($document, $cell, 'SUM('.$amountColumn.$startRow.':'.$amountColumn.$lastRow.')', $total);
        $this->saveXml($zip, $entry, $document);
    }

    private function transactionValues(ProjectAccountingTransaction $transaction): array
    {
        $payTo = $transaction->contractor?->contractor
            ?? $transaction->vendor?->vendor
            ?? $transaction->salesman?->salesman_name
            ?? $transaction->counterparty
            ?? $transaction->company?->company
            ?? 'Unassigned';
        $reference = $transaction->reference_number
            ?? $transaction->invoice_order_number
            ?? $transaction->invoice?->invoice_number
            ?? '';

        return [
            'A' => ['text', $payTo],
            'B' => ['text', $transaction->category],
            'C' => ['text', $reference],
            'D' => ['text', $transaction->transaction_date?->format('m/d/Y') ?? ''],
            'E' => ['number', (float) $transaction->amount],
            'F' => ['text', $transaction->notes ?? ''],
        ];
    }

    private function setSheetValues(ZipArchive $zip, string $entry, array $values): void
    {
        [$document, $xpath] = $this->loadXml($zip, $entry);
        foreach ($values as $reference => $definition) {
            [$type, $value] = $definition;
            $cached = $definition[2] ?? null;
            $cell = $this->findCell($xpath, $reference);
            if ($type === 'formula') {
                $this->writeFormula($document, $cell, $value, (float) $cached);
            } else {
                $this->writeCell($document, $cell, $type, $value);
            }
        }
        $this->saveXml($zip, $entry, $document);
    }

    private function moveTotalRow(DOMDocument $document, DOMXPath $xpath, int $from, int $to): void
    {
        $source = $this->row($xpath, $from);
        $target = $this->row($xpath, $to);
        $clone = $source->cloneNode(true);
        $clone->setAttribute('r', (string) $to);
        foreach ($clone->getElementsByTagName('c') as $cell) {
            $cell->setAttribute('r', preg_replace('/\d+$/', (string) $to, $cell->getAttribute('r')));
        }
        $target->parentNode->replaceChild($clone, $target);

        $merge = $xpath->query('//*[local-name()="mergeCell" and @ref="A'.$from.':F'.$from.'"]')->item(0);
        if ($merge instanceof DOMElement) {
            $merge->setAttribute('ref', 'A'.$to.':F'.$to);
        }
    }

    private function loadXml(ZipArchive $zip, string $entry): array
    {
        $xml = $zip->getFromName($entry);
        if ($xml === false) {
            throw new RuntimeException("Workbook entry {$entry} is missing.");
        }
        $document = new DOMDocument;
        $document->preserveWhiteSpace = false;
        $document->loadXML($xml);

        return [$document, new DOMXPath($document)];
    }

    private function saveXml(ZipArchive $zip, string $entry, DOMDocument $document): void
    {
        $zip->addFromString($entry, $document->saveXML());
    }

    private function row(DOMXPath $xpath, int $number): DOMElement
    {
        $row = $xpath->query('//*[local-name()="row" and @r="'.$number.'"]')->item(0);
        if (! $row instanceof DOMElement) {
            throw new RuntimeException("Workbook row {$number} is missing.");
        }

        return $row;
    }

    private function findCell(DOMXPath $xpath, string $reference): DOMElement
    {
        $cell = $xpath->query('//*[local-name()="c" and @r="'.$reference.'"]')->item(0);
        if (! $cell instanceof DOMElement) {
            throw new RuntimeException("Workbook cell {$reference} is missing.");
        }

        return $cell;
    }

    private function cell(DOMDocument $document, DOMXPath $xpath, DOMElement $row, string $reference): DOMElement
    {
        $cell = $xpath->query('./*[local-name()="c" and @r="'.$reference.'"]', $row)->item(0);
        if ($cell instanceof DOMElement) {
            return $cell;
        }
        $cell = $document->createElementNS($document->documentElement->namespaceURI, 'c');
        $cell->setAttribute('r', $reference);
        $row->appendChild($cell);

        return $cell;
    }

    private function writeCell(DOMDocument $document, DOMElement $cell, string $type, mixed $value): void
    {
        while ($cell->firstChild) {
            $cell->removeChild($cell->firstChild);
        }
        if ($type === 'number') {
            $cell->removeAttribute('t');
            $cell->appendChild($document->createElementNS($document->documentElement->namespaceURI, 'v', (string) $value));

            return;
        }
        $cell->setAttribute('t', 'inlineStr');
        $inline = $document->createElementNS($document->documentElement->namespaceURI, 'is');
        $text = $document->createElementNS($document->documentElement->namespaceURI, 't');
        $text->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        $text->appendChild($document->createTextNode((string) $value));
        $inline->appendChild($text);
        $cell->appendChild($inline);
    }

    private function writeFormula(DOMDocument $document, DOMElement $cell, string $formula, float $cached): void
    {
        while ($cell->firstChild) {
            $cell->removeChild($cell->firstChild);
        }
        $cell->removeAttribute('t');
        $cell->appendChild($document->createElementNS($document->documentElement->namespaceURI, 'f', $formula));
        $cell->appendChild($document->createElementNS($document->documentElement->namespaceURI, 'v', (string) $cached));
    }

    private function forceFormulaRecalculation(ZipArchive $zip): void
    {
        [$document, $xpath] = $this->loadXml($zip, 'xl/workbook.xml');
        $calc = $xpath->query('//*[local-name()="calcPr"]')->item(0);
        if ($calc instanceof DOMElement) {
            $calc->setAttribute('fullCalcOnLoad', '1');
            $calc->setAttribute('forceFullCalc', '1');
            $calc->setAttribute('calcMode', 'auto');
        }
        $this->saveXml($zip, 'xl/workbook.xml', $document);
    }
}
