import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    FileText,
    Eye,
    Landmark,
    Pencil,
    Plus,
    Search,
    Upload,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { crmDateKey } from '@/lib/crm-time';
import type { Auth } from '@/types/auth';
import '@/../css/accounting-register.css';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/searchable-select';

type RegisterType = 'receivable' | 'payable';

type AccountingRow = {
    id: number;
    project_id: number | null;
    company_id: number | null;
    project_invoice_id: number | null;
    project_document_id: number | null;
    contractor_id: number | null;
    vendor_id: number | null;
    project_number: string;
    company_prefix: string;
    customer: string;
    rep: string;
    address: string;
    transaction_date: string;
    reference_number: string | null;
    payment_method: 'check' | 'zelle' | 'credit_card' | 'wire_transfer' | 'square_transfer' | 'cash' | null;
    received_from: string | null;
    contractor: string | null;
    vendor: string | null;
    invoice_number: string | null;
    invoice_order_number: string | null;
    requested_by: string | null;
    amount: string;
    status: 'pending' | 'deposit' | 'ok_to_pay' | 'paid';
    qb: boolean;
    category: string;
    notes: string | null;
    file_name: string | null;
    file_mime: string | null;
    documents: Array<{ id: number; file_name: string; file_mime: string | null }>;
};

