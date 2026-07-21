import { Head, router, useForm } from '@inertiajs/react';
import {
    Building2,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    MapPin,
    Package,
    Save,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/quality-control.css';
import type {
    AgentOption,
    CompanyOption,
    Lead,
    ProductOption,
    SalesmanOption,
} from '@/pages/lead-workflow/leads-shop';

type QualityProject = {
    id: number;
    amount: string;
    created_at: string;
    lead: Lead;
};

type QualityControlProps = {
    projects: QualityProject[];
    companies: CompanyOption[];
    products: ProductOption[];
    agents: AgentOption[];
    salesmen: SalesmanOption[];
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
});

const emptyLeadForm = {
    customer_name: '',
    marital_status: '',
    primary_number: '',
    secondary_number: '',
    mobile_number: '',
    address: '',
    zip_code: '',
    city: '',
    county: '',
    state: '',
    email: '',
    years_in_house: '',
    product_id: '',
    appointment_at: '',
    telemarketer_notes: '',
    company_id: '',
    source: 'CallTools',
    agent_id: '',
    salesman_1_id: '',
    salesman_2_id: '',
};

function toForm(lead?: Lead) {
    if (!lead) {
        return emptyLeadForm;
    }

    return {
        customer_name: lead.customer_name,
        marital_status: lead.marital_status,
        primary_number: lead.primary_number,
        secondary_number: lead.secondary_number ?? '',
        mobile_number: lead.mobile_number ?? '',
        address: lead.address,
        zip_code: lead.zip_code,
        city: lead.city,
        county: lead.county,
        state: lead.state,
        email: lead.email ?? '',
        years_in_house: String(lead.years_in_house),
        product_id: String(lead.product?.prod_id ?? ''),
        appointment_at: lead.appointment_at?.slice(0, 16) ?? '',
        telemarketer_notes: lead.telemarketer_notes,
        company_id: String(lead.company?.com_id ?? ''),
        source: 'CallTools',
        agent_id: String(lead.agent?.agent_id ?? ''),
        salesman_1_id: String(lead.salesman_one?.salesman_id ?? ''),
        salesman_2_id: String(lead.salesman_two?.salesman_id ?? ''),
    };
}

function latestNote(lead: Lead, type: string): string {
    return (
        lead.notes.find((note) => note.note_type === type)?.body ??
        `No ${type.replace('_', ' ')} note yet.`
    );
}

