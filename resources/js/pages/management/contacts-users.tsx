import { Head, router, useForm } from '@inertiajs/react';
import {
    Archive,
    Building2,
    FolderKanban,
    Hash,
    MapPin,
    RotateCcw,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/companies.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';

type Company = {
    com_id: number;
    company: string;
    address: string;
    prefix: string;
    project_code: string;
    archived_at: string | null;
};

type CompanyForm = Omit<Company, 'com_id' | 'archived_at'>;

const emptyForm: CompanyForm = {
    company: '',
    address: '',
    prefix: '',
    project_code: '',
};

export default function ContactsUsers({
    companies,
    archivedCompanies,
}: {
    companies: Company[];
    archivedCompanies: Company[];
}) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Company | null>(null);
    const [search, setSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const form = useForm<CompanyForm>(emptyForm);

    const filteredCompanies = useMemo(() => {
        const query = search.trim().toLowerCase();
        const directory = showArchived ? archivedCompanies : companies;

        if (!query) {
            return directory;
        }

        return directory.filter((company) =>
            [company.company, company.address, company.project_code]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [archivedCompanies, companies, search, showArchived]);

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

    const changeDirectory = (archived: boolean) => {
        setShowArchived(archived);
        setSearch('');
        startNewCompany();
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

    const deleteCompany = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: showArchived
                ? 'Permanently delete company?'
                : 'Delete company?',
            message: showArchived
                ? `${selected.company} will be permanently deleted. This action cannot be undone.`
                : `${selected.company} will be deleted from the company directory.`,
            confirmLabel: showArchived
                ? 'Delete permanently'
                : 'Delete company',
            tone: 'danger',
        });

        if (!confirmed) {
            return;
        }

        router.delete(`/management/contacts-users/${selected.com_id}`, {
            preserveScroll: true,
            onSuccess: startNewCompany,
        });
    };

    const archiveCompany = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Archive company?',
            message: `${selected.company} will be removed from active company selections and moved to the archive.`,
            confirmLabel: 'Archive company',
            tone: 'warning',
        });

        if (!confirmed) {
            return;
        }

        router.patch(
            `/management/contacts-users/${selected.com_id}/archive`,
            {},
            {
                preserveScroll: true,
                onSuccess: startNewCompany,
            },
        );
    };

    const restoreCompany = () => {
        if (!selected) {
            return;
        }

        router.patch(
            `/management/contacts-users/${selected.com_id}/restore`,
            {},
            {
                preserveScroll: true,
                onSuccess: startNewCompany,
            },
        );
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
                                <h2>
                                    {showArchived
                                        ? 'Archived companies'
                                        : 'Company directory'}
                                </h2>
                                <p>
                                    {showArchived
                                        ? 'Select a company to restore'
                                        : 'Select a company to edit'}
                                </p>
                            </div>
                        </div>

                        <div className="companies-directory-toggle">
                            <button
                                type="button"
                                className={!showArchived ? 'is-active' : ''}
                                onClick={() => changeDirectory(false)}
                            >
                                Active <span>{companies.length}</span>
                            </button>
                            <button
                                type="button"
                                className={showArchived ? 'is-active' : ''}
                                onClick={() => changeDirectory(true)}
                            >
                                Archived <span>{archivedCompanies.length}</span>
                            </button>
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
                                            : showArchived
                                              ? 'Archived companies will appear here.'
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
                                    {showArchived
                                        ? selected
                                            ? 'Archived company'
                                            : 'Company archive'
                                        : selected
                                          ? 'Edit company'
                                          : 'Create company'}
                                </h2>
                                <p>
                                    {showArchived
                                        ? selected
                                            ? `Archived company #${selected.com_id}`
                                            : 'Select a company from the archive'
                                        : selected
                                          ? `Updating company #${selected.com_id}`
                                          : 'Add a company to your directory'}
                                </p>
                            </div>
                        </div>

                        {showArchived && !selected ? (
                            <div className="companies-archive-placeholder">
                                <Archive />
                                <strong>No archived company selected</strong>
                                <span>
                                    Choose one from the directory to view,
                                    restore, or permanently delete it.
                                </span>
                            </div>
                        ) : (
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
                                            disabled={showArchived}
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
                                            disabled={showArchived}
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
                                            disabled={showArchived}
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
                                            disabled={showArchived}
                                        />
                                    </div>
                                    {form.errors.project_code && (
                                        <small>
                                            {form.errors.project_code}
                                        </small>
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
                                    {selected && !showArchived && (
                                        <button
                                            type="button"
                                            className="companies-archive-button"
                                            onClick={archiveCompany}
                                        >
                                            <Archive />
                                            Archive
                                        </button>
                                    )}
                                    {selected && showArchived ? (
                                        <button
                                            type="button"
                                            className="companies-restore-button"
                                            onClick={restoreCompany}
                                        >
                                            <RotateCcw />
                                            Restore
                                        </button>
                                    ) : (
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
                                    )}
                                </div>
                            </form>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}
