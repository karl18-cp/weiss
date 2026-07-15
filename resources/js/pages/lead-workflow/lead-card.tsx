import { Head, useForm } from '@inertiajs/react';
import {
    Building2,
    CalendarClock,
    CheckCircle2,
    ClipboardPlus,
    Mail,
    MapPin,
    Phone,
    RotateCcw,
    UserRound,
} from 'lucide-react';
import '@/../css/lead-card.css';

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

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post('/lead-workflow/lead-card', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
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
                <header className="lead-card-header">
                    <div>
                        <span>Lead workflow</span>
                        <h1>New Lead Card</h1>
                        <p>
                            Capture customer details and schedule the next
                            appointment.
                        </p>
                    </div>
                    <div className="lead-card-header__status">
                        <CheckCircle2 />
                        <span>
                            <strong>Ready to create</strong>
                            <small>Required fields are marked</small>
                        </span>
                    </div>
                </header>

                <form onSubmit={submit} className="lead-card-workspace">
                    <section className="lead-card-main">
                        <div className="lead-section-heading">
                            <span>
                                <UserRound />
                            </span>
                            <div>
                                <h2>Customer information</h2>
                                <p>Contact and property details</p>
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
                            {input(
                                'email',
                                'Email',
                                'customer@email.com',
                                <Mail />,
                                'email',
                                true,
                            )}
                            <div className="lead-field lead-field--full">
                                {input(
                                    'address',
                                    'Service address',
                                    'Street address',
                                    <MapPin />,
                                )}
                            </div>
                            {input('city', 'City', 'City')}
                            {input('county', 'County', 'County')}
                            {input('state', 'State', 'CA')}
                            {input('zip_code', 'ZIP code', '00000')}
                            {input(
                                'years_in_house',
                                'Years in house',
                                '0',
                                undefined,
                                'number',
                            )}
                        </div>

                        <div className="lead-section-heading lead-section-heading--spaced">
                            <span>
                                <CalendarClock />
                            </span>
                            <div>
                                <h2>Project &amp; appointment</h2>
                                <p>Service request and scheduling</p>
                            </div>
                        </div>
                        <div className="lead-grid lead-grid--project">
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
                        <div className="lead-section-heading">
                            <span>
                                <ClipboardPlus />
                            </span>
                            <div>
                                <h2>Lead assignment</h2>
                                <p>Source and ownership</p>
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
                                        <option value="">Select company</option>
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
                                        <option value="">Select agent</option>
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
                        <div className="lead-card-actions">
                            <button
                                type="button"
                                onClick={() => form.reset()}
                                className="lead-clear-button"
                            >
                                <RotateCcw />
                                Clear form
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="lead-create-button"
                            >
                                <ClipboardPlus />
                                {form.processing ? 'Creating…' : 'Create lead'}
                            </button>
                            <p>
                                Secondary number, mobile number, and email are
                                optional.
                            </p>
                        </div>
                    </aside>
                </form>
            </main>
        </>
    );
}
