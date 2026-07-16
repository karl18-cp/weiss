import { Head, router, useForm } from '@inertiajs/react';
import {
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
import DataSectionTabs from '@/components/data-section-tabs';
import { useSystemModal } from '@/components/system-modal-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Contractor = { con_id: number; contractor: string };

type ProjectOption = {
    id: number;
    lead: {
        customer_name: string;
        address: string;
        city: string;
        state: string;
        zip_code: string;
        company: { prefix: string } | null;
    };
};

type VendorInvoice = {
    id: number;
    project_id: number;
    project_number: string;
    company_prefix: string;
    customer: string;
    contractor: Contractor;
    invoice_number: string;
    invoice_date: string;
    amount: string;
    balance: string;
    notes: string | null;
    status: 'pending' | 'ok_to_pay' | 'paid';
    file_name: string | null;
    file_mime: string | null;
};

type PaginatedInvoices = {
    data: VendorInvoice[];
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
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
});

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
    `${project.lead.company?.prefix || 'PROJECT'}-${String(project.id).padStart(5, '0')}`;

const projectAddress = (project: ProjectOption) =>
    `${project.lead.address}, ${project.lead.city}, ${project.lead.state} ${project.lead.zip_code}`;

export default function VendorInvoices({
    invoices,
    filters,
    totalInvoices,
    totalAmount,
    projects,
    contractors,
}: {
    invoices: PaginatedInvoices;
    filters: { search: string };
    totalInvoices: number;
    totalAmount: string | number;
    projects: ProjectOption[];
    contractors: Contractor[];
}) {
    const { confirm } = useSystemModal();
    const searchInput = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState(filters.search);
    const [modal, setModal] = useState<{
        mode: 'create' | 'edit';
        invoice: VendorInvoice | null;
    } | null>(null);
    const [preview, setPreview] = useState<{
        url: string;
        mime: string;
    } | null>(null);
    const [projectAddressSearch, setProjectAddressSearch] = useState('');
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const form = useForm<{
        project_id: string;
        invoice_number: string;
        invoice_date: string;
        contractor_id: string;
        amount: string;
        notes: string;
        file: File | null;
    }>({
        project_id: '',
        invoice_number: 'INV#',
        invoice_date: '',
        contractor_id: '',
        amount: '',
        notes: '',
        file: null,
    });

    const selectedProject = projects.find(
        (project) => project.id === Number(form.data.project_id),
    );
    const projectSuggestions = useMemo(() => {
        const query = projectAddressSearch.trim().toLowerCase();

        return projects
            .filter((project) => {
                if (!query) {
                    return true;
                }

                return [
                    projectAddress(project),
                    projectNumber(project),
                    project.lead.customer_name,
                ].some((value) => value.toLowerCase().includes(query));
            })
            .slice(0, 8);
    }, [projectAddressSearch, projects]);

    const fileUrl = (invoice: VendorInvoice) =>
        `/management/projects/${invoice.project_id}/invoices/${invoice.id}/file`;

    const runSearch = (value: string) => {
        router.get(
            '/lead-workflow/data/vendor-invoices',
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
            invoice_date: new Date().toLocaleDateString('en-CA'),
            contractor_id: '',
            amount: '',
            notes: '',
            file: null,
        });
        form.clearErrors();
        setProjectAddressSearch('');
        setShowProjectSuggestions(false);
        setPreview(null);
        setModal({ mode: 'create', invoice: null });
    };

    const openEdit = (invoice: VendorInvoice) => {
        form.setData({
            project_id: String(invoice.project_id),
            invoice_number: withInvoicePrefix(invoice.invoice_number),
            invoice_date: invoice.invoice_date.slice(0, 10),
            contractor_id: String(invoice.contractor.con_id),
            amount: invoice.amount,
            notes: invoice.notes ?? '',
            file: null,
        });
        form.clearErrors();
        const invoiceProject = projects.find(
            (project) => project.id === invoice.project_id,
        );
        setProjectAddressSearch(
            invoiceProject ? projectAddress(invoiceProject) : '',
        );
        setShowProjectSuggestions(false);
        setPreview(
            invoice.file_name && invoice.file_mime
                ? { url: fileUrl(invoice), mime: invoice.file_mime }
                : null,
        );
        setModal({ mode: 'edit', invoice });
    };

    const chooseFile = (file: File | null) => {
        form.setData('file', file);
        setPreview(
            file ? { url: URL.createObjectURL(file), mime: file.type } : null,
        );
    };

    const selectProjectAddress = (project: ProjectOption) => {
        form.setData('project_id', String(project.id));
        setProjectAddressSearch(projectAddress(project));
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

    const updateStatus = (
        invoice: VendorInvoice,
        status: VendorInvoice['status'],
    ) => {
        router.patch(
            `/management/projects/${invoice.project_id}/invoices/${invoice.id}/status`,
            { status },
            { preserveScroll: true },
        );
    };

    const remove = async (invoice: VendorInvoice) => {
        const accepted = await confirm({
            title: 'Delete vendor invoice?',
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

    return (
        <>
            <Head title="Vendor Invoices" />
            <main className="vendor-data-page">
                <header className="vendor-data-header">
                    <div>
                        <span>Data</span>
                        <h1>Vendor Invoices</h1>
                        <p>
                            Every vendor invoice recorded across all projects.
                        </p>
                    </div>
                    <div className="vendor-data-summary">
                        <strong>{totalInvoices.toLocaleString()}</strong>
                        <span>
                            invoices · {currency.format(Number(totalAmount))}
                        </span>
                    </div>
                </header>

                <DataSectionTabs
                    active="Vendor Invoices"
                    onSearch={() => searchInput.current?.focus()}
                />

                <section className="vendor-data-panel">
                    <header className="vendor-data-toolbar">
                        <div>
                            <h2>Vendor invoice register</h2>
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
                            <Plus /> Add vendor invoice
                        </button>
                    </header>

                    <div className="vendor-data-table-wrap">
                        <table className="vendor-data-table">
                            <thead>
                                <tr>
                                    <th>Charged by</th>
                                    <th>Invoice number</th>
                                    <th>Project #</th>
                                    <th>Description</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                    <th>File</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.data.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <td>
                                            <strong>
                                                {invoice.contractor.contractor}
                                            </strong>
                                            <small>
                                                {invoice.company_prefix}
                                            </small>
                                        </td>
                                        <td className="is-link">
                                            {invoice.invoice_number}
                                        </td>
                                        <td className="is-link">
                                            {invoice.project_number}
                                        </td>
                                        <td title={invoice.notes || undefined}>
                                            {invoice.notes || '—'}
                                        </td>
                                        <td>
                                            {date.format(
                                                new Date(invoice.invoice_date),
                                            )}
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
                                            <select
                                                className={`vendor-status is-${invoice.status}`}
                                                value={invoice.status}
                                                onChange={(event) =>
                                                    updateStatus(
                                                        invoice,
                                                        event.target
                                                            .value as VendorInvoice['status'],
                                                    )
                                                }
                                            >
                                                {Object.entries(
                                                    statusLabels,
                                                ).map(([value, label]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            {invoice.file_name ? (
                                                <a
                                                    className="vendor-file-link"
                                                    href={fileUrl(invoice)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <FileText /> View
                                                </a>
                                            ) : (
                                                <span className="vendor-no-file">
                                                    None
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="vendor-row-actions">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openEdit(invoice)
                                                    }
                                                >
                                                    <Pencil /> Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="is-delete"
                                                    onClick={() =>
                                                        void remove(invoice)
                                                    }
                                                >
                                                    <Trash2 /> Delete
                                                </button>
                                            </div>
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
                                                No vendor invoices found
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
                                            ? 'Add vendor invoice'
                                            : 'Edit vendor invoice'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Choose the related project and
                                        contractor. The invoice will also appear
                                        in that project's INV tab.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="vendor-invoice-form-layout">
                                    <div className="vendor-invoice-form">
                                        <div className="vendor-project-address-picker is-wide">
                                            <span>Search project address</span>
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
                                                    onFocus={() =>
                                                        setShowProjectSuggestions(
                                                            true,
                                                        )
                                                    }
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
                                                                            project
                                                                                .lead
                                                                                .customer_name
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
                                                value={form.data.contractor_id}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'contractor_id',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select contractor
                                                </option>
                                                {contractors.map(
                                                    (contractor) => (
                                                        <option
                                                            key={
                                                                contractor.con_id
                                                            }
                                                            value={
                                                                contractor.con_id
                                                            }
                                                        >
                                                            {
                                                                contractor.contractor
                                                            }
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            {form.errors.contractor_id && (
                                                <small>
                                                    {form.errors.contractor_id}
                                                </small>
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
