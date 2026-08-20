import { Head, Link } from '@inertiajs/react';
import { ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatAppointmentDate } from '@/lib/appointment-date';

type SalesmanLead = {
    id: number;
    customer_name: string;
    address: string;
    city: string;
    appointment_at: string | null;
    company: { company: string } | null;
    product: { product_name: string } | null;
    project?: { id: number; project_number: string | null; amount: string; status: string } | null;
};

export default function SalesmanLeads({
    leads,
    salesman,
    mode = 'leads',
}: {
    leads: SalesmanLead[];
    salesman: { id: number; name: string };
    mode?: 'leads' | 'follow-ups' | 'sold';
}) {
    const isFollowUps = mode === 'follow-ups';
    const isSold = mode === 'sold';
    const pageTitle = isSold ? 'My Sold' : isFollowUps ? 'My Follow Ups' : 'My Leads';
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return leads;

        return leads.filter((lead) =>
            [
                lead.customer_name,
                lead.address,
                lead.city,
                lead.company?.company,
                lead.product?.product_name,
                lead.project?.project_number,
            ]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [leads, search]);

    return (
        <>
            <Head title={pageTitle} />
            <section className="salesman-leads">
                <header>
                    <span>Salesman workspace</span>
                    <h1>{pageTitle}</h1>
                    <p>
                        {salesman.name},{' '}
                        {isSold
                            ? 'these are your assigned leads that are already in Projects.'
                            : isFollowUps
                            ? 'these leads are also in CRM Keep in Touch.'
                            : 'select one of your assigned leads to open its information.'}
                    </p>
                </header>

                <label className="salesman-leads__search">
                    <Search />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={isSold ? 'Search my sold projects' : isFollowUps ? 'Search my follow ups' : 'Search my leads'}
                    />
                </label>

                <div className="salesman-leads__list salesman-leads__list--standalone">
                    {filtered.map((lead) => (
                        <Link
                            key={lead.id}
                            href={isSold && lead.project ? `/salesman/sold/${lead.project.id}` : `/salesman/lead-information?lead=${lead.id}`}
                        >
                            <span>
                                <strong>{lead.customer_name}</strong>
                                <small>
                                    {lead.appointment_at
                                        ? formatAppointmentDate(
                                              lead.appointment_at,
                                          )
                                        : 'No appointment'}
                                </small>
                                <small>{lead.city || 'No city'}</small>
                                {isSold && lead.project && (
                                    <small>
                                        {lead.project.project_number || 'Project number pending'} · ${Number(lead.project.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </small>
                                )}
                            </span>
                            <ChevronRight />
                        </Link>
                    ))}
                    {filtered.length === 0 && (
                        <p className="salesman-leads__empty">
                            {isSold
                                ? 'No sold projects match this search.'
                                : isFollowUps
                                ? 'No follow-up leads match this search.'
                                : 'No assigned leads match this search.'}
                        </p>
                    )}
                </div>
            </section>
        </>
    );
}
