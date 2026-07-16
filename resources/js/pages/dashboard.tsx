import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowUpRight,
    LayoutDashboard,
    Search,
    Sparkles,
    SquareStack,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import '@/../css/dashboard.css';
import { dashboard } from '@/routes';

type DashboardProps = {
    metrics: {
        totalLeads: number;
        createdToday: number;
        createdLastSevenDays: number;
        activePipeline: number;
        soldRate: number;
        projects: number;
        completedProjects: number;
    };
    priority: {
        raw: number;
        noAppointment: number;
        overdue: number;
        today: number;
    };
    bookingPressure: {
        today: number;
        tomorrow: number;
        noAppointment: number;
        overdue: number;
    };
    projectHealth: Record<
        'new' | 'progress' | 'completed' | 'canceled',
        number
    >;
    workflowLanes: {
        key: string;
        label: string;
        count: number;
        leads: { id: number; customer: string }[];
    }[];
    activeWorkflowCount: number;
    topSources: { source: string; total: number }[];
};

const laneLinks: Record<string, string> = {
    fresh: '/lead-workflow/leads-shop',
    confirmed: '/lead-workflow/confirm-leads',
    kit: '/lead-workflow/keep-in-touch',
    dispatched: '/lead-workflow/dispatch-leads',
    reschedule: '/lead-workflow/reschedule',
};

