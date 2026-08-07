import { Head, Link, router } from '@inertiajs/react';
import { CalendarDays, History, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import '@/../css/manager-history.css';

type Activity = {
    id: string;
    lead_id: number;
    customer_name: string;
    city: string | null;
    current_status: string;
    manager_name: string;
    manager_account_id: number;
    activity_type: 'movement' | 'note' | 'assignment';
    description: string;
    created_at: string;
};

type PageLink = { url: string | null; label: string; active: boolean };
type PaginatedActivities = {
    data: Activity[];
    total: number;
    from: number | null;
    to: number | null;
    links: PageLink[];
};

type ManagerOption = { manager_id: number; account_id: number; manager_name: string };
type Filters = { manager: number | null; search: string; from: string | null; to: string | null };

const leadPath = (activity: Activity): string => {
    const paths: Record<string, string> = {
        confirmed: '/lead-workflow/confirm-leads',
        dispatched: '/lead-workflow/dispatch-leads',
        reschedule: '/lead-workflow/reschedule',
        his: '/lead-workflow/his',
        la: '/lead-workflow/la',
        '555': '/lead-workflow/555',
        toss: '/lead-workflow/toss-leads',
        project: '/management/quality-control',
    };
    const path = paths[activity.current_status] ?? '/lead-workflow/leads-shop';

    return `${path}?lead=${activity.lead_id}`;
};

export default function ManagerHistory({
    activities,
    managers,
    filters,
    canViewAll,
}: {
    activities: PaginatedActivities;
    managers: ManagerOption[];
    filters: Filters;
    canViewAll: boolean;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [manager, setManager] = useState(filters.manager ? String(filters.manager) : '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const applyFilters = (event: React.FormEvent) => {
        event.preventDefault();
        router.get('/management/manager-history', {
            search: search || undefined,
            manager: canViewAll && manager ? manager : undefined,
            from: from || undefined,
            to: to || undefined,
        }, { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Manager History" />
            <main className="manager-history-page">
                <header className="manager-history-hero">
                    <div className="manager-history-hero__icon"><History /></div>
                    <div>
                        <span>ACCOUNTABILITY</span>
                        <h1>Manager History</h1>
                        <p>{canViewAll ? 'Review every manager action recorded against a lead.' : 'Review the leads and activities recorded under your manager account.'}</p>
                    </div>
                    <div className="manager-history-total"><strong>{activities.total.toLocaleString()}</strong><span>recorded actions</span></div>
                </header>

                <form className="manager-history-filters" onSubmit={applyFilters}>
                    <label className="manager-history-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lead, city, address, or manager" /></label>
                    {canViewAll && (
                        <label><span>Manager</span><select value={manager} onChange={(event) => setManager(event.target.value)}><option value="">All managers</option>{managers.map((option) => <option key={option.manager_id} value={option.account_id}>{option.manager_name}</option>)}</select></label>
                    )}
                    <label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                    <label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                    <button type="submit">Apply filters</button>
                </form>

                <section className="manager-history-card">
                    <header><div><ShieldCheck /><div><h2>Lead activity</h2><p>{activities.from ?? 0}-{activities.to ?? 0} of {activities.total.toLocaleString()}</p></div></div></header>
                    <div className="manager-history-table-wrap">
                        <table>
                            <thead><tr><th>Date & time</th><th>Manager</th><th>Lead</th><th>Activity</th><th>Current lane</th><th /></tr></thead>
                            <tbody>
                                {activities.data.map((activity) => (
                                    <tr key={activity.id}>
                                        <td><CalendarDays /><span>{new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.created_at))}</span></td>
                                        <td><UserRound /><strong>{activity.manager_name}</strong></td>
                                        <td><strong>{activity.customer_name}</strong><small>{activity.city || 'No city'} · Lead #{activity.lead_id}</small></td>
                                        <td><span className={`manager-history-type manager-history-type--${activity.activity_type}`}>{activity.activity_type}</span><p>{activity.description}</p></td>
                                        <td><span className="manager-history-status">{activity.current_status.replaceAll('_', ' ')}</span></td>
                                        <td><Link href={leadPath(activity)}>Open lead</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {activities.data.length === 0 && <div className="manager-history-empty"><History /><strong>No manager activity found</strong><span>Try changing the selected filters.</span></div>}
                    </div>
                    {activities.links.length > 3 && <footer>{activities.links.map((link, index) => link.url ? <Link key={`${link.label}-${index}`} href={link.url} preserveScroll className={link.active ? 'is-active' : ''} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={`${link.label}-${index}`} dangerouslySetInnerHTML={{ __html: link.label }} />)}</footer>}
                </section>
            </main>
        </>
    );
}
