import { Head } from '@inertiajs/react';
import { Clock3, LayoutGrid, List } from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/tele-hours.css';

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

type AgentHours = {
    id: number;
    name: string;
    leads_count: number;
    hours: Record<Weekday, number>;
};

const weekdays: { key: Weekday; label: string }[] = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
];

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

export default function TeleHours({ agents = [] }: { agents?: AgentHours[] }) {
    const [view, setView] = useState<'table' | 'summary'>('table');
    const totals = useMemo(() => {
        const hours = agents.reduce(
            (sum, agent) =>
                sum +
                weekdays.reduce(
                    (agentTotal, day) => agentTotal + agent.hours[day.key],
                    0,
                ),
            0,
        );

        return {
            hours,
            leads: agents.reduce((sum, agent) => sum + agent.leads_count, 0),
            average: agents.length ? hours / agents.length : 0,
        };
    }, [agents]);

    return (
        <>
            <Head title="Tele Hours" />
            <main className="tele-hours-page">
                <header className="tele-hours-hero">
                    <span>
                        <Clock3 />
                    </span>
                    <div>
                        <h1>Tele Hours</h1>
                        <p>Agent call hours and productivity metrics.</p>
                    </div>
                    <nav aria-label="Tele Hours view">
                        <button
                            type="button"
                            className={view === 'table' ? 'is-active' : ''}
                            onClick={() => setView('table')}
                        >
                            <List /> Table
                        </button>
                        <button
                            type="button"
                            className={view === 'summary' ? 'is-active' : ''}
                            onClick={() => setView('summary')}
                        >
                            <LayoutGrid /> Summary
                        </button>
                    </nav>
                </header>

                <section className="tele-hours-metrics">
                    <article>
                        <span>Total hours this week</span>
                        <strong>{totals.hours.toFixed(1)}h</strong>
                    </article>
                    <article>
                        <span>Total leads generated</span>
                        <strong>{totals.leads}</strong>
                    </article>
                    <article>
                        <span>Active agents</span>
                        <strong>{agents.length}</strong>
                    </article>
                    <article>
                        <span>Average hours / agent</span>
                        <strong>{totals.average.toFixed(1)}h</strong>
                    </article>
                </section>

                {view === 'table' ? (
                    <section className="tele-hours-table-card">
                        <div className="tele-hours-table tele-hours-table--head">
                            <span>Agent</span>
                            {weekdays.map((day) => (
                                <span key={day.key}>{day.label}</span>
                            ))}
                            <span>Total</span>
                            <span>Leads</span>
                        </div>
                        <div className="tele-hours-table-body">
                            {agents.map((agent) => {
                                const total = weekdays.reduce(
                                    (sum, day) => sum + agent.hours[day.key],
                                    0,
                                );

                                return (
                                    <div
                                        className="tele-hours-table tele-hours-row"
                                        key={agent.id}
                                    >
                                        <div className="tele-hours-agent">
                                            <span>{initials(agent.name)}</span>
                                            <strong>{agent.name}</strong>
                                        </div>
                                        {weekdays.map((day) => (
                                            <div
                                                className="tele-hours-day"
                                                key={day.key}
                                            >
                                                <i>
                                                    <b
                                                        style={{
                                                            width: `${Math.min(100, (agent.hours[day.key] / 10) * 100)}%`,
                                                        }}
                                                    />
                                                </i>
                                                <span>
                                                    {agent.hours[day.key]}h
                                                </span>
                                            </div>
                                        ))}
                                        <strong>{total.toFixed(1)}h</strong>
                                        <strong className="tele-hours-leads">
                                            {agent.leads_count}
                                        </strong>
                                    </div>
                                );
                            })}
                            {agents.length === 0 && (
                                <div className="tele-hours-empty">
                                    <Clock3 />
                                    <strong>No agent activity yet</strong>
                                    <span>
                                        Agents will appear here when they are
                                        added to the system.
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>
                ) : (
                    <section className="tele-hours-summary">
                        {agents.map((agent) => (
                            <article key={agent.id}>
                                <span>{initials(agent.name)}</span>
                                <div>
                                    <h2>{agent.name}</h2>
                                    <p>{agent.leads_count} generated leads</p>
                                </div>
                                <strong>
                                    {weekdays
                                        .reduce(
                                            (sum, day) =>
                                                sum + agent.hours[day.key],
                                            0,
                                        )
                                        .toFixed(1)}
                                    h
                                </strong>
                            </article>
                        ))}
                    </section>
                )}

                {totals.hours === 0 && agents.length > 0 && (
                    <p className="tele-hours-notice">
                        Agent and lead totals are live. Call-hour values will
                        populate when time tracking is connected.
                    </p>
                )}
            </main>
        </>
    );
}
