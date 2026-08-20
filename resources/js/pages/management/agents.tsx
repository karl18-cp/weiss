import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    BarChart3,
    LockKeyhole,
    Save,
    Search,
    Trash2,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/agents.css';
import DirectoryNavigation from '@/components/directory-navigation';
import AccountStatusControl from '@/components/account-status-control';
import { useSystemModal } from '@/components/system-modal-provider';
import type { PermissionAccess } from '@/components/module-permissions-editor';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Agent = {
    agent_id: number;
    agent_name: string;
    inactive_at: string | null;
    account: { acc_id: number; username: string; suspended_at: string | null } | null;
    company: { com_id: number; company: string } | null;
    permissions: { module: string; access_level: PermissionAccess }[];
};

type Company = { com_id: number; company: string };
type AgentReport = {
    agent: { id: number; name: string };
    summary: { appointments: number; confirmed: number; dispatched: number; sold: number; last_sale: string | null };
    rows: Array<{
        id: number; origin_at: string | null; appointment_at: string | null;
        customer: string; result: string; confirmed: boolean; dispatched: boolean;
        sold: boolean; city: string | null; notes: string;
    }>;
};

export default function Agents({
    agents,
    companies,
    permissionModules,
}: {
    agents: Agent[];
    companies: Company[];
    permissionModules: Record<string, string>;
}) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Agent | null>(null);
    const [search, setSearch] = useState('');
    const [directoryStatus, setDirectoryStatus] = useState<'active' | 'inactive'>('active');
    const [report, setReport] = useState<AgentReport | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const blankPermissions = Object.fromEntries(
        Object.keys(permissionModules).map((module) => [module, 'none']),
    ) as Record<string, PermissionAccess>;
    const form = useForm({
        agent_name: '',
        company_id: '',
        username: '',
        password: '',
        suspended: false,
        permissions: blankPermissions,
    });

    const filteredAgents = useMemo(() => {
        const query = search.trim().toLowerCase();
        const statusFiltered = agents.filter((agent) =>
            directoryStatus === 'inactive'
                ? Boolean(agent.inactive_at)
                : !agent.inactive_at,
        );

        return query
            ? statusFiltered.filter((agent) =>
                  agent.agent_name.toLowerCase().includes(query),
              )
            : statusFiltered;
    }, [agents, directoryStatus, search]);

    const resetForm = () => {
        setSelected(null);
        form.setData({
            agent_name: '',
            company_id: '',
            username: '',
            password: '',
            suspended: false,
            permissions: blankPermissions,
        });
        form.clearErrors();
    };

    const selectAgent = (agent: Agent) => {
        setSelected(agent);
        form.setData({
            agent_name: agent.agent_name,
            company_id: String(agent.company?.com_id ?? ''),
            username: agent.account?.username ?? '',
            password: '',
            suspended: Boolean(agent.inactive_at),
            permissions: {
                ...blankPermissions,
                ...Object.fromEntries(
                    agent.permissions.map((permission) => [
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
            form.put(`/management/agents/${selected.agent_id}`, options);

            return;
        }

        form.post('/management/agents', options);
    };

    const deleteAgent = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete agent?',
            message: `${selected.agent_name} will be deleted if they have no lead history. If leads reference this agent, they will be moved to Inactive instead.`,
            confirmLabel: 'Delete agent',
            tone: 'danger',
        });

        if (!confirmed) {
            return;
        }

        router.delete(`/management/agents/${selected.agent_id}`, {
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
            const response = await fetch(`/management/agents/${selected.agent_id}/report`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('Unable to load report');
            setReport((await response.json()) as AgentReport);
        } finally {
            setReportLoading(false);
        }
    };

    const reportDate = (value: string | null) =>
        value
            ? new Intl.DateTimeFormat('en-US', {
                  month: '2-digit', day: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit',
              }).format(new Date(value))
            : '—';

    return (
        <>
            <Head title="Agents" />
            <main className="agents-page">
                <header className="agents-header directory-heading-with-total">
                    <div className="directory-heading-copy">
                        <span>Contacts &amp; Users</span>
                        <h1>Agents</h1>
                        <p>Create and maintain agent records in Weiss CRM.</p>
                    </div>
                    <section className="agents-count directory-heading-total">
                        <div><Users /></div>
                        <span><strong>{agents.length}</strong><small>Total agents</small></span>
                    </section>
                </header>

                <div className="agents-workspace">
                    <DirectoryNavigation
                        active="Agent"
                        status={directoryStatus}
                        onStatusChange={(status) => {
                            setDirectoryStatus(status);
                            resetForm();
                            setSearch('');
                        }}
                    >
                        <div className="agents-directory-heading">
                            <div className="directory-heading-title-row">
                                <h2>Agent directory</h2>
                                <span className="directory-inline-count">{filteredAgents.length}</span>
                            </div>
                            <p>Select an agent to edit</p>
                        </div>
                        <label className="agents-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search agents"
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
                            {filteredAgents.map((agent) => (
                                <button
                                    type="button"
                                    key={agent.agent_id}
                                    className={
                                        selected?.agent_id === agent.agent_id
                                            ? 'agent-list-item agent-list-item--active'
                                            : 'agent-list-item'
                                    }
                                    onClick={() => selectAgent(agent)}
                                >
                                    <span className="agent-avatar">
                                        {agent.agent_name
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <span>
                                        <strong>{agent.agent_name}</strong>
                                        <small>
                                            {agent.company?.company ??
                                                'No company'}{' '}
                                            - Agent #{agent.agent_id}
                                        </small>
                                    </span>
                                </button>
                            ))}
                            {filteredAgents.length === 0 && (
                                <div className="agents-empty">
                                    <UserRound />
                                    <strong>No agents found</strong>
                                    <span>
                                        {search
                                            ? 'Try another search.'
                                            : 'Create your first agent.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>

                    <section className="agents-form-panel">
                        <div className="agents-form-title">
                            <div>
                                <h2>{selected ? 'Edit agent' : 'Create agent'}</h2>
                                {selected && (
                                    <button type="button" className="agents-report-button" onClick={openReport}>
                                        <BarChart3 /> Agent report
                                    </button>
                                )}
                            </div>
                            <p>
                                {selected
                                    ? `Updating agent #${selected.agent_id}`
                                    : 'Add an agent to your directory'}
                            </p>
                        </div>
                        <form onSubmit={submit} className="agents-form">
                            <label>
                                <span>Agent name</span>
                                <div className="agents-input">
                                    <UserRound />
                                    <input
                                        value={form.data.agent_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'agent_name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter the agent name"
                                        autoFocus
                                    />
                                </div>
                                {form.errors.agent_name && (
                                    <small>{form.errors.agent_name}</small>
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
                            <AccountStatusControl
                                suspended={form.data.suspended}
                                onChange={(suspended) =>
                                    form.setData('suspended', suspended)
                                }
                            />
                            <div className="agents-form-actions">
                                {selected && (
                                    <>
                                        <button
                                            type="button"
                                            className="agents-delete-button"
                                            onClick={deleteAgent}
                                        >
                                            <Trash2 />
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            className="agents-reset-button"
                                            onClick={resetForm}
                                        >
                                            New agent
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
                                        ? 'Saving...'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create agent'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
                <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                    <DialogContent className="agent-report-modal">
                        <DialogHeader>
                            <DialogTitle>{selected?.agent_name} — Agent report</DialogTitle>
                            <DialogDescription>
                                Appointments, confirmations, dispatched leads, and sold projects assigned to this agent.
                            </DialogDescription>
                        </DialogHeader>
                        {reportLoading ? (
                            <div className="agent-report-loading">Loading report…</div>
                        ) : report ? (
                            <>
                                <div className="agent-report-summary">
                                    <span><small>Appointments</small><strong>{report.summary.appointments}</strong></span>
                                    <span><small>Confirmed</small><strong>{report.summary.confirmed}</strong></span>
                                    <span><small>Dispatched</small><strong>{report.summary.dispatched}</strong></span>
                                    <span><small>Sold</small><strong>{report.summary.sold}</strong></span>
                                    <span><small>Last sale</small><strong>{reportDate(report.summary.last_sale)}</strong></span>
                                </div>
                                <div className="agent-report-table-wrap">
                                    <table>
                                        <thead><tr><th>Origin</th><th>Appointment</th><th>Customer</th><th>Result</th><th>Conf.</th><th>Dispatched</th><th>Sold</th><th>City</th><th>Notes</th></tr></thead>
                                        <tbody>
                                            {report.rows.map((row) => (
                                                <tr key={row.id}>
                                                    <td>{reportDate(row.origin_at)}</td><td>{reportDate(row.appointment_at)}</td>
                                                    <td><strong>{row.customer}</strong></td><td>{row.result}</td>
                                                    <td>{row.confirmed ? '✓' : '—'}</td><td>{row.dispatched ? '✓' : '—'}</td><td>{row.sold ? '✓' : '—'}</td>
                                                    <td>{row.city || '—'}</td><td title={row.notes}>{row.notes || '—'}</td>
                                                </tr>
                                            ))}
                                            {report.rows.length === 0 && <tr><td colSpan={9}>No appointment records found.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : <div className="agent-report-loading">The report could not be loaded.</div>}
                    </DialogContent>
                </Dialog>
            </main>
        </>
    );
}
