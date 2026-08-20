import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    FileText,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import '@/../css/vendor-invoices.css';
import { useSystemModal } from '@/components/system-modal-provider';
import { crmDateKey } from '@/lib/crm-time';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Contractor = { con_id: number; contractor: string };
type Vendor = { vendor_id: number; vendor: string };

type ProjectOption = {
    id: number;
    project_number: string | null;
    customer_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    lead: {
        customer_name: string;
        address: string;
        city: string;
        state: string;
        zip_code: string;
        company: { prefix: string } | null;
    } | null;
    documents: Array<{
        id: number;
        file_name: string;
        file_mime: string | null;
        category: string;
    }>;
};

type VendorInvoice = {
    id: number;
    project_id: number;
    project_number: string;
    company_prefix: string;
    customer: string;
    rep: string;
    contractor: Contractor | null;
    vendor: Vendor | null;
    invoice_number: string;
    invoice_date: string | null;
    amount: string;
    balance: string;
    notes: string | null;
    status: 'pending' | 'ok_to_pay' | 'paid';
    file_name: string | null;
    file_mime: string | null;
    documents: Array<{ id: number; file_name: string; file_mime: string | null }>;
};

type PaginatedInvoices = {
    data: VendorInvoice[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

const emptyInvoices: PaginatedInvoices = {
    data: [],
    current_page: 1,
    last_page: 1,
    total: 0,
    prev_page_url: null,
    next_page_url: null,
};

const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
});

