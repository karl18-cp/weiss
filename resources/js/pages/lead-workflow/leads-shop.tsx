import { Head, router, useForm } from '@inertiajs/react';
import {
    Archive,
    Ban,
    Building2,
    CalendarClock,
    CheckCircle2,
    CircleDollarSign,
    Clock3,
    History,
    Mail,
    MapPin,
    MessageCircle,
    Package,
    Pencil,
    Phone,
    PhoneCall,
    RotateCcw,
    Search,
    Save,
    SlidersHorizontal,
    ShoppingBag,
    Trash2,
    Truck,
    UserRound,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/leads-shop.css';
import { RingCentralCallButton } from '@/components/ringcentral-call-button';
import { useSystemModal } from '@/components/system-modal-provider';
import { zillowSearchUrl } from '@/lib/address-search';

export type Lead = {
    id: number;
    customer_name: string;
    marital_status: string;
    primary_number: string;
    secondary_number: string | null;
    mobile_number: string | null;
    address: string;
    zip_code: string;
    city: string;
    county: string;
    state: string;
    email: string | null;
    years_in_house: number;
    appointment_at: string;
    appointment_result: string | null;
    telemarketer_notes: string;
    source: string;
    status: string;
    confirmation_notes: string | null;
    created_at: string;
    company: { com_id: number; company: string; prefix: string } | null;
    product: { prod_id: number; product_name: string } | null;
    agent: { agent_id: number; agent_name: string } | null;
    second_agent: { agent_id: number; agent_name: string } | null;
    salesman_one: { salesman_id: number; salesman_name: string } | null;
    salesman_two: { salesman_id: number; salesman_name: string } | null;
    notes: LeadNote[];
};

type LeadNote = {
    id: number;
    note_type: string;
    body: string;
    created_at: string;
    creator: { acc_id: number; username: string } | null;
};

export type CompanyOption = { com_id: number; company: string };
export type ProductOption = { prod_id: number; product_name: string };
export type AgentOption = { agent_id: number; agent_name: string };
export type SalesmanOption = { salesman_id: number; salesman_name: string };

export type LeadsShopProps = {
    leads: Lead[];
    companies: CompanyOption[];
    products: ProductOption[];
    agents: AgentOption[];
    salesmen?: SalesmanOption[];
    queue?: {
        title: string;
        description: string;
        status: string;
        listTitle: string;
        dateLabel: string;
        dateField: 'created_at' | 'appointment_at';
        statusFilters?: [string, string][];
    };
};

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

const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));

const leadAddress = (lead: Lead) =>
    [lead.address, lead.city, lead.state, lead.zip_code]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');

const leadAddressLinks = (lead: Lead) => {
    const address = encodeURIComponent(leadAddress(lead));

    return {
        googleMaps: `https://www.google.com/maps/search/?api=1&query=${address}`,
        zillow: zillowSearchUrl([
            lead.address,
            lead.city,
            lead.state,
            lead.zip_code,
        ]),
    };
};

function ZillowIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
                d="m4.1 9.4 7.7-6.1 8.1 6.2c-3-.8-6-.7-8.8.3-2.6.9-4.9 2.5-6.9 4.4l-.1-4.8Z"
                fill="currentColor"
            />
            <path
                d="M4.4 15.7c2.2-2.2 4.7-3.8 7.6-4.7 2.4-.8 4.9-.9 7.5-.4L4.7 21l-.3-5.3Z"
                fill="currentColor"
                opacity=".72"
            />
        </svg>
    );
}

function GoogleMapsIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
                d="M12 2a7.2 7.2 0 0 0-7.2 7.2c0 5.2 7.2 12.8 7.2 12.8s7.2-7.6 7.2-12.8A7.2 7.2 0 0 0 12 2Z"
                fill="#4285f4"
            />
            <path
                d="M12 2a7.2 7.2 0 0 1 6.2 3.5l-5.1 5.1-4.5-4.5L12 2Z"
                fill="#34a853"
            />
            <path
                d="m8.6 6.1-3.1 6.2c-1-2.5-.9-4.9.4-7L8.6 6Z"
                fill="#fbbc04"
            />
            <path
                d="m5.5 12.3 6.5 9.6V12a3.2 3.2 0 0 1-3.4-5.9l-2.7-.8a7.2 7.2 0 0 0-.4 7Z"
                fill="#ea4335"
            />
            <circle cx="12" cy="9.2" r="2.8" fill="#fff" />
        </svg>
    );
}

function BlankLeadDetail({ queueStatus }: { queueStatus?: string }) {
    const showsDispatchNotes = [
        'dispatched',
        'rehash',
        '555',
        'la',
        'his',
        'kit',
    ].includes(queueStatus ?? '');
    const detailGridClass =
        queueStatus === 'dispatched'
            ? 'lead-detail__grid--dispatch'
            : showsDispatchNotes
              ? 'lead-detail__grid--three-notes'
              : '';

    return (
        <>
            <div className="lead-detail__header lead-detail__header--blank">
                <div className="lead-detail__identity">
                    <span>—</span>
                    <div>
                        <small>Lead #—</small>
                        <h2>Select a lead</h2>
                    </div>
                </div>
                <div>
                    <span className="lead-status">No lead selected</span>
                    <small className="lead-created">Created —</small>
                </div>
            </div>
            <div className={`lead-detail__grid ${detailGridClass}`}>
                <article className="lead-detail-card lead-detail-card--customer">
                    <h3>
                        <UserRound />
                        Customer information
                    </h3>
                    <div className="lead-detail-fields">
                        <div>
                            <span>Marital status</span>
                            <strong>—</strong>
                        </div>
                        <div>
                            <span>Years in house</span>
                            <strong>—</strong>
                        </div>
                        <div className="lead-detail-field--wide">
                            <span>Address</span>
                            <strong>
                                <MapPin />—
                            </strong>
                        </div>
                        <div>
                            <span>Primary phone</span>
                            <strong>
                                <Phone />—
                            </strong>
                        </div>
                        <div>
                            <span>Secondary phone</span>
                            <strong>—</strong>
                        </div>
                        <div>
                            <span>Mobile number</span>
                            <strong>—</strong>
                        </div>
                        <div className="lead-detail-field--wide">
                            <span>Email</span>
                            <strong>
                                <Mail />—
                            </strong>
                        </div>
                    </div>
                </article>
                <article className="lead-detail-card">
                    <h3>
                        <CalendarClock />
                        Project &amp; appointment
                    </h3>
                    <div className="lead-summary-list">
                        <div>
                            <Package />
                            <span>
                                <small>Product</small>
                                <strong>—</strong>
                            </span>
                        </div>
                        <div>
                            <CalendarClock />
                            <span>
                                <small>Appointment</small>
                                <strong>—</strong>
                            </span>
                        </div>
                        <div>
                            <Building2 />
                            <span>
                                <small>Company</small>
                                <strong>—</strong>
                            </span>
                        </div>
                        <div>
                            <UserRound />
                            <span>
                                <small>Assigned agent</small>
                                <strong>—</strong>
                            </span>
                        </div>
                        <div>
                            <Clock3 />
                            <span>
                                <small>Lead source</small>
                                <strong>—</strong>
                            </span>
                        </div>
                    </div>
                </article>
                <article className="lead-detail-card lead-detail-card--notes">
                    <h3>Telemarketer notes</h3>
                    <p>—</p>
                </article>
                <article className="lead-detail-card lead-detail-card--notes">
                    <h3>Confirmation notes</h3>
                    <p>—</p>
                </article>
                {showsDispatchNotes && (
                    <article className="lead-detail-card lead-detail-card--notes">
                        <h3>Dispatch notes</h3>
                        <p>Select a lead to view or add dispatch notes.</p>
                    </article>
                )}
                {queueStatus === 'dispatched' && (
                    <article className="lead-detail-card lead-detail-card--notes">
                        <h3>Appointment result notes</h3>
                        <p>Select a lead to view or add appointment notes.</p>
                    </article>
                )}
            </div>
        </>
    );
}

