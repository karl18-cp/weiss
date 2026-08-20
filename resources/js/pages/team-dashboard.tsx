import { Head, router } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    Maximize2,
    Minimize2,
    Trophy,
    UserCheck,
    Truck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import '@/../css/team-dashboard.css';

type Period = 'daily' | 'range' | 'monthly';

type DailyScore = {
    date: string;
    label: string;
    day: string;
    count: number;
};

type AgentScore = {
    id: number;
    name: string;
    total: number;
    confirmed: number;
    dispatched: number;
    sold: number;
    worked: boolean;
};

type TeamScore = {
    id: number;
    name: string;
    manager: string;
    memberCount: number;
    total: number;
    confirmed: number;
    dispatched: number;
    sold: number;
    rank: number;
    dailyScores: DailyScore[];
    agents: AgentScore[];
};

type TeamDashboardProps = {
    filters: {
        period: Period;
        date: string;
        from: string;
        to: string;
        timezone: string;
    };
    range: {
        start: string;
        end: string;
        label: string;
    };
    summary: {
        totalLeads: number;
        confirmed: number;
        dispatched: number;
        sold: number;
        workedAgents: number;
    };
    teams: TeamScore[];
};

const periodLabels: Record<Period, string> = {
    daily: 'Daily',
    range: 'Date Range',
    monthly: 'Monthly',
};

