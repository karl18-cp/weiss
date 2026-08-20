import { Head, router, useForm } from '@inertiajs/react';
import {
    BadgeCheck,
    BarChart3,
    BriefcaseBusiness,
    CalendarDays,
    MoveRight,
    Mail,
    MapPin,
    Phone,
    Save,
    Search,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/contractors.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Contractor = {
    con_id: number;
    contractor: string;
    point_of_contact: string | null;
    address: string;
    zip: number | string;
    city: string;
    state: string;
    email: string;
    phone: number | string;
    license: number | string;
    lic_expire: string;
    worker_comp: string;
    insurance_expire: string;
};

type ContractorForm = Omit<Contractor, 'con_id'>;
type ContractorReport = {
    contractor: { id: number; name: string };
    summary: { invoices: number; invoice_total: number; invoice_balance: number; payables: number; payable_total: number };
    rows: Array<{ key: string; type: 'Invoice' | 'Payable'; project_id: number | null; project_number: string; customer: string; reference: string; date: string | null; amount: string | number; balance: string | number; status: string; notes: string | null }>;
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const emptyForm: ContractorForm = {
    contractor: '',
    point_of_contact: '',
    address: '',
    zip: '',
    city: '',
    state: '',
    email: '',
    phone: '',
    license: '',
    lic_expire: '',
    worker_comp: '',
    insurance_expire: '',
};

export default function Contractors({
    contractors,
}: {
    contractors: Contractor[];
}) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Contractor | null>(null);
    const [search, setSearch] = useState('');
    const [report, setReport] = useState<ContractorReport | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [vendorSelections, setVendorSelections] = useState<number[]>([]);
    const form = useForm<ContractorForm>(emptyForm);

    const moveSelectedToVendors = async () => {
        if (vendorSelections.length === 0) return;
        const accepted = await confirm({
            title: 'Move selected contractors to Vendors?',
            message: 'They will leave the contractor directory and become full vendor records. Existing invoices will keep their current contractor links.',
            confirmLabel: 'Move to Vendors',
        });
        if (!accepted) return;
        router.post('/management/vendors/import-contractors', { contractor_ids: vendorSelections }, {
            preserveScroll: true,
            onSuccess: () => { setVendorSelections([]); setSelected(null); },
        });
    };

    const filteredContractors = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
return contractors;
}

        return contractors.filter((contractor) =>
            [
                contractor.contractor,
                contractor.point_of_contact,
                contractor.city,
                contractor.state,
                contractor.email,
            ]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [contractors, search]);

    const resetForm = () => {
        setSelected(null);
        form.setData(emptyForm);
        form.clearErrors();
    };

    const selectContractor = (contractor: Contractor) => {
        setSelected(contractor);
        form.setData({
            contractor: contractor.contractor,
            point_of_contact: contractor.point_of_contact ?? '',
            address: contractor.address,
            zip: contractor.zip,
            city: contractor.city,
            state: contractor.state,
            email: contractor.email,
            phone: contractor.phone,
            license: contractor.license,
            lic_expire: contractor.lic_expire,
            worker_comp: contractor.worker_comp,
            insurance_expire: contractor.insurance_expire,
        });
        form.clearErrors();
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: resetForm };

        if (selected) {
            form.put(`/management/contractors/${selected.con_id}`, options);

            return;
        }

        form.post('/management/contractors', options);
    };

    const deleteContractor = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete contractor?',
            message: `${selected.contractor} will be permanently removed from the contractor directory.`,
            confirmLabel: 'Delete contractor',
            tone: 'danger',
        });

        if (!confirmed) {
            return;
        }

        router.delete(`/management/contractors/${selected.con_id}`, {
            preserveScroll: true,
            onSuccess: resetForm,
        });
    };

    const openReport = async () => {
        if (!selected) return;
        setReportOpen(true);
        setReportLoading(true);
        setReport(null);
        try {
            const response = await fetch(`/management/contractors/${selected.con_id}/report`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!response.ok) throw new Error('Unable to load contractor report');
            setReport((await response.json()) as ContractorReport);
        } finally {
            setReportLoading(false);
        }
    };

    const field = (
        name: keyof ContractorForm,
        label: string,
        placeholder: string,
        icon: React.ReactNode,
        type = 'text',
    ) => (
        <label
            className={
                name === 'address'
                    ? 'contractor-field contractor-field--wide'
                    : 'contractor-field'
            }
        >
            <span>{label}</span>
            <div className="contractor-input">
                {icon}
                <input
                    type={type}
                    value={form.data[name]}
                    onChange={(event) => form.setData(name, event.target.value)}
                    placeholder={placeholder}
                />
            </div>
            {form.errors[name] && <small>{form.errors[name]}</small>}
        </label>
    );

    return (
        <>
            <Head title="Contractors" />
            <main className="contractors-page">
                <header className="contractors-header directory-heading-with-total">
                    <div>
                        <span>Contacts &amp; Users</span>
                        <h1>Contractors</h1>
                        <p>
                            Create and maintain contractor records in Weiss CRM.
                        </p>
                    </div>
                <section className="contractors-count directory-heading-total">
                    <div className="contractors-count__icon">
                        <BriefcaseBusiness />
                    </div>
                    <div>
                        <strong>{contractors.length}</strong>
                        <span>Total contractors</span>
                    </div>
                </section>
                </header>

                <div className="contractors-workspace">
                    <DirectoryNavigation active="Contractor">
                        <div className="contractors-directory-heading">
                            <div className="directory-heading-title-row">
                                <h2>Contractor directory</h2>
                                <span className="directory-inline-count">{filteredContractors.length}</span>
                            </div>
                            <p>Select a contractor to edit</p>
                        </div>
                        <label className="contractors-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search contractors"
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
                        <button type="button" className="contractors-report-button" disabled={vendorSelections.length === 0} onClick={moveSelectedToVendors}>
                            <MoveRight /> Move selected to Vendors ({vendorSelections.length})
                        </button>
                        <div className="contractors-list directory-navigation__scroll-list">
                            {filteredContractors.map((contractor) => (
                                <button
                                    type="button"
                                    key={contractor.con_id}
                                    className={
                                        selected?.con_id === contractor.con_id
                                            ? 'contractor-list-item contractor-list-item--active'
                                            : 'contractor-list-item'
                                    }
                                    onClick={() => selectContractor(contractor)}
                                >
                                    <input
                                        type="checkbox"
                                        aria-label={`Select ${contractor.contractor} to move to Vendors`}
                                        checked={vendorSelections.includes(contractor.con_id)}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => setVendorSelections((current) => event.target.checked ? [...current, contractor.con_id] : current.filter((id) => id !== contractor.con_id))}
                                    />
                                    <span className="contractor-avatar">
                                        {contractor.contractor
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <span>
                                        <strong>{contractor.contractor}</strong>
                                        <small>
                                            {contractor.point_of_contact
                                                ? `Point of Contact: ${contractor.point_of_contact}`
                                                : `${contractor.city}, ${contractor.state}`}
                                        </small>
                                    </span>
                                </button>
                            ))}
                            {filteredContractors.length === 0 && (
                                <div className="contractors-empty">
                                    <BriefcaseBusiness />
                                    <strong>No contractors found</strong>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>

                    <section className="contractors-form-panel">
                        <div className="contractors-form-title">
                            <div>
                                <h2>
                                    {selected
                                        ? 'Edit contractor'
                                        : 'Create contractor'}
                                </h2>
                                <p>
                                    {selected
                                        ? `Updating contractor #${selected.con_id}`
                                        : 'Add a contractor to your directory'}
                                </p>
                            </div>
                        </div>
                        <form onSubmit={submit} className="contractors-form">
                            {field(
                                'contractor',
                                'Contractor name',
                                'Contractor or business name',
                                <BriefcaseBusiness />,
                            )}
                            {field(
                                'point_of_contact',
                                'Point of Contact',
                                'Primary contact person',
                                <UserRound />,
                            )}
                            {field(
                                'email',
                                'Email',
                                'name@company.com',
                                <Mail />,
                                'email',
                            )}
                            {field(
                                'address',
                                'Address',
                                'Street address',
                                <MapPin />,
                            )}
                            {field('city', 'City', 'City', <MapPin />)}
                            {field('state', 'State', 'State', <MapPin />)}
                            {field(
                                'zip',
                                'ZIP code',
                                'ZIP',
                                <MapPin />,
                                'number',
                            )}
                            {field(
                                'phone',
                                'Phone',
                                'Phone number',
                                <Phone />,
                                'tel',
                            )}
                            {field(
                                'license',
                                'License number (optional)',
                                'License',
                                <BadgeCheck />,
                                'number',
                            )}
                            {field(
                                'lic_expire',
                                'License expires (optional)',
                                '',
                                <CalendarDays />,
                                'date',
                            )}
                            {field(
                                'worker_comp',
                                'Workers’ comp expires (optional)',
                                '',
                                <CalendarDays />,
                                'date',
                            )}
                            {field(
                                'insurance_expire',
                                'Insurance expires (optional)',
                                '',
                                <CalendarDays />,
                                'date',
                            )}
                            <div className="contractors-form-actions">
                                {selected && (
                                    <>
                                        <button type="button" className="contractors-report-button" onClick={openReport}><BarChart3 /> Contractor report</button>
                                        <button
                                            type="button"
                                            className="contractors-delete-button"
                                            onClick={deleteContractor}
                                        >
                                            <Trash2 />
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            className="contractors-reset-button"
                                            onClick={resetForm}
                                        >
                                            New contractor
                                        </button>
                                    </>
                                )}
                                <button
                                    type="submit"
                                    className="contractors-save-button"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create contractor'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
                <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                    <DialogContent className="contractor-report-modal">
                        <DialogHeader><DialogTitle>{selected?.contractor} — Contractor report</DialogTitle><DialogDescription>Invoices and payables linked to this contractor across all projects.</DialogDescription></DialogHeader>
                        {reportLoading ? <div className="contractor-report-loading">Loading report…</div> : report ? <>
                            <div className="contractor-report-summary">
                                <span><small>Invoices</small><strong>{report.summary.invoices}</strong></span>
                                <span><small>Invoice total</small><strong>{money.format(report.summary.invoice_total)}</strong></span>
                                <span><small>Invoice balance</small><strong>{money.format(report.summary.invoice_balance)}</strong></span>
                                <span><small>Payables</small><strong>{report.summary.payables}</strong></span>
                                <span><small>Payable total</small><strong>{money.format(report.summary.payable_total)}</strong></span>
                            </div>
                            <div className="contractor-report-table-wrap"><table><thead><tr><th>Type</th><th>Date</th><th>Project #</th><th>Customer</th><th>Invoice / Check</th><th>Amount</th><th>Balance</th><th>Status</th><th>Notes</th></tr></thead><tbody>
                                {report.rows.map((row) => <tr key={row.key}><td><b className={`contractor-report-kind is-${row.type.toLowerCase()}`}>{row.type}</b></td><td>{row.date || '—'}</td><td>{row.project_id ? <a href={`/management/projects?project=${row.project_id}&tab=INV`}>{row.project_number}</a> : row.project_number}</td><td>{row.customer}</td><td>{row.reference}</td><td><strong>{money.format(Number(row.amount))}</strong></td><td>{money.format(Number(row.balance))}</td><td>{row.status.replaceAll('_', ' ')}</td><td title={row.notes || ''}>{row.notes || '—'}</td></tr>)}
                                {report.rows.length === 0 && <tr><td colSpan={9}>No invoices or payables linked to this contractor.</td></tr>}
                            </tbody></table></div>
                        </> : <div className="contractor-report-loading">The report could not be loaded.</div>}
                    </DialogContent>
                </Dialog>
            </main>
        </>
    );
}
