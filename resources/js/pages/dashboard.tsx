import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowUpRight,
    LayoutDashboard,
    Sparkles,
    SquareStack,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import '@/../css/dashboard.css';
import { dashboard } from '@/routes';
import LeadGlobalSearch from '@/components/lead-global-search';

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
    teamFilters: {
        from: string;
        to: string;
        timezone: string;
        all: boolean;
    };
    teamPerformance: {
        id: number;
        name: string;
        manager: string;
        total: number;
        confirmed: number;
        sold: number;
        agents: {
            id: number;
            name: string;
            total: number;
            confirmed: number;
            sold: number;
        }[];
    }[];
    salesmanPerformance: {
        id: number;
        name: string;
        assigned: number;
        sold: number;
    }[];
    managerPerformance: {
        id: number;
        name: string;
        total: number;
        confirmed: number;
        dispatched: number;
        sold: number;
    }[];
    bookingPressure: {
        today: number;
        tomorrow: number;
        noAppointment: number;
        overdue: number;
    };
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
    teamFilters,
    teamPerformance,
    salesmanPerformance,
    managerPerformance,
    bookingPressure,
    workflowLanes,
    activeWorkflowCount,
    topSources,
}: DashboardProps) {
    const [teamFrom, setTeamFrom] = useState(teamFilters.from);
    const [teamTo, setTeamTo] = useState(teamFilters.to);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const selectedTeam =
        teamPerformance.find((team) => team.id === selectedTeamId) ?? null;
    const maxSource = Math.max(...topSources.map((source) => source.total), 1);
    const kpis = [
        {
            label: 'Total leads',
            value: metrics.totalLeads.toLocaleString(),
            caption: 'Created in selected range',
            icon: Users,
            tone: 'blue',
        },
        {
            label: 'Leads created',
            value: metrics.createdToday.toLocaleString(),
            caption: `${teamFilters.from} to ${teamFilters.to}`,
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
                    <div className="crm-dashboard-hero-actions">
                        <form
                            className="crm-dashboard-date-filter"
                            onSubmit={(event) => {
                                event.preventDefault();
                                router.get('/dashboard', { from: teamFrom, to: teamTo }, { preserveScroll: true });
                            }}
                        >
                            <label><span>From</span><input type="date" value={teamFrom} max={teamTo} onChange={(event) => setTeamFrom(event.target.value)} /></label>
                            <label><span>To</span><input type="date" value={teamTo} min={teamFrom} onChange={(event) => setTeamTo(event.target.value)} /></label>
                            <button type="submit">Apply</button>
                            <button type="button" className={teamFilters.all ? 'is-active' : ''} onClick={() => router.get('/dashboard', { all: 1 })}>See all</button>
                        </form>
                        <LeadGlobalSearch className="crm-dashboard-search" />
                    </div>
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
                    <article className="crm-dashboard-card crm-dashboard-teams">
                        <header>
                            <div>
                                <h2>Team Lead Performance</h2>
                                <p>Uses the same lead scoring rules as Team Dashboard.</p>
                            </div>
                        </header>
                        <div className="crm-dashboard-team-table">
                            <div className="crm-dashboard-team-row is-heading">
                                <span>Team</span>
                                <span>Total</span>
                                <span>Confirmed</span>
                                <span>Sold</span>
                            </div>
                            {teamPerformance.map((team) => (
                                <button
                                    type="button"
                                    className="crm-dashboard-team-row"
                                    key={team.id}
                                    onClick={() => setSelectedTeamId(team.id)}
                                >
                                    <strong>
                                        {team.name}{' '}
                                        <small>({team.manager})</small>
                                    </strong>
                                    <span>{team.total}</span>
                                    <span>{team.confirmed}</span>
                                    <span>{team.sold}</span>
                                </button>
                            ))}
                            {teamPerformance.length === 0 && (
                                <p className="crm-dashboard-team-empty">
                                    No teams have been created yet.
                                </p>
                            )}
                        </div>
                    </article>

                    <article className="crm-dashboard-card crm-dashboard-salesmen">
                        <header>
                            <h2>Salesman Lead Performance</h2>
                            <p>Current Dispatch leads by appointment date in the selected range.</p>
                        </header>
                        <div className="crm-dashboard-salesman-table">
                            <div className="crm-dashboard-salesman-row is-heading">
                                <span>Salesman</span>
                                <span>Assigned</span>
                                <span>Sold</span>
                            </div>
                            {salesmanPerformance.map((salesman) => (
                                <div
                                    className="crm-dashboard-salesman-row"
                                    key={salesman.id}
                                >
                                    <strong>{salesman.name}</strong>
                                    <span>{salesman.assigned}</span>
                                    <span>{salesman.sold}</span>
                                </div>
                            ))}
                            {salesmanPerformance.length === 0 && (
                                <p className="crm-dashboard-team-empty">
                                    No salesmen have been created yet.
                                </p>
                            )}
                        </div>
                    </article>

                    <article className="crm-dashboard-card crm-dashboard-salesmen">
                        <header>
                            <h2>Manager Lead Performance</h2>
                            <p>Leads returned to Leads Shop in the selected range and their progress.</p>
                        </header>
                        <div className="crm-dashboard-salesman-table">
                            <div className="crm-dashboard-manager-row is-heading">
                                <span>Manager</span>
                                <span>Total</span>
                                <span>Confirmed</span>
                                <span>Dispatched</span>
                                <span>Sold</span>
                            </div>
                            {managerPerformance.map((manager) => (
                                <div className="crm-dashboard-manager-row" key={manager.id}>
                                    <strong>{manager.name}</strong>
                                    <span>{manager.total}</span>
                                    <span>{manager.confirmed}</span>
                                    <span>{manager.dispatched}</span>
                                    <span>{manager.sold}</span>
                                </div>
                            ))}
                            {managerPerformance.length === 0 && (
                                <p className="crm-dashboard-team-empty">No manager returns in this range.</p>
                            )}
                        </div>
                    </article>

                </section>

                {selectedTeam && (
                    <div
                        className="crm-dashboard-team-modal"
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setSelectedTeamId(null);
                            }
                        }}
                    >
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="team-breakdown-title"
                        >
                            <header>
                                <div>
                                    <small>Team member breakdown</small>
                                    <h2 id="team-breakdown-title">
                                        {selectedTeam.name}
                                    </h2>
                                    <p>Manager: {selectedTeam.manager}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTeamId(null)}
                                    aria-label="Close team breakdown"
                                >
                                    <X />
                                </button>
                            </header>
                            <div className="crm-dashboard-team-modal__summary">
                                <article>
                                    <small>Total</small>
                                    <strong>{selectedTeam.total}</strong>
                                </article>
                                <article>
                                    <small>Confirmed</small>
                                    <strong>{selectedTeam.confirmed}</strong>
                                </article>
                                <article>
                                    <small>Sold</small>
                                    <strong>{selectedTeam.sold}</strong>
                                </article>
                            </div>
                            <div className="crm-dashboard-team-modal__table">
                                <div className="is-heading">
                                    <span>Member</span>
                                    <span>Total</span>
                                    <span>Confirmed</span>
                                    <span>Sold</span>
                                </div>
                                {selectedTeam.agents.map((agent) => (
                                    <div key={agent.id}>
                                        <strong>{agent.name}</strong>
                                        <span>{agent.total}</span>
                                        <span>{agent.confirmed}</span>
                                        <span>{agent.sold}</span>
                                    </div>
                                ))}
                                {selectedTeam.agents.length === 0 && (
                                    <p>No agents assigned to this team.</p>
                                )}
                            </div>
                        </section>
                    </div>
                )}

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
