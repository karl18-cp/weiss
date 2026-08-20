import { Head, router } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Coffee,
    LogIn,
    LogOut,
    Play,
    Users,
} from 'lucide-react';
import { useState } from 'react';
type Session = {
    id: number;
    clocked_in_at: string;
    clocked_out_at: string | null;
    lunch_out_at: string | null;
    lunch_in_at: string | null;
    duration_seconds: number;
};
type Score = { total: number; confirmed: number; sold: number };
const duration = (n: number) =>
    `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor((n % 3600) / 60)).padStart(2, '0')}`;
const dateTime = (v: string) =>
    new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(v));
const clock = (v?: string | null) =>
    v
        ? new Intl.DateTimeFormat('en-US', {
              timeZone: 'UTC',
              hour: 'numeric',
              minute: '2-digit',
          }).format(new Date(`2000-01-01T${v}Z`))
        : '—';
export default function Dashboard({
    agent,
    schedule,
    openSession,
    todaySeconds,
    recentSessions,
    leadSummary,
    recentLeads,
    scoreDate,
    todayDate,
    teamScores,
}: {
    agent: { name: string };
    schedule: null | {
        is_working: boolean;
        shift_start: string;
        shift_end: string;
        lunch_start: string;
        lunch_end: string;
    };
    openSession: Session | null;
    todaySeconds: number;
    recentSessions: Session[];
    leadSummary: Score;
    recentLeads: { id: number; customer: string; city: string | null }[];
    scoreDate: string;
    todayDate: string;
    teamScores: (Score & { id: number; name: string })[];
}) {
    const [busy, setBusy] = useState(false);
    const selectDate = (date: string) =>
        router.get(
            '/agent/dashboard',
            { date },
            { preserveState: true, replace: true },
        );
    const moveDate = (days: number) => {
        const date = new Date(`${scoreDate}T12:00:00`);
        date.setDate(date.getDate() + days);
        selectDate(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        );
    };
    const post = (path: string) => {
        setBusy(true);
        router.post(
            path,
            {},
            { preserveScroll: true, onFinish: () => setBusy(false) },
        );
    };
    let action = { path: '/agent/time-in', label: 'Clock in', icon: <LogIn /> };
    if (openSession && !openSession.lunch_out_at)
        action = {
            path: '/agent/lunch-out',
            label: 'Lunch out',
            icon: <Coffee />,
        };
    else if (openSession?.lunch_out_at && !openSession.lunch_in_at)
        action = { path: '/agent/lunch-in', label: 'Lunch in', icon: <Play /> };
    const ScoreCards = ({ score }: { score: Score }) => (
        <div className="agent-score-cards">
            <span>
                <small>TOTAL</small>
                <b>{score.total}</b>
            </span>
            <span>
                <small>CONFIRMED</small>
                <b>{score.confirmed}</b>
            </span>
            <span>
                <small>SOLD</small>
                <b>{score.sold}</b>
            </span>
        </div>
    );
    return (
        <section className="agent-clock agent-dashboard">
            <Head title="Agent Portal" />
            <header>
                <span>Agent portal · California time</span>
                <h1>Hello, {agent.name}</h1>
                <p>Record attendance and review your daily score.</p>
            </header>
            <div className="agent-dashboard__grid">
                <article
                    className={`agent-clock__card ${openSession ? 'is-active' : ''}`}
                >
                    <small>
                        {openSession
                            ? 'Shift in progress'
                            : 'Ready for your shift'}
                    </small>
                    <strong>
                        {duration(
                            openSession?.duration_seconds ?? todaySeconds,
                        )}
                    </strong>
                    <p>Net rendered time today</p>
                    {openSession && openSession.lunch_in_at ? (
                        <button
                            className="is-time-out"
                            disabled={busy}
                            onClick={() => post('/agent/time-out')}
                        >
                            <LogOut />
                            Clock out
                        </button>
                    ) : (
                        <button
                            className="is-time-in"
                            disabled={busy || !schedule?.is_working}
                            onClick={() => post(action.path)}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    )}
                    {!schedule?.is_working && (
                        <em>No working schedule today</em>
                    )}
                </article>
                <article className="agent-schedule-card">
                    <h2>Today's schedule</h2>
                    <div>
                        <span>
                            Clock in<b>{clock(schedule?.shift_start)}</b>
                        </span>
                        <span>
                            Lunch
                            <b>
                                {clock(schedule?.lunch_start)} –{' '}
                                {clock(schedule?.lunch_end)}
                            </b>
                        </span>
                        <span>
                            Clock out<b>{clock(schedule?.shift_end)}</b>
                        </span>
                    </div>
                </article>
            </div>
            <section className="agent-leads">
                <header className="agent-score-header">
                    <div>
                        <Users />
                        <span>
                            <small>MY DAILY SCORE</small>
                            <strong>{agent.name}</strong>
                        </span>
                    </div>
                    <div className="agent-date-nav">
                        <button type="button" onClick={() => moveDate(-1)} aria-label="Previous day"><ChevronLeft /></button>
                        <label><CalendarDays /><input type="date" max={todayDate} value={scoreDate} onChange={(e) => selectDate(e.target.value)} /></label>
                        <button type="button" disabled={scoreDate >= todayDate} onClick={() => moveDate(1)} aria-label="Next day"><ChevronRight /></button>
                    </div>
                </header>
                <ScoreCards score={leadSummary} />
                <div className="agent-leads__list">
                    {recentLeads.map((l) => (
                        <div key={l.id}>
                            <strong>{l.customer}</strong>
                            <small>{l.city || 'City not provided'}</small>
                        </div>
                    ))}
                    {!recentLeads.length && <p>No leads for this date.</p>}
                </div>
            </section>
            <section className="agent-team-scores">
                <h2>My team score <small>{scoreDate}</small></h2>
                {teamScores.map((team) => (
                    <article key={team.id}>
                        <strong>{team.name}</strong>
                        <ScoreCards score={team} />
                    </article>
                ))}
                {!teamScores.length && <p>You are not assigned to a team.</p>}
            </section>
            <section className="agent-clock__history">
                <h2>Recent attendance</h2>
                {recentSessions.map((s) => (
                    <div key={s.id}>
                        <span>
                            <strong>{dateTime(s.clocked_in_at)}</strong>
                            <small>
                                {s.clocked_out_at
                                    ? `Out: ${dateTime(s.clocked_out_at)}`
                                    : 'In progress'}{' '}
                                · Lunch{' '}
                                {s.lunch_out_at && s.lunch_in_at
                                    ? 'recorded'
                                    : '—'}
                            </small>
                        </span>
                        <b>{duration(s.duration_seconds)}</b>
                    </div>
                ))}
            </section>
        </section>
    );
}
