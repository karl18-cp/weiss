import { Head, router } from '@inertiajs/react';
import {
    Archive,
    Ban,
    Building2,
    CalendarClock,
    CheckCircle2,
    MapPin,
    MessageCircle,
    Package,
    Phone,
    PhoneCall,
    Search,
    Trash2,
    Truck,
    UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/lead-workflow-queue.css';

export type QueueLead = {
    id: number;
    customer_name: string;
    primary_number: string;
    city: string;
    address: string;
    appointment_at: string;
    status: string;
    company: { company: string } | null;
    product: { product_name: string } | null;
    agent: { agent_name: string } | null;
};

type Props = {
    title: string;
    description: string;
    leads: QueueLead[];
};

const actions = [
    {
        status: 'confirmed',
        label: 'Confirm',
        icon: CheckCircle2,
        tone: 'confirm',
    },
    { status: 'dispatched', label: 'Dispatch', icon: Truck, tone: 'dispatch' },
    {
        status: 'reschedule',
        label: 'Reschedule',
        icon: CalendarClock,
        tone: 'reschedule',
    },
    { status: '555', label: '555', icon: Phone, tone: 'five' },
    { status: 'kit', label: 'KIT', icon: MessageCircle, tone: 'kit' },
    { status: 'raw', label: 'Raw', icon: Archive, tone: 'raw' },
    { status: 'cb', label: 'Call Back', icon: PhoneCall, tone: 'callback' },
    { status: 'naov', label: 'NAOV', icon: Ban, tone: 'naov' },
    { status: 'toss', label: 'TOSS', icon: Trash2, tone: 'toss' },
] as const;

const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));

export default function LeadWorkflowQueue({
    title,
    description,
    leads,
}: Props) {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(
        leads[0]?.id ?? null,
    );
    const selected = leads.find((lead) => lead.id === selectedId) ?? null;
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return leads.filter((lead) =>
            [
                lead.customer_name,
                lead.city,
                lead.company?.company,
                lead.product?.product_name,
            ]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [leads, search]);

    const moveLead = (status: string) => {
        if (!selected) return;
        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/status`,
            { status },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    };

    return (
        <>
            <Head title={title} />
            <main className="workflow-queue-page">
                <header className="workflow-queue-header">
                    <div>
                        <span>Lead workflow</span>
                        <h1>{title}</h1>
                        <p>{description}</p>
                    </div>
                    <strong>
                        {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
                    </strong>
                </header>
                <div className="workflow-queue-layout">
                    <section className="workflow-queue-list">
                        <label>
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search this queue"
                            />
                        </label>
                        <div className="workflow-queue-list__scroll">
                            {filtered.map((lead) => (
                                <button
                                    key={lead.id}
                                    type="button"
                                    className={
                                        selectedId === lead.id
                                            ? 'is-selected'
                                            : ''
                                    }
                                    onClick={() => setSelectedId(lead.id)}
                                >
                                    <span>
                                        {lead.customer_name
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <div>
                                        <strong>{lead.customer_name}</strong>
                                        <small>
                                            {lead.city || 'No city'} · Lead #
                                            {lead.id}
                                        </small>
                                    </div>
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <p className="workflow-queue-empty">
                                    No leads in this queue.
                                </p>
                            )}
                        </div>
                    </section>
                    <section className="workflow-queue-detail">
                        {selected ? (
                            <>
                                <header>
                                    <div>
                                        <small>Lead #{selected.id}</small>
                                        <h2>{selected.customer_name}</h2>
                                    </div>
                                    <span>{selected.status}</span>
                                </header>
                                <div className="workflow-queue-fields">
                                    <div>
                                        <Phone />
                                        <span>
                                            <small>Primary phone</small>
                                            <strong>
                                                {selected.primary_number}
                                            </strong>
                                        </span>
                                    </div>
                                    <div>
                                        <MapPin />
                                        <span>
                                            <small>Address</small>
                                            <strong>
                                                {selected.address},{' '}
                                                {selected.city}
                                            </strong>
                                        </span>
                                    </div>
                                    <div>
                                        <CalendarClock />
                                        <span>
                                            <small>Appointment</small>
                                            <strong>
                                                {formatDate(
                                                    selected.appointment_at,
                                                )}
                                            </strong>
                                        </span>
                                    </div>
                                    <div>
                                        <Building2 />
                                        <span>
                                            <small>Company</small>
                                            <strong>
                                                {selected.company?.company ??
                                                    '—'}
                                            </strong>
                                        </span>
                                    </div>
                                    <div>
                                        <Package />
                                        <span>
                                            <small>Product</small>
                                            <strong>
                                                {selected.product
                                                    ?.product_name ?? '—'}
                                            </strong>
                                        </span>
                                    </div>
                                    <div>
                                        <UserRound />
                                        <span>
                                            <small>Agent</small>
                                            <strong>
                                                {selected.agent?.agent_name ??
                                                    '—'}
                                            </strong>
                                        </span>
                                    </div>
                                </div>
                                <div className="workflow-queue-actions">
                                    {actions.map(
                                        ({
                                            status,
                                            label,
                                            icon: Icon,
                                            tone,
                                        }) => (
                                            <button
                                                key={status}
                                                type="button"
                                                className={`workflow-action--${tone} ${selected.status === status ? 'is-current' : ''}`}
                                                disabled={
                                                    selected.status === status
                                                }
                                                onClick={() => moveLead(status)}
                                            >
                                                <Icon />
                                                {label}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="workflow-queue-detail__empty">
                                <UserRound />
                                <h2>Select a lead</h2>
                                <p>Lead information will appear here.</p>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}
