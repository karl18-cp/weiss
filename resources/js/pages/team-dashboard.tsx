import { Head, router } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Medal,
    Search,
    Trophy,
    UserRound,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/team-dashboard.css';

type Period = 'daily' | 'weekly' | 'monthly';

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
};

type TeamScore = {
    id: number;
    name: string;
    manager: string;
    memberCount: number;
    total: number;
    rank: number;
    dailyScores: DailyScore[];
    agents: AgentScore[];
};

type TeamDashboardProps = {
    filters: {
        period: Period;
        date: string;
        timezone: string;
    };
    range: {
        start: string;
        end: string;
        label: string;
    };
    summary: {
        totalLeads: number;
        teamCount: number;
        activeTeams: number;
        unassignedLeads: number;
        topTeam: string | null;
        topScore: number;
    };
    teams: TeamScore[];
};

const periodLabels: Record<Period, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
};

export default function TeamDashboard({
    filters,
    range,
    summary,
    teams,
}: TeamDashboardProps) {
    const [search, setSearch] = useState('');
    const filteredTeams = useMemo(() => {
        const query = search.trim().toLowerCase();

        return query
            ? teams.filter(
                  (team) =>
                      team.name.toLowerCase().includes(query) ||
                      team.manager.toLowerCase().includes(query) ||
                      team.agents.some((agent) =>
                          agent.name.toLowerCase().includes(query),
                      ),
              )
            : teams;
    }, [search, teams]);

    const applyFilters = (period: Period, date = filters.date) => {
        router.get(
            '/team-dashboard',
            { period, date },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['filters', 'range', 'summary', 'teams'],
            },
        );
    };

    const movePeriod = (direction: -1 | 1) => {
        const date = new Date(`${filters.date}T12:00:00`);

        if (filters.period === 'monthly') {
            date.setMonth(date.getMonth() + direction);
        } else {
            date.setDate(
                date.getDate() +
                    direction * (filters.period === 'weekly' ? 7 : 1),
            );
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
            <main className="team-dashboard-page">
                <header className="team-dashboard-hero">
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
                </header>

                <section className="team-dashboard-controls">
                    <div className="team-period-tabs">
                        {(Object.keys(periodLabels) as Period[]).map(
                            (period) => (
                                <button
                                    type="button"
                                    key={period}
                                    className={
                                        filters.period === period
                                            ? 'is-active'
                                            : ''
                                    }
                                    onClick={() => applyFilters(period)}
                                >
                                    {periodLabels[period]}
                                </button>
                            ),
                        )}
                    </div>
                    <div className="team-date-navigation">
                        <button
                            type="button"
                            onClick={() => movePeriod(-1)}
                            aria-label="Previous period"
                        >
                            <ChevronLeft />
                        </button>
                        <label>
                            <CalendarDays />
                            <input
                                type="date"
                                value={filters.date}
                                onChange={(event) =>
                                    applyFilters(
                                        filters.period,
                                        event.target.value,
                                    )
                                }
                            />
                        </label>
                        <strong>{range.label}</strong>
                        <button
                            type="button"
                            onClick={() => movePeriod(1)}
                            aria-label="Next period"
                        >
                            <ChevronRight />
                        </button>
                    </div>
                </section>

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
                            <Medal />
                        </span>
                        <div>
                            <small>Top team</small>
                            <strong>{summary.topTeam ?? '—'}</strong>
                            <p>{summary.topScore} leads</p>
                        </div>
                    </article>
                    <article>
                        <span className="is-green">
                            <Users />
                        </span>
                        <div>
                            <small>Active teams</small>
                            <strong>
                                {summary.activeTeams}/{summary.teamCount}
                            </strong>
                            <p>Teams with a score</p>
                        </div>
                    </article>
                    <article>
                        <span className="is-orange">
                            <UserRound />
                        </span>
                        <div>
                            <small>Outside teams</small>
                            <strong>{summary.unassignedLeads}</strong>
                            <p>Leads from unassigned Agents</p>
                        </div>
                    </article>
                </section>

                <section className="team-scoreboard">
                    <header>
                        <div>
                            <h2>Team scores</h2>
                            <p>
                                Ranked by leads created during the selected
                                period.
                            </p>
                        </div>
                        <label>
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search team, manager, or agent"
                            />
                        </label>
                    </header>

                    <div className="team-score-list">
                        {filteredTeams.map((team) => {
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
                                        <strong>
                                            {team.total}
                                            <small>leads</small>
                                        </strong>
                                    </header>

                                    <div className="team-score-details">
                                        <section className="team-date-counts">
                                            <h4>
                                                {filters.period === 'daily'
                                                    ? 'Selected day'
                                                    : 'Count by day'}
                                            </h4>
                                            <div>
                                                {team.dailyScores.map(
                                                    (score) => (
                                                        <article
                                                            key={score.date}
                                                        >
                                                            <span>
                                                                <strong>
                                                                    {score.day}
                                                                </strong>
                                                                <small>
                                                                    {
                                                                        score.label
                                                                    }
                                                                </small>
                                                            </span>
                                                            <b>
                                                                {score.count}
                                                            </b>
                                                        </article>
                                                    ),
                                                )}
                                            </div>
                                        </section>

                                        <section className="team-agent-scores">
                                            <h4>Agent contribution</h4>
                                            <div>
                                                {team.agents.map((agent) => (
                                                    <article key={agent.id}>
                                                        <span>
                                                            {agent.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                        <strong>
                                                            {agent.name}
                                                        </strong>
                                                        <b>{agent.total}</b>
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
                        {filteredTeams.length === 0 && (
                            <div className="team-dashboard-empty">
                                <Users />
                                <h3>No teams found</h3>
                                <p>
                                    Create teams under Contacts &amp; Users or
                                    change your search.
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
