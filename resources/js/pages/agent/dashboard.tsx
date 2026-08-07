import { Head, router } from '@inertiajs/react';
import { Clock3, LogIn, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Session = {
    id: number;
    clocked_in_at: string;
    clocked_out_at: string | null;
    duration_seconds: number;
};

const duration = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const dateTime = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

export default function AgentDashboard({
    agent,
    openSession,
    todaySeconds,
    recentSessions,
    serverNow,
}: {
    agent: { id: number; name: string };
    openSession: { id: number; clocked_in_at: string } | null;
    todaySeconds: number;
    recentSessions: Session[];
    serverNow: string;
}) {
    const [processing, setProcessing] = useState(false);
    const [now, setNow] = useState(() => new Date(serverNow).getTime());

    useEffect(() => {
        const interval = window.setInterval(
            () => setNow((value) => value + 1000),
            1000,
        );

        return () => window.clearInterval(interval);
    }, []);

    const activeSeconds = useMemo(() => {
        if (!openSession) return 0;

        return Math.max(
            0,
            Math.floor(
                (now - new Date(openSession.clocked_in_at).getTime()) / 1000,
            ),
        );
    }, [now, openSession]);

    const submit = (path: string) => {
        if (processing) return;
        setProcessing(true);
        router.post(path, {}, {
            preserveScroll: true,
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <section className="agent-clock">
            <Head title="Agent Time Clock" />
            <header>
                <span>Agent workspace</span>
                <h1>Hello, {agent.name}</h1>
                <p>Use the button below to record the start and end of your shift.</p>
            </header>

            <article className={`agent-clock__card ${openSession ? 'is-active' : ''}`}>
                <div className="agent-clock__icon"><Clock3 /></div>
                <small>{openSession ? 'Currently timed in' : 'Currently timed out'}</small>
                <strong>{openSession ? duration(activeSeconds) : duration(todaySeconds)}</strong>
                <p>
                    {openSession
                        ? `Started ${dateTime(openSession.clocked_in_at)}`
                        : `Today's completed time: ${duration(todaySeconds)}`}
                </p>
                {openSession ? (
                    <button type="button" className="is-time-out" disabled={processing} onClick={() => submit('/agent/time-out')}>
                        <LogOut /> {processing ? 'Saving…' : 'Time Out'}
                    </button>
                ) : (
                    <button type="button" className="is-time-in" disabled={processing} onClick={() => submit('/agent/time-in')}>
                        <LogIn /> {processing ? 'Saving…' : 'Time In'}
                    </button>
                )}
            </article>

            <section className="agent-clock__history">
                <h2>Recent sessions</h2>
                {recentSessions.length ? recentSessions.map((session) => (
                    <div key={session.id}>
                        <span>
                            <strong>{dateTime(session.clocked_in_at)}</strong>
                            <small>{session.clocked_out_at ? `Out: ${dateTime(session.clocked_out_at)}` : 'In progress'}</small>
                        </span>
                        <b>{duration(session.duration_seconds)}</b>
                    </div>
                )) : <p>No attendance sessions yet.</p>}
            </section>
        </section>
    );
}
