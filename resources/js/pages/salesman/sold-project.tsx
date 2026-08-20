import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, FileText, Image, Upload } from 'lucide-react';
import type { FormEvent } from 'react';

type Document = { id: number; category: string; file_name: string; file_mime: string | null; file_size: number | null; created_at: string };
type Project = {
    id: number; project_number: string | null; amount: string; status: string;
    lead: { customer_name: string; address: string; city: string; state: string; zip_code: string; appointment_at: string | null; product: { product_name: string } | null; company: { company: string } | null };
    sales: Array<{ id: number; type: string; amount: string; sale_date: string; product: { product_name: string } | null }>;
    documents: Document[];
};

export default function SoldProject({ project }: { project: Project }) {
    const form = useForm<{ files: File[] }>({ files: [] });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/salesman/sold/${project.id}/documents`, { forceFormData: true, preserveScroll: true, onSuccess: () => form.reset() });
    };
    const money = (value: string) => Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return <>
        <Head title={`${project.project_number ?? 'Project'} · My Sold`} />
        <main className="salesman-sold-project">
            <Link className="salesman-sold-project__back" href="/salesman/sold"><ArrowLeft /> My Sold</Link>
            <header>
                <span>Sold project</span><h1>{project.lead.customer_name}</h1>
                <p>{project.project_number ?? 'Project number pending'} · {project.lead.city}</p>
            </header>
            <section className="salesman-sold-project__summary">
                <article><small>Sold amount</small><strong>{money(project.amount)}</strong></article>
                <article><small>Status</small><strong>{project.status}</strong></article>
                <article><small>Product</small><strong>{project.lead.product?.product_name ?? '—'}</strong></article>
                <article><small>Company</small><strong>{project.lead.company?.company ?? '—'}</strong></article>
                <article className="wide"><small>Project address</small><strong>{[project.lead.address, project.lead.city, project.lead.state, project.lead.zip_code].filter(Boolean).join(', ')}</strong></article>
            </section>
            <section className="salesman-sold-project__panel">
                <div><span>Sales</span><h2>Project sale details</h2></div>
                <div className="salesman-sold-project__sales">{project.sales.map((sale) => <article key={sale.id}><strong>{sale.type}</strong><span>{sale.product?.product_name ?? 'Project sale'}</span><b>{money(sale.amount)}</b><small>{sale.sale_date}</small></article>)}</div>
            </section>
            <section className="salesman-sold-project__panel">
                <div><span>Documents</span><h2>Files and project photos</h2><p>Uploads are saved in the CRM project DOC tab and its Google Drive folder.</p></div>
                <form onSubmit={submit}>
                    <label className="salesman-sold-project__drop"><Upload /><strong>{form.data.files.length ? `${form.data.files.length} file(s) selected` : 'Choose files or photos'}</strong><small>PDF, JPG, PNG, WebP, HEIC · up to 20 MB each</small><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(e) => form.setData('files', Array.from(e.target.files ?? []))} /></label>
                    {form.errors.files && <em>{form.errors.files}</em>}
                    <button disabled={form.processing || !form.data.files.length}>{form.processing ? 'Uploading...' : 'Upload to project'}</button>
                </form>
                <div className="salesman-sold-project__documents">{project.documents.map((document) => <a key={document.id} href={`/salesman/sold/${project.id}/documents/${document.id}`} target="_blank" rel="noreferrer">{document.file_mime?.startsWith('image/') ? <Image /> : <FileText />}<span><strong>{document.file_name}</strong><small>{document.category} · {new Date(document.created_at).toLocaleDateString()}</small></span></a>)}{!project.documents.length && <p>No project files uploaded yet.</p>}</div>
            </section>
        </main>
    </>;
}
