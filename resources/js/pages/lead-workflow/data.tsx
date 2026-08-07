import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, Save, Search, Upload, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import '@/../css/lead-data.css';
import { formatPhoneNumber } from '@/lib/phone-number';
import DataSectionTabs from '@/components/data-section-tabs';
import { formatAppointmentDate } from '@/lib/appointment-date';

type LeadRow = {
    id: number;
    origin_at: string | null;
    agent_id: number | null;
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
    company: string;
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
        sort: SortKey;
        direction: SortDirection;
    };
    totalLeads: number;
    canEdit: boolean;
    importResult: {
        imported: number;
        notes_updated: number;
        duplicates: number;
        skipped: number;
        total: number;
        errors: string[];
    } | null;
};

type SortDirection = 'asc' | 'desc';
type SortKey = 'origin' | 'agent' | 'customer' | 'verified' | 'address' | 'city' | 'state' | 'zip' | 'appointment' | 'lead_result' | 'rep' | 'company' | 'appointment_result' | 'mobile' | 'phone' | 'note';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
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
    canEdit,
    importResult,
}: DataPageProps) {
    const [search, setSearch] = useState(filters.search);
    const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
    const searchInput = useRef<HTMLInputElement>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [editingAgentLeadId, setEditingAgentLeadId] = useState<number | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState('');
    const [agentSaving, setAgentSaving] = useState(false);
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

    const startAgentEdit = (lead: LeadRow) => {
        setEditingAgentLeadId(lead.id);
        setSelectedAgentId(lead.agent_id?.toString() ?? '');
    };

    const saveOriginalAgent = (leadId: number) => {
        if (!selectedAgentId || agentSaving) return;

        setAgentSaving(true);
        router.patch(
            `/lead-workflow/data/${leadId}/original-agent`,
            { agent_id: Number(selectedAgentId) },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setEditingAgentLeadId(null),
                onFinish: () => setAgentSaving(false),
            },
        );
    };
    const visit = (parameters: { search?: string; agent?: number | null; sort?: SortKey; direction?: SortDirection }) => {
        router.get(
            '/lead-workflow/data',
            {
                search: (parameters.search ?? filters.search) || undefined,
                agent:
                    parameters.agent === undefined
                        ? filters.agent || undefined
                        : parameters.agent || undefined,
                sort: parameters.sort ?? filters.sort,
                direction: parameters.direction ?? filters.direction,
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

    const sortableHeader = (key: SortKey, label: string, className?: string) => {
        const active = filters.sort === key;

        return (
            <th className={className} aria-sort={active ? (filters.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button
                    type="button"
                    className={active ? 'lead-data-sort is-active' : 'lead-data-sort'}
                    onClick={() => visit({
                        sort: key,
                        direction: active && filters.direction === 'asc' ? 'desc' : 'asc',
                    })}
                >
                    <span>{label}</span>
                    {active ? (filters.direction === 'asc' ? <ArrowUp /> : <ArrowDown />) : <ArrowUpDown />}
                </button>
            </th>
        );
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
                                        {sortableHeader('origin', 'Origin')}
                                        {sortableHeader('agent', 'Agent')}
                                        {sortableHeader('customer', 'Customer')}
                                        {sortableHeader('company', 'Company')}
                                        {sortableHeader('verified', 'Lead')}
                                        {sortableHeader('address', 'Address')}
                                        {sortableHeader('city', 'City')}
                                        {sortableHeader('state', 'State')}
                                        {sortableHeader('zip', 'Zip')}
                                        {sortableHeader('appointment', 'App. Date')}
                                        {sortableHeader('lead_result', 'Lead Results')}
                                        {sortableHeader('rep', 'Rep')}
                                        {sortableHeader('appointment_result', 'App. Result')}
                                        {sortableHeader('mobile', 'Mobile')}
                                        {sortableHeader('phone', 'Phone')}
                                        {sortableHeader('note', 'Note', 'lead-data-note-heading')}
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
                                                <td className="lead-data-agent-cell">
                                                    {canEdit && editingAgentLeadId === lead.id ? (
                                                        <div className="lead-data-agent-editor">
                                                            <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} aria-label={`Original agent for ${lead.customer}`}>
                                                                <option value="" disabled>Select agent</option>
                                                                {agents.map((agent) => (
                                                                    <option key={agent.agent_id} value={agent.agent_id}>{agent.agent_name}</option>
                                                                ))}
                                                            </select>
                                                            <button type="button" className="is-save" onClick={() => saveOriginalAgent(lead.id)} disabled={!selectedAgentId || agentSaving} aria-label="Save original agent"><Save /></button>
                                                            <button type="button" onClick={() => setEditingAgentLeadId(null)} disabled={agentSaving} aria-label="Cancel editing original agent"><X /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="lead-data-agent-display">
                                                            <span>{lead.agent}</span>
                                                            {canEdit && <button type="button" onClick={() => startAgentEdit(lead)}><Pencil /> Edit</button>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <strong>
                                                        {lead.customer}
                                                    </strong>
                                                </td>
                                                <td>{lead.company}</td>
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
                                                <td>{formatPhoneNumber(lead.phone)}</td>
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
                                                colSpan={16}
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
