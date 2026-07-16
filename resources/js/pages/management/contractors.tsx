import { Head, router, useForm } from '@inertiajs/react';
import {
    BadgeCheck,
    BriefcaseBusiness,
    CalendarDays,
    Mail,
    MapPin,
    Phone,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/contractors.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';

type Contractor = {
    con_id: number;
    contractor: string;
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

const emptyForm: ContractorForm = {
    contractor: '',
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
    const form = useForm<ContractorForm>(emptyForm);

    const filteredContractors = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
return contractors;
}

        return contractors.filter((contractor) =>
            [
                contractor.contractor,
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
                <header className="contractors-header">
                    <div>
                        <span>Contacts &amp; Users</span>
                        <h1>Contractors</h1>
                        <p>
                            Create and maintain contractor records in Weiss CRM.
                        </p>
                    </div>
                </header>

                <section className="contractors-count">
                    <div className="contractors-count__icon">
                        <BriefcaseBusiness />
                    </div>
                    <div>
                        <strong>{contractors.length}</strong>
                        <span>Total contractors</span>
                    </div>
                </section>

                <div className="contractors-workspace">
                    <DirectoryNavigation active="Contractor">
                        <div className="contractors-directory-heading">
                            <h2>Contractor directory</h2>
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
                                    <span className="contractor-avatar">
                                        {contractor.contractor
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <span>
                                        <strong>{contractor.contractor}</strong>
                                        <small>
                                            {contractor.city},{' '}
                                            {contractor.state}
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
                                'number',
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
            </main>
        </>
    );
}
