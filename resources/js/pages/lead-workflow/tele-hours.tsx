import { Head, router } from '@inertiajs/react';
import { Activity, Clock3, History, PhoneCall } from 'lucide-react';
import { useEffect, useState } from 'react';
import '@/../css/tele-hours.css';

type LoginDay = {
    app_user_id?: string | null;
    agent_id: number;
    agent_name: string;
    shift_date: string;
    first_login_at?: string | null;
    first_logout_at?: string | null;
    second_login_at?: string | null;
    second_logout_at?: string | null;
    last_logout_at?: string | null;
    logged_seconds: number;
    lunch_seconds: number;
    sessions: number;
    leads_sent: number;
};
type CallLog = {
    uuid: string;
    started_at: string;
    inbound: boolean;
    call_type?: string;
    duration: number;
    billable_seconds: number;
    system_disposition?: string;
    call_disposition?: string;
    source?: string;
    destination?: string;
    agent_name?: string;
    disposition_name?: string;
};
type Disposition = {
    call_uuid?: string;
    disposition_name?: string;
    phone_number?: string;
    calltools_created_at: string;
    agent_name?: string;
};
type Filters = {
    from: string;
    to: string;
    agent: number | null;
    timezone: string;
};

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;
const duration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const dateTime = (value: string) => {
    const normalized = value.includes('T')
        ? value
        : `${value.replace(' ', 'T')}Z`;

    return new Date(normalized).toLocaleString();
};

