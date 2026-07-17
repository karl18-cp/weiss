import { Head, Link } from '@inertiajs/react';
import {
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    MapPin,
    Phone,
    Search,
    Truck,
    UserRound,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/booking-board.css';
import { RingCentralCallButton } from '@/components/ringcentral-call-button';

type BookingLead = {
    id: number;
    customer_name: string;
    primary_number: string;
    mobile_number: string | null;
    email: string | null;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    appointment_at: string;
    status: 'confirmed' | 'dispatched';
    source: string;
    confirmation_notes: string | null;
    telemarketer_notes: string;
    company: { company: string; prefix: string } | null;
    product: { product_name: string } | null;
    agent: { agent_name: string } | null;
    second_agent: { agent_name: string } | null;
    salesman_one: { salesman_name: string } | null;
    salesman_two: { salesman_name: string } | null;
    notes: {
        id: number;
        note_type: string;
        body: string;
        created_at: string;
    }[];
};

const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
});

const dateKey = (value: string) => {
    const date = new Date(value);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const fullAddress = (lead: BookingLead) =>
    `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}`;

export default function BookingBoard({ leads }: { leads: BookingLead[] }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all' | BookingLead['status']>('all');
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [selectedId, setSelectedId] = useState<number | null>(
        leads[0]?.id ?? null,
    );

    const dateOptions = useMemo(
        () =>
            Array.from(
                new Set(leads.map((lead) => dateKey(lead.appointment_at))),
            ),
        [leads],
    );
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return leads.filter((lead) => {
            const matchesStatus = status === 'all' || lead.status === status;
            const matchesDate =
                selectedDate === 'all' ||
                dateKey(lead.appointment_at) === selectedDate;
            const matchesSearch = [
                lead.customer_name,
                lead.address,
                lead.city,
                lead.company?.company,
                lead.company?.prefix,
                lead.product?.product_name,
                lead.agent?.agent_name,
                lead.salesman_one?.salesman_name,
            ]
                .join(' ')
                .toLowerCase()
                .includes(query);

            return matchesStatus && matchesDate && matchesSearch;
        });
    }, [leads, search, selectedDate, status]);
    const selected =
        filtered.find((lead) => lead.id === selectedId) ?? filtered[0] ?? null;
    const todayKey = dateKey(new Date().toISOString());
    const todayCount = leads.filter(
        (lead) => dateKey(lead.appointment_at) === todayKey,
    ).length;
    const confirmedCount = leads.filter(
        (lead) => lead.status === 'confirmed',
    ).length;
    const dispatchedCount = leads.filter(
        (lead) => lead.status === 'dispatched',
    ).length;
    const latestNote = selected
        ? [...selected.notes].sort(
              (first, second) =>
                  new Date(second.created_at).getTime() -
                  new Date(first.created_at).getTime(),
          )[0]?.body ||
          selected.confirmation_notes ||
          selected.telemarketer_notes
        : '';

    return (
        <>
            <Head title="Booking Board" />
            <main className="booking-board-page">
                <header className="booking-board-heading">
                    <div>
                        <span>Lead workflow</span>
                        <h1>Booking Board</h1>
                        <p>
                            Confirmed and dispatched appointments in one
                            schedule.
                        </p>
                    </div>
                    <div className="booking-board-stats">
                        <div>
                            <CalendarDays />
                            <span>
                                <strong>{todayCount}</strong>
                                Today
                            </span>
                        </div>
                        <div>
                            <CheckCircle2 />
                            <span>
                                <strong>{confirmedCount}</strong>
                                Confirmed
                            </span>
                        </div>
                        <div>
                            <Truck />
                            <span>
                                <strong>{dispatchedCount}</strong>
                                Dispatched
                            </span>
                        </div>
                    </div>
                </header>

                <section className="booking-board-toolbar">
                    <label>
                        <Search />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search customer, address, company, product, or team…"
                        />
                    </label>
                    <div>
                        {(['all', 'confirmed', 'dispatched'] as const).map(
                            (option) => (
                                <button
                                    type="button"
                                    key={option}
                                    className={
                                        status === option ? 'is-active' : ''
                                    }
                                    onClick={() => setStatus(option)}
                                >
                                    {option === 'all' ? 'All bookings' : option}
                                </button>
                            ),
                        )}
                    </div>
                </section>

                <div className="booking-board-dates">
                    <button
                        type="button"
                        className={selectedDate === 'all' ? 'is-active' : ''}
                        onClick={() => setSelectedDate('all')}
                    >
                        <strong>All dates</strong>
                        <span>{leads.length} bookings</span>
                    </button>
                    {dateOptions.map((option) => {
                        const count = leads.filter(
                            (lead) => dateKey(lead.appointment_at) === option,
                        ).length;

                        return (
                            <button
                                type="button"
                                key={option}
                                className={
                                    selectedDate === option ? 'is-active' : ''
                                }
                                onClick={() => setSelectedDate(option)}
                            >
                                <strong>
                                    {dayFormatter.format(
                                        new Date(`${option}T00:00:00`),
                                    )}
                                </strong>
                                <span>
                                    {count}{' '}
                                    {count === 1 ? 'booking' : 'bookings'}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="booking-board-workspace">
                    <section className="booking-board-agenda">
                        <header>
                            <div>
                                <h2>Appointment agenda</h2>
                                <span>{filtered.length} shown</span>
                            </div>
                            <span>Sorted by appointment time</span>
                        </header>
                        <div className="booking-board-agenda__list">
                            {filtered.map((lead) => (
                                <button
                                    type="button"
                                    key={lead.id}
                                    className={
                                        selected?.id === lead.id
                                            ? 'is-selected'
                                            : ''
                                    }
                                    onClick={() => setSelectedId(lead.id)}
                                >
                                    <time>
                                        <strong>
                                            {timeFormatter.format(
                                                new Date(lead.appointment_at),
                                            )}
                                        </strong>
                                        <span>
                                            {dayFormatter.format(
                                                new Date(lead.appointment_at),
                                            )}
                                        </span>
                                    </time>
                                    <span
                                        className={`booking-board-status is-${lead.status}`}
                                    >
                                        {lead.status}
                                    </span>
                                    <div>
                                        <strong>{lead.customer_name}</strong>
                                        <span>
                                            <MapPin /> {lead.city}, {lead.state}
                                        </span>
                                    </div>
                                    <div>
                                        <strong>
                                            {lead.product?.product_name ||
                                                'No product'}
                                        </strong>
                                        <span>
                                            {lead.company?.prefix ||
                                                lead.company?.company ||
                                                'No company'}
                                        </span>
                                    </div>
                                    <div>
                                        <strong>
                                            {lead.salesman_one?.salesman_name ||
                                                'No salesman'}
                                        </strong>
                                        <span>Assigned salesman</span>
                                    </div>
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <div className="booking-board-empty">
                                    <CalendarDays />
                                    <strong>No matching bookings</strong>
                                    <span>
                                        Try another date, status, or search.
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="booking-board-detail">
                        {!selected ? (
                            <div className="booking-board-detail__empty">
                                <CalendarDays />
                                <strong>Select a booking</strong>
                                <span>
                                    Appointment details will appear here.
                                </span>
                            </div>
                        ) : (
                            <>
                                <header>
                                    <div>
                                        <span
                                            className={`booking-board-status is-${selected.status}`}
                                        >
                                            {selected.status}
                                        </span>
                                        <h2>{selected.customer_name}</h2>
                                        <p>
                                            Lead #{selected.id} ·{' '}
                                            {selected.company?.prefix ||
                                                selected.company?.company ||
                                                'No company'}
                                        </p>
                                    </div>
                                    <Link
                                        href={
                                            selected.status === 'confirmed'
                                                ? '/lead-workflow/confirm-leads'
                                                : '/lead-workflow/dispatch-leads'
                                        }
                                    >
                                        Open workflow
                                    </Link>
                                </header>

                                <div className="booking-board-appointment">
                                    <CalendarDays />
                                    <div>
                                        <span>Appointment</span>
                                        <strong>
                                            {longDateFormatter.format(
                                                new Date(
                                                    selected.appointment_at,
                                                ),
                                            )}
                                        </strong>
                                        <small>
                                            {timeFormatter.format(
                                                new Date(
                                                    selected.appointment_at,
                                                ),
                                            )}
                                        </small>
                                    </div>
                                </div>

                                <div className="booking-board-info-grid">
                                    <div>
                                        <MapPin />
                                        <span>Service address</span>
                                        <strong>{fullAddress(selected)}</strong>
                                    </div>
                                    <div>
                                        <Phone />
                                        <span>Primary phone</span>
                                        <strong>
                                            {selected.primary_number}
                                        </strong>
                                    </div>
                                    <div>
                                        <Building2 />
                                        <span>Company / product</span>
                                        <strong>
                                            {selected.company?.prefix || '—'} ·{' '}
                                            {selected.product?.product_name ||
                                                'No product'}
                                        </strong>
                                    </div>
                                    <div>
                                        <UserRound />
                                        <span>Agent</span>
                                        <strong>
                                            {selected.agent?.agent_name || '—'}
                                        </strong>
                                    </div>
                                    <div>
                                        <Users />
                                        <span>Sales team</span>
                                        <strong>
                                            {[
                                                selected.salesman_one
                                                    ?.salesman_name,
                                                selected.salesman_two
                                                    ?.salesman_name,
                                            ]
                                                .filter(Boolean)
                                                .join(' & ') || 'Unassigned'}
                                        </strong>
                                    </div>
                                    <div>
                                        <Clock3 />
                                        <span>Lead source</span>
                                        <strong>{selected.source}</strong>
                                    </div>
                                </div>

                                <section className="booking-board-note">
                                    <span>Latest workflow note</span>
                                    <p>{latestNote || 'No notes available.'}</p>
                                </section>

                                <footer>
                                    <RingCentralCallButton
                                        phone={selected.primary_number}
                                    >
                                        <Phone /> Call customer
                                    </RingCentralCallButton>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(selected))}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <MapPin /> Google Maps
                                    </a>
                                </footer>
                            </>
                        )}
                    </aside>
                </div>
            </main>
        </>
    );
}
