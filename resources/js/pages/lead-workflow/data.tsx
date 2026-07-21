import { Head, router, useForm } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Search, Upload, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import '@/../css/lead-data.css';
import DataSectionTabs from '@/components/data-section-tabs';
import { formatAppointmentDate } from '@/lib/appointment-date';

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
    rep: string;
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
    importResult: {
        imported: number;
        notes_updated: number;
        duplicates: number;
        skipped: number;
        total: number;
        errors: string[];
    } | null;
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
    importResult,
}: DataPageProps) {
    const [search, setSearch] = useState(filters.search);
    const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
    const searchInput = useRef<HTMLInputElement>(null);
    const [importOpen, setImportOpen] = useState(false);
    const importForm = useForm<{
        file: File | null;
    }>({ file: null });

    const submitImport = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        importForm.post('/lead-workflow/data/import', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setImportOpen(false);
                importForm.reset();
            },
        });
    };

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
                    <div className="lead-data-header-actions">
                        <button type="button" onClick={() => setImportOpen(true)}>
                            <Upload /> Import leads
                        </button>
                        <span className="lead-data-total">
                            {totalLeads.toLocaleString()} Leads
                        </span>
                    </div>
                </header>

                {importResult && (
                    <section className="lead-import-result">
                        <FileSpreadsheet />
                        <div>
                            <strong>Last import: {importResult.imported} added, {importResult.notes_updated} telemarketer notes updated</strong>
                            <span>
                                {importResult.duplicates} existing leads matched and {importResult.skipped} invalid rows skipped
                                out of {importResult.total} rows.
                            </span>
                            {importResult.errors.length > 0 && (
                                <details>
                                    <summary>View skipped-row details</summary>
                                    <ul>{importResult.errors.map((error) => <li key={error}>{error}</li>)}</ul>
                                </details>
                            )}
                        </div>
                    </section>
                )}

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
                                        <th>Rep</th>
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
                                                    {lead.appointment_at
                                                        ? formatAppointmentDate(lead.appointment_at)
                                                        : 'N/A'}
                                                </td>
                                                <td>
                                                    <span className="lead-data-result">
                                                        {lead.lead_result}
                                                    </span>
                                                </td>
                                                <td>{lead.rep}</td>
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
                                                colSpan={15}
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

                {importOpen && (
                    <div className="lead-import-backdrop" role="presentation" onMouseDown={() => setImportOpen(false)}>
                        <section className="lead-import-modal" role="dialog" aria-modal="true" aria-labelledby="lead-import-title" onMouseDown={(event) => event.stopPropagation()}>
                            <header>
                                <div><FileSpreadsheet /><span><strong id="lead-import-title">Import leads</strong><small>WEISS Excel template (.xlsx)</small></span></div>
                                <button type="button" onClick={() => setImportOpen(false)} aria-label="Close import"><X /></button>
                            </header>
                            <form onSubmit={submitImport}>
                                <p>The file's Agent and Lead Results determine ownership and workflow placement. Company and product are left blank, while Rep is always saved as N/A. Duplicate phone numbers or customer/address records are skipped.</p>
                                <label>
                                    Excel workbook
                                    <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => importForm.setData('file', event.target.files?.[0] ?? null)} required />
                                    {importForm.errors.file && <span className="lead-import-error">{importForm.errors.file}</span>}
                                </label>
                                <footer>
                                    <button type="button" className="is-secondary" onClick={() => setImportOpen(false)}>Cancel</button>
                                    <button type="submit" disabled={importForm.processing}>{importForm.processing ? 'Importing…' : 'Import leads'}</button>
                                </footer>
                            </form>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
