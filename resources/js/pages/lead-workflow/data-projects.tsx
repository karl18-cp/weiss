import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FolderKanban, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import DataSectionTabs from '@/components/data-section-tabs';
import { AttachmentPreviewGallery } from '@/components/attachment-preview-gallery';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import '@/../css/lead-data.css';

type ProjectStatus = 'all' | 'new' | 'progress' | 'completed' | 'canceled';
type SaleType = 'all' | 'original' | 'referral';
type ProjectRow = {
    id: number;
    project_number: string;
    signed_at: string | null;
    status: Exclude<ProjectStatus, 'all'>;
    customer: string;
    company: string;
    salesman: string;
    original_agent: string;
    address: string;
    original_sale: string;
    referral_sale: string;
    total_sale: string;
    receivables_count: number;
    invoices_count: number;
    attachments: Array<{ id: number | string; sale_type: Exclude<SaleType, 'all'>; name: string; mime: string | null; url: string }>;
};
type PaginatedProjects = {
    data: ProjectRow[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
const labels: Record<ProjectStatus, string> = { all: 'All', new: 'New', progress: 'In progress', completed: 'Completed', canceled: 'Cancelled' };

export default function DataProjects({ projects, filters, totalProjects, statusCounts }: {
    projects: PaginatedProjects;
    filters: { search: string; status: ProjectStatus; sale_type: SaleType };
    totalProjects: number;
    statusCounts: Record<ProjectStatus, number>;
}) {
    const [search, setSearch] = useState(filters.search);
    const [contractProject, setContractProject] = useState<ProjectRow | null>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const visit = (values: { search?: string; status?: ProjectStatus; sale_type?: SaleType }) => router.get('/lead-workflow/data/projects', {
        search: values.search === undefined ? filters.search || undefined : values.search || undefined,
        status: values.status ?? filters.status,
        sale_type: values.sale_type ?? filters.sale_type,
    }, { preserveState: true, preserveScroll: true, replace: true });

    return (
        <>
            <Head title="Data - Projects" />
            <main className="lead-data-page lead-data-projects-page">
                <header className="lead-data-header">
                    <div>
                        <span className="lead-data-eyebrow">Data</span>
                        <h1>Projects</h1>
                        <p>A project-only register for reporting and review.</p>
                    </div>
                    <span className="lead-data-total">{totalProjects.toLocaleString()} Projects</span>
                </header>

                <DataSectionTabs active="Projects" onSearch={() => searchInput.current?.focus()} />

                <section className="lead-data-panel lead-data-project-register">
                    <div className="lead-data-toolbar">
                        <div>
                            <h2>{labels[filters.status]} projects</h2>
                            <span>{projects.total.toLocaleString()} matching projects</span>
                        </div>
                        <form className="lead-data-search" onSubmit={(event) => { event.preventDefault(); visit({ search: search.trim() }); }}>
                            <Search />
                            <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, customer, company, or city" />
                            {search && <button type="button" onClick={() => { setSearch(''); visit({ search: '' }); }} aria-label="Clear search"><X /></button>}
                        </form>
                        <div className="lead-data-pagination">
                            <button type="button" disabled={!projects.prev_page_url} onClick={() => projects.prev_page_url && router.visit(projects.prev_page_url, { preserveState: true, preserveScroll: true })} aria-label="Previous page"><ChevronLeft /></button>
                            <span>Page {projects.current_page} / {projects.last_page}</span>
                            <button type="button" disabled={!projects.next_page_url} onClick={() => projects.next_page_url && router.visit(projects.next_page_url, { preserveState: true, preserveScroll: true })} aria-label="Next page"><ChevronRight /></button>
                        </div>
                    </div>

                    <div className="lead-data-project-statuses">
                        {(Object.keys(labels) as ProjectStatus[]).map((status) => (
                            <button type="button" key={status} className={filters.status === status ? 'is-active' : ''} onClick={() => visit({ status })}>
                                {labels[status]} <span>{statusCounts[status].toLocaleString()}</span>
                            </button>
                        ))}
                        <span className="lead-data-project-filter-divider" />
                        {(['all', 'original', 'referral'] as SaleType[]).map((saleType) => (
                            <button type="button" key={saleType} className={filters.sale_type === saleType ? 'is-active is-sale-filter' : 'is-sale-filter'} onClick={() => visit({ sale_type: saleType })}>
                                {saleType === 'all' ? 'All sales' : saleType === 'original' ? 'Original sales' : 'Referral sales'}
                            </button>
                        ))}
                    </div>

                    <div className="lead-data-table-wrap">
                        <table className="lead-data-table lead-data-project-table">
                            <thead><tr><th>Signed</th><th>Status</th><th>Project #</th><th>Customer</th><th>Company</th><th>Salesman</th><th>Original agent</th><th>Address</th><th>Original sale</th><th>Referral sale</th><th>Total sale</th><th>Receivables</th><th>Invoices</th></tr></thead>
                            <tbody>
                                {projects.data.map((project) => (
                                    <tr key={project.id}>
                                        <td>{project.signed_at ? date.format(new Date(`${project.signed_at}T12:00:00`)) : 'N/A'}</td>
                                        <td><span className={`lead-data-project-status is-${project.status}`}>{labels[project.status]}</span></td>
                                        <td><button type="button" className="lead-data-project-number" onClick={() => setContractProject(project)}>{project.project_number}</button></td>
                                        <td><strong>{project.customer}</strong></td>
                                        <td>{project.company}</td>
                                        <td>{project.salesman}</td>
                                        <td>{project.original_agent}</td>
                                        <td>{project.address}</td>
                                        <td>{money.format(Number(project.original_sale))}</td>
                                        <td>{money.format(Number(project.referral_sale))}</td>
                                        <td><strong className="lead-data-project-money">{money.format(Number(project.total_sale))}</strong></td>
                                        <td>{project.receivables_count}</td>
                                        <td>{project.invoices_count}</td>
                                    </tr>
                                ))}
                                {projects.data.length === 0 && <tr><td colSpan={13} className="lead-data-empty"><FolderKanban /><strong>No projects found</strong><span>Try another search or status.</span></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                <Dialog open={contractProject !== null} onOpenChange={(open) => !open && setContractProject(null)}>
                    {contractProject && <DialogContent className="lead-data-contract-modal">
                        <DialogHeader>
                            <DialogTitle>{contractProject.project_number} contracts</DialogTitle>
                            <DialogDescription>Original and referral sale files attached to this project.</DialogDescription>
                        </DialogHeader>
                        {(['original', 'referral'] as const).map((saleType) => {
                            const files = contractProject.attachments.filter((file) => file.sale_type === saleType);
                            return <section className="lead-data-contract-group" key={saleType}>
                                <h3>{saleType === 'original' ? 'Original sale contract' : 'Referral sale contract'}</h3>
                                {files.length ? <><AttachmentPreviewGallery files={files.map((file) => ({ name: file.name, mime: file.mime, url: file.url }))} /><div className="lead-data-contract-links">{files.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">Open {file.name}</a>)}</div></> : <p>No {saleType} sale contract attached.</p>}
                            </section>;
                        })}
                    </DialogContent>}
                </Dialog>
            </main>
        </>
    );
}