export default function TeleHours({
    loginDays,
    agentOptions,
    callLogs,
    dispositions,
    filters,
    sync,
    activityCoverage,
    isRange,
}: {
    loginDays: LoginDay[];
    agentOptions: { id: number; name: string }[];
    callLogs: CallLog[];
    dispositions: Disposition[];
    filters: Filters;
    sync: Record<string, string | null>;
    activityCoverage: { from: string | null; to: string | null };
    isRange: boolean;
}) {
    const [view, setView] = useState<'hours' | 'calls' | 'dispositions'>(
        'hours',
    );
    const [query, setQuery] = useState({
        from: filters.from,
        to: filters.to,
        agent: filters.agent ? String(filters.agent) : '',
        timezone: filters.timezone,
    });
    const lastSyncedAt =
        sync.login_shifts_last_success_at ?? sync.last_success_at;
    const navigate = (params: Record<string, string>) => {
        const search = new URLSearchParams(
            Object.entries(params).filter(([, value]) => value !== ''),
        );
        window.location.assign(`/lead-workflow/tele-hours?${search}`);
    };
    const apply = () => navigate(query);
    useEffect(() => {
        const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (deviceTimezone && deviceTimezone !== filters.timezone) {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: deviceTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            })
                .formatToParts(new Date())
                .reduce<Record<string, string>>((values, part) => {
                    values[part.type] = part.value;

                    return values;
                }, {});
            const deviceDate = `${parts.year}-${parts.month}-${parts.day}`;
            const hasExplicitRange = new URLSearchParams(window.location.search).has('from');
            const search = new URLSearchParams({
                from: hasExplicitRange ? query.from : deviceDate,
                to: hasExplicitRange ? query.to : deviceDate,
                timezone: deviceTimezone,
            });

            if (query.agent) {
                search.set('agent', query.agent);
            }

            window.location.replace(`/lead-workflow/tele-hours?${search}`);

            return;
        }

        const timer = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            router.reload({
                only: [
                    'loginDays',
                    'callLogs',
                    'dispositions',
                    'sync',
                    'activityCoverage',
                ],
            });
        }, 30_000);

        return () => window.clearInterval(timer);
    }, [filters.timezone, query.agent, query.from, query.to]);

    return (
        <>
            <Head title="Tele Report" />
            <main className="tele-hours-page">
                <header className="tele-hours-hero">
                    <span>
                        <Clock3 />
                    </span>
                    <div>
                        <h1>Tele Report</h1>
                        <p>
                            CallTools agent activity, call history,
                            dispositions, and CRM lead flow.
                        </p>
                    </div>
                    <nav>
                        {(['hours', 'calls', 'dispositions'] as const).map(
                            (tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={view === tab ? 'is-active' : ''}
                                    onClick={() => setView(tab)}
                                >
                                    {tab === 'hours' ? (
                                        <Activity />
                                    ) : tab === 'calls' ? (
                                        <PhoneCall />
                                    ) : (
                                        <History />
                                    )}
                                    {tab === 'hours'
                                        ? 'Agent hours'
                                        : tab === 'calls'
                                          ? 'Call logs'
                                          : 'Dispositions'}
                                </button>
                            ),
                        )}
                    </nav>
                </header>
                <section className="tele-hours-filters">
                    <label>
                        From
                        <input
                            type="date"
                            min="2026-07-01"
                            value={query.from}
                            onClick={(event) => event.currentTarget.showPicker?.()}
                            onChange={(e) =>
                                setQuery({ ...query, from: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        To
                        <input
                            type="date"
                            min={query.from}
                            value={query.to}
                            onClick={(event) => event.currentTarget.showPicker?.()}
                            onChange={(e) =>
                                setQuery({ ...query, to: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Agent
                        <select
                            value={query.agent}
                            onChange={(e) =>
                                setQuery({ ...query, agent: e.target.value })
                            }
                        >
                            <option value="">All agents</option>
                            {agentOptions.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="button" onClick={apply}>
                        Apply filters
                    </button>
                    <button
                        type="button"
                        className="tele-hours-today"
                        onClick={() => {
                            const today = new Date().toLocaleDateString('en-CA');
                            navigate({ from: today, to: today, agent: query.agent, timezone: query.timezone });
                        }}
                    >
                        Today
                    </button>
                    <small>
                        Last synced:{' '}
                        {lastSyncedAt
                            ? new Date(lastSyncedAt).toLocaleString()
                            : 'Waiting for first sync'}
                    </small>
                </section>
                <p className="tele-hours-coverage">
                    Showing login sessions for{' '}
                    <strong>{filters.from}{filters.to !== filters.from ? ` through ${filters.to}` : ''}</strong>{' '}
                    in <strong>{filters.timezone}</strong>. Imported coverage:{' '}
                    {activityCoverage.from
                        ? `${activityCoverage.from}${activityCoverage.to && activityCoverage.to !== activityCoverage.from ? ` through ${activityCoverage.to}` : ''}`
                        : 'waiting for the first imported session'}
                    . Call and disposition history continues backfilling
                    separately.
                </p>
                {view === 'hours' && (
                    <section className="tele-hours-table-card">
                        <div className="tele-hours-table-title">
                            <strong>Daily login sessions</strong>
                            <span>
                                Login, logout, and total time for each day
                            </span>
                        </div>
                        <div className={`tele-hours-login-table tele-hours-report-head${isRange ? ' is-range' : ''}`}>
                            <span className="tele-hours-day-only">Date</span>
                            <span>Agent</span>
                            <span className="tele-hours-day-only">First login</span>
                            <span className="tele-hours-day-only">Final logout</span>
                            <span>Leads sent</span>
                            <span>Lunch hours</span>
                            <span>Net hours</span>
                            <span className="tele-hours-day-only">Sessions</span>
                        </div>
                        <div className="tele-hours-table-body">
                            {loginDays.map((day) => (
                                <div
                                    className={`tele-hours-login-table tele-hours-report-row${isRange ? ' is-range' : ''}`}
                                    key={`${day.app_user_id}-${day.shift_date}`}
                                >
                                    <span className="tele-hours-day-only">{day.shift_date}</span>
                                    <strong>
                                        {day.agent_name ?? 'Unmapped'}
                                    </strong>
                                    <span className="tele-hours-day-only">
                                        {day.first_login_at
                                            ? dateTime(day.first_login_at)
                                            : 'No login recorded'}
                                    </span>
                                    <span className="tele-hours-session-boundary">
                                        {!day.first_logout_at
                                            ? '—'
                                            : dateTime(day.first_logout_at)}
                                    </span>
                                    <span className="tele-hours-session-boundary">
                                        {day.second_login_at
                                            ? dateTime(day.second_login_at)
                                            : '—'}
                                    </span>
                                    <span className="tele-hours-day-only">
                                        {day.second_login_at
                                            ? day.second_logout_at
                                                ? dateTime(day.second_logout_at)
                                                : 'Still logged in'
                                            : '—'}
                                    </span>
                                    <strong>{day.leads_sent}</strong>
                                    <span>{hours(day.lunch_seconds)}</span>
                                    <span>{hours(Math.max(0, day.logged_seconds - day.lunch_seconds))}</span>
                                    <span className="tele-hours-day-only">{day.sessions}</span>
                                </div>
                            ))}
                            {loginDays.length === 0 && (
                                <div className="tele-hours-empty">
                                    No imported login sessions in this range
                                    yet.
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {view === 'calls' && (
                    <section className="tele-hours-table-card">
                        <div className="tele-hours-call-table tele-hours-report-head">
                            <span>Date</span>
                            <span>Agent</span>
                            <span>Direction</span>
                            <span>From</span>
                            <span>To</span>
                            <span>Duration</span>
                            <span>Talk</span>
                            <span>Disposition</span>
                        </div>
                        <div className="tele-hours-table-body">
                            {callLogs.map((call) => (
                                <div
                                    className="tele-hours-call-table tele-hours-report-row"
                                    key={call.uuid}
                                >
                                    <span>{dateTime(call.started_at)}</span>
                                    <strong>
                                        {call.agent_name ?? 'Unmapped'}
                                    </strong>
                                    <span>
                                        {call.inbound ? 'Inbound' : 'Outbound'}
                                    </span>
                                    <span>{call.source ?? '—'}</span>
                                    <span>{call.destination ?? '—'}</span>
                                    <span>{duration(call.duration)}</span>
                                    <span>
                                        {duration(call.billable_seconds)}
                                    </span>
                                    <span>
                                        {call.disposition_name ??
                                            call.system_disposition ??
                                            '—'}
                                    </span>
                                </div>
                            ))}
                            {callLogs.length === 0 && (
                                <div className="tele-hours-empty">
                                    No synchronized calls in this range yet.
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {view === 'dispositions' && (
                    <section className="tele-hours-table-card">
                        <div className="tele-hours-disposition-table tele-hours-report-head">
                            <span>Date</span>
                            <span>Agent</span>
                            <span>Call UUID</span>
                            <span>Phone</span>
                            <span>Disposition</span>
                        </div>
                        <div className="tele-hours-table-body">
                            {dispositions.map((item, index) => (
                                <div
                                    className="tele-hours-disposition-table tele-hours-report-row"
                                    key={`${item.call_uuid}-${index}`}
                                >
                                    <span>
                                        {dateTime(item.calltools_created_at)}
                                    </span>
                                    <strong>
                                        {item.agent_name ?? 'Unmapped'}
                                    </strong>
                                    <span>{item.call_uuid ?? '—'}</span>
                                    <span>{item.phone_number ?? '—'}</span>
                                    <span>
                                        {item.disposition_name ?? 'Unknown'}
                                    </span>
                                </div>
                            ))}
                            {dispositions.length === 0 && (
                                <div className="tele-hours-empty">
                                    No synchronized dispositions in this range
                                    yet.
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}
