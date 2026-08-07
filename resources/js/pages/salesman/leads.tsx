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
};

export default function SalesmanLeads({
    leads,
    salesman,
}: {
    leads: SalesmanLead[];
    salesman: { id: number; name: string };
}) {
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
            ]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [leads, search]);

    return (
        <>
            <Head title="My Leads" />
            <section className="salesman-leads">
                <header>
                    <span>Salesman workspace</span>
                    <h1>My Leads</h1>
                    <p>
                        {salesman.name}, select one of your assigned leads to
                        open its information.
                    </p>
                </header>

                <label className="salesman-leads__search">
                    <Search />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search my leads"
                    />
                </label>

                <div className="salesman-leads__list salesman-leads__list--standalone">
                    {filtered.map((lead) => (
                        <Link
                            key={lead.id}
                            href={`/salesman/lead-information?lead=${lead.id}`}
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
                            </span>
                            <ChevronRight />
                        </Link>
                    ))}
                    {filtered.length === 0 && (
                        <p className="salesman-leads__empty">
                            No assigned leads match this search.
                        </p>
                    )}
                </div>
            </section>
        </>
    );
}
