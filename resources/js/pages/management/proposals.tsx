import { Head, router, useForm } from '@inertiajs/react';
import { Download, FilePlus2, FileText, Plus, Save, Search, Send, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { useSystemModal } from '@/components/system-modal-provider';
import '@/../css/proposals.css';
import '@/../css/proposals-layout-fix.css';

type Item = { product_id: number | null; name: string; description: string; quantity: number | string; unit: string; unit_price: number | string; total?: string };
type Version = { id: number; version: number; file_name: string; created_at: string };
type Proposal = { id: number; proposal_number: string; project_id: number | null; lead_id: number | null; customer_name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip_code: string | null; status: string; issue_date: string; expires_at: string | null; scope: string | null; exclusions: string | null; payment_schedule: string | null; terms: string | null; notes: string | null; discount: string; tax_rate: string; subtotal: string; tax_amount: string; total: string; items: Item[]; versions: Version[] };
type Contact = { id: number; project_number?: string | null; lead_id?: number | null; customer_name: string | null; email: string | null; primary_number: string | null; address: string | null; city: string | null; state: string | null; zip_code: string | null; lead?: Omit<Contact, 'lead'> | null };
type Product = { prod_id: number; product_name: string; price: string | null; unit: string | null; description: string | null };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const homeImprovementUnits = [
    'Each',
    'Square Foot',
    'Linear Foot',
    'Square Yard',
    'Cubic Yard',
    'Hour',
    'Day',
    'Lump Sum',
    'Room',
    'Fixture',
    'Door',
    'Window',
    'Cabinet',
    'Sheet',
    'Gallon',
    'Bag',
    'Roll',
    'Box',
] as const;
const blankItem = (): Item => ({ product_id: null, name: '', description: '', quantity: 1, unit: 'Each', unit_price: '' });
const blank = () => ({ project_id: null as number | null, lead_id: null as number | null, customer_name: '', email: '', phone: '', address: '', city: '', state: 'CA', zip_code: '', status: 'Draft', issue_date: today(), expires_at: '', scope: '', exclusions: '', payment_schedule: '', terms: 'Proposal pricing is valid through the expiration date above. Changes outside this scope require written approval.', notes: '', discount: 0 as number | string, tax_rate: 0 as number | string, items: [blankItem()] });
const money = (value: number | string) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function Proposals({ proposals, projects, leads, products, statuses, canEdit }: { proposals: Proposal[]; projects: Contact[]; leads: Contact[]; products: Product[]; statuses: string[]; canEdit: boolean }) {
    const requested = typeof window === 'undefined' ? null : Number(new URLSearchParams(window.location.search).get('proposal'));
    const initial = proposals.find((proposal) => proposal.id === requested) ?? proposals[0] ?? null;
    const [selected, setSelected] = useState<Proposal | null>(initial);
    const [creating, setCreating] = useState(!initial);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const { confirm } = useSystemModal();
    const form = useForm(blank());

    const load = (proposal: Proposal) => {
        setSelected(proposal); setCreating(false);
        form.setData({ project_id: proposal.project_id, lead_id: proposal.lead_id, customer_name: proposal.customer_name, email: proposal.email ?? '', phone: proposal.phone ?? '', address: proposal.address ?? '', city: proposal.city ?? '', state: proposal.state ?? '', zip_code: proposal.zip_code ?? '', status: proposal.status, issue_date: proposal.issue_date, expires_at: proposal.expires_at ?? '', scope: proposal.scope ?? '', exclusions: proposal.exclusions ?? '', payment_schedule: proposal.payment_schedule ?? '', terms: proposal.terms ?? '', notes: proposal.notes ?? '', discount: proposal.discount, tax_rate: proposal.tax_rate, items: proposal.items.map((item) => ({ ...item, description: item.description ?? '', unit: item.unit ?? '' })) });
        form.clearErrors();
    };
    const startNew = () => { setSelected(null); setCreating(true); form.setData(blank()); form.clearErrors(); };
    const visible = useMemo(() => proposals.filter((proposal) => (statusFilter === 'All' || proposal.status === statusFilter) && `${proposal.proposal_number} ${proposal.customer_name} ${proposal.address ?? ''}`.toLowerCase().includes(query.toLowerCase())), [proposals, query, statusFilter]);
    const subtotal = form.data.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
    const taxable = Math.max(0, subtotal - Number(form.data.discount || 0));
    const tax = taxable * Number(form.data.tax_rate || 0) / 100;

    const populate = (source: Contact, kind: 'project' | 'lead') => {
        const person = source.lead ?? source;
        form.setData((data) => ({ ...data, project_id: kind === 'project' ? source.id : null, lead_id: kind === 'project' ? (source.lead_id ?? null) : source.id, customer_name: person.customer_name ?? '', email: person.email ?? '', phone: person.primary_number ?? '', address: person.address ?? '', city: person.city ?? '', state: person.state ?? 'CA', zip_code: person.zip_code ?? '' }));
    };
    const updateItem = (index: number, key: keyof Item, value: string | number | null) => form.setData('items', form.data.items.map((item, i) => i === index ? { ...item, [key]: value } : item));
    const chooseProduct = (index: number, id: string) => {
        const product = products.find((entry) => entry.prod_id === Number(id));
        if (!product) return updateItem(index, 'product_id', null);
        form.setData('items', form.data.items.map((item, i) => i === index ? { ...item, product_id: product.prod_id, name: product.product_name, description: product.description ?? '', unit: product.unit ?? 'Each', unit_price: product.price ?? '' } : item));
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (creating) form.post('/management/proposals', { preserveScroll: true });
        else if (selected) form.put(`/management/proposals/${selected.id}`, { preserveScroll: true });
    };
    const remove = async () => {
        if (selected && await confirm({ title: 'Delete proposal?', message: `Delete ${selected.proposal_number} and its saved versions?`, confirmLabel: 'Delete', tone: 'danger' })) router.delete(`/management/proposals/${selected.id}`);
    };

    return <AppLayout><Head title="Proposals" /><main className="proposals-page">
        <header className="proposals-hero"><span><FileText /></span><div><small>ESTIMATING</small><h1>Proposals</h1><p>Create professional estimates independently from project production schedules.</p></div><div className="proposal-stats"><b>{proposals.length}</b><small>Total proposals</small><strong>{money(proposals.reduce((sum, p) => sum + Number(p.total), 0))}</strong><small>Quoted value</small></div>{canEdit && <button onClick={startNew}><FilePlus2 /> New proposal</button>}</header>
        <div className="proposals-workspace">
            <aside className="proposal-list"><div className="proposal-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search proposal, customer, address" /></div><div className="proposal-filters">{['All', ...statuses].map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={statusFilter === status ? 'active' : ''}>{status}</button>)}</div><div className="proposal-scroll">{visible.map((proposal) => <button key={proposal.id} className={selected?.id === proposal.id && !creating ? 'selected' : ''} onClick={() => load(proposal)}><span><b>{proposal.proposal_number}</b><em className={`status-${proposal.status.toLowerCase()}`}>{proposal.status}</em></span><strong>{proposal.customer_name}</strong><small>{proposal.address || 'No address'}</small><span><small>{proposal.issue_date}</small><b>{money(proposal.total)}</b></span></button>)}{visible.length === 0 && <p className="proposal-empty">No matching proposals.</p>}</div></aside>
            <form className="proposal-editor" onSubmit={submit}>
                <div className="proposal-editor-head"><div><small>{creating ? 'NEW PROPOSAL' : selected?.proposal_number}</small><h2>{creating ? 'Build a proposal' : selected?.customer_name}</h2></div><div>{selected && <button type="button" onClick={() => router.post(`/management/proposals/${selected.id}/generate`)} disabled={!canEdit}><Send /> Generate PDF</button>}{canEdit && <button className="primary" disabled={form.processing}><Save /> {form.processing ? 'Saving...' : 'Save proposal'}</button>}{selected && canEdit && <button type="button" className="danger" onClick={remove}><Trash2 /></button>}</div></div>
                <section><h3>Customer & proposal details</h3><div className="proposal-grid four"><label>Use project<select value={form.data.project_id ?? ''} onChange={(e) => { const project = projects.find((p) => p.id === Number(e.target.value)); project ? populate(project, 'project') : form.setData('project_id', null); }}><option value="">Standalone proposal</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.project_number || 'Not assigned'} — {p.lead?.customer_name || p.customer_name}</option>)}</select></label><label>Or CRM lead<select value={!form.data.project_id ? form.data.lead_id ?? '' : ''} onChange={(e) => { const lead = leads.find((p) => p.id === Number(e.target.value)); lead && populate(lead, 'lead'); }}><option value="">Select lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.customer_name} — {lead.city}</option>)}</select></label><label>Status<select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>Issue date<input type="date" value={form.data.issue_date} onChange={(e) => form.setData('issue_date', e.target.value)} required /></label><label>Customer<input value={form.data.customer_name} onChange={(e) => form.setData('customer_name', e.target.value)} required /></label><label>Email<input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} /></label><label>Phone<input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} /></label><label>Expires<input type="date" value={form.data.expires_at} onChange={(e) => form.setData('expires_at', e.target.value)} /></label><label className="wide">Address<input value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} /></label><label>City<input value={form.data.city} onChange={(e) => form.setData('city', e.target.value)} /></label><label>State / ZIP<div className="inline"><input value={form.data.state} onChange={(e) => form.setData('state', e.target.value)} /><input value={form.data.zip_code} onChange={(e) => form.setData('zip_code', e.target.value)} /></div></label></div></section>
                <section><div className="section-title"><h3>Estimate items</h3><button type="button" onClick={() => form.setData('items', [...form.data.items, blankItem()])}><Plus /> Add item</button></div><div className="item-table"><div className="item-heading"><span>Product / description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total</span><span /></div>{form.data.items.map((item, index) => <div className="item-row" key={index}><div><select value={item.product_id ?? ''} onChange={(e) => chooseProduct(index, e.target.value)}><option value="">Custom item</option>{products.map((product) => <option key={product.prod_id} value={product.prod_id}>{product.product_name}</option>)}</select><input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Item name" required /><textarea value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Work description" rows={2} /></div><input type="number" step="0.01" min="0.01" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /><select value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)}>{item.unit && !homeImprovementUnits.includes(item.unit as typeof homeImprovementUnits[number]) && <option value={item.unit}>{item.unit}</option>}{homeImprovementUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select><input type="number" step="0.01" min="0" value={item.unit_price} onChange={(e) => updateItem(index, 'unit_price', e.target.value)} /><b>{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</b><button type="button" onClick={() => form.data.items.length > 1 && form.setData('items', form.data.items.filter((_, i) => i !== index))}><X /></button></div>)}</div><div className="proposal-totals"><label>Discount<input type="number" min="0" step="0.01" value={form.data.discount} onChange={(e) => form.setData('discount', e.target.value)} /></label><label>Tax %<input type="number" min="0" max="100" step="0.01" value={form.data.tax_rate} onChange={(e) => form.setData('tax_rate', e.target.value)} /></label><p><span>Subtotal</span><b>{money(subtotal)}</b><span>Tax</span><b>{money(tax)}</b><strong>Total</strong><strong>{money(taxable + tax)}</strong></p></div></section>
                <section><h3>Scope, payment & terms</h3><div className="proposal-grid two"><label>Scope of work<textarea rows={5} value={form.data.scope} onChange={(e) => form.setData('scope', e.target.value)} /></label><label>Exclusions<textarea rows={5} value={form.data.exclusions} onChange={(e) => form.setData('exclusions', e.target.value)} /></label><label>Payment schedule<textarea rows={4} value={form.data.payment_schedule} onChange={(e) => form.setData('payment_schedule', e.target.value)} /></label><label>Terms & conditions<textarea rows={4} value={form.data.terms} onChange={(e) => form.setData('terms', e.target.value)} /></label><label className="wide">Internal notes<textarea rows={3} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} /></label></div></section>
                {selected && <section><h3>Generated PDF versions</h3><div className="proposal-versions">{selected.versions.map((version) => <a key={version.id} href={`/management/proposals/${selected.id}/versions/${version.version}`}><Download /> Version {version.version}<small>{new Date(version.created_at).toLocaleString()}</small></a>)}{selected.versions.length === 0 && <p>No PDF generated yet.</p>}</div></section>}
            </form>
        </div>
    </main></AppLayout>;
}
