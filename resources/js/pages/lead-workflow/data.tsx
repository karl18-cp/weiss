import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import '@/../css/lead-data.css';
import DataSectionTabs from '@/components/data-section-tabs';

type LeadRow = {
    id: number;
    origin_at: string | null;
    agent: string;
    customer: string;
    verified: boolean;
    address: string;
    city: string;
    state: string;
    zip: string;
    appointment_at: string | null;
    lead_result: string;
    appointment_result: string;
    mobile: string;
    phone: string;
    note: string;
};

type AgentFilter = {
    agent_id: number;
    agent_name: string;
    leads_count: number;
};

type PaginatedLeads = {
    data: LeadRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type DataPageProps = {
    leads: PaginatedLeads;
    agents: AgentFilter[];
    filters: {
        search: string;
        agent: number | null;
    };
    totalLeads: number;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

function formatDate(value: string | null): string {
    return value ? dateFormatter.format(new Date(value)) : 'N/A';
}

export default function Data({
    leads,
    agents,
    filters,
    totalLeads,
}: DataPageProps) {
    const [search, setSearch] = useState(filters.search);
    const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
    const searchInput = useRef<HTMLInputElement>(null);

    const visit = (parameters: { search?: string; agent?: number | null }) => {
        router.get(
            '/lead-workflow/data',
            {
                search: (parameters.search ?? filters.search) || undefined,
                agent:
                    parameters.agent === undefined
                        ? filters.agent || undefined
                        : parameters.agent || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        visit({ search: search.trim() });
    };

    const clearSearch = () => {
        setSearch('');
        visit({ search: '' });
    };

    const toggleNote = (leadId: number) => {
        setExpandedNotes((current) => {
            const next = new Set(current);

            if (next.has(leadId)) {
                next.delete(leadId);
            } else {
                next.add(leadId);
            }

            return next;
        });
    };

    return (
        <>
            <Head title="Data" />
            <main className="lead-data-page">
                <header className="lead-data-header">
                    <div>
                        <span className="lead-data-eyebrow">Lead workflow</span>
                        <h1>Data</h1>
                        <p>
                            Review every lead and its current workflow result.
                        </p>
                    </div>
                    <span className="lead-data-total">
                        {totalLeads.toLocaleString()} Leads
                    </span>
                </header>

                <DataSectionTabs
                    active="Tele Leads"
                    onSearch={() => searchInput.current?.focus()}
                />

                <div className="lead-data-workspace">
                    <aside className="lead-data-agents">
                        <label className="lead-data-agent-search">
                            <Search />
                            <span>Filter telemarketer</span>
                        </label>

                        <button
                            type="button"
                            className={
                                filters.agent === null
                                    ? 'lead-data-agent is-active'
                                    : 'lead-data-agent'
                            }
                            onClick={() => visit({ agent: null })}
                        >
                            <strong>All</strong>
                            <span>
                                All users · {totalLeads.toLocaleString()} leads
                            </span>
                        </button>

                        <div className="lead-data-agent-list">
                            {agents.map((agent) => (
                                <button
                                    type="button"
                                    key={agent.agent_id}
                                    className={
                                        filters.agent === agent.agent_id
                                            ? 'lead-data-agent is-active'
                                            : 'lead-data-agent'
                                    }
                                    onClick={() =>
                                        visit({ agent: agent.agent_id })
                                    }
                                >
                                    <strong>{agent.agent_name}</strong>
                                    <span>
                                        Telemarketer · {agent.leads_count} leads
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <section className="lead-data-panel">
                        <div className="lead-data-toolbar">
                            <div>
                                <h2>
                                    {filters.agent
                                        ? (agents.find(
                                              (agent) =>
                                                  agent.agent_id ===
                                                  filters.agent,
                                          )?.agent_name ?? 'Agent leads')
                                        : 'All'}
                                </h2>
                                <span>
                                    {leads.total.toLocaleString()} matching
                                    leads
                                </span>
                            </div>

                            <form
                                className="lead-data-search"
                                onSubmit={submitSearch}
                            >
                                <Search />
                                <input
                                    ref={searchInput}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search leads"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={clearSearch}
                                        aria-label="Clear search"
                                    >
                                        <X />
                                    </button>
                                )}
                            </form>

                            <div className="lead-data-pagination">
                                <button
                                    type="button"
                                    disabled={!leads.prev_page_url}
                                    onClick={() =>
                                        leads.prev_page_url &&
                                        router.visit(leads.prev_page_url, {
                                            preserveState: true,
                                            preserveScroll: true,
                                        })
                                    }
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft />
                                </button>
                                <span>
                                    Page {leads.current_page} /{' '}
                                    {leads.last_page}
                                </span>
                                <button
                                    type="button"
                                    disabled={!leads.next_page_url}
                                    onClick={() =>
                                        leads.next_page_url &&
                                        router.visit(leads.next_page_url, {
                                            preserveState: true,
                                            preserveScroll: true,
                                        })
                                    }
                                    aria-label="Next page"
                                >
                                    <ChevronRight />
                                </button>
                            </div>
                        </div>

                        <div className="lead-data-table-wrap">
                            <table className="lead-data-table">
                                <thead>
                                    <tr>
                                        <th>Origin</th>
                                        <th>Agent</th>
                                        <th>Customer</th>
                                        <th>Lead</th>
                                        <th>Address</th>
                                        <th>City</th>
                                        <th>State</th>
                                        <th>Zip</th>
                                        <th>App. Date</th>
                                        <th>Lead Results</th>
                                        <th>App. Result</th>
                                        <th>Mobile</th>
                                        <th>Phone</th>
                                        <th className="lead-data-note-heading">
                                            Note
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.data.map((lead) => {
                                        const noteExpanded = expandedNotes.has(
                                            lead.id,
                                        );

                                        return (
                                            <tr key={lead.id}>
                                                <td>
                                                    {formatDate(lead.origin_at)}
                                                </td>
                                                <td>{lead.agent}</td>
                                                <td>
                                                    <strong>
                                                        {lead.customer}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`lead-data-verification ${lead.verified ? 'is-verified' : ''}`}
                                                    >
                                                        {lead.verified
                                                            ? 'Verified'
                                                            : 'Not Verified'}
                                                    </span>
                                                </td>
                                                <td>{lead.address}</td>
                                                <td>{lead.city}</td>
                                                <td>{lead.state}</td>
                                                <td>{lead.zip}</td>
                                                <td>
                                                    {formatDate(
                                                        lead.appointment_at,
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="lead-data-result">
                                                        {lead.lead_result}
                                                    </span>
                                                </td>
                                                <td>
                                                    {lead.appointment_result}
                                                </td>
                                                <td>{lead.mobile}</td>
                                                <td>{lead.phone}</td>
                                                <td className="lead-data-note-cell">
                                                    <div
                                                        className={
                                                            noteExpanded
                                                                ? 'lead-data-note is-expanded'
                                                                : 'lead-data-note'
                                                        }
                                                    >
                                                        <p>
                                                            {lead.note ||
                                                                'No telemarketer note'}
                                                        </p>
                                                        {lead.note && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleNote(
                                                                        lead.id,
                                                                    )
                                                                }
                                                            >
                                                                {noteExpanded
                                                                    ? 'Show less'
                                                                    : 'Expand'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {leads.data.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={14}
                                                className="lead-data-empty"
                                            >
                                                <Users />
                                                <strong>No leads found</strong>
                                                <span>
                                                    Try another search or agent.
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
