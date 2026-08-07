import { Head, router, useForm } from '@inertiajs/react';
import {
    Save,
    Search,
    ShieldCheck,
    Trash2,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';
import '@/../css/teams.css';

type Manager = {
    manager_id: number;
    manager_name: string;
};

type Agent = {
    agent_id: number;
    agent_name: string;
    company: { com_id: number; company: string } | null;
};

type Team = {
    team_id: number;
    team_name: string;
    manager: Manager;
    agents: Agent[];
};

export default function Teams({
    teams,
    managers,
    agents,
}: {
    teams: Team[];
    managers: Manager[];
    agents: Agent[];
}) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Team | null>(null);
    const [teamSearch, setTeamSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const form = useForm({
        team_name: '',
        manager_id: '',
        agent_ids: [] as string[],
    });

    const filteredTeams = useMemo(() => {
        const query = teamSearch.trim().toLowerCase();

        return query
            ? teams.filter(
                  (team) =>
                      team.team_name.toLowerCase().includes(query) ||
                      team.manager.manager_name.toLowerCase().includes(query),
              )
            : teams;
    }, [teamSearch, teams]);

    const filteredAgents = useMemo(() => {
        const query = memberSearch.trim().toLowerCase();

        return query
            ? agents.filter(
                  (agent) =>
                      agent.agent_name.toLowerCase().includes(query) ||
                      agent.company?.company.toLowerCase().includes(query),
              )
            : agents;
    }, [agents, memberSearch]);

    const reset = () => {
        setSelected(null);
        setMemberSearch('');
        form.setData({
            team_name: '',
            manager_id: '',
            agent_ids: [],
        });
        form.clearErrors();
    };

    const chooseTeam = (team: Team) => {
        setSelected(team);
        setMemberSearch('');
        form.setData({
            team_name: team.team_name,
            manager_id: String(team.manager.manager_id),
            agent_ids: team.agents.map((agent) => String(agent.agent_id)),
        });
        form.clearErrors();
    };

    const toggleAgent = (agentId: number) => {
        const id = String(agentId);
        form.setData(
            'agent_ids',
            form.data.agent_ids.includes(id)
                ? form.data.agent_ids.filter((value) => value !== id)
                : [...form.data.agent_ids, id],
        );
    };

    const selectVisibleAgents = () => {
        const visibleIds = filteredAgents.map((agent) => String(agent.agent_id));
        form.setData(
            'agent_ids',
            Array.from(new Set([...form.data.agent_ids, ...visibleIds])),
        );
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: reset };

        if (selected) {
            form.put(`/management/teams/${selected.team_id}`, options);
        } else {
            form.post('/management/teams', options);
        }
    };

    const deleteTeam = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete team?',
            message: `${selected.team_name} will be permanently removed. The manager and agents will not be deleted.`,
            confirmLabel: 'Delete team',
            tone: 'danger',
        });

        if (confirmed) {
            router.delete(`/management/teams/${selected.team_id}`, {
                preserveScroll: true,
                onSuccess: reset,
            });
        }
    };

    return (
        <>
            <Head title="Teams" />
            <main className="teams-page">
                <header className="teams-header directory-heading-with-total">
                    <div className="directory-heading-copy">
                        <span>Contacts &amp; Users</span>
                        <h1>Teams</h1>
                        <p>Group agents under the manager responsible for them.</p>
                    </div>
                <section className="teams-count directory-heading-total">
                    <div>
                        <Users />
                    </div>
                    <span>
                        <strong>{teams.length}</strong>
                        <small>Total teams</small>
                    </span>
                </section>
                </header>

                <div className="teams-workspace">
                    <DirectoryNavigation active="Teams">
                        <div className="teams-directory-heading">
                            <div className="directory-heading-title-row">
                                <h2>Team directory</h2>
                                <span className="directory-inline-count">{filteredTeams.length}</span>
                            </div>
                            <p>Select a team to edit</p>
                        </div>
                        <label className="teams-search">
                            <Search />
                            <input
                                value={teamSearch}
                                onChange={(event) =>
                                    setTeamSearch(event.target.value)
                                }
                                placeholder="Search teams"
                            />
                            {teamSearch && (
                                <button
                                    type="button"
                                    onClick={() => setTeamSearch('')}
                                    aria-label="Clear team search"
                                >
                                    <X />
                                </button>
                            )}
                        </label>
                        <div className="teams-list directory-navigation__scroll-list">
                            {filteredTeams.map((team) => (
                                <button
                                    type="button"
                                    key={team.team_id}
                                    className={
                                        selected?.team_id === team.team_id
                                            ? 'team-list-item team-list-item--active'
                                            : 'team-list-item'
                                    }
                                    onClick={() => chooseTeam(team)}
                                >
                                    <span className="team-avatar">
                                        <Users />
                                    </span>
                                    <span>
                                        <strong>{team.team_name}</strong>
                                        <small>
                                            {team.manager.manager_name} ·{' '}
                                            {team.agents.length} members
                                        </small>
                                    </span>
                                </button>
                            ))}
                            {filteredTeams.length === 0 && (
                                <div className="teams-empty">
                                    <Users />
                                    <strong>No teams found</strong>
                                    <span>
                                        {teamSearch
                                            ? 'Try another search.'
                                            : 'Create your first team.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>

                    <section className="teams-form-panel">
                        <div className="teams-form-title">
                            <div>
                                <h2>
                                    {selected ? 'Edit team' : 'Create team'}
                                </h2>
                                <p>
                                    Select the team manager and their Agent
                                    members.
                                </p>
                            </div>
                            {selected && (
                                <button type="button" onClick={reset}>
                                    New team
                                </button>
                            )}
                        </div>

                        <form onSubmit={submit} className="teams-form">
                            <div className="teams-fields">
                                <label>
                                    <span>Team name</span>
                                    <div className="teams-input">
                                        <Users />
                                        <input
                                            value={form.data.team_name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'team_name',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Enter the team name"
                                            autoFocus
                                        />
                                    </div>
                                    {form.errors.team_name && (
                                        <small>{form.errors.team_name}</small>
                                    )}
                                </label>
                                <label>
                                    <span>Team manager</span>
                                    <div className="teams-input">
                                        <ShieldCheck />
                                        <select
                                            value={form.data.manager_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'manager_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select manager
                                            </option>
                                            {managers.map((manager) => (
                                                <option
                                                    key={manager.manager_id}
                                                    value={manager.manager_id}
                                                >
                                                    {manager.manager_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {form.errors.manager_id && (
                                        <small>{form.errors.manager_id}</small>
                                    )}
                                </label>
                            </div>

                            <section className="team-members">
                                <header>
                                    <div>
                                        <div className="team-members-title">
                                            <h3>Agent members</h3>
                                            <span>{agents.length}</span>
                                        </div>
                                        <p>
                                            {form.data.agent_ids.length}{' '}
                                            selected
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={selectVisibleAgents}
                                    >
                                        Select visible
                                    </button>
                                </header>
                                <label className="team-member-search">
                                    <Search />
                                    <input
                                        value={memberSearch}
                                        onChange={(event) =>
                                            setMemberSearch(event.target.value)
                                        }
                                        placeholder="Search agents or companies"
                                    />
                                    {memberSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setMemberSearch('')}
                                            aria-label="Clear agent search"
                                        >
                                            <X />
                                        </button>
                                    )}
                                </label>
                                <div className="team-member-grid">
                                    {filteredAgents.map((agent) => (
                                        <label key={agent.agent_id}>
                                            <input
                                                type="checkbox"
                                                checked={form.data.agent_ids.includes(
                                                    String(agent.agent_id),
                                                )}
                                                onChange={() =>
                                                    toggleAgent(agent.agent_id)
                                                }
                                            />
                                            <span className="member-avatar">
                                                {agent.agent_name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                            <span>
                                                <strong>
                                                    {agent.agent_name}
                                                </strong>
                                                <small>
                                                    {agent.company?.company ??
                                                        'No company'}
                                                </small>
                                            </span>
                                        </label>
                                    ))}
                                    {filteredAgents.length === 0 && (
                                        <div className="team-members-empty">
                                            <UserRound />
                                            No agents found
                                        </div>
                                    )}
                                </div>
                                {form.errors.agent_ids && (
                                    <small className="teams-error">
                                        {form.errors.agent_ids}
                                    </small>
                                )}
                            </section>

                            <footer className="teams-actions">
                                {selected && (
                                    <button
                                        type="button"
                                        className="teams-delete"
                                        onClick={deleteTeam}
                                    >
                                        <Trash2 />
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="teams-save"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create team'}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
