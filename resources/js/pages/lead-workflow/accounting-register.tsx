import { Head, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Landmark,
    Search,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import '@/../css/accounting-register.css';
import DataSectionTabs from '@/components/data-section-tabs';

type RegisterType = 'receivable' | 'payable';

type AccountingRow = {
    id: number;
    project_id: number;
    project_number: string;
    company_prefix: string;
    customer: string;
    address: string;
    transaction_date: string;
    reference_number: string;
    received_from: string | null;
    contractor: string | null;
    invoice_number: string | null;
    requested_by: string | null;
    amount: string;
    status: 'pending' | 'ok_to_pay' | 'paid';
    category: string;
    notes: string | null;
    file_name: string | null;
    file_mime: string | null;
};

type PaginatedTransactions = {
    data: AccountingRow[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const statusLabels = {
    pending: 'Pending',
    ok_to_pay: 'OK 2 Pay',
    paid: 'Paid',
} as const;

export default function AccountingRegister({
    type,
    transactions,
    filters,
    totalAmount,
}: {
    type: RegisterType;
    transactions: PaginatedTransactions;
    filters: { search: string };
    totalAmount: string | number;
}) {
    const [search, setSearch] = useState(filters.search);
    const searchInput = useRef<HTMLInputElement>(null);
    const isPayable = type === 'payable';
    const title = isPayable ? 'Payables' : 'Receivables';
    const baseUrl = `/lead-workflow/data/${title.toLowerCase()}`;

    const visit = (value: string) => {
        router.get(
            baseUrl,
            { search: value || undefined },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <>
            <Head title={title} />
            <main className="accounting-register-page">
                <header className="accounting-register-heading">
                    <div>
                        <span>Project accounting</span>
                        <h1>{title}</h1>
                        <p>
                            All project {title.toLowerCase()} recorded through
                            the ACT tab.
                        </p>
                    </div>
                    <div className="accounting-register-summary">
                        <Landmark />
                        <div>
                            <strong>
                                {currency.format(Number(totalAmount))}
                            </strong>
                            <span>
                                {transactions.total.toLocaleString()}{' '}
                                {title.toLowerCase()}
                            </span>
                        </div>
                    </div>
                </header>

                <DataSectionTabs
                    active={title}
                    onSearch={() => searchInput.current?.focus()}
                />

                <section className="accounting-register-panel">
                    <header>
                        <div>
                            <h2>All {title}</h2>
                            <span>
                                Columns match the Project ACT {type} view.
                            </span>
                        </div>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                visit(search.trim());
                            }}
                        >
                            <Search />
                            <input
                                ref={searchInput}
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder={`Search ${title.toLowerCase()}, projects, addresses…`}
                            />
                            {search && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => {
                                        setSearch('');
                                        visit('');
                                    }}
                                >
                                    <X />
                                </button>
                            )}
                        </form>
                    </header>

                    <div className="accounting-register-table-wrap">
                        <table
                            className={
                                isPayable ? 'is-payable' : 'is-receivable'
                            }
                        >
                            <thead>
                                {isPayable ? (
                                    <tr>
                                        <th>Req. 2 Pay @</th>
                                        <th>CMP</th>
                                        <th>Proj. #</th>
                                        <th>Pay To</th>
                                        <th>Pay For (Invoice)</th>
                                        <th>Req. By</th>
                                        <th>Status</th>
                                        <th>$ Amount To Pay</th>
                                        <th>Check #</th>
                                        <th>Notes</th>
                                        <th>File</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Date</th>
                                        <th>Reference #</th>
                                        <th>Received From</th>
                                        <th>Notes</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Category</th>
                                        <th>File</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {transactions.data.map((transaction) => {
                                    const fileUrl = `/management/projects/${transaction.project_id}/accounting-transactions/${transaction.id}/file`;

                                    return (
                                        <tr key={transaction.id}>
                                            <td>
                                                {date.format(
                                                    new Date(
                                                        `${transaction.transaction_date}T00:00:00`,
                                                    ),
                                                )}
                                            </td>
                                            {isPayable ? (
                                                <>
                                                    <td>
                                                        <strong>
                                                            {
                                                                transaction.company_prefix
                                                            }
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {
                                                                transaction.project_number
                                                            }
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {transaction.contractor ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        {transaction.invoice_number ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        {transaction.requested_by ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`accounting-register-status is-${transaction.status}`}
                                                        >
                                                            {
                                                                statusLabels[
                                                                    transaction
                                                                        .status
                                                                ]
                                                            }
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {currency.format(
                                                                Number(
                                                                    transaction.amount,
                                                                ),
                                                            )}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {
                                                            transaction.reference_number
                                                        }
                                                    </td>
                                                    <td
                                                        title={
                                                            transaction.notes ??
                                                            ''
                                                        }
                                                    >
                                                        {transaction.notes ||
                                                            '—'}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>
                                                        <strong>
                                                            {
                                                                transaction.reference_number
                                                            }
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {transaction.received_from ||
                                                            transaction.customer}
                                                    </td>
                                                    <td
                                                        title={
                                                            transaction.notes ??
                                                            ''
                                                        }
                                                    >
                                                        {transaction.notes ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {currency.format(
                                                                Number(
                                                                    transaction.amount,
                                                                ),
                                                            )}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`accounting-register-status is-${transaction.status}`}
                                                        >
                                                            {
                                                                statusLabels[
                                                                    transaction
                                                                        .status
                                                                ]
                                                            }
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {transaction.category}
                                                    </td>
                                                </>
                                            )}
                                            <td>
                                                {transaction.file_name ? (
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        <FileText /> View
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {transactions.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={isPayable ? 11 : 8}
                                            className="accounting-register-empty"
                                        >
                                            <Landmark />
                                            <strong>
                                                No {title.toLowerCase()}
                                            </strong>
                                            <span>
                                                {filters.search
                                                    ? 'Try a different search.'
                                                    : `Create a ${type} from a project ACT tab.`}
                                            </span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <footer>
                        <span>
                            Page {transactions.current_page} of{' '}
                            {transactions.last_page}
                        </span>
                        <div>
                            <button
                                type="button"
                                disabled={!transactions.prev_page_url}
                                onClick={() =>
                                    transactions.prev_page_url &&
                                    router.visit(transactions.prev_page_url, {
                                        preserveState: true,
                                        preserveScroll: true,
                                    })
                                }
                            >
                                <ChevronLeft /> Previous
                            </button>
                            <button
                                type="button"
                                disabled={!transactions.next_page_url}
                                onClick={() =>
                                    transactions.next_page_url &&
                                    router.visit(transactions.next_page_url, {
                                        preserveState: true,
                                        preserveScroll: true,
                                    })
                                }
                            >
                                Next <ChevronRight />
                            </button>
                        </div>
                    </footer>
                </section>
            </main>
        </>
    );
}
