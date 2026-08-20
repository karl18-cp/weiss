<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Lead;
use App\Models\Project;
use Illuminate\Validation\ValidationException;

class ProjectNumberAllocator
{
    public function allocate(Lead $lead): string
    {
        return $this->allocateForCompany((int) $lead->company_id);
    }

    public function allocateForCompany(int $companyId): string
    {
        $company = Company::query()
            ->lockForUpdate()
            ->find($companyId);

        if (! $company) {
            throw ValidationException::withMessages([
                'company' => 'Assign a company before creating the project.',
            ]);
        }

        $projectCode = trim((string) $company->project_code);

        if (! preg_match('/^(.*?)(\d+)$/', $projectCode, $matches)) {
            throw ValidationException::withMessages([
                'company' => 'The company project code must end with a number, such as SBH#2552.',
            ]);
        }

        $prefix = $this->normalizePrefix((string) $company->prefix);
        if ($prefix === '') {
            $prefix = $this->normalizePrefix((string) $matches[1]);
        }
        if ($prefix === '') {
            throw ValidationException::withMessages([
                'company' => 'The selected company needs an abbreviation before a project number can be assigned.',
            ]);
        }
        $prefix .= '#';
        $digits = $matches[2];
        $number = (int) $digits;
        $width = strlen($digits);
        $projectNumber = $prefix.str_pad((string) $number, $width, '0', STR_PAD_LEFT);

        while (Project::query()->where('project_number', $projectNumber)->exists()) {
            $number++;
            $projectNumber = $prefix.str_pad((string) $number, $width, '0', STR_PAD_LEFT);
        }

        $nextNumber = $number + 1;
        $company->update([
            'project_code' => $prefix.str_pad((string) $nextNumber, $width, '0', STR_PAD_LEFT),
        ]);

        return $projectNumber;
    }

    public function normalizeForCompany(int $companyId, string $projectNumber, ?int $ignoreProjectId = null): string
    {
        $company = Company::query()->find($companyId);
        if (! $company || blank($company->prefix)) {
            throw ValidationException::withMessages([
                'company_id' => 'The selected company needs an abbreviation before a project number can be assigned.',
            ]);
        }

        if (! preg_match('/(\d+)$/', trim($projectNumber), $matches)) {
            throw ValidationException::withMessages([
                'project_number' => 'Enter a project number ending in digits, such as SBH#5008.',
            ]);
        }

        $prefix = $this->normalizePrefix((string) $company->prefix);
        if ($prefix === '') {
            throw ValidationException::withMessages([
                'company_id' => 'The selected company needs an abbreviation before a project number can be assigned.',
            ]);
        }

        $normalized = $prefix.'#'.$matches[1];
        $exists = Project::query()
            ->where('project_number', $normalized)
            ->when($ignoreProjectId, fn ($query) => $query->whereKeyNot($ignoreProjectId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'project_number' => 'This project number already exists.',
            ]);
        }

        return $normalized;
    }

    private function normalizePrefix(string $prefix): string
    {
        return strtoupper(trim($prefix, " #-_\t\n\r\0\x0B"));
    }
}
