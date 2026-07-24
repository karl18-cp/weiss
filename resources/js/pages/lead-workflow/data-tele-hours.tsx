import { Head, router, useForm } from '@inertiajs/react';
import { CalendarDays, Clock3, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DataSectionTabs from '@/components/data-section-tabs';
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

export default function DataTeleHours({
    hours,
    agents,
    timezone,
    selectedDate,
}: {
    hours: HourRow[];
    agents: AgentOption[];
    timezone: string;
    selectedDate: string;
}) {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(selectedDate);
    const deviceTimezone = useMemo(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone || timezone,
        [timezone],
    );
    const time = useMemo(
        () => new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: deviceTimezone,
            timeZoneName: 'short',
        }),
        [deviceTimezone],
    );
    const form = useForm({
        agent_ids: [] as number[],
        work_date: new Date().toLocaleDateString('en-CA'),
        first_login: '',
        first_logout: '',
        lunch_hours: '0',
        note: '',
    });

    useEffect(() => {
        if (timezone !== deviceTimezone) {
            window.location.replace(`/lead-workflow/data/tele-hours?date=${selectedDate}&timezone=${encodeURIComponent(deviceTimezone)}`);
        }
    }, [deviceTimezone, selectedDate, timezone]);

    const applyDate = (event: React.FormEvent) => {
        event.preventDefault();
        router.get('/lead-workflow/data/tele-hours', { date, timezone: deviceTimezone }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post('/lead-workflow/data/tele-hours', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset('agent_ids', 'first_login', 'first_logout', 'lunch_hours', 'note');
            },
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
                        const today = new Date().toLocaleDateString('en-CA');
                        setDate(today);
                        router.get('/lead-workflow/data/tele-hours', { date: today, timezone: deviceTimezone });
                    }}>Today</button>
                    <p>Viewing agent hours for <strong>{selectedDate}</strong></p>
                    <button className="data-hours-add" type="button" onClick={() => setOpen(true)}>
                        <Plus /> Insert hours
                    </button>
                </form>

                <section className="data-hours-card">
                    <div className="data-hours-card-title">
                        <div><Clock3 /><div><h2>Agent hour history</h2><span>Times shown in {deviceTimezone}</span></div></div>
                        <strong>{hours.length.toLocaleString()} agents with hours</strong>
                    </div>
                    <div className="data-hours-table-wrap">
                        <table>
                            <thead><tr><th>Date</th><th>Agent</th><th>CallTools login</th><th>CallTools logout</th><th>Manual login</th><th>Manual logout</th><th>Leads sent</th><th>Imported</th><th>Lunch deducted</th><th>Manual</th><th>Net total</th><th>Note</th></tr></thead>
                            <tbody>
                                {hours.map((row) => (
                                    <tr key={`${row.agent_id}-${row.work_date}`}>
                                        <td>{row.work_date}</td><td><strong>{row.agent_name}</strong></td>
                                        <td>{row.first_login_at ? time.format(new Date(`${row.first_login_at}Z`)) : '—'}</td>
                                        <td>{row.last_logout_at ? time.format(new Date(`${row.last_logout_at}Z`)) : '—'}</td>
                                        <td>{row.manual_first_login || '—'}</td><td>{row.manual_first_logout || '—'}</td>
                                        <td><strong>{row.leads_sent}</strong></td><td>{duration(row.imported_seconds)}</td>
                                        <td>{row.lunch_seconds ? duration(row.lunch_seconds) : '—'}</td>
                                        <td>{row.manual_seconds ? duration(row.manual_seconds) : '—'}</td>
                                        <td className="data-hours-total">{duration(row.total_seconds)}{row.manual_override && <small className="data-hours-override">Manual</small>}</td>
                                        <td>{row.note || '—'}</td>
                                    </tr>
                                ))}
                                {hours.length === 0 && <tr><td className="data-hours-empty" colSpan={12}>No hour records are available yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {open && (
                <div className="data-hours-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
                    <section className="data-hours-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <header><div><h2>Insert agent hours</h2><p>Apply the same hours to one or more agents for this day.</p></div><button type="button" onClick={() => setOpen(false)}><X /></button></header>
                        <form onSubmit={submit}>
                            <fieldset className="data-hours-agent-picker">
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
                            </fieldset>
                            <label>Date<input type="date" value={form.data.work_date} onChange={(e) => form.setData('work_date', e.target.value)} required /><small>{form.errors.work_date}</small></label>
                            <div className="data-hours-fields">
                                <label>First login<input type="time" value={form.data.first_login} onChange={(e) => form.setData('first_login', e.target.value)} required /><small>{form.errors.first_login}</small></label>
                                <label>Final logout<input type="time" value={form.data.first_logout} onChange={(e) => form.setData('first_logout', e.target.value)} required /><small>{form.errors.first_logout}</small></label>
                                <label>Lunch hours<input type="number" min="0" max="24" step="0.25" value={form.data.lunch_hours} onChange={(e) => form.setData('lunch_hours', e.target.value)} required /><small>{form.errors.lunch_hours}</small></label>
                            </div>
                            <label>Note (optional)<textarea rows={3} maxLength={500} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} placeholder="Reason or details for this manual entry" /><small>{form.errors.note}</small></label>
                            <footer><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={form.processing || form.data.agent_ids.length === 0}>{form.processing ? 'Saving…' : `Save for ${form.data.agent_ids.length || 0} agent${form.data.agent_ids.length === 1 ? '' : 's'}`}</button></footer>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}