export default function LeadsShop({
    leads,
    companies,
    products,
    agents,
    salesmen = [],
    queue,
}: LeadsShopProps) {
    const { notify } = useSystemModal();
    const [search, setSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState(
        queue?.status ?? 'fresh',
    );
    const [companyFilter, setCompanyFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [productFilter, setProductFilter] = useState('all');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [historyType, setHistoryType] = useState<
        | 'telemarketer'
        | 'confirmation'
        | 'dispatch'
        | 'appointment_result'
        | 'all'
        | null
    >(null);
    const form = useForm(emptyLeadForm);
    const telemarketerNoteForm = useForm({
        note_type: 'telemarketer',
        body: '',
    });
    const confirmationNoteForm = useForm({
        note_type: 'confirmation',
        body: '',
    });
    const dispatchNoteForm = useForm({
        note_type: 'dispatch',
        body: '',
    });
    const appointmentResultNoteForm = useForm({
        note_type: 'appointment_result',
        body: '',
    });
    const saleForm = useForm<{ amount: string; salesman?: string }>({
        amount: '',
    });

    const lastThirtyDays = useMemo(() => {
        const counts = new Map<string, number>();
        leads.forEach((lead) => {
            const key = new Date(
                lead[queue?.dateField ?? 'created_at'],
            ).toLocaleDateString('en-CA');
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        return Array.from({ length: 30 }, (_, index) => {
            const date = new Date();
            date.setHours(12, 0, 0, 0);
            date.setDate(date.getDate() - index);
            const key = date.toLocaleDateString('en-CA');

            return {
                key,
                date: new Intl.DateTimeFormat('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: '2-digit',
                }).format(date),
                day: new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                }).format(date),
                count: counts.get(key) ?? 0,
            };
        });
    }, [leads, queue?.dateField]);

    const filterOptions = useMemo(
        () => ({
            companies: Array.from(
                new Map(
                    leads
                        .filter((lead) => lead.company)
                        .map((lead) => [
                            String(lead.company!.com_id),
                            lead.company!.company,
                        ]),
                ),
            ).sort((a, b) => a[1].localeCompare(b[1])),
            sources: Array.from(
                new Set(leads.map((lead) => lead.source)),
            ).sort(),
            cities: Array.from(new Set(leads.map((lead) => lead.city))).sort(),
            products: Array.from(
                new Map(
                    leads
                        .filter((lead) => lead.product)
                        .map((lead) => [
                            String(lead.product!.prod_id),
                            lead.product!.product_name,
                        ]),
                ),
            ).sort((a, b) => a[1].localeCompare(b[1])),
        }),
        [leads],
    );

    const statusFilters = useMemo(
        () =>
            queue?.statusFilters
                ? queue.statusFilters
                : queue
                  ? ([[queue.status, queue.listTitle]] as const)
                  : ([
                        ['fresh', 'Freshly In'],
                        ['raw', 'Raw'],
                        ['cb', 'CB'],
                        ['naov', 'NAOV'],
                        ['toss', 'TOSS'],
                    ] as const),
        [queue],
    );

    const statusCounts = useMemo(
        () =>
            Object.fromEntries(
                statusFilters.map(([status]) => [
                    status,
                    leads.filter((lead) => (lead.status || 'fresh') === status)
                        .length,
                ]),
            ),
        [leads, statusFilters],
    );

    const filteredLeads = useMemo(() => {
        const query = search.trim().toLowerCase();

        return leads.filter((lead) => {
            const matchesDate =
                selectedDate === 'all' ||
                new Date(
                    lead[queue?.dateField ?? 'created_at'],
                ).toLocaleDateString('en-CA') === selectedDate;
            const matchesSearch =
                !query ||
                [
                    lead.customer_name,
                    lead.city,
                    lead.company?.company,
                    lead.product?.product_name,
                    lead.agent?.agent_name,
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(query);

            const matchesStatus = (lead.status || 'fresh') === selectedStatus;
            const matchesCompany =
                companyFilter === 'all' ||
                String(lead.company?.com_id) === companyFilter;
            const matchesSource =
                sourceFilter === 'all' || lead.source === sourceFilter;
            const matchesCity =
                cityFilter === 'all' || lead.city === cityFilter;
            const matchesProduct =
                productFilter === 'all' ||
                String(lead.product?.prod_id) === productFilter;

            return (
                matchesDate &&
                matchesSearch &&
                matchesStatus &&
                matchesCompany &&
                matchesSource &&
                matchesCity &&
                matchesProduct
            );
        });
    }, [
        leads,
        search,
        selectedDate,
        selectedStatus,
        companyFilter,
        sourceFilter,
        cityFilter,
        productFilter,
        queue?.dateField,
    ]);

    const clearListFilters = () => {
        setSelectedStatus(queue?.status ?? 'fresh');
        setCompanyFilter('all');
        setSourceFilter('all');
        setCityFilter('all');
        setProductFilter('all');
    };

    const selected = leads.find((lead) => lead.id === selectedId) ?? null;

    const selectLead = (lead: Lead) => {
        setSelectedId(lead.id);
        setIsEditing(false);
        setHistoryType(null);
        telemarketerNoteForm.reset();
        telemarketerNoteForm.clearErrors();
        confirmationNoteForm.reset();
        confirmationNoteForm.clearErrors();
        dispatchNoteForm.reset();
        dispatchNoteForm.clearErrors();
        appointmentResultNoteForm.reset();
        appointmentResultNoteForm.clearErrors();
        form.setData({
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
            appointment_at: lead.appointment_at.slice(0, 16),
            telemarketer_notes: lead.telemarketer_notes,
            company_id: String(lead.company?.com_id ?? ''),
            source: 'CallTools',
            agent_id: String(lead.agent?.agent_id ?? ''),
            salesman_1_id: String(lead.salesman_one?.salesman_id ?? ''),
            salesman_2_id: String(lead.salesman_two?.salesman_id ?? ''),
        });
        form.clearErrors();
    };

    const saveLead = () => {
        if (!selected) {
            return;
        }

        form.put(`/lead-workflow/leads-shop/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => setIsEditing(false),
        });
    };

    const saveTelemarketerNote = () => {
        if (!selected || !telemarketerNoteForm.data.body.trim()) {
            return;
        }

        telemarketerNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => telemarketerNoteForm.reset(),
            },
        );
    };

    const saveConfirmationNote = () => {
        if (!selected || !confirmationNoteForm.data.body.trim()) {
            return;
        }

        confirmationNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => confirmationNoteForm.reset(),
            },
        );
    };

    const saveDispatchNote = () => {
        if (!selected || !dispatchNoteForm.data.body.trim()) {
            return;
        }

        dispatchNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => dispatchNoteForm.reset(),
            },
        );
    };

    const saveAppointmentResultNote = () => {
        if (!selected || !appointmentResultNoteForm.data.body.trim()) {
            return;
        }

        appointmentResultNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => appointmentResultNoteForm.reset(),
            },
        );
    };

    const updateLeadStatus = (status: string) => {
        if (!selected) {
            return;
        }

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/status`,
            { status },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    };

    const openSaleModal = () => {
        if (!selected) {
            return;
        }

        if (!selected.salesman_one && !selected.salesman_two) {
            notify({
                title: 'Salesman required',
                message:
                    'Assign at least one salesman before accepting a sale.',
                tone: 'warning',
            });

            return;
        }

        saleForm.reset();
        saleForm.clearErrors();
        setSaleModalOpen(true);
    };

    const acceptSale = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selected) {
            return;
        }

        saleForm.post(`/lead-workflow/leads-shop/${selected.id}/sale`, {
            preserveScroll: true,
            onSuccess: () => {
                setSaleModalOpen(false);
                saleForm.reset();
                setSelectedId(null);
                router.flushAll();
            },
        });
    };

    const assignSalesman = (
        field: 'salesman_1_id' | 'salesman_2_id',
        value: string,
    ) => {
        if (!selected) {
            return;
        }

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/salesmen`,
            {
                salesman_1_id:
                    field === 'salesman_1_id'
                        ? value || null
                        : (selected.salesman_one?.salesman_id ?? null),
                salesman_2_id:
                    field === 'salesman_2_id'
                        ? value || null
                        : (selected.salesman_two?.salesman_id ?? null),
            },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    };

    const updateAppointmentResult = (appointmentResult: string) => {
        if (!selected) {
            return;
        }

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/appointment-result`,
            { appointment_result: appointmentResult || null },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    };

    const assignSecondAgent = (agentId: string) => {
        if (!selected) {
            return;
        }

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/second-agent`,
            { agent_2_id: agentId || null },
            { preserveScroll: true, onSuccess: () => router.flushAll() },
        );
    };

    const telemarketerHistory =
        selected?.notes.filter((note) => note.note_type === 'telemarketer') ??
        [];
    const confirmationHistory =
        selected?.notes.filter((note) => note.note_type === 'confirmation') ??
        [];
    const dispatchHistory =
        selected?.notes.filter((note) => note.note_type === 'dispatch') ?? [];
    const appointmentResultHistory =
        selected?.notes.filter(
            (note) => note.note_type === 'appointment_result',
        ) ?? [];
    const displayedHistory =
        historyType === 'all'
            ? (selected?.notes ?? [])
            : (selected?.notes.filter(
                  (note) => note.note_type === historyType,
              ) ?? []);

    const defaultWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['555', '555', Phone, '555'],
        ['kit', 'KIT', MessageCircle, 'kit'],
        ['raw', 'Raw', Archive, 'raw'],
        ['cb', 'Call Back', PhoneCall, 'callback'],
        ['naov', 'NAOV', Ban, 'naov'],
        ['toss', 'TOSS', Trash2, 'toss'],
        ['history', 'History', History, 'history'],
    ] as const;
    const confirmWorkflowActions = [
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
    ] as const;
    const dispatchWorkflowActions = [
        ['kit', 'Keep in Touch', MessageCircle, 'callback'],
        ['rehash', 'Rehash', RotateCcw, 'toss'],
        ['555', '555', Phone, '555'],
        ['sale', 'Sale', CircleDollarSign, 'confirm'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['history', 'History', History, 'history'],
    ] as const;
    const rescheduleWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['history', 'History', History, 'history'],
    ] as const;
    const rehashWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['rehash_ng', 'NG', Ban, 'raw'],
        ['rehash_toss', 'TOSS', Trash2, 'toss'],
        ['rehash_cb', 'Call Back', PhoneCall, 'callback'],
        ['history', 'History', History, 'history'],
    ] as const;
    const fiveFiveFiveWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['history', 'History', History, 'history'],
    ] as const;
    const hisWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['la', 'LA', MapPin, '555'],
        ['555', '555', Phone, '555'],
        ['kit', 'KIT', MessageCircle, 'kit'],
        ['raw', 'Raw', Archive, 'raw'],
        ['cb', 'Call Back', PhoneCall, 'callback'],
        ['naov', 'NAOV', Ban, 'naov'],
        ['toss', 'TOSS', Trash2, 'toss'],
        ['history', 'History', History, 'history'],
    ] as const;
    const keepInTouchWorkflowActions = [
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['kit_ng', 'NG', Ban, 'raw'],
        ['kit_toss', 'TOSS', Trash2, 'toss'],
        ['kit_cb', 'Call Back', PhoneCall, 'callback'],
        ['history', 'History', History, 'history'],
    ] as const;
    const workflowActions =
        queue?.status === 'confirmed'
            ? confirmWorkflowActions
            : queue?.status === 'dispatched'
              ? dispatchWorkflowActions
              : queue?.status === 'reschedule'
                ? rescheduleWorkflowActions
                : queue?.status === 'rehash'
                  ? rehashWorkflowActions
                  : ['555', 'la'].includes(queue?.status ?? '')
                    ? fiveFiveFiveWorkflowActions
                    : queue?.status === 'his'
                      ? hisWorkflowActions
                      : queue?.status === 'kit'
                        ? keepInTouchWorkflowActions
                        : defaultWorkflowActions;
    const headerIcon =
        queue?.status === 'confirmed' ? (
            <CheckCircle2 />
        ) : queue?.status === 'dispatched' ? (
            <Truck />
        ) : queue?.status === 'reschedule' ? (
            <CalendarClock />
        ) : queue?.status === 'rehash' ? (
            <RotateCcw />
        ) : queue?.status === '555' ? (
            <PhoneCall />
        ) : queue?.status === 'la' ? (
            <MapPin />
        ) : queue?.status === 'his' ? (
            <Building2 />
        ) : queue?.status === 'kit' ? (
            <Clock3 />
        ) : (
            <ShoppingBag />
        );

    return (
        <>
            <Head title={queue?.title ?? 'Leads Shop'} />
            <main
                className={`leads-shop-page leads-shop-page--${queue?.status ?? 'shop'} ${queue?.status === 'his' ? 'leads-shop-page--his' : ''}`}
            >
                <header className="leads-shop-header">
                    <div className="leads-shop-header__identity">
                        <span className="leads-shop-header__icon">
                            {headerIcon}
                        </span>
                        <div>
                            <div className="leads-shop-header__title">
                                <h1>{queue?.title ?? 'Leads Shop'}</h1>
                                <strong>{leads.length}</strong>
                            </div>
                            <p>
                                {queue?.description ??
                                    'Browse and manage freshly imported leads.'}
                            </p>
                        </div>
                    </div>
                    <label className="leads-shop-search">
                        <Search />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by customer, city, company, product, or agent"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                            >
                                <X />
                            </button>
                        )}
                    </label>
                </header>

                <div className="leads-shop-workspace">
                    <aside className="lead-dates">
                        <div className="lead-dates__header">
                            <div>
                                <h2>{queue?.dateLabel ?? 'Last 30 days'}</h2>
                                <p>
                                    Filter by{' '}
                                    {queue?.dateField === 'appointment_at'
                                        ? 'appointment date'
                                        : 'created date'}
                                </p>
                            </div>
                            <CalendarClock />
                        </div>
                        <div className="lead-dates__columns">
                            <span>Date</span>
                            <span>Day</span>
                            <span>Count</span>
                        </div>
                        <div className="lead-dates__list">
                            {lastThirtyDays.map((day) => (
                                <button
                                    type="button"
                                    key={day.key}
                                    className={
                                        selectedDate === day.key
                                            ? 'lead-date-row lead-date-row--active'
                                            : 'lead-date-row'
                                    }
                                    onClick={() => setSelectedDate(day.key)}
                                >
                                    <span>{day.date}</span>
                                    <span>{day.day}</span>
                                    <strong>{day.count}</strong>
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className={
                                selectedDate === 'all'
                                    ? 'lead-dates__all lead-dates__all--active'
                                    : 'lead-dates__all'
                            }
                            onClick={() => setSelectedDate('all')}
                        >
                            All dates
                        </button>
                    </aside>

                    <section className="lead-browser">
                        <div className="lead-browser__header">
                            <div>
                                <h2>{queue?.listTitle ?? 'Fresh leads'}</h2>
                                <p>{filteredLeads.length} shown</p>
                            </div>
                            <span>Newest first</span>
                        </div>
                        <div className="lead-browser-filters">
                            <div className="lead-status-filters">
                                {statusFilters.map(([status, label]) => (
                                    <button
                                        type="button"
                                        key={status}
                                        className={
                                            selectedStatus === status
                                                ? 'lead-status-filter lead-status-filter--active'
                                                : 'lead-status-filter'
                                        }
                                        onClick={() =>
                                            setSelectedStatus(status)
                                        }
                                    >
                                        {label}
                                        <span>{statusCounts[status] ?? 0}</span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="lead-filter-reset"
                                    onClick={clearListFilters}
                                    aria-label="Reset lead filters"
                                    title="Reset filters"
                                >
                                    <RotateCcw />
                                </button>
                            </div>
                            <div className="lead-dropdown-filters">
                                <label>
                                    <Building2 />
                                    <select
                                        value={companyFilter}
                                        onChange={(event) =>
                                            setCompanyFilter(event.target.value)
                                        }
                                    >
                                        <option value="all">
                                            All companies
                                        </option>
                                        {filterOptions.companies.map(
                                            ([id, name]) => (
                                                <option key={id} value={id}>
                                                    {name}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>
                                <label>
                                    <SlidersHorizontal />
                                    <select
                                        value={sourceFilter}
                                        onChange={(event) =>
                                            setSourceFilter(event.target.value)
                                        }
                                    >
                                        <option value="all">All sources</option>
                                        {filterOptions.sources.map((source) => (
                                            <option key={source}>
                                                {source}
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
                                        <option value="all">
                                            All products
                                        </option>
                                        {filterOptions.products.map(
                                            ([id, name]) => (
                                                <option key={id} value={id}>
                                                    {name}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="lead-browser__columns">
                            <span>Customer</span>
                            <span>City</span>
                            <span>
                                {queue?.dateField === 'appointment_at'
                                    ? 'Appointment'
                                    : 'Created'}
                            </span>
                        </div>
                        <div className="lead-browser__list">
                            {filteredLeads.map((lead) => (
                                <button
                                    type="button"
                                    key={lead.id}
                                    className={
                                        selectedId === lead.id
                                            ? 'lead-browser-row lead-browser-row--active'
                                            : 'lead-browser-row'
                                    }
                                    onClick={() => selectLead(lead)}
                                >
                                    <span>
                                        <strong>{lead.customer_name}</strong>
                                        <small>
                                            {lead.product?.product_name ??
                                                'No product'}
                                        </small>
                                    </span>
                                    <span>{lead.city}</span>
                                    <span>
                                        {formatDate(
                                            lead[
                                                queue?.dateField ?? 'created_at'
                                            ],
                                        )}
                                    </span>
                                </button>
                            ))}
                            {filteredLeads.length === 0 && (
                                <div className="lead-browser-empty">
                                    <ShoppingBag />
                                    <strong>No leads found</strong>
                                    <span>
                                        {search
                                            ? 'Try another search.'
                                            : 'Create a lead from Lead Card.'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="lead-detail">
                        {selected ? (
                            <>
                                <div className="lead-detail__header">
                                    <div className="lead-detail__identity">
                                        <span>
                                            {selected.customer_name
                                                .charAt(0)
                                                .toUpperCase()}
                                        </span>
                                        <div>
                                            <small>Lead #{selected.id}</small>
                                            <h2>{selected.customer_name}</h2>
                                        </div>
                                    </div>
                                    <div className="lead-detail__controls">
                                        <div className="lead-address-actions">
                                            <a
                                                className="lead-address-action lead-address-action--zillow"
                                                href={
                                                    leadAddressLinks(selected)
                                                        .zillow
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Search ${leadAddress(selected)} on Zillow`}
                                                title="Search this address on Zillow"
                                            >
                                                <ZillowIcon />
                                                <span>Zillow</span>
                                            </a>
                                            <a
                                                className="lead-address-action lead-address-action--maps"
                                                href={
                                                    leadAddressLinks(selected)
                                                        .googleMaps
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Open ${leadAddress(selected)} in Google Maps`}
                                                title="Open this address in Google Maps"
                                            >
                                                <GoogleMapsIcon />
                                                <span>Maps</span>
                                            </a>
                                        </div>
                                        <div>
                                            <span className="lead-status">
                                                {selected.status || 'fresh'}
                                            </span>
                                            <small className="lead-created">
                                                Created{' '}
                                                {formatDate(
                                                    selected.created_at,
                                                )}
                                            </small>
                                        </div>
                                        <button
                                            type="button"
                                            className={
                                                isEditing
                                                    ? 'lead-detail-save'
                                                    : 'lead-detail-edit'
                                            }
                                            disabled={form.processing}
                                            onClick={() =>
                                                isEditing
                                                    ? saveLead()
                                                    : setIsEditing(true)
                                            }
                                        >
                                            {isEditing ? <Save /> : <Pencil />}
                                            {form.processing
                                                ? 'Saving…'
                                                : isEditing
                                                  ? 'Save'
                                                  : 'Edit'}
                                        </button>
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div className="lead-edit-grid">
                                        <label>
                                            <span>Customer name</span>
                                            <input
                                                value={form.data.customer_name}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'customer_name',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.customer_name && (
                                                <em>
                                                    {form.errors.customer_name}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Marital status</span>
                                            <select
                                                value={form.data.marital_status}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'marital_status',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select status
                                                </option>
                                                <option>Single</option>
                                                <option>Married</option>
                                                <option>Divorced</option>
                                                <option>Widowed</option>
                                                <option>Other</option>
                                            </select>
                                            {form.errors.marital_status && (
                                                <em>
                                                    {form.errors.marital_status}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Primary phone</span>
                                            <div className="lead-edit-phone">
                                                <input
                                                    value={
                                                        form.data.primary_number
                                                    }
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'primary_number',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                {form.data.primary_number.trim() && (
                                                    <RingCentralCallButton
                                                        phone={
                                                            form.data
                                                                .primary_number
                                                        }
                                                        title="Call primary phone with RingCentral"
                                                    >
                                                        <PhoneCall />
                                                    </RingCentralCallButton>
                                                )}
                                            </div>
                                            {form.errors.primary_number && (
                                                <em>
                                                    {form.errors.primary_number}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Secondary phone</span>
                                            <div className="lead-edit-phone">
                                                <input
                                                    value={
                                                        form.data
                                                            .secondary_number
                                                    }
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'secondary_number',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                {form.data.secondary_number.trim() && (
                                                    <RingCentralCallButton
                                                        phone={
                                                            form.data
                                                                .secondary_number
                                                        }
                                                        title="Call secondary phone with RingCentral"
                                                    >
                                                        <PhoneCall />
                                                    </RingCentralCallButton>
                                                )}
                                            </div>
                                        </label>
                                        <label>
                                            <span>Mobile number</span>
                                            <div className="lead-edit-phone">
                                                <input
                                                    value={
                                                        form.data.mobile_number
                                                    }
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'mobile_number',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                {form.data.mobile_number.trim() && (
                                                    <RingCentralCallButton
                                                        phone={
                                                            form.data
                                                                .mobile_number
                                                        }
                                                        title="Call mobile number with RingCentral"
                                                    >
                                                        <PhoneCall />
                                                    </RingCentralCallButton>
                                                )}
                                            </div>
                                        </label>
                                        <label>
                                            <span>Email</span>
                                            <input
                                                type="email"
                                                value={form.data.email}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'email',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.email && (
                                                <em>{form.errors.email}</em>
                                            )}
                                        </label>
                                        <label className="lead-edit-field--wide">
                                            <span>Address</span>
                                            <input
                                                value={form.data.address}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'address',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.address && (
                                                <em>{form.errors.address}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>City</span>
                                            <input
                                                value={form.data.city}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'city',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.city && (
                                                <em>{form.errors.city}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>County</span>
                                            <input
                                                value={form.data.county}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'county',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.county && (
                                                <em>{form.errors.county}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>State</span>
                                            <input
                                                value={form.data.state}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'state',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.state && (
                                                <em>{form.errors.state}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>ZIP code</span>
                                            <input
                                                value={form.data.zip_code}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'zip_code',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.zip_code && (
                                                <em>{form.errors.zip_code}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Years in house</span>
                                            <input
                                                type="number"
                                                value={form.data.years_in_house}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'years_in_house',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.years_in_house && (
                                                <em>
                                                    {form.errors.years_in_house}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Product</span>
                                            <select
                                                value={form.data.product_id}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'product_id',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select product
                                                </option>
                                                {products.map((product) => (
                                                    <option
                                                        key={product.prod_id}
                                                        value={product.prod_id}
                                                    >
                                                        {product.product_name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.product_id && (
                                                <em>
                                                    {form.errors.product_id}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Appointment</span>
                                            <input
                                                type="datetime-local"
                                                value={form.data.appointment_at}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'appointment_at',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.appointment_at && (
                                                <em>
                                                    {form.errors.appointment_at}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Company</span>
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
                                            {form.errors.company_id && (
                                                <em>
                                                    {form.errors.company_id}
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Assigned agent</span>
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
                                            {form.errors.agent_id && (
                                                <em>{form.errors.agent_id}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Lead source</span>
                                            <input value="CallTools" readOnly />
                                        </label>
                                        {[
                                            'dispatched',
                                            'rehash',
                                            '555',
                                            'his',
                                            'kit',
                                        ].includes(queue?.status ?? '') && (
                                            <>
                                                <label>
                                                    <span>Salesman 1</span>
                                                    <select
                                                        value={
                                                            form.data
                                                                .salesman_1_id
                                                        }
                                                        onChange={(event) =>
                                                            form.setData(
                                                                'salesman_1_id',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Select salesman
                                                        </option>
                                                        {salesmen.map(
                                                            (salesman) => (
                                                                <option
                                                                    key={
                                                                        salesman.salesman_id
                                                                    }
                                                                    value={
                                                                        salesman.salesman_id
                                                                    }
                                                                >
                                                                    {
                                                                        salesman.salesman_name
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    {form.errors
                                                        .salesman_1_id && (
                                                        <em>
                                                            {
                                                                form.errors
                                                                    .salesman_1_id
                                                            }
                                                        </em>
                                                    )}
                                                </label>
                                                <label>
                                                    <span>Salesman 2</span>
                                                    <select
                                                        value={
                                                            form.data
                                                                .salesman_2_id
                                                        }
                                                        onChange={(event) =>
                                                            form.setData(
                                                                'salesman_2_id',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Select salesman
                                                        </option>
                                                        {salesmen.map(
                                                            (salesman) => (
                                                                <option
                                                                    key={
                                                                        salesman.salesman_id
                                                                    }
                                                                    value={
                                                                        salesman.salesman_id
                                                                    }
                                                                >
                                                                    {
                                                                        salesman.salesman_name
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    {form.errors
                                                        .salesman_2_id && (
                                                        <em>
                                                            {
                                                                form.errors
                                                                    .salesman_2_id
                                                            }
                                                        </em>
                                                    )}
                                                </label>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={`lead-detail__grid ${queue?.status === 'dispatched' ? 'lead-detail__grid--dispatch' : ['rehash', '555', 'la', 'his', 'kit'].includes(queue?.status ?? '') ? 'lead-detail__grid--three-notes' : ''}`}
                                    >
                                        <article className="lead-detail-card lead-detail-card--customer">
                                            <h3>
                                                <UserRound />
                                                Customer information
                                            </h3>
                                            <div className="lead-detail-fields">
                                                <div>
                                                    <span>Marital status</span>
                                                    <strong>
                                                        {
                                                            selected.marital_status
                                                        }
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span>Years in house</span>
                                                    <strong>
                                                        {
                                                            selected.years_in_house
                                                        }
                                                    </strong>
                                                </div>
                                                <div className="lead-detail-field--wide">
                                                    <span>Address</span>
                                                    <strong>
                                                        <MapPin />
                                                        {selected.address},{' '}
                                                        {selected.city},{' '}
                                                        {selected.county},{' '}
                                                        {selected.state}{' '}
                                                        {selected.zip_code}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span>Primary phone</span>
                                                    <div className="lead-phone-value">
                                                        <strong>
                                                            <Phone />
                                                            {
                                                                selected.primary_number
                                                            }
                                                        </strong>
                                                        {selected.primary_number.trim() && (
                                                            <RingCentralCallButton
                                                                phone={
                                                                    selected.primary_number
                                                                }
                                                                title="Call primary phone with RingCentral"
                                                            >
                                                                <PhoneCall />
                                                            </RingCentralCallButton>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span>Secondary phone</span>
                                                    <div className="lead-phone-value">
                                                        <strong>
                                                            {selected.secondary_number ||
                                                                '—'}
                                                        </strong>
                                                        {selected.secondary_number?.trim() && (
                                                            <RingCentralCallButton
                                                                phone={
                                                                    selected.secondary_number
                                                                }
                                                                title="Call secondary phone with RingCentral"
                                                            >
                                                                <PhoneCall />
                                                            </RingCentralCallButton>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span>Mobile number</span>
                                                    <div className="lead-phone-value">
                                                        <strong>
                                                            {selected.mobile_number ||
                                                                '—'}
                                                        </strong>
                                                        {selected.mobile_number?.trim() && (
                                                            <RingCentralCallButton
                                                                phone={
                                                                    selected.mobile_number
                                                                }
                                                                title="Call mobile number with RingCentral"
                                                            >
                                                                <PhoneCall />
                                                            </RingCentralCallButton>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="lead-detail-field--wide">
                                                    <span>Email</span>
                                                    <strong>
                                                        <Mail />
                                                        {selected.email || '—'}
                                                    </strong>
                                                </div>
                                            </div>
                                        </article>

                                        <article className="lead-detail-card">
                                            <h3>
                                                <CalendarClock />
                                                Project &amp; appointment
                                            </h3>
                                            <div className="lead-summary-list">
                                                <div>
                                                    <Package />
                                                    <span>
                                                        <small>Product</small>
                                                        <strong>
                                                            {selected.product
                                                                ?.product_name ??
                                                                '—'}
                                                        </strong>
                                                    </span>
                                                </div>
                                                <div>
                                                    <CalendarClock />
                                                    <span>
                                                        <small>
                                                            Appointment
                                                        </small>
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
                                                            {selected.company
                                                                ?.prefix ?? '—'}
                                                        </strong>
                                                    </span>
                                                </div>
                                                <div>
                                                    <UserRound />
                                                    <span>
                                                        <small>
                                                            Assigned agent
                                                        </small>
                                                        <strong>
                                                            {selected.agent
                                                                ?.agent_name ??
                                                                '—'}
                                                        </strong>
                                                    </span>
                                                </div>
                                                {[
                                                    'reschedule',
                                                    'rehash',
                                                    '555',
                                                    'his',
                                                ].includes(
                                                    queue?.status ?? '',
                                                ) && (
                                                    <div>
                                                        <UserRound />
                                                        <span>
                                                            <small>
                                                                Second agent
                                                            </small>
                                                            <select
                                                                className="lead-inline-assignment"
                                                                value={
                                                                    selected
                                                                        .second_agent
                                                                        ?.agent_id ??
                                                                    ''
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    assignSecondAgent(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            >
                                                                <option value="">
                                                                    Unassigned
                                                                </option>
                                                                {agents.map(
                                                                    (agent) => (
                                                                        <option
                                                                            key={
                                                                                agent.agent_id
                                                                            }
                                                                            value={
                                                                                agent.agent_id
                                                                            }
                                                                            disabled={
                                                                                selected
                                                                                    .agent
                                                                                    ?.agent_id ===
                                                                                agent.agent_id
                                                                            }
                                                                        >
                                                                            {
                                                                                agent.agent_name
                                                                            }
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                        </span>
                                                    </div>
                                                )}
                                                {[
                                                    'dispatched',
                                                    'rehash',
                                                    '555',
                                                    'his',
                                                    'kit',
                                                ].includes(
                                                    queue?.status ?? '',
                                                ) && (
                                                    <>
                                                        {queue?.status ===
                                                            'dispatched' && (
                                                            <div>
                                                                <CalendarClock />
                                                                <span>
                                                                    <small>
                                                                        Appointment
                                                                        result
                                                                    </small>
                                                                    <select
                                                                        className="lead-inline-assignment"
                                                                        value={
                                                                            selected.appointment_result ??
                                                                            ''
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            updateAppointmentResult(
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                    >
                                                                        <option value="">
                                                                            Select
                                                                            result
                                                                        </option>
                                                                        <option value="PNS">
                                                                            PNS
                                                                        </option>
                                                                        <option value="PNS No Rehash">
                                                                            PNS
                                                                            No
                                                                            Rehash
                                                                        </option>
                                                                        <option value="2 ND Meeting">
                                                                            2 ND
                                                                            Meeting
                                                                        </option>
                                                                        <option value="Sold">
                                                                            Sold
                                                                        </option>
                                                                        <option value="Sold and Cancel">
                                                                            Sold
                                                                            and
                                                                            Cancel
                                                                        </option>
                                                                    </select>
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <UserRound />
                                                            <span>
                                                                <small>
                                                                    Salesman 1
                                                                </small>
                                                                <select
                                                                    className="lead-inline-assignment"
                                                                    value={
                                                                        selected
                                                                            .salesman_one
                                                                            ?.salesman_id ??
                                                                        ''
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        assignSalesman(
                                                                            'salesman_1_id',
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Unassigned
                                                                    </option>
                                                                    {salesmen.map(
                                                                        (
                                                                            salesman,
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    salesman.salesman_id
                                                                                }
                                                                                value={
                                                                                    salesman.salesman_id
                                                                                }
                                                                                disabled={
                                                                                    selected
                                                                                        .salesman_two
                                                                                        ?.salesman_id ===
                                                                                    salesman.salesman_id
                                                                                }
                                                                            >
                                                                                {
                                                                                    salesman.salesman_name
                                                                                }
                                                                            </option>
                                                                        ),
                                                                    )}
                                                                </select>
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <UserRound />
                                                            <span>
                                                                <small>
                                                                    Salesman 2
                                                                </small>
                                                                <select
                                                                    className="lead-inline-assignment"
                                                                    value={
                                                                        selected
                                                                            .salesman_two
                                                                            ?.salesman_id ??
                                                                        ''
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        assignSalesman(
                                                                            'salesman_2_id',
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Unassigned
                                                                    </option>
                                                                    {salesmen.map(
                                                                        (
                                                                            salesman,
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    salesman.salesman_id
                                                                                }
                                                                                value={
                                                                                    salesman.salesman_id
                                                                                }
                                                                                disabled={
                                                                                    selected
                                                                                        .salesman_one
                                                                                        ?.salesman_id ===
                                                                                    salesman.salesman_id
                                                                                }
                                                                            >
                                                                                {
                                                                                    salesman.salesman_name
                                                                                }
                                                                            </option>
                                                                        ),
                                                                    )}
                                                                </select>
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                                <div>
                                                    <Clock3 />
                                                    <span>
                                                        <small>
                                                            Lead source
                                                        </small>
                                                        <strong>
                                                            {selected.source}
                                                        </strong>
                                                    </span>
                                                </div>
                                            </div>
                                        </article>

                                        <article className="lead-detail-card lead-detail-card--notes lead-live-notes">
                                            <div className="lead-note-heading">
                                                <h3>Telemarketer notes</h3>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setHistoryType(
                                                            'telemarketer',
                                                        )
                                                    }
                                                >
                                                    <History />
                                                    History{' '}
                                                    <span>
                                                        {
                                                            telemarketerHistory.length
                                                        }
                                                    </span>
                                                </button>
                                            </div>
                                            <textarea
                                                value={
                                                    telemarketerNoteForm.data
                                                        .body
                                                }
                                                onChange={(event) =>
                                                    telemarketerNoteForm.setData(
                                                        'body',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Type a new telemarketer note…"
                                            />
                                            <div className="lead-note-actions">
                                                {telemarketerNoteForm.errors
                                                    .body && (
                                                    <em>
                                                        {
                                                            telemarketerNoteForm
                                                                .errors.body
                                                        }
                                                    </em>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={
                                                        telemarketerNoteForm.processing ||
                                                        !telemarketerNoteForm.data.body.trim()
                                                    }
                                                    onClick={
                                                        saveTelemarketerNote
                                                    }
                                                >
                                                    <Save />
                                                    {telemarketerNoteForm.processing
                                                        ? 'Saving…'
                                                        : 'Save note'}
                                                </button>
                                            </div>
                                        </article>
                                        <article className="lead-detail-card lead-detail-card--notes lead-live-notes">
                                            <div className="lead-note-heading">
                                                <h3>Confirmation notes</h3>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setHistoryType(
                                                            'confirmation',
                                                        )
                                                    }
                                                >
                                                    <History />
                                                    History{' '}
                                                    <span>
                                                        {
                                                            confirmationHistory.length
                                                        }
                                                    </span>
                                                </button>
                                            </div>
                                            <textarea
                                                value={
                                                    confirmationNoteForm.data
                                                        .body
                                                }
                                                onChange={(event) =>
                                                    confirmationNoteForm.setData(
                                                        'body',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Type a new confirmation note…"
                                            />
                                            <div className="lead-note-actions">
                                                {confirmationNoteForm.errors
                                                    .body && (
                                                    <em>
                                                        {
                                                            confirmationNoteForm
                                                                .errors.body
                                                        }
                                                    </em>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={
                                                        confirmationNoteForm.processing ||
                                                        !confirmationNoteForm.data.body.trim()
                                                    }
                                                    onClick={
                                                        saveConfirmationNote
                                                    }
                                                >
                                                    <Save />
                                                    {confirmationNoteForm.processing
                                                        ? 'Saving…'
                                                        : 'Save note'}
                                                </button>
                                            </div>
                                        </article>
                                        {[
                                            'dispatched',
                                            'rehash',
                                            '555',
                                            'la',
                                            'his',
                                            'kit',
                                        ].includes(queue?.status ?? '') && (
                                            <>
                                                <article className="lead-detail-card lead-detail-card--notes lead-live-notes">
                                                    <div className="lead-note-heading">
                                                        <h3>Dispatch notes</h3>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setHistoryType(
                                                                    'dispatch',
                                                                )
                                                            }
                                                        >
                                                            <History /> History{' '}
                                                            <span>
                                                                {
                                                                    dispatchHistory.length
                                                                }
                                                            </span>
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={
                                                            dispatchNoteForm
                                                                .data.body
                                                        }
                                                        onChange={(event) =>
                                                            dispatchNoteForm.setData(
                                                                'body',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Type a new dispatch note…"
                                                    />
                                                    <div className="lead-note-actions">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                dispatchNoteForm.processing ||
                                                                !dispatchNoteForm.data.body.trim()
                                                            }
                                                            onClick={
                                                                saveDispatchNote
                                                            }
                                                        >
                                                            <Save /> Save note
                                                        </button>
                                                    </div>
                                                </article>
                                                {queue?.status ===
                                                    'dispatched' && (
                                                    <article className="lead-detail-card lead-detail-card--notes lead-live-notes">
                                                        <div className="lead-note-heading">
                                                            <h3>
                                                                Appointment
                                                                result notes
                                                            </h3>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setHistoryType(
                                                                        'appointment_result',
                                                                    )
                                                                }
                                                            >
                                                                <History />{' '}
                                                                History{' '}
                                                                <span>
                                                                    {
                                                                        appointmentResultHistory.length
                                                                    }
                                                                </span>
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            value={
                                                                appointmentResultNoteForm
                                                                    .data.body
                                                            }
                                                            onChange={(event) =>
                                                                appointmentResultNoteForm.setData(
                                                                    'body',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Type a new appointment result note…"
                                                        />
                                                        <div className="lead-note-actions">
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    appointmentResultNoteForm.processing ||
                                                                    !appointmentResultNoteForm.data.body.trim()
                                                                }
                                                                onClick={
                                                                    saveAppointmentResultNote
                                                                }
                                                            >
                                                                <Save /> Save
                                                                note
                                                            </button>
                                                        </div>
                                                    </article>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <BlankLeadDetail queueStatus={queue?.status} />
                        )}
                        <div className="lead-workflow-actions">
                            {workflowActions.map(
                                ([status, label, Icon, tone]) => (
                                    <button
                                        type="button"
                                        key={status}
                                        className={`lead-workflow-action lead-workflow-action--${tone} ${selected?.status === status ? 'is-active' : ''}`}
                                        disabled={
                                            !selected ||
                                            isEditing ||
                                            (status !== 'history' &&
                                                selected?.status === status)
                                        }
                                        onClick={() =>
                                            status === 'history'
                                                ? setHistoryType('all')
                                                : status === 'sale'
                                                  ? openSaleModal()
                                                  : updateLeadStatus(status)
                                        }
                                    >
                                        <Icon /> {label}
                                    </button>
                                ),
                            )}
                        </div>
                    </section>
                </div>

                {saleModalOpen && selected && (
                    <div
                        className="lead-note-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lead-sale-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setSaleModalOpen(false);
                            }
                        }}
                    >
                        <section className="lead-note-modal__card lead-sale-modal__card">
                            <header>
                                <div>
                                    <span>
                                        <CircleDollarSign />
                                    </span>
                                    <div>
                                        <h2 id="lead-sale-title">
                                            Accept sale
                                        </h2>
                                        <p>
                                            Create a project for{' '}
                                            {selected.customer_name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSaleModalOpen(false)}
                                    aria-label="Close sale modal"
                                >
                                    <X />
                                </button>
                            </header>

                            <form
                                className="lead-sale-modal__form"
                                onSubmit={acceptSale}
                            >
                                <div className="lead-sale-modal__summary">
                                    <span>Assigned salesman</span>
                                    <strong>
                                        {[
                                            selected.salesman_one
                                                ?.salesman_name,
                                            selected.salesman_two
                                                ?.salesman_name,
                                        ]
                                            .filter(Boolean)
                                            .join(' & ')}
                                    </strong>
                                </div>

                                <label>
                                    <span>Sale amount</span>
                                    <div className="lead-sale-modal__amount">
                                        <strong>$</strong>
                                        <input
                                            type="number"
                                            min="0.01"
                                            max="9999999999.99"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={saleForm.data.amount}
                                            onChange={(event) =>
                                                saleForm.setData(
                                                    'amount',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                    {saleForm.errors.amount && (
                                        <small>{saleForm.errors.amount}</small>
                                    )}
                                    {saleForm.errors.salesman && (
                                        <small>
                                            {saleForm.errors.salesman}
                                        </small>
                                    )}
                                </label>

                                <div className="lead-sale-modal__actions">
                                    <button
                                        type="button"
                                        onClick={() => setSaleModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            saleForm.processing ||
                                            !saleForm.data.amount
                                        }
                                    >
                                        <CircleDollarSign />
                                        {saleForm.processing
                                            ? 'Creating project…'
                                            : 'Accept sale'}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}

                {historyType && selected && (
                    <div
                        className="lead-note-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lead-note-history-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setHistoryType(null);
                            }
                        }}
                    >
                        <section className="lead-note-modal__card">
                            <header>
                                <div>
                                    <span>
                                        <History />
                                    </span>
                                    <div>
                                        <h2 id="lead-note-history-title">
                                            {historyType === 'all'
                                                ? 'Lead note history'
                                                : historyType === 'confirmation'
                                                  ? 'Confirmation note history'
                                                  : historyType === 'dispatch'
                                                    ? 'Dispatch note history'
                                                    : historyType ===
                                                        'appointment_result'
                                                      ? 'Appointment result note history'
                                                      : 'Telemarketer note history'}
                                        </h2>
                                        <p>
                                            {selected.customer_name} · Lead #
                                            {selected.id}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setHistoryType(null)}
                                    aria-label="Close note history"
                                >
                                    <X />
                                </button>
                            </header>
                            <div className="lead-note-history">
                                {displayedHistory.map((note) => (
                                    <article key={note.id}>
                                        <div>
                                            <strong>
                                                {note.creator?.username ??
                                                    'Unknown user'}
                                            </strong>
                                            <time>
                                                {formatDate(note.created_at)}
                                            </time>
                                        </div>
                                        <p>{note.body}</p>
                                    </article>
                                ))}
                                {displayedHistory.length === 0 && (
                                    <div className="lead-note-history__empty">
                                        <History />
                                        <strong>No note history yet</strong>
                                        <span>
                                            Saved notes will appear here.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
