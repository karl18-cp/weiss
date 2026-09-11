<?php

namespace App\Http\Requests;

use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\Salesman;
use App\Services\ProjectCommissionCalculator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ProjectAccountingTransactionRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $referenceNumber = trim((string) $this->input('reference_number'));
        $emptyReferences = ['', 'CH#', 'ZELLE', 'CC-', 'WIRE-', 'SQUARE-', 'CASH-'];

        if (! in_array($referenceNumber, $emptyReferences, true)) {
            $prefix = match ($this->input('payment_method')) {
                'check' => 'CH#',
                'zelle' => 'ZELLE',
                'credit_card' => 'CC-',
                'wire_transfer' => 'WIRE-',
                'square_transfer' => 'SQUARE-',
                'cash' => 'CASH-',
                default => null,
            };

            if ($prefix) {
                foreach (['CH#', 'ZELLE', 'CC-', 'WIRE-', 'SQUARE-', 'CASH-'] as $knownPrefix) {
                    if (str_starts_with(strtoupper($referenceNumber), $knownPrefix)) {
                        $referenceNumber = trim(substr($referenceNumber, strlen($knownPrefix)));
                        break;
                    }
                }

                $referenceNumber = $referenceNumber === '' ? '' : $prefix.$referenceNumber;
                $this->merge(['reference_number' => $referenceNumber ?: null]);
            }
        }

        if (in_array($referenceNumber, $emptyReferences, true)) {
            $this->merge(['reference_number' => null]);
        }

        if ($this->input('type') === 'payable' && ! in_array($referenceNumber, $emptyReferences, true)) {
            $this->merge([
                'status' => 'paid',
                'payment_method' => $this->input('payment_method') ?: 'check',
            ]);
        }

        if (
            $this->input('status') === 'pending'
        ) {
            $this->merge([
                'payment_method' => null,
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'unassigned' => ['sometimes', 'boolean'],
            'company_id' => ['nullable', 'integer', 'exists:companies,com_id'],
            'type' => ['required', Rule::in(['receivable', 'payable'])],
            'category' => ['required', 'string', 'max:100'],
            'transaction_date' => ['required', 'date'],
            'payment_method' => [
                Rule::requiredIf(fn (): bool => $this->input('status') === 'paid' || $this->input('status') === 'deposit'),
                'nullable',
                Rule::in(['check', 'zelle', 'credit_card', 'wire_transfer', 'square_transfer', 'cash']),
            ],
            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],
            'invoice_order_number' => ['nullable', 'string', 'max:100'],
            'counterparty' => ['nullable', 'string', 'max:255'],
            'contractor_id' => ['nullable', 'integer', 'exists:contractors,con_id'],
            'vendor_id' => ['nullable', 'integer', 'exists:vendors,vendor_id'],
            'salesman_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
            'requested_by' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'status' => ['required', Rule::in(['pending', 'deposit', 'ok_to_pay', 'paid'])],
            'notes' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'extensions:pdf,jpg,jpeg,jfif,png,webp,heic,heif', 'max:20480'],
            'project_document_id' => ['nullable', 'integer', 'exists:project_documents,id'],
            'project_invoice_id' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === 'payable'
                    && $this->input('category') === 'Invoice Payment'
                    && ! $this->boolean('unassigned')),
                'nullable',
                'integer',
                'exists:project_invoices,id',
            ],
            'project_sale_id' => ['nullable', 'integer', 'exists:project_sales,id'],
            'scheduled_payment_ids' => ['nullable', 'array'],
            'scheduled_payment_ids.*' => ['integer', 'distinct', 'exists:scheduled_payments,id'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $type = $this->input('type');
                $status = $this->input('status');

                if ($type === 'receivable' && ! in_array($status, ['pending', 'deposit'], true)) {
                    $validator->errors()->add('status', 'Receivables can only be Pending or Deposit.');
                }

                if ($type === 'payable' && $status === 'deposit') {
                    $validator->errors()->add('status', 'Deposit is only available for receivables.');
                }

                if ($this->filled('contractor_id') && $this->filled('vendor_id')) {
                    $validator->errors()->add('vendor_id', 'Select either a contractor or a vendor, not both.');
                }

                $isCommission = $type === 'payable'
                    && str_contains(strtolower((string) $this->input('category')), 'commission');

                if ($isCommission && ! $this->filled('salesman_id')) {
                    $validator->errors()->add('salesman_id', 'Select a salesman assigned to this project.');
                }

                $project = $this->route('project');
                if (
                    $project instanceof Project
                    && $this->filled('project_sale_id')
                    && ! $project->sales()->whereKey((int) $this->input('project_sale_id'))->exists()
                ) {
                    $validator->errors()->add('project_sale_id', 'The selected sale does not belong to this project.');
                }
                if ($isCommission && $this->filled('salesman_id') && $project instanceof Project) {
                    $salesmanId = (int) $this->input('salesman_id');
                    $lead = $project->lead;
                    $isAssigned = (int) $project->salesman_id === $salesmanId
                        || (int) $lead?->salesman_1_id === $salesmanId
                        || (int) $lead?->salesman_2_id === $salesmanId
                        || $project->sales()->where('salesman_id', $salesmanId)->exists();

                    if (! $isAssigned) {
                        $validator->errors()->add('salesman_id', 'The selected salesman is not assigned to this project.');
                    }
                }

                if (
                    $isCommission
                    && $this->filled('salesman_id')
                    && $this->filled('amount')
                    && $project instanceof Project
                    && ! $validator->errors()->has('salesman_id')
                ) {
                    $salesman = Salesman::query()->find((int) $this->input('salesman_id'));
                    if ($salesman) {
                        $project->loadMissing(['sales', 'accountingTransactions', 'lead']);
                        $available = app(ProjectCommissionCalculator::class)
                            ->calculate($project, $salesman)['commission_balance'];
                        $existing = $this->route('accountingTransaction');

                        if (
                            $existing instanceof ProjectAccountingTransaction
                            && $existing->status === 'paid'
                            && (int) $existing->salesman_id === (int) $salesman->salesman_id
                            && str_contains(strtolower((string) $existing->category), 'commission')
                        ) {
                            $available += (float) $existing->amount;
                        }

                        if ((float) $this->input('amount') > $available + 0.001) {
                            $validator->errors()->add(
                                'amount',
                                'Commission cannot exceed the salesman’s remaining commission balance of $'.number_format($available, 2).'.',
                            );
                        }
                    }
                }

            },
        ];
    }
}
