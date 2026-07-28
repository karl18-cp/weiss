import { Head } from '@inertiajs/react';
import { Headphones, PhoneCall, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/call-logs.css';

type UserSummary = {
    acc_id: number;
    username: string;
    role: string;
    attempts: number;
    leads: number;
};

type Call = {
    id: number;
    account_id: number;
    lead_id: number;
    phone_number: string;
    result: string | null;
    duration_seconds: number;
    initiated_at: string;
    started_at: string | null;
    recording_path: string | null;
    caller: { acc_id: number; username: string; role: string } | null;
    lead: {
        id: number;
        customer_name: string;
        address: string;
        city: string;
        state: string;
        zip_code: string;
    };
};

const when = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));

const duration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function CallLogs({
    calls,
    users,
    isAdmin,
    viewerId,
}: {
    calls: Call[];
    users: UserSummary[];
    isAdmin: boolean;
    viewerId: number;
}) {
    const [userId, setUserId] = useState<number | null>(
        isAdmin ? (users[0]?.acc_id ?? null) : viewerId,
    );
    const [leadId, setLeadId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const userCalls = calls.filter((call) => call.account_id === userId);
    const leads = useMemo(() => {
        const grouped = new Map<
            number,
            { lead: Call['lead']; calls: Call[]; latest: string }
        >();
        userCalls.forEach((call) => {
            const existing = grouped.get(call.lead_id);
            if (existing) existing.calls.push(call);
            else
                grouped.set(call.lead_id, {
                    lead: call.lead,
                    calls: [call],
                    latest: call.initiated_at,
                });
        });
        const query = search.trim().toLowerCase();
        return [...grouped.values()].filter(({ lead }) =>
            `${lead.customer_name} ${lead.address} ${lead.city}`
                .toLowerCase()
                .includes(query),
        );
    }, [userCalls, search]);
    const selectedLeadId =
        leadId && leads.some(({ lead }) => lead.id === leadId)
            ? leadId
            : (leads[0]?.lead.id ?? null);
    const selected = leads.find(({ lead }) => lead.id === selectedLeadId);

    return (
        <>
            <Head title="Call Logs" />
            <main className="call-logs-page">
                <header>
                    <span><PhoneCall /></span>
                    <div>
                        <small>RingCentral activity</small>
                        <h1>Call Logs</h1>
                        <p>Review called leads, call outcomes, and recordings.</p>
                    </div>
                </header>
                <div className={`call-logs-layout ${isAdmin ? '' : 'is-personal'}`}>
                    {isAdmin && (
                        <aside className="call-log-users">
                            <h2>Users</h2>
                            {users.map((user) => (
                                <button
                                    key={user.acc_id}
                                    className={userId === user.acc_id ? 'is-active' : ''}
                                    onClick={() => { setUserId(user.acc_id); setLeadId(null); }}
                                >
                                    <UserRound />
                                    <span><strong>{user.username}</strong><small>{user.leads} leads · {user.attempts} attempts</small></span>
                                </button>
                            ))}
                        </aside>
                    )}
                    <section className="call-log-leads">
                        <h2>Called leads</h2>
                        <label><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads" /></label>
                        {leads.map(({ lead, calls: attempts, latest }) => (
                            <button
                                key={lead.id}
                                className={selectedLeadId === lead.id ? 'is-active' : ''}
                                onClick={() => setLeadId(lead.id)}
                            >
                                <strong>{lead.customer_name}</strong>
                                <span>{lead.city || 'No city'}</span>
                                <small>{attempts.length} attempts · {when(latest)}</small>
                            </button>
                        ))}
                        {leads.length === 0 && <p className="call-log-empty">No called leads found.</p>}
                    </section>
                    <section className="call-log-detail">
                        {selected ? (
                            <>
                                <header>
                                    <div><small>Lead</small><h2>{selected.lead.customer_name}</h2></div>
                                    <span>{selected.calls.length} attempts</span>
                                </header>
                                <p>{[selected.lead.address, selected.lead.city, selected.lead.state, selected.lead.zip_code].filter(Boolean).join(', ')}</p>
                                <div className="call-log-attempts">
                                    {selected.calls.map((call) => (
                                        <article key={call.id}>
                                            <div><strong>{call.result ?? 'Waiting for RingCentral'}</strong><time>{when(call.started_at ?? call.initiated_at)}</time></div>
                                            <p><span>{call.phone_number}</span><b>{duration(call.duration_seconds)}</b></p>
                                            {call.recording_path ? (
                                                <audio controls preload="none" src={`/lead-workflow/leads-shop/${call.lead_id}/ringcentral-calls/${call.id}/recording`} />
                                            ) : (
                                                <small className="is-processing"><Headphones /> Recording unavailable or still processing</small>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="call-log-empty"><Headphones /><strong>Select a called lead</strong></div>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}
