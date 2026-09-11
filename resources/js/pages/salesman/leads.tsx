import { Head, Link } from '@inertiajs/react';
import { CalendarDays, ChevronRight, Search } from 'lucide-react';
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

const californiaDay = (value: string | Date) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(typeof value === 'string' ? new Date(value) : value);

export default function SalesmanLeads({ leads, salesman, mode = 'leads' }: {
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
            [lead.customer_name, lead.address, lead.city, lead.company?.company, lead.product?.product_name, lead.project?.project_number]
                .join(' ').toLowerCase().includes(query),
        );
    }, [leads, search]);
    const leadSections = useMemo(() => {
        if (isSold || isFollowUps) return [{ label: pageTitle, leads: filtered }];

        const today = californiaDay(new Date());
        return [
            { label: 'Today', leads: filtered.filter((lead) => lead.appointment_at && californiaDay(lead.appointment_at) === today) },
            { label: 'Upcoming', leads: filtered.filter((lead) => lead.appointment_at && californiaDay(lead.appointment_at) !== today) },
        ].filter((section) => section.leads.length > 0);
    }, [filtered, isFollowUps, isSold, pageTitle]);

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
                              : 'select an active appointment to open its information.'}
                    </p>
                </header>

                <label className="salesman-leads__search">
                    <Search />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={isSold ? 'Search my sold projects' : isFollowUps ? 'Search my follow ups' : 'Search active appointments'}
                    />
                </label>

                {!isSold && !isFollowUps && (
                    <div className="salesman-leads__active-summary">
                        <CalendarDays />
                        <span>
                            <strong>{leads.length} active appointments</strong>
                            Today and upcoming only. Older Keep in Touch leads are under My Follow Ups.
                        </span>
                    </div>
                )}

                <div className="salesman-leads__list salesman-leads__list--standalone">
                    {leadSections.map((section) => (
                        <div className="salesman-leads__section" key={section.label}>
                            {!isSold && !isFollowUps && (
                                <div className="salesman-leads__section-heading">
                                    <span>{section.label}</span>
                                    <small>{section.leads.length}</small>
                                </div>
                            )}
                            {section.leads.map((lead) => (
                                <Link
                                    key={lead.id}
                                    href={isSold && lead.project ? `/salesman/sold/${lead.project.id}` : `/salesman/lead-information?lead=${lead.id}`}
                                >
                                    <span>
                                        <strong>{lead.customer_name}</strong>
                                        <small>{lead.appointment_at ? formatAppointmentDate(lead.appointment_at) : 'No appointment'}</small>
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
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <p className="salesman-leads__empty">
                            {isSold
                                ? 'No sold projects match this search.'
                                : isFollowUps
                                  ? 'No follow-up leads match this search.'
                                  : search.trim()
                                    ? 'No active appointments match this search.'
                                    : 'No appointments scheduled for today or later.'}
                        </p>
                    )}
                </div>
            </section>
        </>
    );
}