type PaginatedTransactions = {
    data: AccountingRow[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type ProjectOption = {
    id: number;
    project_number: string | null;
    lead: {
        customer_name: string;
        address: string;
        city: string;
        state: string;
        zip_code: string;
        company: { com_id: number; prefix: string } | null;
    } | null;
    documents: Array<{
        id: number;
        file_name: string;
        file_mime: string | null;
        category: string;
    }>;
};
type ContractorOption = { con_id: number; contractor: string };
type SalesmanOption = { salesman_id: number; salesman_name: string };
type VendorOption = { vendor_id: number; vendor: string };
type CompanyOption = { com_id: number; company: string; prefix: string };
type InvoiceOption = { id: number; project_id: number; contractor_id: number | null; vendor_id: number | null; contractor: string | null; vendor: string | null; invoice_number: string; balance: string | number };

const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const projectAddress = (project: ProjectOption) => project.lead
    ? [project.lead.address, project.lead.city, [project.lead.state, project.lead.zip_code].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : '';

const statusLabels = {
    pending: 'Pending',
    deposit: 'Deposit',
    ok_to_pay: 'OK 2 Pay',
    paid: 'Paid',
} as const;

const paymentPrefixes = {
    check: 'CH#',
    zelle: 'ZELLE',
    credit_card: 'CC-',
    wire_transfer: 'WIRE-',
    square_transfer: 'SQUARE-',
    cash: 'CASH-',
} as const;

const paymentLabels = {
    check: 'Check',
    zelle: 'Zelle',
    credit_card: 'Credit card',
    wire_transfer: 'Wire transfer',
    square_transfer: 'Square transfer',
    cash: 'Cash',
} as const;

const cashReferenceCode = () => `CASH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export default function AccountingRegister({
    type,
    transactions,
    filters,
    totalAmount,
    projects,
    companies,
    contractors,
    vendors,
    salesmen,
    invoices,
}: {
    type: RegisterType;
    transactions: PaginatedTransactions;
    filters: { search: string; invoice: number | null; show_all: boolean; salesman: number | null; contractor: number | null };
    totalAmount: string | number;
    projects: ProjectOption[];
    companies: CompanyOption[];
    contractors: ContractorOption[];
    vendors: VendorOption[];
    salesmen: SalesmanOption[];
    invoices: InvoiceOption[];
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const canGeneratePaymentCodes = auth.user.role === 'admin' || auth.permissions?.generate_payment_codes === 'edit';
    const sbhCompanyId = String(
        companies.find((company) => company.prefix.trim().toUpperCase() === 'SBH')?.com_id ?? '',
    );
    const [search, setSearch] = useState(filters.search);
    const [qbModalRow, setQbModalRow] = useState<AccountingRow | null>(null);
    const [qbPaymentMethod, setQbPaymentMethod] =
        useState<keyof typeof paymentPrefixes>('check');
    const [qbReferenceNumber, setQbReferenceNumber] = useState('CH#');
    const [qbError, setQbError] = useState('');
    const [qbDetailsOpen, setQbDetailsOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<AccountingRow | null>(null);
    const [attachmentRow, setAttachmentRow] = useState<AccountingRow | null>(null);
    const attachmentForm = useForm<{ files: File[]; target_type: 'accounting'; target_id: string }>({ files: [], target_type: 'accounting', target_id: '' });
    const [projectCustomerSearch, setProjectCustomerSearch] = useState('');
    const [projectAddressSearch, setProjectAddressSearch] = useState('');
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const [projectSearchField, setProjectSearchField] = useState<'customer' | 'address'>('customer');
    const [payRow, setPayRow] = useState<AccountingRow | null>(null);
    const [payMethod, setPayMethod] = useState<keyof typeof paymentPrefixes>('check');
    const [payTargetStatus, setPayTargetStatus] = useState<'paid' | 'deposit'>('paid');
    const [payReference, setPayReference] = useState('CH#');
    const [payError, setPayError] = useState('');
    const searchInput = useRef<HTMLInputElement>(null);
    const isPayable = type === 'payable';
    const title = isPayable ? 'Payables' : 'Receivables';
    const baseUrl = `/management/${title.toLowerCase()}`;
    const createForm = useForm({
        type,
        project_id: '',
        company_id: sbhCompanyId,
        project_invoice_id: '',
        project_document_id: '',
        contractor_id: '',
        vendor_id: '',
        transaction_date: crmDateKey(new Date()),
        amount: '',
        payment_method: type === 'receivable' ? 'check' : '',
        reference_number: '',
        invoice_order_number: '',
        status: type === 'receivable' ? 'deposit' : 'ok_to_pay',
        notes: '',
        payable_for: '',
        file: null as File | null,
    });

    const projectSuggestions = useMemo(() => {
        const query = (projectSearchField === 'customer' ? projectCustomerSearch : projectAddressSearch)
            .trim()
            .toLowerCase();

        return projects.filter((project) => {
            if (!project.lead) return false;
            if (!query) return true;

            return [project.lead.customer_name, projectAddress(project), project.project_number ?? '']
                .some((value) => value.toLowerCase().includes(query));
        }).slice(0, 8);
    }, [projectAddressSearch, projectCustomerSearch, projectSearchField, projects]);

    const selectedProjectInvoices = useMemo(
        () => createForm.data.project_id
            ? invoices.filter((invoice) => String(invoice.project_id) === createForm.data.project_id)
            : [],
        [createForm.data.project_id, invoices],
    );

    const selectProject = (project: ProjectOption) => {
        createForm.setData((data) => ({
            ...data,
            project_id: String(project.id),
            project_document_id: project.documents.some((document) => String(document.id) === data.project_document_id)
                ? data.project_document_id
                : '',
            project_invoice_id: data.project_invoice_id && invoices.some((invoice) =>
                String(invoice.id) === data.project_invoice_id && invoice.project_id === project.id)
                ? data.project_invoice_id
                : '',
        }));
        setProjectCustomerSearch(project.lead?.customer_name ?? '');
        setProjectAddressSearch(projectAddress(project));
        setShowProjectSuggestions(false);
    };

    const clearSelectedProject = (field: 'customer' | 'address', value: string) => {
        if (field === 'customer') setProjectCustomerSearch(value);
        else setProjectAddressSearch(value);
        createForm.setData((data) => ({ ...data, project_id: '', project_invoice_id: '', project_document_id: '' }));
        setProjectSearchField(field);
        setShowProjectSuggestions(true);
    };

    const selectInvoice = (invoiceId: string, payNow = false) => {
        const invoice = invoices.find((item) => String(item.id) === invoiceId);
        const project = invoice ? projects.find((item) => item.id === invoice.project_id) : null;
        createForm.setData((data) => ({
            ...data,
            project_invoice_id: invoiceId,
            project_id: invoice ? String(invoice.project_id) : data.project_id,
            contractor_id: invoice?.contractor_id ? String(invoice.contractor_id) : data.contractor_id,
            vendor_id: invoice?.vendor_id ? String(invoice.vendor_id) : data.vendor_id,
            payable_for: invoice?.vendor ?? data.payable_for,
            amount: invoice ? String(invoice.balance) : data.amount,
            status: payNow ? 'paid' : data.status,
            payment_method: payNow ? 'check' : data.payment_method,
            reference_number: payNow ? '' : data.reference_number,
        }));
        if (project) {
            setProjectCustomerSearch(project.lead?.customer_name ?? '');
            setProjectAddressSearch(projectAddress(project));
        }
    };

    useEffect(() => {
        if (isPayable && filters.invoice) {
            selectInvoice(String(filters.invoice), true);
            setCreateOpen(true);
        }
        // Open only from the server-provided invoice deep link.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateQb = (
        transaction: AccountingRow,
        qb: boolean,
        paymentMethod?: keyof typeof paymentPrefixes,
        referenceNumber?: string,
    ) => {
        router.patch(
            `/management/projects/${transaction.project_id}/accounting-transactions/${transaction.id}/qb`,
            {
                qb,
                payment_method: paymentMethod,
                reference_number: referenceNumber,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setQbModalRow(null);
                    setQbError('');
                },
                onError: (errors) =>
                    setQbError(
                        String(
                            errors.reference_number ||
                                errors.payment_method ||
                                errors.status ||
                                'Unable to move this receivable to QB.',
                        ),
                    ),
            },
        );
    };

    const requestQb = (transaction: AccountingRow, checked: boolean) => {
        if (!checked) {
            updateQb(transaction, false);
            return;
        }

        const method = transaction.payment_method ?? 'check';
        setQbPaymentMethod(method);
        setQbReferenceNumber(
            transaction.reference_number ||
                (method === 'zelle' ? '' : paymentPrefixes[method]),
        );
        setQbError('');
        setQbDetailsOpen(false);
        setQbModalRow(transaction);
    };

    const visit = (
        value: string,
        showAll = filters.show_all,
        salesman = filters.salesman,
        contractor = filters.contractor,
    ) => {
        router.get(
            baseUrl,
            {
                search: value || undefined,
                show_all: showAll ? 1 : undefined,
                salesman: salesman || undefined,
                contractor: contractor || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const updateStatus = (
        transaction: AccountingRow,
        status: AccountingRow['status'],
    ) => {
        router.patch(
            `/management/accounting-transactions/${transaction.id}/status`,
            { status },
            {
                preserveScroll: true,
                onError: (errors) =>
                    window.alert(
                        String(
                            errors.status ?? 'The status could not be updated.',
                        ),
                    ),
            },
        );
    };

    const requestStatus = (transaction: AccountingRow, status: AccountingRow['status']) => {
        if ((isPayable && status === 'paid') || (!isPayable && status === 'deposit')) {
            const method = transaction.payment_method ?? 'check';
            setPayTargetStatus(status as 'paid' | 'deposit');
            setPayMethod(method);
            setPayReference(transaction.reference_number || '');
            setPayError('');
            setPayRow(transaction);
            return;
        }
        updateStatus(transaction, status);
    };

    const submitCreate = (event: React.FormEvent) => {
        event.preventDefault();
        createForm.post(editingRow
            ? `/management/accounting-transactions/${editingRow.id}`
            : '/management/accounting-transactions', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setCreateOpen(false);
                setEditingRow(null);
                createForm.reset();
                setProjectCustomerSearch('');
                setProjectAddressSearch('');
            },
        });
    };

    const openCreate = () => {
        createForm.reset();
        createForm.setData('company_id', sbhCompanyId);
        createForm.clearErrors();
        setEditingRow(null);
        setProjectCustomerSearch('');
        setProjectAddressSearch('');
        setShowProjectSuggestions(false);
        setCreateOpen(true);
    };

    const openEdit = (transaction: AccountingRow) => {
        const project = projects.find((item) => item.id === transaction.project_id);
        createForm.setData({
            type,
            project_id: transaction.project_id ? String(transaction.project_id) : '',
            company_id: transaction.company_id ? String(transaction.company_id) : sbhCompanyId,
            project_invoice_id: transaction.project_invoice_id ? String(transaction.project_invoice_id) : '',
            project_document_id: transaction.project_document_id ? String(transaction.project_document_id) : '',
            contractor_id: transaction.contractor_id ? String(transaction.contractor_id) : '',
            vendor_id: transaction.vendor_id ? String(transaction.vendor_id) : '',
            transaction_date: transaction.transaction_date.slice(0, 10),
            amount: transaction.amount,
            payment_method: transaction.payment_method ?? 'check',
            reference_number: transaction.reference_number ?? '',
            invoice_order_number: transaction.invoice_order_number ?? '',
            status: transaction.status,
            notes: transaction.notes ?? '',
            payable_for: transaction.contractor_id || transaction.vendor_id ? '' : transaction.category,
            file: null,
        });
        createForm.clearErrors();
        setProjectCustomerSearch(project?.lead?.customer_name ?? transaction.customer ?? '');
        setProjectAddressSearch(project ? projectAddress(project) : '');
        setShowProjectSuggestions(false);
        setEditingRow(transaction);
        setCreateOpen(true);
    };

    const removeRow = (transaction: AccountingRow) => {
        if (!window.confirm(`Delete this ${type}? This action cannot be undone.`)) return;
        router.delete(`/management/accounting-transactions/${transaction.id}`, { preserveScroll: true });
    };

    const removeAttachedFile = (url: string, fileName: string) => {
        if (!window.confirm(`Remove ${fileName} from the CRM and Google Drive?`)) return;
        router.delete(url, {
            preserveScroll: true,
            onSuccess: () => setAttachmentRow(null),
        });
    };

    const submitPayment = () => {
        if (!payRow) return;
        router.patch(`/management/accounting-transactions/${payRow.id}/status`, {
            status: payTargetStatus, payment_method: payMethod, reference_number: payReference,
        }, {
            preserveScroll: true,
            onSuccess: () => setPayRow(null),
            onError: (errors) => setPayError(String(errors.reference_number || errors.payment_method || errors.status || 'Unable to record payment.')),
        });
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
                            Project-linked and unassigned {title.toLowerCase()}.
                        </p>
                    </div>
                    <div className="accounting-register-header-actions">
                        <button
                            className={`accounting-register-show-all ${filters.show_all ? 'is-active' : ''}`}
                            type="button"
                            onClick={() => visit(search, !filters.show_all)}
                        >
                            {filters.show_all
                                ? `Hide ${isPayable ? 'paid payables' : 'QB receivables'}`
                                : `See all ${title.toLowerCase()}`}
                        </button>
                        <nav className="accounting-register-tabs">
                            <a className={!isPayable ? 'is-active' : ''} href="/management/receivables">Receivables</a>
                            <a className={isPayable ? 'is-active' : ''} href="/management/payables">Payables</a>
                            <a href="/management/invoices">Invoices</a>
                        </nav>
                        <div className="accounting-register-summary">
                            <Landmark />
                            <div>
                                <strong>{currency.format(Number(totalAmount))}</strong>
                                <span>{transactions.total.toLocaleString()} {title.toLowerCase()}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <nav className="accounting-register-navigation">
                    <a href="/management/projects">
                        <ArrowLeft /> Back to Projects
                    </a>
                </nav>

                <section className="accounting-register-panel">
                    <header>
                        <div>
                            <h2>All {title}</h2>
                            <span>Manage every {type}, including unassigned records.</span>
                        </div>
                        <div className="accounting-register-filters">
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
                        <SearchableSelect
                            value={filters.salesman ? String(filters.salesman) : ''}
                            onChange={(value) => visit(search.trim(), filters.show_all, value ? Number(value) : null, filters.contractor)}
                            placeholder="All salesmen"
                            searchPlaceholder="Search salesmen…"
                            options={[{ value: '', label: 'All salesmen' }, ...salesmen.map((salesman) => ({ value: String(salesman.salesman_id), label: salesman.salesman_name }))]}
                        />
                        <SearchableSelect
                            value={filters.contractor ? String(filters.contractor) : ''}
                            onChange={(value) => visit(search.trim(), filters.show_all, filters.salesman, value ? Number(value) : null)}
                            placeholder="All contractors"
                            searchPlaceholder="Search contractors…"
                            options={[{ value: '', label: 'All contractors' }, ...contractors.map((contractor) => ({ value: String(contractor.con_id), label: contractor.contractor }))]}
                        />
                        </div>
                        <button className="accounting-register-add" type="button" onClick={openCreate}>
                            <Plus /> {isPayable ? 'Add Payable' : 'Add Receivable'}
                        </button>
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
                                        <th>Rep</th>
                                        <th>Pay To</th>
                                        <th>Pay For (Invoice)</th>
                                        <th>Payment Method</th>
                                        <th>Req. By</th>
                                        <th>Status</th>
                                        <th>$ Amount To Pay</th>
                                        <th>Check #</th>
                                        <th>Category</th>
                                        <th>Notes</th>
                                        <th>File</th>
                                        <th>Payment</th>
                                        <th>Actions</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Date</th>
                                        <th>Reference #</th>
                                        <th>Received From</th>
                                        <th>Project #</th>
                                        <th>Rep</th>
                                        <th>Notes</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>QB</th>
                                        <th>Category</th>
                                        <th>File</th>
                                        <th>Actions</th>
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
                                                        <a
                                                            className="accounting-register-project-link"
                                                            href={
                                                                transaction.project_id
                                                                    ? `/management/projects?project=${transaction.project_id}&tab=INV`
                                                                    : undefined
                                                            }
                                                        >
                                                            {
                                                                transaction.project_number
                                                            }
                                                        </a>
                                                    </td>
                                                    <td>{transaction.rep}</td>
                                                    <td>
                                                        {transaction.contractor ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        {transaction.invoice_order_number ||
                                                            transaction.invoice_number ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        {transaction.payment_method
                                                            ? paymentLabels[transaction.payment_method]
                                                            : '—'}
                                                    </td>
                                                    <td>
                                                        {transaction.requested_by ||
                                                            '—'}
                                                    </td>
                                                    <td>
                                                        <select
                                                            className={`accounting-register-status is-${transaction.status}`}
                                                            value={transaction.status}
                                                            onChange={(event) =>
                                                                requestStatus(
                                                                    transaction,
                                                                    event.target.value as AccountingRow['status'],
                                                                )
                                                            }
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="ok_to_pay">OK 2 Pay</option>
                                                            <option value="paid">Paid</option>
                                                        </select>
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
                                                        <button className="accounting-register-attachment-trigger" type="button" onClick={() => { attachmentForm.setData({ files: [], target_type: 'accounting', target_id: String(transaction.id) }); attachmentForm.clearErrors(); setAttachmentRow(transaction); }}>
                                                            {transaction.reference_number || 'Add file'}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        {transaction.category}
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
                                                        <button className="accounting-register-attachment-trigger" type="button" onClick={() => { attachmentForm.setData({ files: [], target_type: 'accounting', target_id: String(transaction.id) }); attachmentForm.clearErrors(); setAttachmentRow(transaction); }}>
                                                            {transaction.reference_number || 'Add file'}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        {transaction.received_from ||
                                                            transaction.customer}
                                                    </td>
                                                    <td>
                                                        <a
                                                            className="accounting-register-project-link"
                                                            href={
                                                                transaction.project_id
                                                                    ? `/management/projects?project=${transaction.project_id}&tab=INV`
                                                                    : undefined
                                                            }
                                                        >
                                                            {transaction.project_number}
                                                        </a>
                                                    </td>
                                                    <td>{transaction.rep}</td>
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
                                                        <select
                                                            className={`accounting-register-status is-${transaction.status}`}
                                                            value={transaction.status}
                                                            onChange={(event) =>
                                                                updateStatus(
                                                                    transaction,
                                                                    event.target.value as AccountingRow['status'],
                                                                )
                                                            }
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="deposit">Deposit</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="accounting-register-qb"
                                                            type="checkbox"
                                                            aria-label={`Move ${transaction.customer} receivable to QB`}
                                                            checked={transaction.qb}
                                                            onChange={(event) =>
                                                                requestQb(
                                                                    transaction,
                                                                    event.target.checked,
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        {transaction.category}
                                                    </td>
                                                </>
                                            )}
                                            <td>
                                                <div className="accounting-register-file-actions">{transaction.file_name ? (
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        <FileText /> View
                                                    </a>
                                                ) : ('—')}{transaction.project_id && <button type="button" onClick={() => { attachmentForm.setData({ files: [], target_type: 'accounting', target_id: String(transaction.id) }); attachmentForm.clearErrors(); setAttachmentRow(transaction); }}><Upload /> Add files</button>}</div>
                                            </td>
                                            {isPayable && <td>
                                                {transaction.status !== 'paid' ? (
                                                    <button className="accounting-register-pay" type="button" onClick={() => requestStatus(transaction, 'paid')}>Pay</button>
                                                ) : <span>Paid</span>}
                                            </td>}
                                            <td>
                                                <div className="accounting-register-row-actions">
                                                    <button type="button" onClick={() => openEdit(transaction)}><Pencil /> Edit</button>
                                                    <button className="is-danger" type="button" onClick={() => removeRow(transaction)}><Trash2 /> Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {transactions.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={isPayable ? 16 : 12}
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

                <Dialog open={createOpen} onOpenChange={(open) => { if (!createForm.processing) { setCreateOpen(open); if (!open) setEditingRow(null); } }}>
                    <DialogContent className="accounting-register-transaction-modal">
                        <form onSubmit={submitCreate}>
                            <DialogHeader>
                                <DialogTitle>{editingRow ? `Edit ${isPayable ? 'Payable' : 'Receivable'}` : (isPayable ? 'New Payable' : 'New Receivable')}</DialogTitle>
                                <DialogDescription>{isPayable ? 'Record a project payable. Linking a vendor payment is optional.' : 'Record a project receivable. Linking a scheduled payment is optional.'}</DialogDescription>
                            </DialogHeader>
                            <label className="accounting-register-unassigned">
                                <input type="checkbox" checked={!createForm.data.project_id} onChange={(event) => { if (event.target.checked) { createForm.setData((data) => ({ ...data, project_id: '', project_invoice_id: '', project_document_id: '', contractor_id: '', vendor_id: '' })); setProjectCustomerSearch(''); setProjectAddressSearch(''); } else { setProjectSearchField('customer'); setShowProjectSuggestions(true); } }} />
                                <span><strong>Unassigned / not related to a project</strong><small>Save this record in the global receivables or payables register without connecting it to a project.</small></span>
                            </label>
                            <div className="accounting-register-form-top">
                                {isPayable && <label><span>Invoice / order number</span><input maxLength={100} placeholder="Enter invoice or order number" value={createForm.data.invoice_order_number} onChange={(e) => createForm.setData('invoice_order_number', e.target.value)} /></label>}
                                <label><span>Date *</span><input required type="date" value={createForm.data.transaction_date} onChange={(e) => createForm.setData('transaction_date', e.target.value)} /></label>
                                <label><span>Payment method *</span><select required value={createForm.data.payment_method || 'check'} onChange={(e) => { const method = e.target.value as keyof typeof paymentPrefixes; createForm.setData((data) => ({...data, payment_method: method, reference_number: paymentPrefixes[method]})); }}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                <label><span>Reference # (optional)</span><div className="accounting-register-reference"><strong>{paymentPrefixes[(createForm.data.payment_method || 'check') as keyof typeof paymentPrefixes]}</strong><input value={createForm.data.reference_number.replace(paymentPrefixes[(createForm.data.payment_method || 'check') as keyof typeof paymentPrefixes], '')} placeholder="Reference number" onChange={(e) => { const method = (createForm.data.payment_method || 'check') as keyof typeof paymentPrefixes; createForm.setData((data) => ({ ...data, reference_number: `${paymentPrefixes[method]}${e.target.value}`, status: isPayable && e.target.value.trim() ? 'paid' : data.status })); }} /></div>{createForm.data.payment_method === 'cash' && canGeneratePaymentCodes && <button className="accounting-generate-code" type="button" onClick={() => createForm.setData((data) => ({ ...data, reference_number: cashReferenceCode(), status: isPayable ? 'paid' : data.status }))}>Generate code</button>}</label>
                                <label><span>Amount *</span><div className="accounting-register-amount"><strong>$</strong><input required min="0.01" step="0.01" type="number" placeholder="0.00" value={createForm.data.amount} onChange={(e) => createForm.setData('amount', e.target.value)} /></div></label>
                                <label><span>Status</span><select value={createForm.data.status} onChange={(e) => createForm.setData('status', e.target.value)}>{isPayable ? <><option value="pending">Pending</option><option value="ok_to_pay">OK 2 Pay</option><option value="paid">Paid</option></> : <><option value="pending">Pending</option><option value="deposit">Deposit</option></>}</select></label>
                            </div>
                            <div className="accounting-register-form-body">
                              <section>
                                <header><strong>{isPayable ? 'Vendor payment' : 'Project & customer'}</strong><small>Optionally connect this record to an existing project{isPayable ? ' and invoice' : ''}.</small></header>
                                <div className="accounting-register-form-grid">
                                {isPayable && <label className="is-wide"><span>Company</span><SearchableSelect value={createForm.data.company_id} onChange={(value) => createForm.setData('company_id', value)} searchPlaceholder="Search companies…" options={[{ value: '', label: 'No company selected' }, ...companies.map((company) => ({ value: String(company.com_id), label: `${company.company} (${company.prefix})` }))]} /></label>}
                                <div className="accounting-project-picker is-wide">
                                    <label><span>Customer name</span><input autoComplete="off" placeholder="Start typing a project customer…" value={projectCustomerSearch} onFocus={() => { setProjectSearchField('customer'); setShowProjectSuggestions(true); }} onBlur={() => setShowProjectSuggestions(false)} onChange={(e) => clearSelectedProject('customer', e.target.value)} /></label>
                                    <label><span>Project address</span><input autoComplete="off" placeholder="Start typing a project address…" value={projectAddressSearch} onFocus={() => { setProjectSearchField('address'); setShowProjectSuggestions(true); }} onBlur={() => setShowProjectSuggestions(false)} onChange={(e) => clearSelectedProject('address', e.target.value)} /></label>
                                    {showProjectSuggestions && <div className="accounting-project-suggestions">{projectSuggestions.map((project) => <button type="button" key={project.id} onMouseDown={(event) => { event.preventDefault(); selectProject(project); }}><strong>{project.lead?.customer_name}</strong><span>{projectAddress(project)}</span><small>{project.project_number || 'Project number not assigned'}</small></button>)}{projectSuggestions.length === 0 && <p>No project customers or addresses match.</p>}</div>}
                                    {(projectCustomerSearch || projectAddressSearch) && !createForm.data.project_id && <small>Select a suggestion to link this record to its project.</small>}
                                </div>
                                <label><span>Project (optional)</span><SearchableSelect value={createForm.data.project_id} onChange={(value) => { const project = projects.find((item) => String(item.id) === value); if (project) selectProject(project); else { createForm.setData((data) => ({...data, project_id: '', project_invoice_id: '', project_document_id: ''})); setProjectCustomerSearch(''); setProjectAddressSearch(''); } }} searchPlaceholder="Search project or customer…" options={[{ value: '', label: 'Unassigned / not project related' }, ...projects.map((project) => ({ value: String(project.id), label: `${project.project_number || 'Not assigned'} - ${project.lead?.customer_name || 'Standalone project'}`, keywords: projectAddress(project) }))]} /></label>
                                <label className="is-wide"><span>Use existing project file (optional)</span><SearchableSelect disabled={!createForm.data.project_id} value={createForm.data.project_document_id} onChange={(value) => createForm.setData('project_document_id', value)} searchPlaceholder="Search project files…" options={[{ value: '', label: !createForm.data.project_id ? 'Select a project first' : 'No existing file selected' }, ...(projects.find((project) => String(project.id) === createForm.data.project_id)?.documents ?? []).map((document) => ({ value: String(document.id), label: `${document.file_name} (${document.category})` }))]} /><small>Files uploaded by the salesman in My Sold are available here.</small></label>
                                {isPayable && <label><span>Invoice for selected project (optional)</span><SearchableSelect disabled={!createForm.data.project_id} value={createForm.data.project_invoice_id} onChange={selectInvoice} searchPlaceholder="Search invoice numbers…" options={[{ value: '', label: !createForm.data.project_id ? 'Select a project customer first' : selectedProjectInvoices.length === 0 ? 'No unpaid invoices for this project' : 'Choose an invoice' }, ...selectedProjectInvoices.map((invoice) => ({ value: String(invoice.id), label: `${invoice.invoice_number} - Balance ${currency.format(Number(invoice.balance))}` }))]} />{createForm.data.project_id && selectedProjectInvoices.length > 0 && <small>Selecting an invoice fills its remaining balance and contractor.</small>}</label>}
                                {isPayable && <label><span>Contractor or vendor (optional)</span><SearchableSelect value={createForm.data.contractor_id ? `contractor:${createForm.data.contractor_id}` : createForm.data.vendor_id ? `vendor:${createForm.data.vendor_id}` : ''} onChange={(value) => createForm.setData((data) => ({ ...data, contractor_id: value.startsWith('contractor:') ? value.slice(11) : '', vendor_id: value.startsWith('vendor:') ? value.slice(7) : '', project_invoice_id: '' }))} searchPlaceholder="Search contractors or vendors…" options={[{ value: '', label: 'No contractor or vendor' }, ...contractors.map((contractor) => ({ value: `contractor:${contractor.con_id}`, label: `Contractor — ${contractor.contractor}` })), ...vendors.map((vendor) => ({ value: `vendor:${vendor.vendor_id}`, label: `Vendor — ${vendor.vendor}` }))]} /></label>}
                                {isPayable && !createForm.data.contractor_id && !createForm.data.vendor_id && <label className="is-wide"><span>What is this payable for? *</span><input required placeholder="Example: Vendor payment, office rent, utilities, supplies..." value={createForm.data.payable_for} onChange={(e) => createForm.setData('payable_for', e.target.value)} /></label>}
                                </div>
                              </section>
                              <section>
                                <header><strong>Transaction details</strong><small>Add an attachment and optional notes.</small></header>
                                <div className="accounting-register-details">
                                  <label><span>{isPayable ? 'Paid to' : 'Received from'}</span><input readOnly value={isPayable ? (contractors.find((item) => String(item.con_id) === createForm.data.contractor_id)?.contractor || vendors.find((item) => String(item.vendor_id) === createForm.data.vendor_id)?.vendor || createForm.data.payable_for) : projectCustomerSearch} /></label>
                                  <label><span>Attachment</span><span className="accounting-register-create-upload"><Upload /><strong>{createForm.data.file?.name || 'Drop PDF or image here'}</strong><small>or click to browse</small><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(event) => createForm.setData('file', event.target.files?.[0] ?? null)} /></span></label>
                                  <label><span>Notes</span><textarea rows={5} placeholder="Accounting notes..." value={createForm.data.notes} onChange={(e) => createForm.setData('notes', e.target.value)} /></label>
                                </div>
                              </section>
                            </div>
                            {Object.keys(createForm.errors).length > 0 && <small>{Object.values(createForm.errors)[0]}</small>}
                            <DialogFooter className="accounting-register-modal-actions"><button className="is-secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="is-primary" type="submit" disabled={createForm.processing}>{createForm.processing ? 'Saving...' : isPayable && createForm.data.status === 'paid' ? 'Pay & save' : 'Save'}</button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={attachmentRow !== null} onOpenChange={(open) => !open && !attachmentForm.processing && setAttachmentRow(null)}>
                    {attachmentRow && <DialogContent className="accounting-register-qb-modal"><form onSubmit={(event) => {
                        event.preventDefault();
                        if (!attachmentRow.project_id) return;
                        attachmentForm.post(`/management/projects/${attachmentRow.project_id}/documents`, { forceFormData: true, preserveScroll: true, onSuccess: () => { setAttachmentRow(null); attachmentForm.reset(); } });
                    }}>
                        <DialogHeader><DialogTitle>{attachmentRow.reference_number || `Files for this ${attachmentRow.type}`}</DialogTitle><DialogDescription>View existing attachments or add PDFs, images, and photos. New files also appear in the project DOC tab and Google Drive.</DialogDescription></DialogHeader>
                        <div className="accounting-register-attachment-list">
                            {attachmentRow.file_name && <div className="accounting-attachment-row"><a href={`/management/projects/${attachmentRow.project_id}/accounting-transactions/${attachmentRow.id}/file`} target="_blank" rel="noreferrer"><FileText /><span>{attachmentRow.file_name}</span><strong>View</strong></a><button type="button" onClick={() => removeAttachedFile(`/management/accounting-transactions/${attachmentRow.id}/file`, attachmentRow.file_name!)}><Trash2 /> Remove</button></div>}
                            {attachmentRow.documents.map((document) => <div className="accounting-attachment-row" key={document.id}><a href={`/management/projects/${attachmentRow.project_id}/documents/${document.id}/file`} target="_blank" rel="noreferrer"><FileText /><span>{document.file_name}</span><strong>View</strong></a><button type="button" onClick={() => removeAttachedFile(`/management/projects/${attachmentRow.project_id}/documents/${document.id}`, document.file_name)}><Trash2 /> Remove</button></div>)}
                            {!attachmentRow.file_name && attachmentRow.documents.length === 0 && <p>No files attached yet.</p>}
                        </div>
                        <label className="accounting-register-multi-upload"><Upload /><strong>{attachmentForm.data.files.length ? `${attachmentForm.data.files.length} files selected` : 'Choose files or photos'}</strong><input type="file" multiple accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,.heic,.heif" onChange={(event) => attachmentForm.setData('files', Array.from(event.target.files ?? []))} /></label>
                        {Object.entries(attachmentForm.errors).map(([key, message]) => <small key={key}>{message}</small>)}
                        <DialogFooter className="accounting-register-modal-actions"><button className="is-secondary" type="button" onClick={() => setAttachmentRow(null)}>Cancel</button><button className="is-primary" type="submit" disabled={attachmentForm.processing || attachmentForm.data.files.length === 0}>{attachmentForm.processing ? 'Uploading…' : 'Upload files'}</button></DialogFooter>
                    </form></DialogContent>}
                </Dialog>

                <Dialog open={payRow !== null} onOpenChange={(open) => !open && setPayRow(null)}>
                    <DialogContent className="accounting-register-qb-modal">
                        <DialogHeader><DialogTitle>{payTargetStatus === 'paid' ? 'Record payment' : 'Record deposit'}</DialogTitle><DialogDescription>Select a payment method. The check/reference number is optional.</DialogDescription></DialogHeader>
                        <label><span>Payment method</span><select value={payMethod} onChange={(e) => { const method = e.target.value as keyof typeof paymentPrefixes; setPayMethod(method); setPayReference(''); }}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label><span>Check / reference number (optional)</span><input value={payReference} onChange={(e) => setPayReference(e.target.value)} /></label>
                        {payError && <small>{payError}</small>}
                        <DialogFooter className="accounting-register-modal-actions"><button className="is-secondary" type="button" onClick={() => setPayRow(null)}>Cancel</button><button className="is-primary" type="button" onClick={submitPayment}>{payTargetStatus === 'paid' ? 'Record payment' : 'Record deposit'}</button></DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={qbModalRow !== null}
                    onOpenChange={(open) => !open && setQbModalRow(null)}
                >
                    <DialogContent className="accounting-register-qb-modal">
                        <DialogHeader>
                            <DialogTitle>Confirm move to QB</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to mark this receivable as QB? Review the payment details before confirming.
                            </DialogDescription>
                        </DialogHeader>
                        {qbModalRow && <div className="accounting-register-qb-summary"><span>Received from</span><strong>{qbModalRow.received_from || qbModalRow.customer}</strong><span>Amount</span><strong>{currency.format(Number(qbModalRow.amount))}</strong></div>}
                        {qbModalRow && qbDetailsOpen && <div className="accounting-register-qb-details">
                            <div><span>Project</span><strong>{qbModalRow.project_number || 'Unassigned'}</strong></div>
                            <div><span>Address</span><strong>{qbModalRow.address || '—'}</strong></div>
                            <div><span>Date</span><strong>{date.format(new Date(`${qbModalRow.transaction_date}T12:00:00`))}</strong></div>
                            <div><span>Category</span><strong>{qbModalRow.category}</strong></div>
                            <div><span>Status</span><strong>{statusLabels[qbModalRow.status]}</strong></div>
                            <div><span>Reference</span><strong>{qbModalRow.reference_number || '—'}</strong></div>
                            <div className="is-wide"><span>Notes</span><strong>{qbModalRow.notes || 'No notes'}</strong></div>
                            <div className="is-wide"><span>Attachments</span><strong>{qbModalRow.file_name || qbModalRow.documents.length ? `${(qbModalRow.file_name ? 1 : 0) + qbModalRow.documents.length} file(s) attached` : 'No files attached'}</strong></div>
                        </div>}
                        <label>
                            <span>Payment method</span>
                            <select
                                value={qbPaymentMethod}
                                onChange={(event) => {
                                    const method = event.target.value as keyof typeof paymentPrefixes;
                                    setQbPaymentMethod(method);
                                    setQbReferenceNumber(method === 'zelle' ? '' : paymentPrefixes[method]);
                                }}
                            >
                                {Object.entries(paymentLabels).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Check / reference number (optional)</span>
                            <div className="accounting-register-qb-reference">
                                {qbPaymentMethod !== 'zelle' && <strong>{paymentPrefixes[qbPaymentMethod]}</strong>}
                                <input
                                    autoFocus
                                    disabled={qbPaymentMethod === 'zelle'}
                                    value={qbReferenceNumber.slice(paymentPrefixes[qbPaymentMethod].length)}
                                    onChange={(event) =>
                                        setQbReferenceNumber(
                                            `${paymentPrefixes[qbPaymentMethod]}${event.target.value}`,
                                        )
                                    }
                                />
                            </div>
                        </label>
                        {qbError && <small>{qbError}</small>}
                        <DialogFooter className="accounting-register-modal-actions">
                            <button className="is-secondary" type="button" onClick={() => setQbModalRow(null)}>Cancel</button>
                            <button className="is-secondary" type="button" onClick={() => setQbDetailsOpen((open) => !open)}><Eye /> {qbDetailsOpen ? 'Hide details' : 'View details'}</button>
                            <button
                                className="is-primary"
                                type="button"
                                onClick={() =>
                                    qbModalRow &&
                                    updateQb(
                                        qbModalRow,
                                        true,
                                        qbPaymentMethod,
                                        qbPaymentMethod === 'zelle' ? '' : qbReferenceNumber,
                                    )
                                }
                            >
                                Yes, move to QB
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </>
    );
}
