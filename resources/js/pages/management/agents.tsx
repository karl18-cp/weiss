import { Head, router, useForm } from '@inertiajs/react';
import { Save, Search, Trash2, UserRound, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/agents.css';
import DirectoryNavigation from '@/components/directory-navigation';
import { useSystemModal } from '@/components/system-modal-provider';

type Agent = {
    agent_id: number;
    agent_name: string;
};

export default function Agents({ agents }: { agents: Agent[] }) {
    const { confirm } = useSystemModal();
    const [selected, setSelected] = useState<Agent | null>(null);
    const [search, setSearch] = useState('');
    const form = useForm({ agent_name: '' });

    const filteredAgents = useMemo(() => {
        const query = search.trim().toLowerCase();

        return query
            ? agents.filter((agent) =>
                  agent.agent_name.toLowerCase().includes(query),
              )
            : agents;
    }, [agents, search]);

    const resetForm = () => {
        setSelected(null);
        form.setData('agent_name', '');
        form.clearErrors();
    };

    const selectAgent = (agent: Agent) => {
        setSelected(agent);
        form.setData('agent_name', agent.agent_name);
        form.clearErrors();
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: resetForm };

        if (selected) {
            form.put(`/management/agents/${selected.agent_id}`, options);

            return;
        }

        form.post('/management/agents', options);
    };

    const deleteAgent = async () => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete agent?',
            message: `${selected.agent_name} will be permanently removed from the agent directory.`,
            confirmLabel: 'Delete agent',
            tone: 'danger',
        });

        if (!confirmed) {
            return;
        }

        router.delete(`/management/agents/${selected.agent_id}`, {
            preserveScroll: true,
            onSuccess: resetForm,
        });
    };

    return (
        <>
            <Head title="Agents" />
            <main className="agents-page">
                <header className="agents-header">
                    <span>Contacts &amp; Users</span>
                    <h1>Agents</h1>
                    <p>Create and maintain agent records in Weiss CRM.</p>
                </header>

                <section className="agents-count">
                    <div>
                        <Users />
                    </div>
                    <span>
                        <strong>{agents.length}</strong>
                        <small>Total agents</small>
                    </span>
                </section>

                <div className="agents-workspace">
                    <DirectoryNavigation active="Agent">
                        <div className="agents-directory-heading">
                            <h2>Agent directory</h2>
                            <p>Select an agent to edit</p>
                        </div>
                        <label className="agents-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search agents"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Clear search"
                                >
                                    <X />
                                </button>
                            )}
                        </label>
                        <div className="agents-list directory-navigation__scroll-list">
                            {filteredAgents.map((agent) => (
                                <button
                                    type="button"
                                    key={agent.agent_id}
                                    className={
                                        selected?.agent_id === agent.agent_id
                                            ? 'agent-list-item agent-list-item--active'
                                            : 'agent-list-item'
                                    }
                                    onClick={() => selectAgent(agent)}
                                >
                                    <span className="agent-avatar">
                                        {agent.agent_name
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <span>
                                        <strong>{agent.agent_name}</strong>
                                        <small>Agent #{agent.agent_id}</small>
                                    </span>
                                </button>
                            ))}
                            {filteredAgents.length === 0 && (
                                <div className="agents-empty">
                                    <UserRound />
                                    <strong>No agents found</strong>
                                    <span>
                                        {search
                                            ? 'Try another search.'
                                            : 'Create your first agent.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </DirectoryNavigation>

                    <section className="agents-form-panel">
                        <div className="agents-form-title">
                            <h2>{selected ? 'Edit agent' : 'Create agent'}</h2>
                            <p>
                                {selected
                                    ? `Updating agent #${selected.agent_id}`
                                    : 'Add an agent to your directory'}
                            </p>
                        </div>
                        <form onSubmit={submit} className="agents-form">
                            <label>
                                <span>Agent name</span>
                                <div className="agents-input">
                                    <UserRound />
                                    <input
                                        value={form.data.agent_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'agent_name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter the agent name"
                                        autoFocus
                                    />
                                </div>
                                {form.errors.agent_name && (
                                    <small>{form.errors.agent_name}</small>
                                )}
                            </label>
                            <div className="agents-form-actions">
                                {selected && (
                                    <>
                                        <button
                                            type="button"
                                            className="agents-delete-button"
                                            onClick={deleteAgent}
                                        >
                                            <Trash2 />
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            className="agents-reset-button"
                                            onClick={resetForm}
                                        >
                                            New agent
                                        </button>
                                    </>
                                )}
                                <button
                                    type="submit"
                                    className="agents-save-button"
                                    disabled={form.processing}
                                >
                                    <Save />
                                    {form.processing
                                        ? 'Saving…'
                                        : selected
                                          ? 'Save changes'
                                          : 'Create agent'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
