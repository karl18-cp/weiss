import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    KeyRound,
    Phone,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/managers.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';

type Access = 'none' | 'view' | 'edit';
type Manager = {
    manager_id: number;
    manager_name: string;
    phone: string;
    manager_types: string[];
    account: { acc_id: number; username: string };
    company: { com_id: number; company: string } | null;
    companies: { com_id: number; company: string }[];
    permissions: { module: string; access_level: Access }[];
};
type Company = { com_id: number; company: string };

export default function Managers({
    managers,
    companies,
    managerTypes,
    permissionModules,
}: {
    managers: Manager[];
    companies: Company[];
    managerTypes: string[];
    permissionModules: Record<string, string>;
}) {
    const { confirm } = useSystemModal();
    const blankPermissions = Object.fromEntries(
        Object.keys(permissionModules).map((key) => [key, 'none']),
    ) as Record<string, Access>;
    const [selected, setSelected] = useState<Manager | null>(null);
    const [search, setSearch] = useState('');
    const form = useForm({
        manager_name: '',
        username: '',
        phone: '',
        password: '',
        company_ids: [] as string[],
        manager_types: [] as string[],
        permissions: blankPermissions,
    });
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        return q
            ? managers.filter((manager) =>
                  [
                      manager.manager_name,
                      manager.account.username,
                      ...manager.companies.map((company) => company.company),
                  ]
                      .join(' ')
                      .toLowerCase()
                      .includes(q),
              )
            : managers;
    }, [managers, search]);

    const reset = () => {
        setSelected(null);
        form.setData({
            manager_name: '',
            username: '',
            phone: '',
            password: '',
            company_ids: [],
            manager_types: [],
            permissions: blankPermissions,
        });
        form.clearErrors();
    };
    const choose = (manager: Manager) => {
        setSelected(manager);
        form.setData({
            manager_name: manager.manager_name,
            username: manager.account.username,
            phone: manager.phone,
            password: '',
            company_ids: manager.companies.map((company) => String(company.com_id)),
            manager_types: manager.manager_types,
            permissions: {
                ...blankPermissions,
                ...Object.fromEntries(
                    manager.permissions.map((permission) => [
                        permission.module,
                        permission.access_level,
                    ]),
                ),
            },
        });
        form.clearErrors();
    };
    const toggleType = (type: string) =>
        form.setData(
            'manager_types',
            form.data.manager_types.includes(type)
                ? form.data.manager_types.filter((item) => item !== type)
                : [...form.data.manager_types, type],
        );
    const toggleCompany = (companyId: number) => {
        const value = String(companyId);
        form.setData(
            'company_ids',
            form.data.company_ids.includes(value)
                ? form.data.company_ids.filter((id) => id !== value)
                : [...form.data.company_ids, value],
        );
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: reset };

        if (selected) {
            form.put(`/management/managers/${selected.manager_id}`, options);
        } else {
            form.post('/management/managers', options);
        }
    };
    const remove = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete manager account?',
            message: `${selected.manager_name} and their login account will be permanently deleted.`,
            confirmLabel: 'Delete manager',
            tone: 'danger',
        });

        if (confirmed) {
            router.delete(`/management/managers/${selected.manager_id}`, {
                preserveScroll: true,
                onSuccess: reset,
            });
        }
    };
    const visible = Object.values(form.data.permissions).filter(
        (value) => value !== 'none',
    ).length;
    const editable = Object.values(form.data.permissions).filter(
        (value) => value === 'edit',
    ).length;

    return (
        <>
            <Head title="Managers" />
            <main className="managers-page">
                <header className="managers-header">
                    <span>Contacts &amp; Users</span>
                    <h1>Managers</h1>
                    <p>Create manager accounts and control their access.</p>
                </header>
                <div className="managers-workspace">
                    <DirectoryNavigation active="Managers">
                        <div className="managers-directory-heading">
                            <h2>Manager directory</h2>
                            <p>{managers.length} manager accounts</p>
                        </div>
                        <label className="managers-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search managers"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                >
                                    <X />
                                </button>
                            )}
                        </label>
                        <div className="managers-list directory-navigation__scroll-list">
                            {filtered.map((manager) => (
                                <button
                                    type="button"
                                    key={manager.manager_id}
                                    className={
                                        selected?.manager_id ===
                                        manager.manager_id
                                            ? 'manager-item is-active'
                                            : 'manager-item'
                                    }
                                    onClick={() => choose(manager)}
                                >
                                    <span>
                                        {manager.manager_name.charAt(0)}
                                    </span>
                                    <div>
                                        <strong>{manager.manager_name}</strong>
                                        <small>
                                            {manager.account.username}
                                        </small>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </DirectoryNavigation>
                    <section className="manager-editor">
                        <div className="manager-editor__heading">
                            <div>
                                <h2>
                                    {selected
                                        ? 'Edit manager'
                                        : 'Create manager'}
                                </h2>
                                <p>
                                    {selected
                                        ? 'Update this account and its permissions.'
                                        : 'Add a manager with system access.'}
                                </p>
                            </div>
                            {selected && (
                                <button type="button" onClick={reset}>
                                    New manager
                                </button>
                            )}
                        </div>
                        <form onSubmit={submit} className="manager-form">
                            <div className="manager-fields">
                                <label>
                                    <span>Name</span>
                                    <div>
                                        <UserRound />
                                        <input
                                            value={form.data.manager_name}
                                            onChange={(e) =>
                                                form.setData(
                                                    'manager_name',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Manager name"
                                        />
                                    </div>
                                    <em>{form.errors.manager_name}</em>
                                </label>
                                <label>
                                    <span>Username</span>
                                    <div>
                                        <UserRound />
                                        <input
                                            value={form.data.username}
                                            onChange={(e) =>
                                                form.setData(
                                                    'username',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Login username"
                                        />
                                    </div>
                                    <em>{form.errors.username}</em>
                                </label>
                                <label>
                                    <span>Phone number</span>
                                    <div>
                                        <Phone />
                                        <input
                                            value={form.data.phone}
                                            onChange={(e) =>
                                                form.setData(
                                                    'phone',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Phone number"
                                        />
                                    </div>
                                    <em>{form.errors.phone}</em>
                                </label>
                                <label>
                                    <span>
                                        Password{' '}
                                        {selected && '(leave blank to keep)'}
                                    </span>
                                    <div>
                                        <KeyRound />
                                        <input
                                            type="password"
                                            value={form.data.password}
                                            onChange={(e) =>
                                                form.setData(
                                                    'password',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder={
                                                selected
                                                    ? 'Keep current password'
                                                    : 'Minimum 8 characters'
                                            }
                                        />
                                    </div>
                                    <em>{form.errors.password}</em>
                                </label>
                            </div>
                            <section className="manager-companies">
                                <h3><Building2 /> Assigned companies</h3>
                                <p>Select one or more companies this manager is assigned to.</p>
                                <div>
                                    {companies.map((company) => (
                                        <label key={company.com_id}>
                                            <input
                                                type="checkbox"
                                                checked={form.data.company_ids.includes(String(company.com_id))}
                                                onChange={() => toggleCompany(company.com_id)}
                                            />
                                            <span>{company.company}</span>
                                        </label>
                                    ))}
                                </div>
                                {form.errors.company_ids && <em>{form.errors.company_ids}</em>}
                            </section>
                            <section className="manager-types">
                                <h3>Manager roles</h3>
                                <div>
                                    {managerTypes.map((type) => (
                                        <label key={type}>
                                            <span>{type}</span>
                                            <input
                                                type="checkbox"
                                                checked={form.data.manager_types.includes(
                                                    type,
                                                )}
                                                onChange={() =>
                                                    toggleType(type)
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                                {form.errors.manager_types && (
                                    <em>{form.errors.manager_types}</em>
                                )}
                            </section>
                            <section className="manager-permissions">
                                <header>
                                    <div>
                                        <ShieldCheck />
                                        <span>
                                            <strong>User permissions</strong>
                                            <small>
                                                Choose access separately for
                                                this manager.
                                            </small>
                                        </span>
                                    </div>
                                    <b>
                                        {visible} visible, {editable} editable
                                    </b>
                                </header>
                                <div className="manager-permission-grid">
                                    {Object.entries(permissionModules).map(
                                        ([module, label]) => (
                                            <label key={module}>
                                                <span>{label}</span>
                                                <select
                                                    value={
                                                        form.data.permissions[
                                                            module
                                                        ]
                                                    }
                                                    onChange={(e) =>
                                                        form.setData(
                                                            'permissions',
                                                            {
                                                                ...form.data
                                                                    .permissions,
                                                                [module]: e
                                                                    .target
                                                                    .value as Access,
                                                            },
                                                        )
                                                    }
                                                >
                                                    <option value="none">
                                                        None
                                                    </option>
                                                    <option value="view">
                                                        View
                                                    </option>
                                                    <option value="edit">
                                                        Edit
                                                    </option>
                                                </select>
                                            </label>
                                        ),
                                    )}
                                </div>
                            </section>
                            <footer className="manager-actions">
                                {selected && (
                                    <button
                                        type="button"
                                        className="manager-delete"
                                        onClick={remove}
                                    >
                                        <Trash2 />
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="manager-save"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create manager'}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
