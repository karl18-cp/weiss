import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Building2,
    BadgeDollarSign,
    CalendarClock,
    CircleX,
    ClipboardList,
    MapPin,
    Navigation,
    Package,
    Phone,
    PhoneCall,
    Save,
    UsersRound,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { formatAppointmentDate } from '@/lib/appointment-date';
import { formatPhoneNumber } from '@/lib/phone-number';

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
    company: { company: string } | null;
    product: { product_name: string } | null;
};

const address = (lead: SalesmanLead) =>
    [lead.address, lead.city, lead.state, lead.zip_code]
        .filter(Boolean)
        .join(', ');

export default function SalesmanLeadInformation({
    lead,
    dispatchNote,
}: {
    lead: SalesmanLead | null;
    dispatchNote: string | null;
}) {
    const noteForm = useForm({ body: '' });
    const [actionProcessing, setActionProcessing] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [showMapChoices, setShowMapChoices] = useState(false);
    const phoneNumber = lead?.primary_number || lead?.mobile_number || '';
    const dialNumber = phoneNumber.replace(/[^\d+]/g, '');

    const saveAppointmentResultNote = () => {
        if (!lead) return;

        noteForm.post(`/salesman/leads/${lead.id}/appointment-result-notes`, {
            preserveScroll: true,
            onSuccess: () => noteForm.reset(),
        });
    };

    const sendAppointmentAction = (action: 'on_my_way' | 'sold' | 'not_sold') => {
        if (!lead || actionProcessing) return;

        const labels = {
            on_my_way: 'On My Way',
            sold: 'Sold',
            not_sold: 'Not Sold',
        } as const;

        setActionProcessing(true);
        setActionMessage(`Sending ${labels[action]}…`);
        router.post(
            `/salesman/leads/${lead.id}/appointment-result-notes`,
            { action },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () =>
                    setActionMessage(
                        `${labels[action]} was saved and sent to managers and admins.`,
                    ),
                onError: () =>
                    setActionMessage(
                        'The status could not be sent. Please try again.',
                    ),
                onFinish: () => setActionProcessing(false),
            },
        );
    };

    if (!lead) {
        return (
            <section className="salesman-leads">
                <Head title="Lead Information" />
                <header>
                    <span>Salesman workspace</span>
                    <h1>Lead Information</h1>
                </header>
                <div className="salesman-leads__empty salesman-lead-detail">
                    <p>No leads are currently assigned to you.</p>
                    <Link href="/salesman/leads">Open My Leads</Link>
                </div>
            </section>
        );
    }

    return (
        <>
            <Head title="Lead Information" />
            <section className="salesman-leads salesman-lead-information-page">
                <header>
                    <span>Salesman workspace</span>
                    <h1>Lead Information</h1>
                    <p>
                        View the selected lead and record the appointment
                        outcome.
                    </p>
                </header>

                <article className="salesman-lead-detail">
                    <div className="salesman-lead-detail__title">
                        <h2>{lead.customer_name}</h2>
                    </div>

                    <div className="salesman-lead-detail__facts">
                        <div>
                            <CalendarClock />
                            <span>
                                <small>Appointment</small>
                                <strong>
                                    {lead.appointment_at
                                        ? formatAppointmentDate(
                                              lead.appointment_at,
                                          )
                                        : 'Not scheduled'}
                                </strong>
                            </span>
                        </div>
                        <div className="salesman-lead-detail__phone">
                            <Phone />
                            <span>
                                <small>Phone</small>
                                <strong>
                                    {formatPhoneNumber(phoneNumber)}
                                </strong>
                            </span>
                            {dialNumber && (
                                <a
                                    href={`tel:${dialNumber}`}
                                    className="salesman-lead-detail__dial"
                                    aria-label={`Call ${formatPhoneNumber(phoneNumber)}`}
                                >
                                    <PhoneCall />
                                    <span>Call</span>
                                </a>
                            )}
                        </div>
                        <button
                            type="button"
                            className="salesman-lead-detail__address"
                            onClick={() => setShowMapChoices(true)}
                        >
                            <MapPin />
                            <span>
                                <small>Address</small>
                                <strong>{address(lead)}</strong>
                                <em>Tap for directions</em>
                            </span>
                        </button>
                        <div>
                            <Building2 />
                            <span>
                                <small>Company</small>
                                <strong>{lead.company?.company ?? '—'}</strong>
                            </span>
                        </div>
                        <div>
                            <Package />
                            <span>
                                <small>Product</small>
                                <strong>
                                    {lead.product?.product_name ?? '—'}
                                </strong>
                            </span>
                        </div>
                    </div>

                    <section className="salesman-lead-detail__notes">
                        <h3>
                            <ClipboardList />
                            Dispatch notes
                            <span>View only</span>
                        </h3>
                        <p>
                            {dispatchNote?.trim() ||
                                'No dispatch notes available.'}
                        </p>
                    </section>

                    <section className="salesman-appointment-result">
                        <h3>Appointment result notes</h3>
                        <p>
                            Add the outcome of your visit or follow-up
                            information.
                        </p>
                        <div className="salesman-appointment-result__quick-actions">
                            <button type="button" className="is-on-my-way" disabled={actionProcessing} onClick={() => sendAppointmentAction('on_my_way')}>
                                <Navigation /> On My Way
                            </button>
                            <button type="button" className="is-sold" disabled={actionProcessing} onClick={() => sendAppointmentAction('sold')}>
                                <BadgeDollarSign /> Sold
                            </button>
                            <button type="button" className="is-not-sold" disabled={actionProcessing} onClick={() => sendAppointmentAction('not_sold')}>
                                <CircleX /> Not Sold
                            </button>
                        </div>
                        {actionMessage && (
                            <p className="salesman-appointment-result__status" role="status">
                                {actionMessage}
                            </p>
                        )}
                        <textarea
                            value={noteForm.data.body}
                            onChange={(event) =>
                                noteForm.setData('body', event.target.value)
                            }
                            placeholder="Type the appointment result…"
                            rows={4}
                        />
                        {noteForm.errors.body && (
                            <small>{noteForm.errors.body}</small>
                        )}
                        <button
                            type="button"
                            disabled={
                                noteForm.processing ||
                                noteForm.data.body.trim() === ''
                            }
                            onClick={saveAppointmentResultNote}
                        >
                            <Save />
                            {noteForm.processing
                                ? 'Saving…'
                                : 'Save result note'}
                        </button>
                    </section>

                    <div className="salesman-lead-detail__actions">
                        <button
                            type="button"
                            onClick={() => setShowMapChoices(true)}
                        >
                            <Navigation />
                            Directions
                        </button>
                        <Link href="/salesman/leads">
                            <UsersRound />
                            My Leads
                        </Link>
                    </div>
                </article>
            </section>

            {showMapChoices && (
                <div
                    className="salesman-map-chooser"
                    role="presentation"
                    onClick={() => setShowMapChoices(false)}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="salesman-map-chooser-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <small>Open address with</small>
                                <h2 id="salesman-map-chooser-title">
                                    Choose a map
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowMapChoices(false)}
                                aria-label="Close map choices"
                            >
                                <X />
                            </button>
                        </header>
                        <p>{address(lead)}</p>
                        <div>
                            <a
                                href={`https://maps.apple.com/?daddr=${encodeURIComponent(address(lead))}&dirflg=d`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Apple Maps
                            </a>
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address(lead))}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Google Maps
                            </a>
                            <a
                                href={`https://www.waze.com/ul?q=${encodeURIComponent(address(lead))}&navigate=yes`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Waze
                            </a>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
