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

        $prefix = $matches[1];
        $digits = $matches[2];
        $number = (int) $digits;
        $width = strlen($digits);
        $projectNumber = $projectCode;

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
}
