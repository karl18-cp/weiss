import { Head, Link } from '@inertiajs/react';
import {
    Building2,
    CalendarClock,
    ChevronRight,
    MapPin,
    Navigation,
    Package,
    Phone,
    Search,
    UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatAppointmentDate } from '@/lib/appointment-date';

type SalesmanLead = {
    id: number;
    customer_name: string;
    primary_number: string;
    mobile_number: string | null;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    appointment_at: string | null;
    status: string;
    source: string;
    company: { company: string } | null;
    product: { product_name: string } | null;
    agent: { agent_name: string } | null;
    notes: {
        id: number;
        note_type: string;
        body: string;
        created_at: string;
    }[];
};

const address = (lead: SalesmanLead) =>
    [lead.address, lead.city, lead.state, lead.zip_code]
        .filter(Boolean)
        .join(', ');

export default function SalesmanLeads({
    leads,
    salesman,
}: {
    leads: SalesmanLead[];
    salesman: { id: number; name: string };
}) {
    const requestedId = Number(
        new URLSearchParams(window.location.search).get('lead'),
    );
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(
        leads.some((lead) => lead.id === requestedId)
            ? requestedId
            : leads[0]?.id ?? null,
    );
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
    const selected = leads.find((lead) => lead.id === selectedId) ?? null;

    return (
        <>
            <Head title="My Leads" />
            <section className="salesman-leads">
                <header>
                    <span>Salesman workspace</span>
                    <h1>My Leads</h1>
                    <p>
                        {salesman.name}, these are the leads currently assigned
                        to you.
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

                <div className="salesman-leads__layout">
                    <div className="salesman-leads__list">
                        {filtered.map((lead) => (
                            <button
                                type="button"
                                key={lead.id}
                                className={
                                    selectedId === lead.id ? 'is-active' : ''
                                }
                                onClick={() => setSelectedId(lead.id)}
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
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="salesman-leads__empty">
                                No assigned leads match this search.
                            </p>
                        )}
                    </div>

                    {selected && (
                        <article className="salesman-lead-detail">
                            <div className="salesman-lead-detail__title">
                                <span>{selected.status}</span>
                                <h2>{selected.customer_name}</h2>
                                <small>Lead #{selected.id}</small>
                            </div>

                            <div className="salesman-lead-detail__facts">
                                <div>
                                    <CalendarClock />
                                    <span>
                                        <small>Appointment</small>
                                        <strong>
                                            {selected.appointment_at
                                                ? formatAppointmentDate(
                                                      selected.appointment_at,
                                                  )
                                                : 'Not scheduled'}
                                        </strong>
                                    </span>
                                </div>
                                <div>
                                    <Phone />
                                    <span>
                                        <small>Phone</small>
                                        <strong>
                                            {selected.primary_number ||
                                                selected.mobile_number ||
                                                'Not available'}
                                        </strong>
                                    </span>
                                </div>
                                <div>
                                    <MapPin />
                                    <span>
                                        <small>Address</small>
                                        <strong>{address(selected)}</strong>
                                    </span>
                                </div>
                                <div>
                                    <Building2 />
                                    <span>
                                        <small>Company</small>
                                        <strong>
                                            {selected.company?.company ?? '—'}
                                        </strong>
                                    </span>
                                </div>
                                <div>
                                    <Package />
                                    <span>
                                        <small>Product</small>
                                        <strong>
                                            {selected.product?.product_name ??
                                                '—'}
                                        </strong>
                                    </span>
                                </div>
                                <div>
                                    <UserRound />
                                    <span>
                                        <small>Assigned by</small>
                                        <strong>
                                            {selected.agent?.agent_name ?? '—'}
                                        </strong>
                                    </span>
                                </div>
                            </div>

                            <section className="salesman-lead-detail__notes">
                                <h3>Lead notes</h3>
                                {selected.notes.length > 0 ? (
                                    selected.notes.map((note) => (
                                        <p key={note.id}>
                                            <small>
                                                {note.note_type.replaceAll(
                                                    '_',
                                                    ' ',
                                                )}
                                            </small>
                                            {note.body}
                                        </p>
                                    ))
                                ) : (
                                    <p>No notes have been added.</p>
                                )}
                            </section>

                            <div className="salesman-lead-detail__actions">
                                <a
                                    href={`https://maps.apple.com/?daddr=${encodeURIComponent(address(selected))}&dirflg=d`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <Navigation />
                                    Apple Maps
                                </a>
                                <Link href="/salesman/booking-board">
                                    <CalendarClock />
                                    My bookings
                                </Link>
                            </div>
                        </article>
                    )}
                </div>
            </section>
        </>
    );
}
