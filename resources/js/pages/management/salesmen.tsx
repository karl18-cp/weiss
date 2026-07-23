import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
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
import { useSystemModal } from '@/components/system-modal-provider';
import ModulePermissionsEditor, {
    type PermissionAccess,
} from '@/components/module-permissions-editor';

type Salesman = {
    salesman_id: number;
    salesman_name: string;
    phone: string | null;
    account: { acc_id: number; username: string } | null;
    company: { com_id: number; company: string } | null;
    permissions: { module: string; access_level: PermissionAccess }[];
};

type Company = { com_id: number; company: string };

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
    const blankPermissions = Object.fromEntries(
        Object.keys(permissionModules).map((module) => [module, 'none']),
    ) as Record<string, PermissionAccess>;
    const form = useForm({
        salesman_name: '',
        phone: '',
        company_id: '',
        username: '',
        password: '',
        permissions: blankPermissions,
    });

    const filteredSalesmen = useMemo(() => {
        const query = search.trim().toLowerCase();

        return query
            ? salesmen.filter((salesman) =>
                  [salesman.salesman_name, salesman.phone]
                      .join(' ')
                      .toLowerCase()
                      .includes(query),
              )
            : salesmen;
    }, [salesmen, search]);

    const resetForm = () => {
        setSelected(null);
        form.setData({
            salesman_name: '',
            phone: '',
            company_id: '',
            username: '',
            password: '',
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

    return (
        <>
            <Head title="Salesmen" />
            <main className="agents-page salesmen-page">
                <header className="agents-header">
                    <span>Contacts &amp; Users</span>
                    <h1>Salesmen</h1>
                    <p>Create and maintain salesman records in Weiss CRM.</p>
                </header>
                <section className="agents-count">
                    <div>
                        <Users />
                    </div>
                    <span>
                        <strong>{salesmen.length}</strong>
                        <small>Total salesmen</small>
                    </span>
                </section>
                <div className="agents-workspace">
                    <DirectoryNavigation active="Salesman">
                        <div className="agents-directory-heading">
                            <h2>Salesman directory</h2>
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
                                            · {salesman.phone || 'No phone'}
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
                            <ModulePermissionsEditor
                                roleLabel="salesman"
                                modules={permissionModules}
                                permissions={form.data.permissions}
                                onChange={(permissions) =>
                                    form.setData('permissions', permissions)
                                }
                            />
                            <div className="agents-form-actions">
                                {selected && (
                                    <>
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
            </main>
        </>
    );
}
