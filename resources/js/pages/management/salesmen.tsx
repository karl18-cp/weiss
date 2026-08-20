import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    BarChart3,
    LockKeyhole,
    Phone,
    Save,
    Search,
    Trash2,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/salesmen.css';
import DirectoryNavigation from '@/components/directory-navigation';
import AccountStatusControl from '@/components/account-status-control';
import { useSystemModal } from '@/components/system-modal-provider';
import { formatPhoneNumber } from '@/lib/phone-number';
import { type PermissionAccess } from '@/components/module-permissions-editor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Salesman = {
    salesman_id: number;
    salesman_name: string;
    phone: string | null;
    inactive_at: string | null;
    initial_sale_cut_percent: string;
    change_order_cut_percent: string;
    sale_commission_percent: string;
    completed_projects_count: number;
    completed_sales_total: number;
    completed_cut_total: number;
    account: { acc_id: number; username: string; suspended_at: string | null } | null;
    company: { com_id: number; company: string } | null;
    permissions: { module: string; access_level: PermissionAccess }[];
};

type Company = { com_id: number; company: string };
type SalesmanReport = {
    salesman: { id: number; name: string };
    summary: { appointments: number; confirmed: number; dispatched: number; sold: number; sale_total: number; last_sale: string | null };
    rows: Array<{ id: number; origin_at: string | null; appointment_at: string | null; customer: string; result: string; confirmed: boolean; dispatched: boolean; sold: boolean; project_id: number | null; project_number: string; sale_total: number; city: string | null; notes: string }>;
    commission: {
        rates: { initial_sale: number; change_order: number; sale_commission: number };
        summary: { projects: number; sales: number; received: number; expenses: number; balance: number; commission_due: number };
        rows: Array<{ project_id: number; project_number: string; customer: string; company: string; city: string; completed_at: string | null; original_sale: number; change_orders: number; total_sale: number; received: number; expenses: number; project_balance: number; initial_cut: number; change_order_cut: number; sale_commission: number; commission_due: number }>;
    };
};
const reportMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function Salesmen({
    salesmen,
    companies,
    permissionModules,
}: {
    salesmen: Salesman[];
    companies: Company[];
    permissionModules: Record<string, string>;
}) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Salesman | null>(null);
    const [search, setSearch] = useState('');
    const [directoryStatus, setDirectoryStatus] = useState<'active' | 'inactive'>('active');
    const [report, setReport] = useState<SalesmanReport | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [commissionOpen, setCommissionOpen] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const blankPermissions = Object.fromEntries(
        Object.keys(permissionModules).map((module) => [module, 'none']),
    ) as Record<string, PermissionAccess>;
    const form = useForm({
        salesman_name: '',
        phone: '',
        company_id: '',
        username: '',
        password: '',
        suspended: false,
        initial_sale_cut_percent: '0',
        change_order_cut_percent: '0',
        sale_commission_percent: '0',
        permissions: blankPermissions,
    });

    const filteredSalesmen = useMemo(() => {
        const query = search.trim().toLowerCase();
        const statusFiltered = salesmen.filter((salesman) =>
            directoryStatus === 'inactive'
                ? Boolean(salesman.inactive_at)
                : !salesman.inactive_at,
        );

        return query
            ? statusFiltered.filter((salesman) =>
                  [salesman.salesman_name, salesman.phone]
                      .join(' ')
                      .toLowerCase()
                      .includes(query),
              )
            : statusFiltered;
    }, [salesmen, directoryStatus, search]);

    const resetForm = () => {
        setSelected(null);
        form.setData({
            salesman_name: '',
            phone: '',
            company_id: '',
            username: '',
            password: '',
            suspended: false,
            initial_sale_cut_percent: '0',
            change_order_cut_percent: '0',
            sale_commission_percent: '0',
            permissions: blankPermissions,
        });
        form.clearErrors();
    };

    const selectSalesman = (salesman: Salesman) => {
        setSelected(salesman);
        form.setData({
            salesman_name: salesman.salesman_name,
            phone: salesman.phone ?? '',
            company_id: String(salesman.company?.com_id ?? ''),
            username: salesman.account?.username ?? '',
            password: '',
            suspended: Boolean(salesman.inactive_at),
            initial_sale_cut_percent: salesman.initial_sale_cut_percent ?? '0',
            change_order_cut_percent: salesman.change_order_cut_percent ?? '0',
            sale_commission_percent: salesman.sale_commission_percent ?? '0',
            permissions: {
                ...blankPermissions,
                ...Object.fromEntries(
                    salesman.permissions.map((permission) => [
                        permission.module,
                        permission.access_level,
                    ]),
                ),
            },
        });
        form.clearErrors();
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: resetForm };

        if (selected) {
            form.put(`/management/salesmen/${selected.salesman_id}`, options);
        } else {
            form.post('/management/salesmen', options);
        }
    };

    const deleteSalesman = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete salesman?',
            message: `${selected.salesman_name} will be permanently removed from the salesman directory.`,
            confirmLabel: 'Delete salesman',
            tone: 'danger',
        });

        if (!confirmed) {
            return;
        }

        router.delete(`/management/salesmen/${selected.salesman_id}`, {
            preserveScroll: true,
            onSuccess: resetForm,
        });
    };

    const openReport = async () => {
        if (!selected) return;
        setReportOpen(true); setReportLoading(true); setReport(null);
        try {
            const response = await fetch(`/management/salesmen/${selected.salesman_id}/report`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!response.ok) throw new Error('Unable to load salesman report');
            setReport((await response.json()) as SalesmanReport);
        } finally { setReportLoading(false); }
    };
    const openCommissionReport = async () => {
        if (!selected) return;
        setCommissionOpen(true); setReportLoading(true); setReport(null);
        try {
            const response = await fetch(`/management/salesmen/${selected.salesman_id}/report`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!response.ok) throw new Error('Unable to load commission report');
            setReport((await response.json()) as SalesmanReport);
        } finally { setReportLoading(false); }
    };
    const downloadCommissionPdf = () => {
        if (!report || !selected) return;
        const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '');
        const lines = [
            `${selected.salesman_name} - Completed Project Commission Report`,
            `Projects: ${report.commission.summary.projects}   Sales: ${reportMoney.format(report.commission.summary.sales)}   Received: ${reportMoney.format(report.commission.summary.received)}`,
            `Expenses: ${reportMoney.format(report.commission.summary.expenses)}   Balance: ${reportMoney.format(report.commission.summary.balance)}   Commission Due: ${reportMoney.format(report.commission.summary.commission_due)}`,
            `Rates - Initial: ${report.commission.rates.initial_sale}%   Change orders: ${report.commission.rates.change_order}%   Additional: ${report.commission.rates.sale_commission}%`,
            '',
            ...report.commission.rows.flatMap((row) => [
                `${row.project_number} | ${row.customer} | ${row.company} | ${row.city}`,
                `Sale ${reportMoney.format(row.total_sale)} | Received ${reportMoney.format(row.received)} | Expenses ${reportMoney.format(row.expenses)} | Balance ${reportMoney.format(row.project_balance)} | Commission ${reportMoney.format(row.commission_due)}`,
                '',
            ]),
        ];
        const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 42)) }, (_, index) => lines.slice(index * 42, index * 42 + 42));
        const objects: string[] = ['', '<< /Type /Catalog /Pages 2 0 R >>'];
        const pageIds = pages.map((_, index) => 3 + index * 2);
        const fontId = 3 + pages.length * 2;
        objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
        pages.forEach((page, index) => {
            const pageId = pageIds[index]; const contentId = pageId + 1;
            let content = 'BT\n/F1 9 Tf\n';
            page.forEach((line, lineIndex) => { content += `1 0 0 1 38 ${750 - lineIndex * 17} Tm (${escape(line)}) Tj\n`; });
            content += 'ET\n';
            objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
            objects[contentId] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`;
        });
        objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        let pdf = '%PDF-1.4\n'; const offsets = [0];
        for (let id = 1; id <= fontId; id += 1) { offsets[id] = new TextEncoder().encode(pdf).length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
        const xref = new TextEncoder().encode(pdf).length;
        pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
        const url = URL.createObjectURL(new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' }));
        const link = document.createElement('a'); link.href = url; link.download = `${selected.salesman_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-commission-report.pdf`; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const reportDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

    return (
        <>
            <Head title="Salesmen" />
            <main className="agents-page salesmen-page">
                <header className="agents-header directory-heading-with-total">
                    <div className="directory-heading-copy">
                        <span>Contacts &amp; Users</span>
                        <h1>Salesmen</h1>
                        <p>Create and maintain salesman records in Weiss CRM.</p>
                    </div>
                    <section className="agents-count directory-heading-total">
                        <div><Users /></div>
                        <span><strong>{salesmen.length}</strong><small>Total salesmen</small></span>
                    </section>
                </header>
                <div className="agents-workspace">
                    <DirectoryNavigation
                        active="Salesman"
                        status={directoryStatus}
                        onStatusChange={(status) => {
                            setDirectoryStatus(status);
                            resetForm();
                            setSearch('');
                        }}
                    >
                        <div className="agents-directory-heading">
                            <div className="directory-heading-title-row">
                                <h2>Salesman directory</h2>
                                <span className="directory-inline-count">{filteredSalesmen.length}</span>
                            </div>
                            <p>Select a salesman to edit</p>
                        </div>
                        <label className="agents-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search name or phone"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Clear search"
                                >
                                    <X />
                                </button>
                            )}
                        </label>
                        <div className="agents-list directory-navigation__scroll-list">
                            {filteredSalesmen.map((salesman) => (
                                <button
                                    type="button"
                                    key={salesman.salesman_id}
                                    className={
                                        selected?.salesman_id ===
                                        salesman.salesman_id
                                            ? 'agent-list-item agent-list-item--active'
                                            : 'agent-list-item'
                                    }
                                    onClick={() => selectSalesman(salesman)}
                                >
                                    <span className="agent-avatar">
                                        {salesman.salesman_name
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <span>
                                        <strong>
                                            {salesman.salesman_name}
                                        </strong>
                                        <small>
                                            {salesman.company?.company ??
                                                'No company'}{' '}
                                            · {formatPhoneNumber(salesman.phone)}
                                        </small>
                                    </span>
                                </button>
                            ))}
                            {filteredSalesmen.length === 0 && (
                                <div className="agents-empty">
                                    <UserRound />
                                    <strong>No salesmen found</strong>
                                    <span>
                                        {search
                                            ? 'Try another search.'
                                            : 'Create your first salesman.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>
                    <section className="agents-form-panel">
                        <div className="agents-form-title">
                            <h2>
                                {selected ? 'Edit salesman' : 'Create salesman'}
                            </h2>
                            <p>
                                {selected
                                    ? `Updating salesman #${selected.salesman_id}`
                                    : 'Add a salesman to your directory'}
                            </p>
                        </div>
                        <form
                            onSubmit={submit}
                            className="agents-form salesmen-form"
                        >
                            <label>
                                <span>Salesman name</span>
                                <div className="agents-input">
                                    <UserRound />
                                    <input
                                        value={form.data.salesman_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'salesman_name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter the salesman name"
                                        autoFocus
                                    />
                                </div>
                                {form.errors.salesman_name && (
                                    <small>{form.errors.salesman_name}</small>
                                )}
                            </label>
                            <label>
                                <span>Assigned company</span>
                                <div className="agents-input">
                                    <Building2 />
                                    <select
                                        value={form.data.company_id}
                                        onChange={(event) =>
                                            form.setData(
                                                'company_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Select company</option>
                                        {companies.map((company) => (
                                            <option
                                                key={company.com_id}
                                                value={company.com_id}
                                            >
                                                {company.company}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {form.errors.company_id && (
                                    <small>{form.errors.company_id}</small>
                                )}
                            </label>
                            <label>
                                <span>
                                    Username <small>(optional)</small>
                                </span>
                                <div className="agents-input">
                                    <UserRound />
                                    <input
                                        value={form.data.username}
                                        onChange={(event) =>
                                            form.setData(
                                                'username',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Optional login username"
                                        autoComplete="off"
                                    />
                                </div>
                                {form.errors.username && (
                                    <small>{form.errors.username}</small>
                                )}
                            </label>
                            <label>
                                <span>
                                    Password <small>(optional)</small>
                                </span>
                                <div className="agents-input">
                                    <LockKeyhole />
                                    <input
                                        type="password"
                                        value={form.data.password}
                                        onChange={(event) =>
                                            form.setData(
                                                'password',
                                                event.target.value,
                                            )
                                        }
                                        placeholder={
                                            selected?.account
                                                ? 'Leave blank to keep current password'
                                                : 'At least 8 characters'
                                        }
                                        autoComplete="new-password"
                                    />
                                </div>
                                {form.errors.password && (
                                    <small>{form.errors.password}</small>
                                )}
                            </label>
                            <label>
                                <span>Phone number</span>
                                <div className="agents-input">
                                    <Phone />
                                    <input
                                        value={form.data.phone}
                                        onChange={(event) =>
                                            form.setData(
                                                'phone',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter the phone number"
                                    />
                                </div>
                                {form.errors.phone && (
                                    <small>{form.errors.phone}</small>
                                )}
                            </label>
                            <AccountStatusControl
                                suspended={form.data.suspended}
                                disabled={false}
                                onChange={(suspended) =>
                                    form.setData('suspended', suspended)
                                }
                            />
                            <section className="salesman-commission-card">
                                <header>
                                    <div>
                                        <strong>Completed project commission</strong>
                                        <span>These rates calculate the salesman cut only after a project is Completed.</span>
                                    </div>
                                    <div className="salesman-commission-totals">
                                        <span><small>Completed projects</small><strong>{selected?.completed_projects_count ?? 0}</strong></span>
                                        <span><small>Completed sales</small><strong>{reportMoney.format(selected?.completed_sales_total ?? 0)}</strong></span>
                                        <span><small>Calculated cut</small><strong>{reportMoney.format(selected?.completed_cut_total ?? 0)}</strong></span>
                                    </div>
                                </header>
                                <div className="salesman-commission-fields">
                                    {([
                                        ['initial_sale_cut_percent', 'Initial sale cut'],
                                        ['change_order_cut_percent', 'Change-order cut'],
                                        ['sale_commission_percent', 'Additional sale commission'],
                                    ] as const).map(([field, label]) => (
                                        <label key={field}>
                                            <span>{label}</span>
                                            <div><input type="number" min="0" max="100" step="0.01" value={form.data[field]} onChange={(event) => form.setData(field, event.target.value)} /><b>%</b></div>
                                            {form.errors[field] && <small>{form.errors[field]}</small>}
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <div className="agents-form-actions">
                                {selected && (
                                    <>
                                        <button type="button" className="agents-report-button" onClick={openReport}><BarChart3 /> Salesman report</button>
                                        <button type="button" className="agents-report-button" onClick={openCommissionReport}><BarChart3 /> Accounting report</button>
                                        <button
                                            type="button"
                                            className="agents-delete-button"
                                            onClick={deleteSalesman}
                                        >
                                            <Trash2 />
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            className="agents-reset-button"
                                            onClick={resetForm}
                                        >
                                            New salesman
                                        </button>
                                    </>
                                )}
                                <button
                                    type="submit"
                                    className="agents-save-button"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create salesman'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
                <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                    <DialogContent className="salesman-report-modal">
                        <DialogHeader><DialogTitle>{selected?.salesman_name} — Salesman report</DialogTitle><DialogDescription>Leads and projects assigned as primary or second salesman.</DialogDescription></DialogHeader>
                        {reportLoading ? <div className="agent-report-loading">Loading report…</div> : report ? <>
                            <div className="salesman-report-summary"><span><small>Appointments</small><strong>{report.summary.appointments}</strong></span><span><small>Confirmed</small><strong>{report.summary.confirmed}</strong></span><span><small>Dispatched</small><strong>{report.summary.dispatched}</strong></span><span><small>Sold</small><strong>{report.summary.sold}</strong></span><span><small>Sales total</small><strong>{reportMoney.format(report.summary.sale_total)}</strong></span><span><small>Last sale</small><strong>{reportDate(report.summary.last_sale)}</strong></span></div>
                            <div className="salesman-report-table-wrap"><table><thead><tr><th>Origin</th><th>Appointment</th><th>Customer</th><th>Result</th><th>Conf.</th><th>Dispatched</th><th>Sold</th><th>Project #</th><th>Sale</th><th>City</th><th>Notes</th></tr></thead><tbody>
                                {report.rows.map((row) => <tr key={row.id}><td>{reportDate(row.origin_at)}</td><td>{reportDate(row.appointment_at)}</td><td><strong>{row.customer}</strong></td><td>{row.result}</td><td>{row.confirmed ? '✓' : '—'}</td><td>{row.dispatched ? '✓' : '—'}</td><td>{row.sold ? '✓' : '—'}</td><td>{row.project_id ? <a href={`/management/projects?project=${row.project_id}&tab=INV`}>{row.project_number}</a> : '—'}</td><td>{row.sold ? reportMoney.format(row.sale_total) : '—'}</td><td>{row.city || '—'}</td><td title={row.notes}>{row.notes || '—'}</td></tr>)}
                                {report.rows.length === 0 && <tr><td colSpan={11}>No leads assigned to this salesman.</td></tr>}
                            </tbody></table></div>
                        </> : <div className="agent-report-loading">The report could not be loaded.</div>}
                    </DialogContent>
                </Dialog>
                <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
                    <DialogContent className="salesman-report-modal salesman-accounting-report-modal">
                        <DialogHeader><DialogTitle>{selected?.salesman_name} — Accounting &amp; commission report</DialogTitle><DialogDescription>Completed projects, collected payments, expenses, balances, and calculated salesman cuts.</DialogDescription></DialogHeader>
                        {reportLoading ? <div className="agent-report-loading">Loading report…</div> : report ? <>
                            <div className="salesman-report-summary"><span><small>Completed projects</small><strong>{report.commission.summary.projects}</strong></span><span><small>Total sales</small><strong>{reportMoney.format(report.commission.summary.sales)}</strong></span><span><small>Received</small><strong>{reportMoney.format(report.commission.summary.received)}</strong></span><span><small>Paid expenses</small><strong>{reportMoney.format(report.commission.summary.expenses)}</strong></span><span><small>Project balance</small><strong>{reportMoney.format(report.commission.summary.balance)}</strong></span><span><small>Commission due</small><strong>{reportMoney.format(report.commission.summary.commission_due)}</strong></span></div>
                            <div className="salesman-report-rates"><span>Initial sale <b>{report.commission.rates.initial_sale}%</b></span><span>Change orders <b>{report.commission.rates.change_order}%</b></span><span>Additional commission <b>{report.commission.rates.sale_commission}%</b></span><button type="button" onClick={downloadCommissionPdf}>Download PDF</button></div>
                            <div className="salesman-report-table-wrap"><table className="salesman-accounting-table"><thead><tr><th>Project</th><th>Customer</th><th>Company</th><th>Completed</th><th>Original sale</th><th>Change orders</th><th>Total sale</th><th>Received</th><th>Expenses</th><th>Balance</th><th>Initial cut</th><th>Change cut</th><th>Additional</th><th>Commission due</th></tr></thead><tbody>
                                {report.commission.rows.map((row) => <tr key={row.project_id}><td><a href={`/management/projects?project=${row.project_id}&tab=DTL`}>{row.project_number}</a></td><td><strong>{row.customer}</strong><small>{row.city}</small></td><td>{row.company}</td><td>{reportDate(row.completed_at)}</td><td>{reportMoney.format(row.original_sale)}</td><td>{reportMoney.format(row.change_orders)}</td><td>{reportMoney.format(row.total_sale)}</td><td>{reportMoney.format(row.received)}</td><td>{reportMoney.format(row.expenses)}</td><td>{reportMoney.format(row.project_balance)}</td><td>{reportMoney.format(row.initial_cut)}</td><td>{reportMoney.format(row.change_order_cut)}</td><td>{reportMoney.format(row.sale_commission)}</td><td><strong>{reportMoney.format(row.commission_due)}</strong></td></tr>)}
                                {report.commission.rows.length === 0 && <tr><td colSpan={14}>No completed projects for this salesman.</td></tr>}
                            </tbody></table></div>
                        </> : <div className="agent-report-loading">The accounting report could not be loaded.</div>}
                    </DialogContent>
                </Dialog>
            </main>
        </>
    );
}
