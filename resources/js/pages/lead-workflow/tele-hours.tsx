import { Head, router } from '@inertiajs/react';
import { Activity, Clock3, Download, History, PhoneCall } from 'lucide-react';
import { useEffect, useState } from 'react';
import '@/../css/tele-hours.css';
import { formatPhoneNumber } from '@/lib/phone-number';
import { CRM_TIME_ZONE, crmDateKey } from '@/lib/crm-time';

type LoginDay = {
    app_user_id?: string | null;
    agent_id: number;
    agent_name: string;
    shift_date: string;
    first_login_at?: string | null;
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

    return new Date(normalized).toLocaleString('en-US', {
        timeZone: CRM_TIME_ZONE,
    });
};

const pdfSafe = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[^\x20-\x7e]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

const shortPdfText = (value: string, limit: number) =>
    value.length > limit ? `${value.slice(0, Math.max(0, limit - 3))}...` : value;

const createTeleReportPdf = (
    loginDays: LoginDay[],
    filters: Filters,
    agentName: string,
) => {
    const rowsPerPage = 17;
    const pages = Array.from(
        { length: Math.max(1, Math.ceil(loginDays.length / rowsPerPage)) },
        (_, page) => loginDays.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    );
    const reportPeriod =
        filters.from === filters.to
            ? `Report date: ${filters.from}`
            : `Report range: ${filters.from} through ${filters.to}`;
    const generatedAt = new Date().toLocaleString('en-US', {
        timeZone: CRM_TIME_ZONE,
    });
    const totalNetSeconds = loginDays.reduce(
        (total, day) => total + Math.max(0, day.logged_seconds - day.lunch_seconds),
        0,
    );
    const fontId = 3 + pages.length * 2;
    const objects: string[] = [];
    const text = (x: number, y: number, size: number, value: string) =>
        `BT /F1 ${size} Tf ${x} ${y} Td (${pdfSafe(value)}) Tj ET\n`;

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages
        .map((_, index) => `${3 + index * 2} 0 R`)
        .join(' ')}] >>`;

    pages.forEach((pageRows, pageIndex) => {
        const pageId = 3 + pageIndex * 2;
        const contentId = pageId + 1;
        let content = '';

        content += '0.64 0.13 0.70 rg\n0 552 792 60 re f\n';
        content += '1 1 1 rg\n';
        content += text(32, 580, 18, 'Weiss CRM - Tele Report');
        content += text(32, 562, 9, `${reportPeriod} | Timezone: ${filters.timezone}`);
        content += '0.12 0.16 0.25 rg\n';
        content += text(32, 535, 9, `Agent: ${agentName}`);
        content += text(
            290,
            535,
            9,
            `Total net hours: ${(totalNetSeconds / 3600).toFixed(1)}h`,
        );
        content += text(590, 535, 8, `Generated: ${generatedAt}`);
        content += '0.97 0.93 0.98 rg\n32 498 728 24 re f\n';
        content += '0.25 0.18 0.33 rg\n';

        const headers = [
            [38, 'Date'],
            [112, 'Agent'],
            [225, 'First login'],
            [355, 'Final logout'],
            [485, 'Leads'],
            [535, 'Lunch'],
            [595, 'Net'],
            [650, 'Sessions'],
        ] as const;
        headers.forEach(([x, label]) => {
            content += text(x, 507, 8, label);
        });

        pageRows.forEach((day, rowIndex) => {
            const y = 482 - rowIndex * 25;
            if (rowIndex % 2 === 1) {
                content += '0.98 0.98 0.99 rg\n32 ' + (y - 8) + ' 728 23 re f\n';
            }
            content += '0.15 0.20 0.30 rg\n';
            const firstLogin = day.first_login_at
                ? dateTime(day.first_login_at)
                : 'No login';
            const finalLogout = day.last_logout_at
                ? dateTime(day.last_logout_at)
                : day.first_login_at
                  ? 'Still logged in'
                  : '-';
            const values = [
                [38, shortPdfText(day.shift_date, 18)],
                [112, shortPdfText(day.agent_name ?? 'Unmapped', 18)],
                [225, shortPdfText(firstLogin, 22)],
                [355, shortPdfText(finalLogout, 22)],
                [485, String(day.leads_sent)],
                [535, hours(day.lunch_seconds)],
                [595, hours(Math.max(0, day.logged_seconds - day.lunch_seconds))],
                [650, String(day.sessions)],
            ] as const;
            values.forEach(([x, value]) => {
                content += text(x, y, 8, value);
            });
            content += `0.88 0.88 0.91 RG\n32 ${y - 10} m 760 ${y - 10} l S\n`;
        });

        if (pageRows.length === 0) {
            content += text(32, 470, 10, 'No imported login sessions in this range.');
        }
        content += text(690, 22, 8, `Page ${pageIndex + 1} of ${pages.length}`);

        objects[pageId] =
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] ` +
            `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
        objects[contentId] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`;
    });
    objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (let id = 1; id <= fontId; id += 1) {
        offsets[id] = new TextEncoder().encode(pdf).length;
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = new TextEncoder().encode(pdf).length;
    pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= fontId; id += 1) {
        pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdf +=
        `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([new TextEncoder().encode(pdf)], {
        type: 'application/pdf',
    });
    const link = document.createElement('a');
    const period =
        filters.from === filters.to ? filters.from : `${filters.from}-to-${filters.to}`;
    link.href = URL.createObjectURL(blob);
    link.download = `tele-report-${period}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
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
    const appliedAgentName = filters.agent
        ? (agentOptions.find((agent) => agent.id === filters.agent)?.name ??
          'Selected agent')
        : 'All agents';
    const navigate = (params: Record<string, string>) => {
        const search = new URLSearchParams(
            Object.entries(params).filter(([, value]) => value !== ''),
        );
        window.location.assign(`/lead-workflow/tele-hours?${search}`);
    };
    const apply = () => navigate(query);
    useEffect(() => {
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
                            const today = crmDateKey();
                            navigate({ from: today, to: today, agent: query.agent, timezone: query.timezone });
                        }}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        className="tele-hours-export"
                        onClick={() =>
                            createTeleReportPdf(
                                loginDays,
                                filters,
                                appliedAgentName,
                            )
                        }
                    >
                        <Download />
                        Export PDF
                    </button>
                    <small>
                        Last synced:{' '}
                        {lastSyncedAt
                            ? new Date(lastSyncedAt).toLocaleString('en-US', {
                                  timeZone: CRM_TIME_ZONE,
                              })
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
                                    <span className="tele-hours-day-only">
                                        {day.last_logout_at
                                            ? dateTime(day.last_logout_at)
                                            : day.first_login_at
                                              ? 'Still logged in'
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
                                    <span>{formatPhoneNumber(item.phone_number)}</span>
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