const formatInvoiceDate = (value: string | null | undefined) => {
    if (!value) return '—';

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

const statusLabels: Record<VendorInvoice['status'], string> = {
    pending: 'Pending',
    ok_to_pay: 'OK 2 Pay',
    paid: 'Paid',
};

const withInvoicePrefix = (value: string) => {
    const suffix = value.replace(/^INV[#-]?/i, '').replace(/\s+/g, '');

    return `INV#${suffix}`;
};

const invoiceSuffix = (value: string) => withInvoicePrefix(value).slice(4);

const projectNumber = (project: ProjectOption) =>
    project.project_number || 'Not assigned';

const projectCustomer = (project: ProjectOption) =>
    project.lead?.customer_name || project.customer_name || 'Unnamed project';

const projectAddress = (project: ProjectOption) =>
    [
        project.lead?.address || project.address,
        project.lead?.city || project.city,
        project.lead?.state || project.state,
        project.lead?.zip_code || project.zip_code,
    ].filter(Boolean).join(', ') || 'No address';

export default function VendorInvoices({
    invoices = emptyInvoices,
    filters = { search: '', show_all: false },
    totalInvoices = 0,
    totalAmount = 0,
    totalBalance = 0,
    outstandingInvoiceCount = 0,
    projects = [],
    contractors = [],
    vendors = [],
}: {
    invoices: PaginatedInvoices;
    filters: { search: string; show_all: boolean };
    totalInvoices: number;
    totalAmount: string | number;
    totalBalance: string | number;
    outstandingInvoiceCount: number;
    projects: ProjectOption[];
    contractors: Contractor[];
    vendors: Vendor[];
}) {
    const { confirm } = useSystemModal();
    const searchInput = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState(filters.search);
    const [modal, setModal] = useState<{
        mode: 'create' | 'edit';
        invoice: VendorInvoice | null;
    } | null>(null);
    const [actionInvoice, setActionInvoice] =
        useState<VendorInvoice | null>(null);
    const [attachmentInvoice, setAttachmentInvoice] = useState<VendorInvoice | null>(null);
    const attachmentForm = useForm<{ files: File[]; target_type: 'invoice'; target_id: string }>({ files: [], target_type: 'invoice', target_id: '' });
    const [preview, setPreview] = useState<{
        url: string;
        mime: string;
    } | null>(null);
    const [projectAddressSearch, setProjectAddressSearch] = useState('');
    const [projectCustomerSearch, setProjectCustomerSearch] = useState('');
    const [projectSearchField, setProjectSearchField] = useState<'customer' | 'address'>('customer');
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const form = useForm<{
        project_id: string;
        invoice_number: string;
        invoice_date: string;
        contractor_id: string;
        vendor_id: string;
        amount: string;
        notes: string;
        file: File | null;
        project_document_id: string;
    }>({
        project_id: '',
        invoice_number: 'INV#',
        invoice_date: '',
        contractor_id: '',
        vendor_id: '',
        amount: '',
        notes: '',
        file: null,
        project_document_id: '',
    });

    const selectedProject = projects.find(
        (project) => project.id === Number(form.data.project_id),
    );
    const projectSuggestions = useMemo(() => {
        const query = (projectSearchField === 'customer' ? projectCustomerSearch : projectAddressSearch)
            .trim()
            .toLowerCase();

        return projects
            .filter((project) => {
                if (!query) {
                    return true;
                }

                return [
                    projectAddress(project),
                    projectNumber(project),
                    projectCustomer(project),
                ].some((value) => value.toLowerCase().includes(query));
            })
            .slice(0, 8);
    }, [projectAddressSearch, projectCustomerSearch, projectSearchField, projects]);

    const fileUrl = (invoice: VendorInvoice) =>
        `/management/projects/${invoice.project_id}/invoices/${invoice.id}/file`;

    const runSearch = (value: string) => {
        router.get(
            '/management/invoices',
            { search: value || undefined },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const openNew = () => {
        form.setData({
            project_id: '',
            invoice_number: 'INV#',
            invoice_date: crmDateKey(),
            contractor_id: '',
            vendor_id: '',
            amount: '',
            notes: '',
            file: null,
            project_document_id: '',
        });
        form.clearErrors();
        setProjectAddressSearch('');
        setProjectCustomerSearch('');
        setShowProjectSuggestions(false);
        setPreview(null);
        setModal({ mode: 'create', invoice: null });
    };

    const openEdit = (invoice: VendorInvoice) => {
        form.setData({
            project_id: String(invoice.project_id),
            invoice_number: withInvoicePrefix(invoice.invoice_number),
            invoice_date: invoice.invoice_date?.slice(0, 10) ?? crmDateKey(),
            contractor_id: invoice.contractor
                ? String(invoice.contractor.con_id)
                : '',
            vendor_id: invoice.vendor ? String(invoice.vendor.vendor_id) : '',
            amount: invoice.amount,
            notes: invoice.notes ?? '',
            file: null,
            project_document_id: '',
        });
        form.clearErrors();
        const invoiceProject = projects.find(
            (project) => project.id === invoice.project_id,
        );
        setProjectAddressSearch(
            invoiceProject ? projectAddress(invoiceProject) : '',
        );
        setProjectCustomerSearch(invoiceProject ? projectCustomer(invoiceProject) : '');
        setShowProjectSuggestions(false);
        setPreview(
            invoice.file_name && invoice.file_mime
                ? { url: fileUrl(invoice), mime: invoice.file_mime }
                : null,
        );
        setModal({ mode: 'edit', invoice });
    };

    const chooseFile = (file: File | null) => {
        form.setData((data) => ({ ...data, file, project_document_id: file ? '' : data.project_document_id }));
        setPreview(
            file ? { url: URL.createObjectURL(file), mime: file.type } : null,
        );
    };

    const selectProjectAddress = (project: ProjectOption) => {
        form.setData((data) => ({ ...data, project_id: String(project.id), project_document_id: '' }));
        setProjectAddressSearch(projectAddress(project));
        setProjectCustomerSearch(projectCustomer(project));
        setShowProjectSuggestions(false);
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!modal || !form.data.project_id) {
            return;
        }

        const url =
            modal.mode === 'edit' && modal.invoice
                ? `/management/projects/${modal.invoice.project_id}/invoices/${modal.invoice.id}`
                : `/management/projects/${form.data.project_id}/invoices`;

        form.post(url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setModal(null);
                setPreview(null);
                form.reset();
                router.flushAll();
            },
        });
    };

    const remove = async (invoice: VendorInvoice) => {
        const accepted = await confirm({
            title: 'Delete vendor payment?',
            message: `${invoice.invoice_number} and its attached file will be permanently deleted.`,
            confirmLabel: 'Delete invoice',
            tone: 'danger',
        });

        if (accepted) {
            router.delete(
                `/management/projects/${invoice.project_id}/invoices/${invoice.id}`,
                { preserveScroll: true },
            );
        }
    };

    const afterActionChooserCloses = (action: () => void) => {
        setActionInvoice(null);
        window.setTimeout(action, 180);
    };

    return (
        <>
            <Head title="Vendor Payments" />
            <main className="vendor-data-page">
                <header className="vendor-data-header">
                    <div>
                        <span>Data</span>
                        <h1>Vendor Payments</h1>
                        <p>
                            Every vendor payment recorded across all projects.
                        </p>
                    </div>
                    <div className="vendor-data-header-actions">
                        <nav className="vendor-register-tabs">
                            <a href="/management/receivables">Receivables</a>
                            <a href="/management/payables">Payables</a>
                            <a className="is-active" href="/management/invoices">Invoices</a>
                        </nav>
                        <div className="vendor-data-summaries">
                            <div className="vendor-data-summary">
                                <strong>{currency.format(Number(totalAmount))}</strong>
                                <span>{totalInvoices.toLocaleString()} unpaid invoices</span>
                            </div>
                            <div className="vendor-data-summary is-balance">
                                <strong>{currency.format(Number(totalBalance))}</strong>
                                <span>{outstandingInvoiceCount.toLocaleString()} balances</span>
                                <button
                                    type="button"
                                    onClick={() => router.get('/management/invoices', {
                                        search: search || undefined,
                                        show_all: filters.show_all ? undefined : 1,
                                    })}
                                >
                                    {filters.show_all ? 'Show balances only' : 'See all invoices'}
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <nav className="vendor-register-navigation">
                    <a href="/management/projects">
                        <ArrowLeft /> Back to Projects
                    </a>
                </nav>

                <section className="vendor-data-panel">
                    <header className="vendor-data-toolbar">
                        <div>
                            <h2>Vendor payment register</h2>
                            <span>{invoices.total} matching invoices</span>
                        </div>
                        <form
                            className="vendor-data-search"
                            onSubmit={(event) => {
                                event.preventDefault();
                                runSearch(search.trim());
                            }}
                        >
                            <Search />
                            <input
                                ref={searchInput}
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search invoices, contractors, projects…"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        runSearch('');
                                    }}
                                    aria-label="Clear search"
                                >
                                    <X />
                                </button>
                            )}
                        </form>
                        <button
                            type="button"
                            className="vendor-data-add"
                            onClick={openNew}
                        >
                            <Plus /> Add Invoice
                        </button>
                    </header>

                    <div className="vendor-data-table-wrap">
                        <table className="vendor-data-table">
                            <thead>
                                <tr>
                                    <th>Charged by</th>
                                    <th>Invoice number</th>
                                    <th>Project #</th>
                                    <th>Rep</th>
                                    <th>Description</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                    <th>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.data.map((invoice) => (
                                    <tr
                                        key={invoice.id}
                                        className="vendor-data-clickable-row"
                                        tabIndex={0}
                                        onClick={() => setActionInvoice(invoice)}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === 'Enter' ||
                                                event.key === ' '
                                            ) {
                                                event.preventDefault();
                                                setActionInvoice(invoice);
                                            }
                                        }}
                                    >
                                        <td>
                                            <strong>
                                                {invoice.contractor?.contractor ??
                                                    invoice.vendor?.vendor ??
                                                    'Unknown vendor'}
                                            </strong>
                                            <small>
                                                {invoice.company_prefix}
                                            </small>
                                        </td>
                                        <td className="is-link">
                                            <button className="vendor-invoice-attachment-trigger" type="button" onClick={(event) => { event.stopPropagation(); attachmentForm.setData({ files: [], target_type: 'invoice', target_id: String(invoice.id) }); attachmentForm.clearErrors(); setAttachmentInvoice(invoice); }}>
                                                {invoice.invoice_number}
                                            </button>
                                        </td>
                                        <td>
                                            <a
                                                className="vendor-project-link"
                                                href={`/management/projects?project=${invoice.project_id}&tab=INV`}
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                {invoice.project_number}
                                            </a>
                                        </td>
                                        <td>{invoice.rep}</td>
                                        <td title={invoice.notes || undefined}>
                                            {invoice.notes || '—'}
                                        </td>
                                        <td>
                                            {formatInvoiceDate(invoice.invoice_date)}
                                        </td>
                                        <td>
                                            <strong>
                                                {currency.format(
                                                    Number(invoice.amount),
                                                )}
                                            </strong>
                                        </td>
                                        <td>
                                            {currency.format(
                                                Number(invoice.balance),
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className={`vendor-status is-${invoice.status}`}
                                            >
                                                {statusLabels[invoice.status]}
                                            </span>
                                        </td>
                                        <td>
                                            {invoice.file_name ? (
                                                <a
                                                    className="vendor-file-link"
                                                    href={fileUrl(invoice)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <FileText /> View
                                                </a>
                                            ) : (
                                                <span className="vendor-no-file">
                                                    None
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {invoices.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="vendor-data-empty"
                                        >
                                            <FileText />
                                            <strong>
                                                No vendor payments found
                                            </strong>
                                            <span>
                                                Invoices created inside projects
                                                will automatically appear here.
                                            </span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <footer className="vendor-data-pagination">
                        <span>
                            Page {invoices.current_page} of {invoices.last_page}
                        </span>
                        <div>
                            <button
                                type="button"
                                disabled={!invoices.prev_page_url}
                                onClick={() =>
                                    invoices.prev_page_url &&
                                    router.visit(invoices.prev_page_url, {
                                        preserveScroll: true,
                                    })
                                }
                            >
                                <ChevronLeft /> Previous
                            </button>
                            <button
                                type="button"
                                disabled={!invoices.next_page_url}
                                onClick={() =>
                                    invoices.next_page_url &&
                                    router.visit(invoices.next_page_url, {
                                        preserveScroll: true,
                                    })
                                }
                            >
                                Next <ChevronRight />
                            </button>
                        </div>
                    </footer>
                </section>

                <Dialog
                    open={actionInvoice !== null}
                    onOpenChange={(open) => {
                        if (!open) setActionInvoice(null);
                    }}
                >
                    {actionInvoice && (
                        <DialogContent className="vendor-action-modal">
                            <DialogHeader>
                                <DialogTitle>
                                    {actionInvoice.invoice_number}
                                </DialogTitle>
                                <DialogDescription>
                                    Choose what you want to do with this invoice.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="vendor-action-choices">
                                {Number(actionInvoice.balance) > 0 && (
                                    <button
                                        type="button"
                                        className="is-pay"
                                        onClick={() => {
                                            const invoice = actionInvoice;
                                            afterActionChooserCloses(() =>
                                                router.get(
                                                    `/management/payables?invoice=${invoice.id}`,
                                                ),
                                            );
                                        }}
                                    >
                                        Pay invoice
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const invoice = actionInvoice;
                                        afterActionChooserCloses(() =>
                                            openEdit(invoice),
                                        );
                                    }}
                                >
                                    <Pencil /> Edit invoice
                                </button>
                                <button type="button" onClick={() => {
                                    const invoice = actionInvoice;
                                    afterActionChooserCloses(() => {
                                        attachmentForm.setData({ files: [], target_type: 'invoice', target_id: String(invoice.id) });
                                        attachmentForm.clearErrors();
                                        setAttachmentInvoice(invoice);
                                    });
                                }}><Upload /> Add files or photos</button>
                                <button
                                    type="button"
                                    className="is-delete"
                                    onClick={() => {
                                        const invoice = actionInvoice;
                                        afterActionChooserCloses(() =>
                                            void remove(invoice),
                                        );
                                    }}
                                >
                                    <Trash2 /> Delete invoice
                                </button>
                            </div>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog open={attachmentInvoice !== null} onOpenChange={(open) => !open && !attachmentForm.processing && setAttachmentInvoice(null)}>
                    {attachmentInvoice && <DialogContent className="vendor-action-modal"><form onSubmit={(event) => {
                        event.preventDefault();
                        attachmentForm.post(`/management/projects/${attachmentInvoice.project_id}/documents`, { forceFormData: true, preserveScroll: true, onSuccess: () => { setAttachmentInvoice(null); attachmentForm.reset(); } });
                    }}>
                        <DialogHeader><DialogTitle>{attachmentInvoice.invoice_number}</DialogTitle><DialogDescription>View existing attachments or add PDFs, images, and photos. New files also appear in the project DOC tab and Google Drive.</DialogDescription></DialogHeader>
                        <div className="vendor-attachment-list">
                            {attachmentInvoice.file_name && <a href={fileUrl(attachmentInvoice)} target="_blank" rel="noreferrer"><FileText /><span>{attachmentInvoice.file_name}</span><strong>View</strong></a>}
                            {attachmentInvoice.documents.map((document) => <a key={document.id} href={`/management/projects/${attachmentInvoice.project_id}/documents/${document.id}/file`} target="_blank" rel="noreferrer"><FileText /><span>{document.file_name}</span><strong>View</strong></a>)}
                            {!attachmentInvoice.file_name && attachmentInvoice.documents.length === 0 && <p>No files attached yet.</p>}
                        </div>
                        <label className="vendor-upload-panel"><span><Upload /> {attachmentForm.data.files.length ? `${attachmentForm.data.files.length} files selected` : 'Choose files or photos'}</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(event) => attachmentForm.setData('files', Array.from(event.target.files ?? []))} /></label>
                        {attachmentForm.errors.files && <small>{attachmentForm.errors.files}</small>}
                        <DialogFooter className="vendor-modal-footer"><button type="button" onClick={() => setAttachmentInvoice(null)}>Cancel</button><button type="submit" disabled={attachmentForm.processing || attachmentForm.data.files.length === 0}>{attachmentForm.processing ? 'Uploading…' : 'Upload files'}</button></DialogFooter>
                    </form></DialogContent>}
                </Dialog>

                <Dialog
                    open={modal !== null}
                    onOpenChange={(open) => {
                        if (!open && !form.processing) {
                            setModal(null);
                            setPreview(null);
                        }
                    }}
                >
                    {modal && (
                        <DialogContent className="vendor-invoice-modal">
                            <form onSubmit={submit}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {modal.mode === 'create'
                                            ? 'Add vendor payment'
                                            : 'Edit vendor payment'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Choose the related project and
                                        contractor or vendor. The invoice will also appear
                                        in that project's INV tab.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="vendor-invoice-form-layout">
                                    <div className="vendor-invoice-form">
                                        <div className="vendor-project-address-picker is-wide">
                                            <span>Project customer and address</span>
                                            <div className="vendor-project-address-input">
                                                <Search />
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    disabled={modal.mode === 'edit'}
                                                    value={projectCustomerSearch}
                                                    placeholder="Start typing a project customer…"
                                                    onFocus={() => { setProjectSearchField('customer'); setShowProjectSuggestions(true); }}
                                                    onBlur={() => setShowProjectSuggestions(false)}
                                                    onChange={(event) => {
                                                        setProjectCustomerSearch(event.target.value);
                                                        form.setData('project_id', '');
                                                        setProjectSearchField('customer');
                                                        setShowProjectSuggestions(true);
                                                    }}
                                                />
                                            </div>
                                            <div className="vendor-project-address-input">
                                                <Search />
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    disabled={
                                                        modal.mode === 'edit'
                                                    }
                                                    value={projectAddressSearch}
                                                    placeholder="Start typing a project street address…"
                                                    onFocus={() => { setProjectSearchField('address'); setShowProjectSuggestions(true); }}
                                                    onBlur={() =>
                                                        setShowProjectSuggestions(
                                                            false,
                                                        )
                                                    }
                                                    onChange={(event) => {
                                                        setProjectAddressSearch(
                                                            event.target.value,
                                                        );
                                                        form.setData(
                                                            'project_id',
                                                            '',
                                                        );
                                                        setProjectSearchField('address');
                                                        setShowProjectSuggestions(
                                                            true,
                                                        );
                                                    }}
                                                />
                                            </div>
                                            {showProjectSuggestions &&
                                                modal.mode === 'create' && (
                                                    <div className="vendor-project-suggestions">
                                                        {projectSuggestions.map(
                                                            (project) => (
                                                                <button
                                                                    type="button"
                                                                    key={
                                                                        project.id
                                                                    }
                                                                    onMouseDown={(
                                                                        event,
                                                                    ) => {
                                                                        event.preventDefault();
                                                                        selectProjectAddress(
                                                                            project,
                                                                        );
                                                                    }}
                                                                >
                                                                    <span>
                                                                        {projectAddress(
                                                                            project,
                                                                        )}
                                                                    </span>
                                                                    <small>
                                                                        {projectNumber(
                                                                            project,
                                                                        )}{' '}
                                                                        ·{' '}
                                                                        {
                                                                            projectCustomer(project)
                                                                        }
                                                                    </small>
                                                                </button>
                                                            ),
                                                        )}
                                                        {projectSuggestions.length ===
                                                            0 && (
                                                            <p>
                                                                No project
                                                                addresses match
                                                                your search.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            {!form.data.project_id &&
                                                projectAddressSearch && (
                                                    <small>
                                                        Select an address from
                                                        the suggestions to link
                                                        the invoice.
                                                    </small>
                                                )}
                                        </div>
                                        <label>
                                            <span>Invoice number</span>
                                            <div className="vendor-invoice-number">
                                                <strong>INV#</strong>
                                                <input
                                                    value={invoiceSuffix(
                                                        form.data
                                                            .invoice_number,
                                                    )}
                                                    placeholder="0001"
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'invoice_number',
                                                            withInvoicePrefix(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                            {form.errors.invoice_number && (
                                                <small>
                                                    {form.errors.invoice_number}
                                                </small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Project number</span>
                                            <input
                                                readOnly
                                                value={
                                                    selectedProject
                                                        ? projectNumber(
                                                              selectedProject,
                                                          )
                                                        : ''
                                                }
                                                placeholder="Filled after selecting an address"
                                            />
                                        </label>
                                        <label>
                                            <span>Charged by</span>
                                            <select
                                                value={
                                                    form.data.contractor_id
                                                        ? `contractor:${form.data.contractor_id}`
                                                        : form.data.vendor_id
                                                          ? `vendor:${form.data.vendor_id}`
                                                          : ''
                                                }
                                                onChange={(event) => {
                                                    const [kind, id = ''] =
                                                        event.target.value.split(':');
                                                    form.setData((data) => ({
                                                        ...data,
                                                        contractor_id:
                                                            kind === 'contractor'
                                                                ? id
                                                                : '',
                                                        vendor_id:
                                                            kind === 'vendor'
                                                                ? id
                                                                : '',
                                                    }));
                                                }}
                                            >
                                                <option value="">
                                                    Select contractor or vendor
                                                </option>
                                                <optgroup label="Contractors">
                                                    {contractors.map((contractor) => (
                                                        <option
                                                            key={
                                                                `contractor-${contractor.con_id}`
                                                            }
                                                            value={
                                                                `contractor:${contractor.con_id}`
                                                            }
                                                        >
                                                            {
                                                                contractor.contractor
                                                            }
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Vendors">
                                                    {vendors.map((vendor) => (
                                                        <option
                                                            key={`vendor-${vendor.vendor_id}`}
                                                            value={`vendor:${vendor.vendor_id}`}
                                                        >
                                                            {vendor.vendor}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                            {form.errors.contractor_id && (
                                                <small>
                                                    {form.errors.contractor_id}
                                                </small>
                                            )}
                                            {form.errors.vendor_id && (
                                                <small>{form.errors.vendor_id}</small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Date</span>
                                            <input
                                                type="date"
                                                value={form.data.invoice_date}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'invoice_date',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            <span>Amount</span>
                                            <input
                                                inputMode="decimal"
                                                value={form.data.amount}
                                                placeholder="0.00"
                                                onChange={(event) =>
                                                    form.setData(
                                                        'amount',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.amount && (
                                                <small>
                                                    {form.errors.amount}
                                                </small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Status</span>
                                            <input
                                                readOnly
                                                value={
                                                    modal.invoice
                                                        ? statusLabels[
                                                              modal.invoice
                                                                  .status
                                                          ]
                                                        : 'Pending'
                                                }
                                            />
                                        </label>
                                        <label className="is-wide">
                                            <span>Description</span>
                                            <textarea
                                                value={form.data.notes}
                                                placeholder="What is this invoice for?"
                                                onChange={(event) =>
                                                    form.setData(
                                                        'notes',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label className="is-wide">
                                            <span>Use existing project file (optional)</span>
                                            <select
                                                value={form.data.project_document_id}
                                                onChange={(event) => {
                                                    form.setData((data) => ({ ...data, project_document_id: event.target.value, file: null }));
                                                    setPreview(null);
                                                }}
                                            >
                                                <option value="">No existing file selected</option>
                                                {selectedProject?.documents.map((document) => <option key={document.id} value={document.id}>{document.file_name} ({document.category})</option>)}
                                            </select>
                                            <small>Includes files uploaded by the salesman in My Sold.</small>
                                        </label>
                                    </div>
                                    <aside className="vendor-upload-panel">
                                        <label>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                onChange={(event) =>
                                                    chooseFile(
                                                        event.target
                                                            .files?.[0] ?? null,
                                                    )
                                                }
                                            />
                                            <Upload />
                                            <strong>
                                                {form.data.file?.name ||
                                                    modal.invoice?.file_name ||
                                                    'Choose invoice file'}
                                            </strong>
                                            <span>
                                                PDF or image · up to 10 MB
                                            </span>
                                        </label>
                                        {form.errors.file && (
                                            <small>{form.errors.file}</small>
                                        )}
                                        <div className="vendor-upload-preview">
                                            {preview ? (
                                                preview.mime.startsWith(
                                                    'image/',
                                                ) ? (
                                                    <img
                                                        src={preview.url}
                                                        alt="Invoice preview"
                                                    />
                                                ) : (
                                                    <iframe
                                                        src={preview.url}
                                                        title="Invoice preview"
                                                    />
                                                )
                                            ) : (
                                                <div>
                                                    <FileText />
                                                    <span>
                                                        No file selected
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </aside>
                                </div>
                                <DialogFooter className="vendor-modal-footer">
                                    <button
                                        type="button"
                                        onClick={() => setModal(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            form.processing ||
                                            !form.data.project_id
                                        }
                                    >
                                        {form.processing
                                            ? 'Saving…'
                                            : 'Save invoice'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>
            </main>
        </>
    );
}
