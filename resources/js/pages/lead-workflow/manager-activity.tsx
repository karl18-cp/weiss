import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    Headphones,
    History,
    PhoneCall,
    Search,
    ArrowUpDown,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { formatPhoneNumber } from '@/lib/phone-number';
import '@/../css/manager-activity.css';

type PageLink = { url: string | null; label: string; active: boolean };
type Paginated<T> = {
    data: T[];
    total: number;
    from: number | null;
    to: number | null;
    links: PageLink[];
};

type ManagerOption = {
    manager_id: number;
    account_id: number;
    manager_name: string;
    manager_types: string[];
};

type Activity = {
    id: string;
    lead_id: number;
    customer_name: string;
    city: string | null;
    current_status: string;
    manager_name: string;
    activity_type: 'movement' | 'note' | 'assignment';
    description: string;
    created_at: string;
};

type Call = {
    id: number;
    lead_id: number;
    phone_number: string;
    result: string | null;
    duration_seconds: number;
    initiated_at: string;
    started_at: string | null;
    recording_url: string | null;
    manager_name: string;
    lead: {
        id: number;
        customer_name: string;
        address: string;
        city: string;
        state: string;
        zip_code: string;
        status: string;
    } | null;
};

type Filters = {
    manager: number | null;
    search: string;
    from: string | null;
    to: string | null;
    view: 'calls' | 'history';
    destination: 'confirmed' | 'dispatched' | null;
    talked_to: boolean;
    call_sort: 'date' | 'manager' | 'lead' | 'result' | 'duration';
    call_direction: 'asc' | 'desc';
};

const dateTime = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

const duration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const leadPath = (leadId: number, status: string): string => {
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

    return `${paths[status] ?? '/lead-workflow/leads-shop'}?lead=${leadId}`;
};