export default function QualityControl({
    projects,
    companies,
    products,
    agents,
    salesmen,
}: QualityControlProps) {
    const [selectedId, setSelectedId] = useState<number | null>(
        projects[0]?.id ?? null,
    );
    const [search, setSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [salesmanFilter, setSalesmanFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [productFilter, setProductFilter] = useState('all');
    const [isEditing, setIsEditing] = useState(false);
    const form = useForm(toForm(projects[0]?.lead));
    const noteForm = useForm({
        note_type: 'quality_control',
        body: '',
    });

    const scheduledDates = useMemo(() => {
        const counts = new Map<string, number>();

        projects.forEach(({ lead }) => {
            if (!lead.appointment_at) return;
            const key = new Date(lead.appointment_at).toLocaleDateString(
                'en-CA',
            );
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [projects]);

    const filterOptions = useMemo(
        () => ({
            cities: [...new Set(projects.map(({ lead }) => lead.city))].sort(),
        }),
        [projects],
    );

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();

        return projects.filter(({ lead }) => {
            const appointmentDate = lead.appointment_at
                ? new Date(lead.appointment_at).toLocaleDateString('en-CA')
                : '';
            const matchesSearch =
                !query ||
                [
                    lead.customer_name,
                    lead.city,
                    lead.address,
                    lead.company?.company,
                    lead.salesman_one?.salesman_name,
                    lead.salesman_two?.salesman_name,
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(query);

            return (
                matchesSearch &&
                (selectedDate === 'all' || appointmentDate === selectedDate) &&
                (companyFilter === 'all' ||
                    String(lead.company?.com_id) === companyFilter) &&
                (salesmanFilter === 'all' ||
                    String(lead.salesman_one?.salesman_id) === salesmanFilter ||
                    String(lead.salesman_two?.salesman_id) ===
                        salesmanFilter) &&
                (cityFilter === 'all' || lead.city === cityFilter) &&
                (productFilter === 'all' ||
                    String(lead.product?.prod_id) === productFilter)
            );
        });
    }, [
        cityFilter,
        companyFilter,
        productFilter,
        projects,
        salesmanFilter,
        search,
        selectedDate,
    ]);

    const selected =
        projects.find((project) => project.id === selectedId) ?? null;

    const selectProject = (project: QualityProject) => {
        setSelectedId(project.id);
        setIsEditing(false);
        form.setData(toForm(project.lead));
        form.clearErrors();
        noteForm.reset();
    };

    const saveLead = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selected) {
            return;
        }

        form.put(`/lead-workflow/leads-shop/${selected.lead.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditing(false);
                router.flushAll();
            },
        });
    };

    const saveQualityNote = () => {
        if (!selected || !noteForm.data.body.trim()) {
            return;
        }

        noteForm.post(`/lead-workflow/leads-shop/${selected.lead.id}/notes`, {
            preserveScroll: true,
            onSuccess: () => {
                noteForm.reset();
                router.flushAll();
            },
        });
    };

    return (
        <>
            <Head title="Quality Control" />
            <main className="quality-control-page">
                <header className="quality-control-header">
                    <div>
                        <span>Management</span>
                        <h1>Quality Control</h1>
                        <p>Review leads accepted into Projects.</p>
                    </div>
                    <label className="quality-control-search">
                        <Search />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search quality control leads…"
                        />
                    </label>
                    <div className="quality-control-total">
                        <ClipboardCheck />
                        <span>
                            <strong>{projects.length}</strong>
                            <small>Project leads</small>
                        </span>
                    </div>
                </header>

                <div className="quality-control-workspace">
                    <aside className="quality-control-schedule">
                        <div className="quality-control-schedule__header">
                            <div>
                                <h2>Scheduled Calls</h2>
                                <p>Filter by appointment date</p>
                            </div>
                            <CalendarDays />
                        </div>
                        <div className="quality-control-schedule__columns">
                            <span>Date</span>
                            <span>Day</span>
                            <span>Count</span>
                        </div>
                        <div className="quality-control-schedule__list">
                            {scheduledDates.map(([date, count]) => (
                                <button
                                    type="button"
                                    key={date}
                                    className={
                                        selectedDate === date ? 'is-active' : ''
                                    }
                                    onClick={() => setSelectedDate(date)}
                                >
                                    <span>
                                        {new Intl.DateTimeFormat('en-US', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            year: '2-digit',
                                        }).format(new Date(`${date}T12:00:00`))}
                                    </span>
                                    <small>
                                        {new Intl.DateTimeFormat('en-US', {
                                            weekday: 'short',
                                        }).format(new Date(`${date}T12:00:00`))}
                                    </small>
                                    <strong>{count}</strong>
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className={`quality-control-schedule__all ${
                                selectedDate === 'all' ? 'is-active' : ''
                            }`}
                            onClick={() => setSelectedDate('all')}
                        >
                            All dates
                        </button>
                    </aside>

                    <section className="quality-control-list-panel">
                        <div className="quality-control-list-header">
                            <div>
                                <h2>Quality control leads</h2>
                                <p>{filteredProjects.length} shown</p>
                            </div>
                            <span>Newest first</span>
                        </div>
                        <div className="quality-control-filters">
                            <label>
                                <Building2 />
                                <select
                                    value={companyFilter}
                                    onChange={(event) =>
                                        setCompanyFilter(event.target.value)
                                    }
                                >
                                    <option value="all">All companies</option>
                                    {companies.map((company) => (
                                        <option
                                            key={company.com_id}
                                            value={company.com_id}
                                        >
                                            {company.company}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <SlidersHorizontal />
                                <select
                                    value={salesmanFilter}
                                    onChange={(event) =>
                                        setSalesmanFilter(event.target.value)
                                    }
                                >
                                    <option value="all">All salesmen</option>
                                    {salesmen.map((salesman) => (
                                        <option
                                            key={salesman.salesman_id}
                                            value={salesman.salesman_id}
                                        >
                                            {salesman.salesman_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <MapPin />
                                <select
                                    value={cityFilter}
                                    onChange={(event) =>
                                        setCityFilter(event.target.value)
                                    }
                                >
                                    <option value="all">All cities</option>
                                    {filterOptions.cities.map((city) => (
                                        <option key={city}>{city}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <Package />
                                <select
                                    value={productFilter}
                                    onChange={(event) =>
                                        setProductFilter(event.target.value)
                                    }
                                >
                                    <option value="all">All products</option>
                                    {products.map((product) => (
                                        <option
                                            key={product.prod_id}
                                            value={product.prod_id}
                                        >
                                            {product.product_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="quality-control-list-heading">
                            <span>Customer</span>
                            <span>City</span>
                            <span>Time</span>
                        </div>

                        <div className="quality-control-list">
                            {filteredProjects.map((project) => (
                                <button
                                    type="button"
                                    key={project.id}
                                    className={
                                        selectedId === project.id
                                            ? 'quality-control-list-item is-active'
                                            : 'quality-control-list-item'
                                    }
                                    onClick={() => selectProject(project)}
                                >
                                    <strong>
                                        {project.lead.customer_name}
                                    </strong>
                                    <span>{project.lead.city}</span>
                                    <time>
                                        {project.lead.appointment_at
                                            ? timeFormatter.format(new Date(project.lead.appointment_at))
                                            : 'Not scheduled'}
                                    </time>
                                    <small>
                                        {project.lead.appointment_at
                                            ? dateFormatter.format(new Date(project.lead.appointment_at))
                                            : 'No date'}
                                    </small>
                                </button>
                            ))}

                            {filteredProjects.length === 0 && (
                                <div className="quality-control-empty">
                                    <ClipboardCheck />
                                    <strong>No project leads found</strong>
                                    <span>
                                        Only leads in Projects appear here.
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="quality-control-detail">
                        {selected ? (
                            <form onSubmit={saveLead}>
                                <header>
                                    <div>
                                        <span>#{selected.id}</span>
                                        <div>
                                            <h2>Lead Card · Quality Control</h2>
                                            <p>
                                                {currencyFormatter.format(
                                                    Number(selected.amount),
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsEditing((value) => !value)
                                            }
                                        >
                                            {isEditing ? 'Cancel' : 'Edit'}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={
                                                !isEditing || form.processing
                                            }
                                        >
                                            <Save /> Save
                                        </button>
                                    </div>
                                </header>

                                <div className="quality-control-form-grid">
                                    <label className="is-wide">
                                        <span>Customer name</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.customer_name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'customer_name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Marital status</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.marital_status}
                                            onChange={(event) =>
                                                form.setData(
                                                    'marital_status',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Years in house</span>
                                        <input
                                            type="number"
                                            disabled={!isEditing}
                                            value={form.data.years_in_house}
                                            onChange={(event) =>
                                                form.setData(
                                                    'years_in_house',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label className="is-wide">
                                        <span>Address</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.address}
                                            onChange={(event) =>
                                                form.setData(
                                                    'address',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>City</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.city}
                                            onChange={(event) =>
                                                form.setData(
                                                    'city',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>County</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.county}
                                            onChange={(event) =>
                                                form.setData(
                                                    'county',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>State</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.state}
                                            onChange={(event) =>
                                                form.setData(
                                                    'state',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>ZIP</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.zip_code}
                                            onChange={(event) =>
                                                form.setData(
                                                    'zip_code',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Primary phone</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.primary_number}
                                            onChange={(event) =>
                                                form.setData(
                                                    'primary_number',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Secondary phone</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.secondary_number}
                                            onChange={(event) =>
                                                form.setData(
                                                    'secondary_number',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Mobile</span>
                                        <input
                                            disabled={!isEditing}
                                            value={form.data.mobile_number}
                                            onChange={(event) =>
                                                form.setData(
                                                    'mobile_number',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label className="is-wide">
                                        <span>Email</span>
                                        <input
                                            type="email"
                                            disabled={!isEditing}
                                            value={form.data.email}
                                            onChange={(event) =>
                                                form.setData(
                                                    'email',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Product</span>
                                        <select
                                            disabled={!isEditing}
                                            value={form.data.product_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'product_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            {products.map((product) => (
                                                <option
                                                    key={product.prod_id}
                                                    value={product.prod_id}
                                                >
                                                    {product.product_name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Appointment date</span>
                                        <input
                                            type="datetime-local"
                                            disabled={!isEditing}
                                            value={form.data.appointment_at}
                                            onChange={(event) =>
                                                form.setData(
                                                    'appointment_at',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Company</span>
                                        <select
                                            disabled={!isEditing}
                                            value={form.data.company_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'company_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            {companies.map((company) => (
                                                <option
                                                    key={company.com_id}
                                                    value={company.com_id}
                                                >
                                                    {company.company}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Agent</span>
                                        <select
                                            disabled={!isEditing}
                                            value={form.data.agent_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'agent_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            {agents.map((agent) => (
                                                <option
                                                    key={agent.agent_id}
                                                    value={agent.agent_id}
                                                >
                                                    {agent.agent_name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Salesman 1</span>
                                        <select
                                            disabled={!isEditing}
                                            value={form.data.salesman_1_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'salesman_1_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">None</option>
                                            {salesmen.map((salesman) => (
                                                <option
                                                    key={salesman.salesman_id}
                                                    value={salesman.salesman_id}
                                                >
                                                    {salesman.salesman_name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Salesman 2</span>
                                        <select
                                            disabled={!isEditing}
                                            value={form.data.salesman_2_id}
                                            onChange={(event) =>
                                                form.setData(
                                                    'salesman_2_id',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">None</option>
                                            {salesmen.map((salesman) => (
                                                <option
                                                    key={salesman.salesman_id}
                                                    value={salesman.salesman_id}
                                                    disabled={
                                                        form.data
                                                            .salesman_1_id ===
                                                        String(
                                                            salesman.salesman_id,
                                                        )
                                                    }
                                                >
                                                    {salesman.salesman_name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="quality-control-note-preview-grid">
                                    {[
                                        ['Telemarketer', 'telemarketer'],
                                        ['Confirmation', 'confirmation'],
                                        ['Dispatch', 'dispatch'],
                                    ].map(([label, type]) => (
                                        <article key={type}>
                                            <h3>{label} notes</h3>
                                            <p>
                                                {latestNote(
                                                    selected.lead,
                                                    type,
                                                )}
                                            </p>
                                        </article>
                                    ))}
                                </div>

                                <article className="quality-control-notes">
                                    <header>
                                        <div>
                                            <CheckCircle2 />
                                            <h3>Quality Control Notes</h3>
                                        </div>
                                        <span>
                                            {
                                                selected.lead.notes.filter(
                                                    (note) =>
                                                        note.note_type ===
                                                        'quality_control',
                                                ).length
                                            }{' '}
                                            saved
                                        </span>
                                    </header>
                                    <p>
                                        {latestNote(
                                            selected.lead,
                                            'quality_control',
                                        )}
                                    </p>
                                    <textarea
                                        value={noteForm.data.body}
                                        onChange={(event) =>
                                            noteForm.setData(
                                                'body',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Type quality control notes…"
                                    />
                                    <button
                                        type="button"
                                        disabled={
                                            noteForm.processing ||
                                            !noteForm.data.body.trim()
                                        }
                                        onClick={saveQualityNote}
                                    >
                                        <Save /> Save note
                                    </button>
                                </article>
                            </form>
                        ) : (
                            <div className="quality-control-detail-empty">
                                <CalendarDays />
                                <strong>No project selected</strong>
                                <span>
                                    Select a project lead to begin quality
                                    control.
                                </span>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}
