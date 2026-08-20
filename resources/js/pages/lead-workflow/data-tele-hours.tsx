import { Head, router, useForm } from '@inertiajs/react';
import { CalendarDays, Clock3, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import DataSectionTabs from '@/components/data-section-tabs';
import { CRM_TIME_ZONE, crmDateKey } from '@/lib/crm-time';
import '@/../css/lead-data.css';
import '@/../css/data-tele-hours.css';

type HourRow = {
    agent_id: number;
    agent_name: string;
    work_date: string;
    first_login_at: string | null;
    last_logout_at: string | null;
    imported_seconds: number;
    manual_seconds: number;
    lunch_seconds: number;
    total_seconds: number;
    manual_override: boolean;
    sessions: number;
    manual_first_login: string | null;
    manual_first_logout: string | null;
    manual_second_login: string | null;
    manual_second_logout: string | null;
    leads_sent: number;
    note: string | null;
};

type AgentOption = { id: number; name: string };

const duration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

const attendanceDate = (value: string) => {
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    return new Date(hasTimezone ? value : `${value.replace(' ', 'T')}Z`);
};

export default function DataTeleHours({
    hours,
    agents,
    editableAgents,
    selectedDate,
    canManageManualHours,
}: {
    hours: HourRow[];
    agents: AgentOption[];
    editableAgents: AgentOption[];
    timezone: string;
    selectedDate: string;
    canManageManualHours: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<HourRow | null>(null);
    const [date, setDate] = useState(selectedDate);
    const time = useMemo(
        () => new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: CRM_TIME_ZONE,
            timeZoneName: 'short',
        }),
        [],
    );
    const form = useForm({
        agent_ids: [] as number[],
        agent_id: 0,
        work_date: crmDateKey(),
        calltools_login: '',
        calltools_logout: '',
        first_login: '',
        first_logout: '',
        imported_hours: '0',
        leads_sent: '0',
        lunch_hours: '0',
        note: '',
    });

    const applyDate = (event: React.FormEvent) => {
        event.preventDefault();
        router.get('/lead-workflow/data/tele-hours', { date }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                setEditing(null);
                form.reset('agent_ids', 'agent_id', 'calltools_login', 'calltools_logout', 'first_login', 'first_logout', 'imported_hours', 'leads_sent', 'lunch_hours', 'note');
            },
        };

        if (editing) {
            form.patch(`/lead-workflow/data/tele-hours/${editing.agent_id}/${editing.work_date}`, options);
        } else {
            form.post('/lead-workflow/data/tele-hours', options);
        }
    };

    const openInsert = () => {
        setEditing(null);
        form.reset();
        form.setData('work_date', selectedDate);
        setOpen(true);
    };

    const openEdit = (row: HourRow) => {
        const localTime = (utcValue: string | null) => {
            if (!utcValue) return '';
            const parts = new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
                timeZone: CRM_TIME_ZONE,
            }).formatToParts(attendanceDate(utcValue));

            return `${parts.find((part) => part.type === 'hour')?.value ?? ''}:${parts.find((part) => part.type === 'minute')?.value ?? ''}`;
        };
        setEditing(row);
        form.setData({
            agent_ids: [row.agent_id],
            agent_id: row.agent_id,
            work_date: row.work_date,
            calltools_login: localTime(row.first_login_at),
            calltools_logout: localTime(row.last_logout_at),
            first_login: row.manual_first_login?.slice(0, 5) || localTime(row.first_login_at),
            first_logout: row.manual_first_logout?.slice(0, 5) || localTime(row.last_logout_at),
            imported_hours: (row.imported_seconds / 3600).toFixed(2),
            leads_sent: row.leads_sent.toString(),
            lunch_hours: (row.lunch_seconds / 3600).toString(),
            note: row.note ?? '',
        });
        setOpen(true);
    };

    const deleteHours = (row: HourRow) => {
        if (!window.confirm(`Delete the entire Tele Hours row for ${row.agent_name} on ${row.work_date}? Raw CallTools history will remain preserved.`)) return;

        router.delete(`/lead-workflow/data/tele-hours/${row.agent_id}/${row.work_date}`, {
            preserveScroll: true,
        });
    };

    const toggleAgent = (agentId: number) => {
        form.setData(
            'agent_ids',
            form.data.agent_ids.includes(agentId)
                ? form.data.agent_ids.filter((id) => id !== agentId)
                : [...form.data.agent_ids, agentId],
        );
    };

    return (
        <>
            <Head title="Data - Tele Report" />
            <main className="lead-data-page data-hours-page">
                <DataSectionTabs active="Tele Report" />

                <form className="data-hours-filter" onSubmit={applyDate}>
                    <label>
                        <span>Date</span>
                        <div><CalendarDays /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
                    </label>
                    <button type="submit">Apply filter</button>
                    <button type="button" className="data-hours-today" onClick={() => {
                        const today = crmDateKey();
                        setDate(today);
                        router.get('/lead-workflow/data/tele-hours', { date: today });
                    }}>Today</button>
                    <p>Viewing agent hours for <strong>{selectedDate}</strong></p>
                    <button className="data-hours-add" type="button" onClick={openInsert}>
                        <Plus /> Insert hours
                    </button>
                </form>

                <section className="data-hours-card">
                    <div className="data-hours-card-title">
                        <div><Clock3 /><div><h2>Agent hour history</h2><span>Times shown in California time</span></div></div>
                        <strong>{hours.length.toLocaleString()} agents with hours</strong>
                    </div>
                    <div className="data-hours-table-wrap">
                        <table>
                            <thead><tr><th>Date</th><th>Agent</th><th>CallTools login</th><th>CallTools logout</th><th>Manual login</th><th>Manual logout</th><th>Leads sent</th><th>Imported</th><th>Lunch deducted</th><th>Manual</th><th>Net total</th><th>Note</th>{canManageManualHours && <th>Actions</th>}</tr></thead>
                            <tbody>
                                {hours.map((row) => (
                                    <tr key={`${row.agent_id}-${row.work_date}`}>
                                        <td>{row.work_date}</td><td><strong>{row.agent_name}</strong></td>
                                        <td>{row.first_login_at ? time.format(attendanceDate(row.first_login_at)) : '—'}</td>
                                        <td>{row.last_logout_at ? time.format(attendanceDate(row.last_logout_at)) : '—'}</td>
                                        <td>{row.manual_first_login || '—'}</td><td>{row.manual_first_logout || '—'}</td>
                                        <td><strong>{row.leads_sent}</strong></td><td>{duration(row.imported_seconds)}</td>
                                        <td>{row.lunch_seconds ? duration(row.lunch_seconds) : '—'}</td>
                                        <td>{row.manual_seconds ? duration(row.manual_seconds) : '—'}</td>
                                        <td className="data-hours-total">{duration(row.total_seconds)}{row.manual_override && <small className="data-hours-override">Manual</small>}</td>
                                        <td>{row.note || '—'}</td>
                                        {canManageManualHours && <td><div className="data-hours-row-actions"><button type="button" onClick={() => openEdit(row)} aria-label={`Edit hours for ${row.agent_name}`}><Pencil /></button><button type="button" className="is-delete" onClick={() => deleteHours(row)} aria-label={`Delete hours for ${row.agent_name}`}><Trash2 /></button></div></td>}
                                    </tr>
                                ))}
                                {hours.length === 0 && <tr><td className="data-hours-empty" colSpan={canManageManualHours ? 13 : 12}>No hour records are available yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {open && (
                <div className="data-hours-overlay" role="presentation" onMouseDown={() => { setOpen(false); setEditing(null); }}>
                    <section className="data-hours-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <header><div><h2>{editing ? 'Edit complete hour record' : 'Insert agent hours'}</h2><p>{editing ? `Update every displayed value for ${editing.agent_name}. Calculated totals refresh automatically.` : 'Apply the same hours to one or more agents for this day.'}</p></div><button type="button" onClick={() => { setOpen(false); setEditing(null); }}><X /></button></header>
                        <form onSubmit={submit}>
                            {!editing && <fieldset className="data-hours-agent-picker">
                                <legend>Agents <span>{form.data.agent_ids.length} selected</span></legend>
                                <div className="data-hours-agent-actions">
                                    <button type="button" onClick={() => form.setData('agent_ids', agents.map((agent) => agent.id))}>Select all</button>
                                    <button type="button" onClick={() => form.setData('agent_ids', [])}>Clear</button>
                                </div>
                                <div className="data-hours-agent-options">
                                    {agents.map((agent) => (
                                        <label key={agent.id} className={form.data.agent_ids.includes(agent.id) ? 'is-selected' : ''}>
                                            <input type="checkbox" checked={form.data.agent_ids.includes(agent.id)} onChange={() => toggleAgent(agent.id)} />
                                            <span>{agent.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <small>{form.errors.agent_ids}</small>
                            </fieldset>}
                            {editing && <label>Agent<select value={form.data.agent_id} onChange={(e) => form.setData('agent_id', Number(e.target.value))} required>{editableAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><small>{form.errors.agent_id}</small></label>}
                            <label>Date<input type="date" value={form.data.work_date} onChange={(e) => form.setData('work_date', e.target.value)} required /><small>{form.errors.work_date}</small></label>
                            {editing && <div className="data-hours-fields">
                                <label>CallTools login<input type="time" value={form.data.calltools_login} onChange={(e) => form.setData('calltools_login', e.target.value)} /><small>{form.errors.calltools_login}</small></label>
                                <label>CallTools logout<input type="time" value={form.data.calltools_logout} onChange={(e) => form.setData('calltools_logout', e.target.value)} /><small>{form.errors.calltools_logout}</small></label>
                                <label>Imported hours<input type="number" min="0" max="24" step="0.01" value={form.data.imported_hours} onChange={(e) => form.setData('imported_hours', e.target.value)} required /><small>{form.errors.imported_hours}</small></label>
                                <label>Leads sent<input type="number" min="0" step="1" value={form.data.leads_sent} onChange={(e) => form.setData('leads_sent', e.target.value)} required /><small>{form.errors.leads_sent}</small></label>
                            </div>}
                            <div className="data-hours-fields">
                                <label>First login<input type="time" value={form.data.first_login} onChange={(e) => form.setData('first_login', e.target.value)} required /><small>{form.errors.first_login}</small></label>
                                <label>Final logout<input type="time" value={form.data.first_logout} onChange={(e) => form.setData('first_logout', e.target.value)} required /><small>{form.errors.first_logout}</small></label>
                                <label>Lunch hours<input type="number" min="0" max="24" step="0.25" value={form.data.lunch_hours} onChange={(e) => form.setData('lunch_hours', e.target.value)} required /><small>{form.errors.lunch_hours}</small></label>
                            </div>
                            <label>Note (optional)<textarea rows={3} maxLength={500} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} placeholder="Reason or details for this manual entry" /><small>{form.errors.note}</small></label>
                            <footer><button type="button" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</button><button type="submit" disabled={form.processing || form.data.agent_ids.length === 0}>{form.processing ? 'Saving…' : editing ? 'Save changes' : `Save for ${form.data.agent_ids.length || 0} agent${form.data.agent_ids.length === 1 ? '' : 's'}`}</button></footer>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}
