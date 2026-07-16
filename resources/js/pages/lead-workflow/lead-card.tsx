import { Head, useForm } from '@inertiajs/react';
import {
    Building2,
    CalendarClock,
    CheckCircle2,
    ClipboardPlus,
    House,
    Mail,
    MapPin,
    Phone,
    RotateCcw,
    Search,
    UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import '@/../css/lead-card.css';
import { zillowSearchUrl } from '@/lib/address-search';

type Company = { com_id: number; company: string };
type Product = { prod_id: number; product_name: string };
type Agent = { agent_id: number; agent_name: string };

const emptyLead = {
    customer_name: '',
    marital_status: '',
    primary_number: '',
    secondary_number: '',
    mobile_number: '',
    address: '',
    zip_code: '',
    city: '',
    county: '',
    state: 'CA',
    email: '',
    years_in_house: '',
    product_id: '',
    appointment_at: '',
    telemarketer_notes: '',
    company_id: '',
    source: 'CallTools',
    agent_id: '',
};

type GeoapifyAddress = {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    county?: string;
    district?: string;
    formatted: string;
    housenumber?: string;
    municipality?: string;
    place_id: string;
    postcode?: string;
    state_code?: string;
    street?: string;
    suburb?: string;
    town?: string;
    village?: string;
};

const geoapifyApiKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim();
const californiaBounds = '-124.482003,32.528832,-114.131211,42.009518';
const californiaSearchCenter = '-119.4179,36.7783';

export default function LeadCard({
    companies,
    products,
    agents,
}: {
    companies: Company[];
    products: Product[];
    agents: Agent[];
}) {
    const form = useForm(emptyLead);
    const [addressSuggestions, setAddressSuggestions] = useState<
        GeoapifyAddress[]
    >([]);
    const [addressMenuOpen, setAddressMenuOpen] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);
    const [addressLookupFailed, setAddressLookupFailed] = useState(false);
    const [unitNumber, setUnitNumber] = useState('');
    const addressRequestId = useRef(0);

    useEffect(() => {
        const query = form.data.address.trim();

        if (!geoapifyApiKey || !addressMenuOpen || query.length < 2) {
            setAddressSuggestions([]);
            setAddressLoading(false);

            return;
        }

        const requestId = ++addressRequestId.current;
        const controller = new AbortController();
        setAddressLoading(true);
        setAddressLookupFailed(false);
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    const parameters = new URLSearchParams({
                        text: query,
                        filter: `rect:${californiaBounds}`,
                        bias: `proximity:${californiaSearchCenter}`,
                        format: 'json',
                        lang: 'en',
                        limit: '20',
                        apiKey: geoapifyApiKey,
                    });
                    const response = await fetch(
                        `https://api.geoapify.com/v1/geocode/autocomplete?${parameters.toString()}`,
                        { signal: controller.signal },
                    );

                    if (!response.ok) {
                        throw new Error('Address autocomplete request failed.');
                    }

                    const data = (await response.json()) as {
                        results?: GeoapifyAddress[];
                    };

                    if (requestId !== addressRequestId.current) {
                        return;
                    }

                    setAddressSuggestions(
                        (data.results ?? [])
                            .filter(
                                (suggestion) =>
                                    suggestion.state_code?.toUpperCase() ===
                                        'CA' &&
                                    Boolean(
                                        suggestion.street ||
                                        suggestion.housenumber,
                                    ),
                            )
                            .slice(0, 5),
                    );
                } catch (error) {
                    if (
                        error instanceof DOMException &&
                        error.name === 'AbortError'
                    ) {
                        return;
                    }

                    if (requestId === addressRequestId.current) {
                        setAddressSuggestions([]);
                        setAddressLookupFailed(true);
                    }
                } finally {
                    if (requestId === addressRequestId.current) {
                        setAddressLoading(false);
                    }
                }
            })();
        }, 120);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [addressMenuOpen, form.data.address]);

    const selectAddress = (suggestion: GeoapifyAddress) => {
        setAddressLookupFailed(false);
        form.setData({
            ...form.data,
            address:
                suggestion.address_line1 ||
                [suggestion.housenumber, suggestion.street]
                    .filter(Boolean)
                    .join(' ') ||
                suggestion.formatted,
            city:
                suggestion.city ??
                suggestion.town ??
                suggestion.village ??
                suggestion.municipality ??
                suggestion.suburb ??
                suggestion.district ??
                '',
            county: suggestion.county ?? '',
            state: 'CA',
            zip_code: suggestion.postcode ?? '',
        });

        setAddressSuggestions([]);
        setAddressMenuOpen(false);
        setAddressLoading(false);
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const unit = unitNumber.trim();
        const formattedUnit =
            unit && /^(apt|apartment|unit|suite|#)/i.test(unit)
                ? unit
                : unit
                  ? `Unit ${unit}`
                  : '';

        form.transform((data) => ({
            ...data,
            address: [data.address.trim(), formattedUnit]
                .filter(Boolean)
                .join(', '),
        }));
        form.post('/lead-workflow/lead-card', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setUnitNumber('');
            },
        });
    };

    const clearForm = () => {
        form.reset();
        setUnitNumber('');
        setAddressSuggestions([]);
        setAddressMenuOpen(false);
    };

    const openZillow = () => {
        const addressParts = [
            form.data.address.trim(),
            unitNumber.trim(),
            form.data.city.trim(),
            form.data.state.trim(),
            form.data.zip_code.trim(),
        ];

        if (!addressParts.some(Boolean)) {
            return;
        }

        window.open(
            zillowSearchUrl(addressParts),
            '_blank',
            'noopener,noreferrer',
        );
    };

    const input = (
        name: keyof typeof emptyLead,
        label: string,
        placeholder: string,
        icon?: React.ReactNode,
        type = 'text',
        optional = false,
    ) => (
        <label className="lead-field">
            <span>
                {label}
                {optional && <small>Optional</small>}
            </span>
            <div className="lead-input">
                {icon}
                <input
                    type={type}
                    value={form.data[name]}
                    onChange={(event) => form.setData(name, event.target.value)}
                    placeholder={placeholder}
                />
            </div>
            {form.errors[name] && <em>{form.errors[name]}</em>}
        </label>
    );

    return (
        <>
            <Head title="Lead Card" />
            <main className="lead-card-page">
                <header className="lead-card-hero">
                    <span className="lead-card-hero__icon">
                        <ClipboardPlus />
                    </span>
                    <div>
                        <h1>Lead Card</h1>
                        <p>
                            Create a new lead with customer details and an
                            appointment.
                        </p>
                    </div>
                </header>

                <form onSubmit={submit} className="lead-card-workspace">
                    <section className="lead-card-main">
                        <div className="lead-section-heading lead-section-heading--customer">
                            <span>
                                <UserRound />
                            </span>
                            <div>
                                <h2>Customer information</h2>
                                <p>
                                    Contact numbers, service address, email, and
                                    customer profile.
                                </p>
                            </div>
                        </div>
                        <div className="lead-grid lead-grid--customer">
                            {input(
                                'customer_name',
                                'Customer name',
                                'Full name',
                                <UserRound />,
                            )}
                            <label className="lead-field">
                                <span>Marital status</span>
                                <div className="lead-input">
                                    <select
                                        value={form.data.marital_status}
                                        onChange={(event) =>
                                            form.setData(
                                                'marital_status',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Select status</option>
                                        <option>Single</option>
                                        <option>Married</option>
                                        <option>Divorced</option>
                                        <option>Widowed</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                {form.errors.marital_status && (
                                    <em>{form.errors.marital_status}</em>
                                )}
                            </label>
                            {input(
                                'primary_number',
                                'Primary number',
                                '(555) 000-0000',
                                <Phone />,
                                'tel',
                            )}
                            {input(
                                'secondary_number',
                                'Secondary number',
                                '(555) 000-0000',
                                <Phone />,
                                'tel',
                                true,
                            )}
                            {input(
                                'mobile_number',
                                'Mobile number',
                                '(555) 000-0000',
                                <Phone />,
                                'tel',
                                true,
                            )}
                            <div className="lead-field lead-field--full lead-address-field">
                                <span>Service address</span>
                                <div className="lead-input">
                                    <MapPin />
                                    <input
                                        type="text"
                                        value={form.data.address}
                                        onChange={(event) => {
                                            form.setData(
                                                'address',
                                                event.target.value,
                                            );
                                            setAddressMenuOpen(true);
                                        }}
                                        onFocus={() => setAddressMenuOpen(true)}
                                        onBlur={(event) => {
                                            if (
                                                !event.currentTarget.parentElement?.parentElement?.contains(
                                                    event.relatedTarget,
                                                )
                                            ) {
                                                setAddressMenuOpen(false);
                                            }
                                        }}
                                        placeholder="Start typing a California address, e.g. 2666 Ventura…"
                                        autoComplete="off"
                                        role="combobox"
                                        aria-autocomplete="list"
                                        aria-expanded={
                                            addressMenuOpen &&
                                            form.data.address.trim().length >= 2
                                        }
                                        aria-controls="lead-address-suggestions"
                                    />
                                    {addressLoading && (
                                        <span
                                            className="lead-address-loading"
                                            aria-label="Loading address suggestions"
                                        />
                                    )}
                                    <button
                                        type="button"
                                        className="lead-zillow-button"
                                        disabled={!form.data.address.trim()}
                                        onClick={openZillow}
                                        title="Search this address on Zillow"
                                        aria-label="Search this address on Zillow"
                                    >
                                        <House />
                                        <span>Zillow</span>
                                    </button>
                                </div>
                                {addressMenuOpen &&
                                    form.data.address.trim().length >= 2 && (
                                        <div
                                            id="lead-address-suggestions"
                                            className="lead-address-suggestions"
                                            role="listbox"
                                            aria-live="polite"
                                        >
                                            {addressLoading &&
                                                addressSuggestions.length ===
                                                    0 && (
                                                    <div className="lead-address-suggestions__status">
                                                        Searching California
                                                        streets…
                                                    </div>
                                                )}
                                            {addressSuggestions.map(
                                                (suggestion) => (
                                                    <button
                                                        key={
                                                            suggestion.place_id
                                                        }
                                                        type="button"
                                                        role="option"
                                                        aria-selected="false"
                                                        onMouseDown={(event) =>
                                                            event.preventDefault()
                                                        }
                                                        onClick={() =>
                                                            selectAddress(
                                                                suggestion,
                                                            )
                                                        }
                                                    >
                                                        <Search />
                                                        <span>
                                                            <strong>
                                                                {suggestion.address_line1 ??
                                                                    suggestion.formatted}
                                                            </strong>
                                                            {suggestion.address_line2 && (
                                                                <small>
                                                                    {
                                                                        suggestion.address_line2
                                                                    }
                                                                </small>
                                                            )}
                                                        </span>
                                                    </button>
                                                ),
                                            )}
                                            {!addressLoading &&
                                                addressSuggestions.length ===
                                                    0 &&
                                                !addressLookupFailed && (
                                                    <div className="lead-address-suggestions__status">
                                                        Keep typing the house
                                                        number or street name.
                                                    </div>
                                                )}
                                            <small className="lead-address-attribution">
                                                Powered by Geoapify
                                            </small>
                                        </div>
                                    )}
                                {addressLookupFailed && (
                                    <small className="lead-address-message">
                                        Address suggestions are temporarily
                                        unavailable. You can still enter the
                                        address manually.
                                    </small>
                                )}
                                {!geoapifyApiKey && (
                                    <small className="lead-address-message">
                                        Address suggestions require a Geoapify
                                        API key.
                                    </small>
                                )}
                                {form.errors.address && (
                                    <em>{form.errors.address}</em>
                                )}
                                <small className="lead-address-helper">
                                    Select a suggestion to auto-fill the city,
                                    county, state, and ZIP code.
                                </small>
                            </div>
                            {input('zip_code', 'ZIP code', '00000')}
                            {input('city', 'City', 'City')}
                            {input('county', 'County', 'County')}
                            {input('state', 'State', 'CA')}
                            <label className="lead-field">
                                <span>
                                    Apartment / Unit
                                    <small>Optional</small>
                                </span>
                                <div className="lead-input">
                                    <Building2 />
                                    <input
                                        type="text"
                                        value={unitNumber}
                                        onChange={(event) =>
                                            setUnitNumber(event.target.value)
                                        }
                                        placeholder="Apt 4B, Unit 12, Suite 3"
                                        autoComplete="address-line2"
                                    />
                                </div>
                            </label>
                            {input(
                                'years_in_house',
                                'Years in house',
                                '0',
                                undefined,
                                'number',
                            )}
                            {input(
                                'email',
                                'Email',
                                'Customer email (optional)',
                                <Mail />,
                                'email',
                                true,
                            )}
                            <label className="lead-field">
                                <span>Product</span>
                                <div className="lead-input">
                                    <select
                                        value={form.data.product_id}
                                        onChange={(event) =>
                                            form.setData(
                                                'product_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Select product</option>
                                        {products.map((product) => (
                                            <option
                                                key={product.prod_id}
                                                value={product.prod_id}
                                            >
                                                {product.product_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {form.errors.product_id && (
                                    <em>{form.errors.product_id}</em>
                                )}
                            </label>
                            {input(
                                'appointment_at',
                                'Appointment date & time',
                                '',
                                <CalendarClock />,
                                'datetime-local',
                            )}
                            <label className="lead-field lead-field--notes">
                                <span>Telemarketer notes</span>
                                <textarea
                                    value={form.data.telemarketer_notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'telemarketer_notes',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Add important details about this lead…"
                                />
                                {form.errors.telemarketer_notes && (
                                    <em>{form.errors.telemarketer_notes}</em>
                                )}
                            </label>
                        </div>
                    </section>

                    <aside className="lead-card-side">
                        <section className="lead-side-card lead-side-card--create">
                            <div>
                                <h2>Create Lead</h2>
                                <p>
                                    Review the important fields, then save this
                                    as a fresh lead.
                                </p>
                            </div>
                            <div className="lead-card-actions">
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="lead-create-button"
                                >
                                    <CheckCircle2 />
                                    {form.processing
                                        ? 'Creating…'
                                        : 'Create lead'}
                                </button>
                                <button
                                    type="button"
                                    onClick={clearForm}
                                    className="lead-clear-button"
                                >
                                    <RotateCcw />
                                    Clear fields
                                </button>
                            </div>
                        </section>

                        <section className="lead-side-card">
                            <div className="lead-side-card__heading">
                                <span>
                                    <Building2 />
                                </span>
                                <div>
                                    <h2>Lead Source</h2>
                                    <p>Company, source, and assigned agent.</p>
                                </div>
                            </div>
                            <div className="lead-side-fields">
                                <label className="lead-field">
                                    <span>Company</span>
                                    <div className="lead-input">
                                        <Building2 />
                                        <select
                                            value={form.data.company_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'company_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select company
                                            </option>
                                            {companies.map((company) => (
                                                <option
                                                    key={company.com_id}
                                                    value={company.com_id}
                                                >
                                                    {company.company}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {form.errors.company_id && (
                                        <em>{form.errors.company_id}</em>
                                    )}
                                </label>
                                <label className="lead-field">
                                    <span>Lead source</span>
                                    <div className="lead-input">
                                        <Phone />
                                        <input
                                            value={form.data.source}
                                            readOnly
                                            aria-readonly="true"
                                        />
                                    </div>
                                    {form.errors.source && (
                                        <em>{form.errors.source}</em>
                                    )}
                                </label>
                                <label className="lead-field">
                                    <span>Assigned agent</span>
                                    <div className="lead-input">
                                        <UserRound />
                                        <select
                                            value={form.data.agent_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'agent_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select agent
                                            </option>
                                            {agents.map((agent) => (
                                                <option
                                                    key={agent.agent_id}
                                                    value={agent.agent_id}
                                                >
                                                    {agent.agent_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {form.errors.agent_id && (
                                        <em>{form.errors.agent_id}</em>
                                    )}
                                </label>
                            </div>
                        </section>

                        <section className="lead-side-card lead-appointment-card">
                            <div className="lead-side-card__heading">
                                <span>
                                    <CalendarClock />
                                </span>
                                <div>
                                    <h2>Appointment</h2>
                                    <p>
                                        Scheduled date and time for this lead.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="lead-appointment-summary"
                                onClick={() =>
                                    document
                                        .querySelector<HTMLInputElement>(
                                            'input[type="datetime-local"]',
                                        )
                                        ?.focus()
                                }
                            >
                                <CalendarClock />
                                <span>
                                    {form.data.appointment_at
                                        ? new Date(
                                              form.data.appointment_at,
                                          ).toLocaleString([], {
                                              dateStyle: 'medium',
                                              timeStyle: 'short',
                                          })
                                        : 'Select appointment'}
                                </span>
                            </button>
                        </section>

                        <p className="lead-required-note">
                            All fields are required except apartment/unit,
                            secondary number, mobile number, and email.
                        </p>
                    </aside>
                </form>
            </main>
        </>
    );
}