export default function TeamDashboard({
    filters,
    range,
    summary,
    teams,
}: TeamDashboardProps) {
    const [isScoreFullscreen, setIsScoreFullscreen] = useState(false);
    const dashboardRef = useRef<HTMLElement>(null);
    const scoreRefreshInProgress = useRef(false);

    useEffect(() => {
        const refreshScores = () => {
            if (document.hidden || scoreRefreshInProgress.current) {
                return;
            }

            scoreRefreshInProgress.current = true;
            router.reload({
                only: ['filters', 'range', 'summary', 'teams'],
                preserveState: true,
                preserveScroll: true,
                onFinish: () => {
                    scoreRefreshInProgress.current = false;
                },
            });
        };

        const intervalId = window.setInterval(refreshScores, 15_000);
        const refreshWhenVisible = () => {
            if (!document.hidden) {
                refreshScores();
            }
        };

        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener(
                'visibilitychange',
                refreshWhenVisible,
            );
        };
    }, []);

    useEffect(() => {
        const syncFullscreenState = () =>
            setIsScoreFullscreen(
                document.fullscreenElement === dashboardRef.current,
            );

        document.addEventListener('fullscreenchange', syncFullscreenState);

        return () =>
            document.removeEventListener(
                'fullscreenchange',
                syncFullscreenState,
            );
    }, []);
    const applyFilters = (
        period: Period,
        date = filters.date,
        from = filters.from,
        to = filters.to,
    ) => {
        router.get(
            '/team-dashboard',
            { period, date, from, to },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['filters', 'range', 'summary', 'teams'],
            },
        );
    };

    const enterScoreFullscreen = async () => {
        if (!dashboardRef.current?.requestFullscreen) {
            setIsScoreFullscreen(true);

            return;
        }

        try {
            await dashboardRef.current.requestFullscreen();
        } catch {
            setIsScoreFullscreen(true);
        }
    };

    const exitScoreFullscreen = async () => {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            setIsScoreFullscreen(false);
        }
    };

    const movePeriod = (direction: -1 | 1) => {
        if (filters.period === 'range') {
            const start = new Date(`${filters.from}T12:00:00`);
            const end = new Date(`${filters.to}T12:00:00`);
            const span = Math.max(
                1,
                Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
            );
            start.setDate(start.getDate() + direction * span);
            end.setDate(end.getDate() + direction * span);

            const dateKey = (value: Date) =>
                [
                    value.getFullYear(),
                    String(value.getMonth() + 1).padStart(2, '0'),
                    String(value.getDate()).padStart(2, '0'),
                ].join('-');

            applyFilters('range', filters.date, dateKey(start), dateKey(end));
            return;
        }

        const date = new Date(`${filters.date}T12:00:00`);

        if (filters.period === 'monthly') {
            date.setMonth(date.getMonth() + direction);
        } else {
            date.setDate(date.getDate() + direction);
        }

        applyFilters(
            filters.period,
            [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0'),
            ].join('-'),
        );
    };

    return (
        <>
            <Head title="Team Dashboard" />
            <main
                ref={dashboardRef}
                className={`team-dashboard-page${isScoreFullscreen ? ' is-score-fullscreen' : ''}`}
            >
                {isScoreFullscreen && (
                    <button
                        type="button"
                        className="team-fullscreen-exit"
                        onClick={exitScoreFullscreen}
                    >
                        <Minimize2 />
                    </button>
                )}
                <header className="team-dashboard-hero">
                    <div className="team-dashboard-hero__identity">
                        <span>
                            <Trophy />
                        </span>
                        <div>
                            <small>Performance scoreboard</small>
                            <h1>Team Dashboard</h1>
                            <p>
                                Leads created by the Agent members of every team.
                            </p>
                        </div>
                    </div>
                    <div className="team-dashboard-controls team-dashboard-hero__controls">
                        <div className="team-period-tabs">
                            {(Object.keys(periodLabels) as Period[]).map(
                                (period) => (
                                    <button
                                        type="button"
                                        key={period}
                                        className={filters.period === period ? 'is-active' : ''}
                                        onClick={() => applyFilters(period)}
                                    >
                                        {periodLabels[period]}
                                    </button>
                                ),
                            )}
                        </div>
                        <div className="team-date-navigation">
                            <button type="button" onClick={() => movePeriod(-1)} aria-label="Previous period">
                                <ChevronLeft />
                            </button>
                            {filters.period === 'range' ? (
                                <div className="team-custom-range">
                                    <label>
                                        <span>From</span>
                                        <input
                                            type="date"
                                            value={filters.from}
                                            onChange={(event) =>
                                                applyFilters('range', filters.date, event.target.value, filters.to)
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>To</span>
                                        <input
                                            type="date"
                                            value={filters.to}
                                            onChange={(event) =>
                                                applyFilters('range', filters.date, filters.from, event.target.value)
                                            }
                                        />
                                    </label>
                                </div>
                            ) : (
                                <label>
                                    <CalendarDays />
                                    <input
                                        type="date"
                                        value={filters.date}
                                        onChange={(event) => applyFilters(filters.period, event.target.value)}
                                    />
                                </label>
                            )}
                            <strong>{range.label}</strong>
                            <button type="button" onClick={() => movePeriod(1)} aria-label="Next period">
                                <ChevronRight />
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="team-dashboard-hero__fullscreen"
                        onClick={enterScoreFullscreen}
                        aria-label="Open team scores in fullscreen"
                        title="Fullscreen scores"
                    >
                        <Maximize2 />
                    </button>
                </header>

                <section className="team-dashboard-summary">
                    <article>
                        <span className="is-blue">
                            <Trophy />
                        </span>
                        <div>
                            <small>Team leads</small>
                            <strong>{summary.totalLeads}</strong>
                            <p>{range.label}</p>
                        </div>
                    </article>
                    <article>
                        <span className="is-purple">
                            <CheckCircle2 />
                        </span>
                        <div>
                            <small>Confirmed</small>
                            <strong>{summary.confirmed}</strong>
                            <p>Confirmed in selected period</p>
                        </div>
                    </article>
                    <article>
                        <span className="is-green">
                            <Truck />
                        </span>
                        <div>
                            <small>Dispatched</small>
                            <strong>{summary.dispatched}</strong>
                            <p>Dispatched in selected period</p>
                        </div>
                    </article>
                    <article>
                        <span className="is-orange">
                            <CircleDollarSign />
                        </span>
                        <div>
                            <small>Sold</small>
                            <strong>{summary.sold}</strong>
                            <p>Sold in selected period</p>
                        </div>
                    </article>
                    <article>
                        <span className="is-teal">
                            <UserCheck />
                        </span>
                        <div>
                            <small>Agents worked</small>
                            <strong>{summary.workedAgents}</strong>
                            <p>Tele Report logins</p>
                        </div>
                    </article>
                </section>

                <section className="team-scoreboard">
                    <div className="team-score-list">
                        {teams.map((team) => {
                            return (
                                <article
                                    className="team-score-card"
                                    key={team.id}
                                >
                                    <header>
                                        <span
                                            className={`team-rank is-rank-${Math.min(team.rank, 4)}`}
                                        >
                                            #{team.rank}
                                        </span>
                                        <div>
                                            <h3>{team.name}</h3>
                                            <p>
                                                Manager: {team.manager} ·{' '}
                                                {team.memberCount} members
                                            </p>
                                        </div>
                                        <div className="team-score-counts">
                                            <span>
                                                <small>Total</small>
                                                <strong>{team.total}</strong>
                                            </span>
                                            <span>
                                                <small>Confirmed</small>
                                                <strong>{team.confirmed}</strong>
                                            </span>
                                            <span>
                                                <small>Sold</small>
                                                <strong>{team.sold}</strong>
                                            </span>
                                        </div>
                                    </header>

                                    <div className="team-score-details">
                                        <section className="team-agent-scores">
                                            <h4>Agent contribution</h4>
                                            <div>
                                                {team.agents.map((agent) => (
                                                    <article
                                                        key={agent.id}
                                                        className={
                                                            agent.worked
                                                                ? 'is-present'
                                                                : 'is-absent'
                                                        }
                                                    >
                                                        <span className="team-agent-avatar">
                                                            {agent.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                        <strong>
                                                            {agent.name}
                                                        </strong>
                                                        <small className="team-agent-attendance">
                                                            {agent.worked
                                                                ? 'Worked'
                                                                : 'No login'}
                                                        </small>
                                                        <span className="team-agent-score-metrics">
                                                            <span>
                                                                <small>Total</small>
                                                                <b>{agent.total}</b>
                                                            </span>
                                                            <span>
                                                                <small>Confirmed</small>
                                                                <b>{agent.confirmed}</b>
                                                            </span>
                                                            <span>
                                                                <small>Sold</small>
                                                                <b>{agent.sold}</b>
                                                            </span>
                                                        </span>
                                                    </article>
                                                ))}
                                                {team.agents.length === 0 && (
                                                    <p>
                                                        No Agent members
                                                        assigned.
                                                    </p>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                </article>
                            );
                        })}
                        {teams.length === 0 && (
                            <div className="team-dashboard-empty">
                                <Users />
                                <h3>No teams found</h3>
                                <p>
                                    Create teams under Contacts &amp; Users.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                <p className="team-dashboard-timezone">
                    Scores use {filters.timezone}. Leads assigned to Agents who
                    are not members of a team are shown under “Outside teams.”
                </p>
            </main>
        </>
    );
}
