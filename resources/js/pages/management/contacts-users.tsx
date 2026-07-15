import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    FolderKanban,
    Hash,
    MapPin,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/companies.css';
import DirectoryNavigation from '@/components/directory-navigation';

type Company = {
    com_id: number;
    company: string;
    address: string;
    prefix: string;
    project_code: string;
};

type CompanyForm = Omit<Company, 'com_id'>;

const emptyForm: CompanyForm = {
    company: '',
    address: '',
    prefix: '',
    project_code: '',
};

export default function ContactsUsers({ companies }: { companies: Company[] }) {
    const [selected, setSelected] = useState<Company | null>(null);
    const [search, setSearch] = useState('');
    const form = useForm<CompanyForm>(emptyForm);

    const filteredCompanies = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return companies;

        return companies.filter((company) =>
            [company.company, company.address, company.project_code]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [companies, search]);

    const selectCompany = (company: Company) => {
        setSelected(company);
        form.setData({
            company: company.company,
            address: company.address,
            prefix: company.prefix,
            project_code: company.project_code,
        });
        form.clearErrors();
    };

    const startNewCompany = () => {
        setSelected(null);
        form.setData(emptyForm);
        form.clearErrors();
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: startNewCompany,
        };

        if (selected) {
            form.put(`/management/contacts-users/${selected.com_id}`, options);
            return;
        }

        form.post('/management/contacts-users', options);
    };

    const deleteCompany = () => {
        if (!selected || !window.confirm(`Delete ${selected.company}?`)) return;

        router.delete(`/management/contacts-users/${selected.com_id}`, {
            preserveScroll: true,
            onSuccess: startNewCompany,
        });
    };

    return (
        <>
            <Head title="Companies" />
            <main className="companies-page">
                <header className="companies-header">
                    <div>
                        <span className="companies-eyebrow">Management</span>
                        <h1>Companies</h1>
                        <p>
                            Create and maintain the companies available in Weiss
                            CRM.
                        </p>
                    </div>
                </header>

                <section className="companies-stats">
                    <div className="companies-stat-icon">
                        <Building2 />
                    </div>
                    <div>
                        <strong>{companies.length}</strong>
                        <span>Total companies</span>
                    </div>
                </section>

                <div className="companies-workspace">
                    <DirectoryNavigation active="Companies">
                        <div className="companies-panel-title companies-directory-title">
                            <div>
                                <h2>Company directory</h2>
                                <p>Select a company to edit</p>
                            </div>
                        </div>

                        <label className="companies-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search companies"
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

                        <div className="companies-list directory-navigation__scroll-list">
                            {filteredCompanies.map((company) => (
                                <button
                                    type="button"
                                    key={company.com_id}
                                    className={
                                        selected?.com_id === company.com_id
                                            ? 'company-list-item company-list-item--active'
                                            : 'company-list-item'
                                    }
                                    onClick={() => selectCompany(company)}
                                >
                                    <span className="company-list-avatar">
                                        {company.company
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <span className="company-list-copy">
                                        <strong>{company.company}</strong>
                                        <small>{company.project_code}</small>
                                    </span>
                                </button>
                            ))}

                            {filteredCompanies.length === 0 && (
                                <div className="companies-empty">
                                    <Building2 />
                                    <strong>No companies found</strong>
                                    <span>
                                        {search
                                            ? 'Try another search.'
                                            : 'Create your first company.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>

                    <section className="companies-form-panel">
                        <div className="companies-panel-title">
                            <div>
                                <h2>
                                    {selected
                                        ? 'Edit company'
                                        : 'Create company'}
                                </h2>
                                <p>
                                    {selected
                                        ? `Updating company #${selected.com_id}`
                                        : 'Add a company to your directory'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={submit} className="companies-form">
                            <label className="company-field company-field--wide">
                                <span>Company name</span>
                                <div className="company-input">
                                    <Building2 />
                                    <input
                                        value={form.data.company}
                                        onChange={(event) =>
                                            form.setData(
                                                'company',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="e.g. Bright Horizon"
                                        autoFocus
                                    />
                                </div>
                                {form.errors.company && (
                                    <small>{form.errors.company}</small>
                                )}
                            </label>

                            <label className="company-field company-field--wide">
                                <span>Address (optional)</span>
                                <div className="company-input">
                                    <MapPin />
                                    <input
                                        value={form.data.address}
                                        onChange={(event) =>
                                            form.setData(
                                                'address',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Add an address later"
                                    />
                                </div>
                                {form.errors.address && (
                                    <small>{form.errors.address}</small>
                                )}
                            </label>

                            <label className="company-field">
                                <span>Prefix</span>
                                <div className="company-input">
                                    <Hash />
                                    <input
                                        value={form.data.prefix}
                                        onChange={(event) =>
                                            form.setData(
                                                'prefix',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="e.g. BH"
                                    />
                                </div>
                                {form.errors.prefix && (
                                    <small>{form.errors.prefix}</small>
                                )}
                            </label>

                            <label className="company-field">
                                <span>Project code</span>
                                <div className="company-input">
                                    <FolderKanban />
                                    <input
                                        value={form.data.project_code}
                                        onChange={(event) =>
                                            form.setData(
                                                'project_code',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="e.g. BH-001"
                                    />
                                </div>
                                {form.errors.project_code && (
                                    <small>{form.errors.project_code}</small>
                                )}
                            </label>

                            <div className="companies-form-actions">
                                {selected && (
                                    <button
                                        type="button"
                                        className="companies-delete-button"
                                        onClick={deleteCompany}
                                    >
                                        <Trash2 />
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="companies-primary-button"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create company'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