function Pagination({ links }: { links: PageLink[] }) {
    if (links.length <= 3) return null;

    return (
        <footer className="manager-activity-pagination">
            {links.map((link, index) =>
                link.url ? (
                    <Link
                        key={`${link.label}-${index}`}
                        href={link.url}
                        preserveScroll
                        className={link.active ? 'is-active' : ''}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <span
                        key={`${link.label}-${index}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ),
            )}
        </footer>
    );
}

export default function ManagerActivity({
    activities,
    calls,
    managers,
    filters,
    canViewAll,
    movementTotals,
}: {
    activities: Paginated<Activity>;
    calls: Paginated<Call>;
    managers: ManagerOption[];
    filters: Filters;
    canViewAll: boolean;
    movementTotals: {
        confirmed: number;
        dispatched: number;
    };
}) {
    const [view, setView] = useState<'calls' | 'history'>(filters.view);
    const [search, setSearch] = useState(filters.search ?? '');
    const [manager, setManager] = useState(
        filters.manager ? String(filters.manager) : '',
    );
    const [destination, setDestination] = useState(filters.destination ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [talkedTo, setTalkedTo] = useState(Boolean(filters.talked_to));

    const requestFilters = (overrides: Record<string, string | boolean | undefined> = {}) => {
        const requestedView = (overrides.view as 'calls' | 'history' | undefined) ?? view;

        return {
            view: requestedView,
            search: search || undefined,
            manager: canViewAll && manager ? manager : undefined,
            from: from || undefined,
            to: to || undefined,
            talked_to: requestedView === 'calls' && talkedTo ? true : undefined,
            destination:
                canViewAll && requestedView === 'history' && destination
                    ? destination
                    : undefined,
            call_sort: requestedView === 'calls' ? filters.call_sort : undefined,
            call_direction: requestedView === 'calls' ? filters.call_direction : undefined,
            ...overrides,
        };
    };

    const leadsManagers = managers.filter((option) =>
        option.manager_types.includes('Leads Manager'),
    );
    const otherManagers = managers.filter(
        (option) => !option.manager_types.includes('Leads Manager'),
    );
    const selectedLeadsManager = leadsManagers.some(
        (option) => String(option.account_id) === manager,
    )
        ? manager
        : '';
    const selectedOtherManager = otherManagers.some(
        (option) => String(option.account_id) === manager,
    )
        ? manager
        : '';

    const switchView = (nextView: 'calls' | 'history') => {
        setView(nextView);
        router.get(
            '/lead-workflow/call-logs',
            requestFilters({
                view: nextView,
                talked_to: nextView === 'calls' && talkedTo ? true : undefined,
                call_sort: nextView === 'calls' ? filters.call_sort : undefined,
                call_direction: nextView === 'calls' ? filters.call_direction : undefined,
            }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const applyFilters = (event: React.FormEvent) => {
        event.preventDefault();
        router.get(
            '/lead-workflow/call-logs',
            requestFilters(),
            { preserveState: true, replace: true },
        );
    };

    const sortCalls = (column: Filters['call_sort']) => {
        const direction =
            filters.call_sort === column && filters.call_direction === 'asc'
                ? 'desc'
                : 'asc';
        router.get(
            '/lead-workflow/call-logs',
            requestFilters({ view: 'calls', call_sort: column, call_direction: direction }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const SortHeading = ({ column, children }: { column: Filters['call_sort']; children: React.ReactNode }) => (
        <button type="button" className="manager-activity-sort" onClick={() => sortCalls(column)}>
            {children}<ArrowUpDown />
        </button>
    );

    return (
        <>
            <Head title="Manager Activity" />
            <main className="manager-activity-page">
                <header className="manager-activity-hero">
                    <div className="manager-activity-hero__icon">
                        <History />
                    </div>
                    <div>
                        <span>Data &amp; accountability</span>
                        <h1>Manager Activity</h1>
                        <p>
                            Manager call attempts, recordings, and lead history
                            in one place.
                        </p>
                    </div>
                    <div className="manager-activity-totals">
                        <span>
                            <strong>{calls.total.toLocaleString()}</strong>
                            calls
                        </span>
                        <span>
                            <strong>{activities.total.toLocaleString()}</strong>
                            lead actions
                        </span>
                        <span>
                            <strong>{movementTotals.confirmed.toLocaleString()}</strong>
                            moved to confirm
                        </span>
                        <span>
                            <strong>{movementTotals.dispatched.toLocaleString()}</strong>
                            moved to dispatch
                        </span>
                    </div>
                </header>

                <form
                    className="manager-activity-filters"
                    onSubmit={applyFilters}
                >
                    <label className="manager-activity-search">
                        <Search />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search manager, lead, city, address, or phone"
                        />
                    </label>
                    {canViewAll && (
                        <label>
                            <span>Leads Manager</span>
                            <select
                                value={selectedLeadsManager}
                                onChange={(event) =>
                                    setManager(event.target.value)
                                }
                            >
                                <option value="">Select leads manager</option>
                                {leadsManagers.map((option) => (
                                    <option
                                        key={option.manager_id}
                                        value={option.account_id}
                                    >
                                        {option.manager_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {canViewAll && (
                        <label>
                            <span>Other Manager</span>
                            <select
                                value={selectedOtherManager}
                                onChange={(event) =>
                                    setManager(event.target.value)
                                }
                            >
                                <option value="">Select other manager</option>
                                {otherManagers.map((option) => (
                                    <option
                                        key={option.manager_id}
                                        value={option.account_id}
                                    >
                                        {option.manager_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label>
                        <span>From</span>
                        <input
                            type="date"
                            value={from}
                            onChange={(event) => setFrom(event.target.value)}
                        />
                    </label>
                    <label>
                        <span>To</span>
                        <input
                            type="date"
                            value={to}
                            onChange={(event) => setTo(event.target.value)}
                        />
                    </label>
                    {view === 'calls' && (
                        <label>
                            <span>Calls</span>
                            <select
                                value={talkedTo ? 'talked' : 'all'}
                                onChange={(event) => setTalkedTo(event.target.value === 'talked')}
                            >
                                <option value="all">All calls</option>
                                <option value="talked">Talked to (over 20 sec)</option>
                            </select>
                        </label>
                    )}
                    {canViewAll && view === 'history' && (
                        <label>
                            <span>Moved to</span>
                            <select
                                value={destination}
                                onChange={(event) =>
                                    setDestination(event.target.value)
                                }
                            >
                                <option value="">All lead activity</option>
                                <option value="confirmed">Confirm</option>
                                <option value="dispatched">Dispatch</option>
                            </select>
                        </label>
                    )}
                    <button type="submit">Apply filters</button>
                </form>

                <section className="manager-activity-card">
                    <nav className="manager-activity-switcher">
                        <button
                            type="button"
                            className={view === 'calls' ? 'is-active' : ''}
                            onClick={() => switchView('calls')}
                        >
                            <PhoneCall /> Called Leads
                            <b>{calls.total}</b>
                        </button>
                        <button
                            type="button"
                            className={view === 'history' ? 'is-active' : ''}
                            onClick={() => switchView('history')}
                        >
                            <History /> Lead History
                            <b>{activities.total}</b>
                        </button>
                    </nav>

                    {view === 'calls' ? (
                        <>
                            <div className="manager-activity-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th><SortHeading column="date">Date &amp; time</SortHeading></th>
                                            <th><SortHeading column="manager">Manager</SortHeading></th>
                                            <th><SortHeading column="lead">Called lead</SortHeading></th>
                                            <th><SortHeading column="result">Result</SortHeading></th>
                                            <th><SortHeading column="duration">Duration</SortHeading></th>
                                            <th>Recording</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calls.data.map((call) => (
                                            <tr key={call.id}>
                                                <td>
                                                    <CalendarDays />
                                                    {dateTime(
                                                        call.started_at ??
                                                            call.initiated_at,
                                                    )}
                                                </td>
                                                <td>
                                                    <UserRound />
                                                    <strong>
                                                        {call.manager_name}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <strong>
                                                        {call.lead
                                                            ?.customer_name ??
                                                            `Lead #${call.lead_id}`}
                                                    </strong>
                                                    <small>
                                                        {formatPhoneNumber(
                                                            call.phone_number,
                                                        )}
                                                        {call.lead?.city
                                                            ? ` · ${call.lead.city}`
                                                            : ''}
                                                    </small>
                                                </td>
                                                <td>
                                                    <span className="manager-activity-result">
                                                        {call.result ??
                                                            'Waiting for RingCentral'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {duration(
                                                        call.duration_seconds,
                                                    )}
                                                </td>
                                                <td>
                                                    {call.recording_url ? (
                                                        <audio
                                                            controls
                                                            preload="none"
                                                            src={
                                                                call.recording_url
                                                            }
                                                        />
                                                    ) : (
                                                        <small className="manager-activity-processing">
                                                            <Headphones /> Not
                                                            available
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    {call.lead && (
                                                        <Link
                                                            href={leadPath(
                                                                call.lead.id,
                                                                call.lead
                                                                    .status,
                                                            )}
                                                        >
                                                            Open lead
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {calls.data.length === 0 && (
                                    <div className="manager-activity-empty">
                                        <PhoneCall />
                                        <strong>No manager calls found</strong>
                                        <span>
                                            Try changing the selected filters.
                                        </span>
                                    </div>
                                )}
                            </div>
                            <Pagination links={calls.links} />
                        </>
                    ) : (
                        <>
                            <div className="manager-activity-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date &amp; time</th>
                                            <th>Manager</th>
                                            <th>Lead</th>
                                            <th>Activity</th>
                                            <th>Current lane</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activities.data.map((activity) => (
                                            <tr key={activity.id}>
                                                <td>
                                                    <CalendarDays />
                                                    {dateTime(
                                                        activity.created_at,
                                                    )}
                                                </td>
                                                <td>
                                                    <UserRound />
                                                    <strong>
                                                        {activity.manager_name}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <strong>
                                                        {activity.customer_name}
                                                    </strong>
                                                    <small>
                                                        {activity.city ||
                                                            'No city'}{' '}
                                                        · Lead #
                                                        {activity.lead_id}
                                                    </small>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`manager-activity-type manager-activity-type--${activity.activity_type}`}
                                                    >
                                                        {activity.activity_type}
                                                    </span>
                                                    <p>
                                                        {activity.description}
                                                    </p>
                                                </td>
                                                <td>
                                                    <span className="manager-activity-status">
                                                        {activity.current_status.replaceAll(
                                                            '_',
                                                            ' ',
                                                        )}
                                                    </span>
                                                </td>
                                                <td>
                                                    <Link
                                                        href={leadPath(
                                                            activity.lead_id,
                                                            activity.current_status,
                                                        )}
                                                    >
                                                        Open lead
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {activities.data.length === 0 && (
                                    <div className="manager-activity-empty">
                                        <History />
                                        <strong>
                                            No manager history found
                                        </strong>
                                        <span>
                                            Try changing the selected filters.
                                        </span>
                                    </div>
                                )}
                            </div>
                            <Pagination links={activities.links} />
                        </>
                    )}
                </section>
            </main>
        </>
    );
}