export default function Dashboard({
    metrics,
    priority,
    bookingPressure,
    projectHealth,
    workflowLanes,
    activeWorkflowCount,
    topSources,
}: DashboardProps) {
    const [search, setSearch] = useState('');
    const maxProjectStatus = Math.max(...Object.values(projectHealth), 1);
    const maxSource = Math.max(...topSources.map((source) => source.total), 1);
    const kpis = [
        {
            label: 'Total leads',
            value: metrics.totalLeads.toLocaleString(),
            caption: 'All leads in the CRM',
            icon: Users,
            tone: 'blue',
        },
        {
            label: 'Created today',
            value: metrics.createdToday.toLocaleString(),
            caption: `${metrics.createdLastSevenDays.toLocaleString()} in last 7 days`,
            icon: Sparkles,
            tone: 'green',
        },
        {
            label: 'Active pipeline',
            value: metrics.activePipeline.toLocaleString(),
            caption: `${bookingPressure.today + bookingPressure.tomorrow} upcoming bookings`,
            icon: TrendingUp,
            tone: 'orange',
        },
        {
            label: 'Sold rate',
            value: `${metrics.soldRate}%`,
            caption: `${metrics.projects.toLocaleString()} sold leads`,
            icon: ArrowUpRight,
            tone: 'purple',
        },
        {
            label: 'Projects',
            value: metrics.projects.toLocaleString(),
            caption: `${metrics.completedProjects.toLocaleString()} completed`,
            icon: SquareStack,
            tone: 'teal',
        },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <main className="crm-dashboard-page">
                <section className="crm-dashboard-hero">
                    <div>
                        <span>
                            <LayoutDashboard />
                        </span>
                        <div>
                            <h1>Dashboard</h1>
                            <p>
                                Overview of your pipeline, bookings, and project
                                health.
                            </p>
                        </div>
                    </div>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            router.get('/lead-workflow/data', {
                                search: search.trim() || undefined,
                            });
                        }}
                    >
                        <Search />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search leads, customers, phone numbers…"
                        />
                    </form>
                </section>

                <section className="crm-dashboard-kpis">
                    {kpis.map((kpi) => {
                        const Icon = kpi.icon;

                        return (
                            <article
                                key={kpi.label}
                                className={`is-${kpi.tone}`}
                            >
                                <header>
                                    <span>{kpi.label}</span>
                                    <i>
                                        <Icon />
                                    </i>
                                </header>
                                <strong>{kpi.value}</strong>
                                <small>{kpi.caption}</small>
                            </article>
                        );
                    })}
                </section>

                <section className="crm-dashboard-main-grid">
                    <article className="crm-dashboard-card crm-dashboard-priority">
                        <header>
                            <h2>Priority Queue</h2>
                            <p>Operational items that need attention first.</p>
                        </header>
                        <div>
                            <Link href="/lead-workflow/leads-shop">
                                <i className="is-red" />
                                <span>Raw leads to triage</span>
                                <strong>{priority.raw}</strong>
                            </Link>
                            <Link href="/lead-workflow/booking-board">
                                <i className="is-orange" />
                                <span>No appointment set</span>
                                <strong>{priority.noAppointment}</strong>
                            </Link>
                            <Link href="/lead-workflow/booking-board">
                                <i className="is-yellow" />
                                <span>Overdue bookings</span>
                                <strong>{priority.overdue}</strong>
                            </Link>
                            <Link href="/lead-workflow/booking-board">
                                <i className="is-blue" />
                                <span>Appointments today</span>
                                <strong>{priority.today}</strong>
                            </Link>
                        </div>
                    </article>

                    <article className="crm-dashboard-card crm-dashboard-booking">
                        <header>
                            <h2>Booking Pressure</h2>
                            <p>Confirm and dispatch appointments.</p>
                        </header>
                        <div>
                            {[
                                ['Today', bookingPressure.today],
                                ['Tomorrow', bookingPressure.tomorrow],
                                ['No Appt.', bookingPressure.noAppointment],
                                ['Overdue', bookingPressure.overdue],
                            ].map(([label, value]) => (
                                <Link
                                    href="/lead-workflow/booking-board"
                                    key={label}
                                    className={
                                        label === 'Overdue' ? 'is-alert' : ''
                                    }
                                >
                                    <strong>{value}</strong>
                                    <span>{label}</span>
                                </Link>
                            ))}
                        </div>
                    </article>

                    <article className="crm-dashboard-card crm-dashboard-health">
                        <header>
                            <h2>Project Health</h2>
                            <p>Jobs by current status.</p>
                        </header>
                        <div>
                            {Object.entries(projectHealth).map(
                                ([label, value]) => (
                                    <div key={label}>
                                        <span>
                                            <em>{label}</em>
                                            <strong>{value}</strong>
                                        </span>
                                        <i>
                                            <b
                                                style={{
                                                    width: `${(value / maxProjectStatus) * 100}%`,
                                                }}
                                            />
                                        </i>
                                    </div>
                                ),
                            )}
                        </div>
                    </article>
                </section>

                <section className="crm-dashboard-bottom-grid">
                    <article className="crm-dashboard-card crm-dashboard-workflow">
                        <header>
                            <div>
                                <h2>Workflow Snapshot</h2>
                                <p>
                                    Live lead queues with the newest records in
                                    each lane.
                                </p>
                            </div>
                            <span>{activeWorkflowCount} Active</span>
                        </header>
                        <div>
                            {workflowLanes.map((lane) => (
                                <Link
                                    href={
                                        laneLinks[lane.key] ??
                                        '/lead-workflow/leads-shop'
                                    }
                                    key={lane.key}
                                >
                                    <header>
                                        <strong>{lane.label}</strong>
                                        <span>{lane.count}</span>
                                    </header>
                                    <div>
                                        {lane.leads.map((lead) => (
                                            <p key={lead.id}>{lead.customer}</p>
                                        ))}
                                        {lane.leads.length === 0 && <em>—</em>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </article>

                    <article className="crm-dashboard-card crm-dashboard-sources">
                        <header>
                            <h2>Top Sources</h2>
                            <p>Where leads are coming from.</p>
                        </header>
                        <div>
                            {topSources.map((source, index) => (
                                <div key={source.source}>
                                    <span>
                                        <strong>{source.source}</strong>
                                        <em>{source.total}</em>
                                    </span>
                                    <i>
                                        <b
                                            className={`is-${(index % 4) + 1}`}
                                            style={{
                                                width: `${(source.total / maxSource) * 100}%`,
                                            }}
                                        />
                                    </i>
                                </div>
                            ))}
                            {topSources.length === 0 && (
                                <span className="crm-dashboard-no-data">
                                    No source data yet.
                                </span>
                            )}
                        </div>
                    </article>
                </section>
            </main>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
