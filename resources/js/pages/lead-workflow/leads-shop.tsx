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
    Headphones,
    Mail,
    MapPin,
    Maximize2,
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
import { useEffect, useMemo, useState } from 'react';
import '@/../css/leads-shop.css';
import { RingCentralCallButton } from '@/components/ringcentral-call-button';
import { useSystemModal } from '@/components/system-modal-provider';
import { zillowSearchUrl } from '@/lib/address-search';
import {
    appointmentInputValue,
    formatAppointmentDate,
} from '@/lib/appointment-date';

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
    appointment_at: string | null;
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
    agent_assignments?: LeadAgentAssignment[];
    salesman_one: { salesman_id: number; salesman_name: string } | null;
    salesman_two: { salesman_id: number; salesman_name: string } | null;
    notes: LeadNote[];
    movements?: LeadMovement[];
    ring_central_calls?: RingCentralCall[];
};

type RingCentralCall = {
    id: number;
    phone_number: string;
    result: string | null;
    duration_seconds: number;
    initiated_at: string;
    started_at: string | null;
    recording_path: string | null;
    caller: { acc_id: number; username: string } | null;
};

type LeadNote = {
    id: number;
    note_type: string;
    body: string;
    created_at: string;
    creator: { acc_id: number; username: string } | null;
};

type LeadMovement = {
    id: number;
    from_status: string | null;
    to_status: string;
    created_at: string;
    mover: { acc_id: number; username: string } | null;
};

type LeadAgentAssignment = {
    id: number;
    is_original: boolean;
    created_at: string;
    agent: { agent_id: number; agent_name: string } | null;
    assigner: { acc_id: number; username: string } | null;
};

type SmsTemplateField =
    | 'heading'
    | 'customer'
    | 'address'
    | 'phones'
    | 'email'
    | 'project'
    | 'confirmation'
    | 'appointment';

type EditableNoteType =
    | 'telemarketer'
    | 'confirmation'
    | 'dispatch'
    | 'appointment_result';

const latestNoteBody = (lead: Lead | null, noteType: string): string => {
    if (!lead) return '';

    const latest = [...lead.notes]
        .filter((note) => note.note_type === noteType)
        .sort((a, b) => b.id - a.id)[0];

    if (latest) return latest.body;

    return noteType === 'telemarketer' ? (lead.telemarketer_notes ?? '') : '';
};

export type CompanyOption = { com_id: number; company: string };
export type ProductOption = { prod_id: number; product_name: string };
export type AgentOption = { agent_id: number; agent_name: string };
export type SalesmanOption = { salesman_id: number; salesman_name: string };

export type LeadsShopProps = {
    leads: Lead[];
    companies: CompanyOption[];
    products: ProductOption[];
    cities: string[];
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
    appointment_result: '',
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

const workflowLocation = (status: string | null) => {
    const locations: Record<string, string> = {
        fresh: 'Leads Shop / Freshly In',
        raw: 'Leads Shop / Raw',
        cb: 'Leads Shop / Call Back',
        naov: 'Leads Shop / NAOV',
        toss: 'Leads Shop / TOSS',
        confirmed: 'Confirm Leads',
        dispatched: 'Dispatch Leads',
        reschedule: 'Reschedule',
        rehash: 'Rehash',
        rehash_ng: 'Rehash / NG',
        rehash_toss: 'Rehash / TOSS',
        rehash_cb: 'Rehash / Call Back',
        '555': '555',
        kit: 'Keep in Touch',
        kit_ng: 'Keep in Touch / NG',
        kit_toss: 'Keep in Touch / TOSS',
        kit_cb: 'Keep in Touch / Call Back',
        la: 'LA',
        his: 'HIS',
        project: 'Projects',
    };

    return status
        ? (locations[status] ?? status.replaceAll('_', ' '))
        : 'New lead';
};

const historyNoteLabel = (type: string) => {
    const labels: Record<string, string> = {
        telemarketer: 'Telemarketer note',
        confirmation: 'Confirmation note',
        dispatch: 'Dispatch note',
        appointment_result: 'Appointment result',
        salesman_sent: 'Salesman Sent',
        salesman_assignment: 'Salesman assignment',
        agent_reassigned: 'Agent reassigned',
    };

    return labels[type] ?? 'Lead note';
};

const calendarDateKey = (value: string | null | undefined) => {
    if (!value) return null;

    const datePart = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

    if (datePart) return datePart;

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
        ? null
        : parsed.toLocaleDateString('en-CA');
};

const deviceDateKey = (value: string | null | undefined) => {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isInstantAppointment = (lead: Lead) => {
    const createdDate = deviceDateKey(lead.created_at);
    const appointmentDate = deviceDateKey(lead.appointment_at);

    return Boolean(
        createdDate && appointmentDate && createdDate === appointmentDate,
    );
};

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
                <article className="lead-detail-card lead-detail-card--notes lead-note-card--telemarketer">
                    <h3>Telemarketer notes</h3>
                    <p>—</p>
                </article>
                <article className="lead-detail-card lead-detail-card--notes lead-note-card--confirmation">
                    <h3>Confirmation notes</h3>
                    <p>—</p>
                </article>
                {showsDispatchNotes && (
                    <article className="lead-detail-card lead-detail-card--notes lead-note-card--dispatch">
                        <h3>Dispatch notes</h3>
                        <p>Select a lead to view or add dispatch notes.</p>
                    </article>
                )}
                {queueStatus === 'dispatched' && (
                    <article className="lead-detail-card lead-detail-card--notes lead-note-card--appointment-result">
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
    cities,
    agents,
    salesmen = [],
    queue,
}: LeadsShopProps) {
    const requestedLeadId =
        Number(new URLSearchParams(window.location.search).get('lead')) || null;
    const requestedLead =
        leads.find((lead) => lead.id === requestedLeadId) ?? null;
    const requestedTelemarketerNote = latestNoteBody(
        requestedLead,
        'telemarketer',
    );
    const requestedConfirmationNote = latestNoteBody(
        requestedLead,
        'confirmation',
    );
    const requestedDispatchNote = latestNoteBody(requestedLead, 'dispatch');
    const requestedAppointmentResultNote = latestNoteBody(
        requestedLead,
        'appointment_result',
    );
    const { notify } = useSystemModal();
    const [search, setSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState(
        requestedLead?.status ?? queue?.status ?? 'fresh',
    );
    const [companyFilter, setCompanyFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState('all');
    const [productFilter, setProductFilter] = useState('all');
    const [agentFilter, setAgentFilter] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(
        requestedLeadId,
    );
    const [appointmentResultDraft, setAppointmentResultDraft] = useState('');
    const [salesmanOneDraft, setSalesmanOneDraft] = useState('');
    const [salesmanTwoDraft, setSalesmanTwoDraft] = useState('');
    const [savingAssignment, setSavingAssignment] = useState<
        'appointment' | 'salesman_1' | 'salesman_2' | null
    >(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [smsTemplateOpen, setSmsTemplateOpen] = useState(false);
    const [smsTemplateFields, setSmsTemplateFields] = useState<
        SmsTemplateField[]
    >([]);
    const [recordingsOpen, setRecordingsOpen] = useState(false);
    const [newCallAttempts, setNewCallAttempts] = useState<
        Record<number, number>
    >({});
    const [historyType, setHistoryType] = useState<
        | 'telemarketer'
        | 'confirmation'
        | 'dispatch'
        | 'appointment_result'
        | 'all'
        | null
    >(null);
    const [expandedNoteType, setExpandedNoteType] =
        useState<EditableNoteType | null>(null);
    const form = useForm(emptyLeadForm);

    useEffect(() => {
        const handleTrackedCall = (event: Event) => {
            const leadId = (event as CustomEvent<{ leadId?: number }>).detail
                ?.leadId;
            if (!leadId) return;
            setNewCallAttempts((current) => ({
                ...current,
                [leadId]: (current[leadId] ?? 0) + 1,
            }));
        };

        window.addEventListener(
            'weiss:ringcentral-call-tracked',
            handleTrackedCall,
        );
        return () =>
            window.removeEventListener(
                'weiss:ringcentral-call-tracked',
                handleTrackedCall,
            );
    }, []);
    const telemarketerNoteForm = useForm({
        note_type: 'telemarketer',
        body: requestedTelemarketerNote,
    });
    const [loadedTelemarketerNote, setLoadedTelemarketerNote] = useState(
        requestedTelemarketerNote,
    );
    const confirmationNoteForm = useForm({
        note_type: 'confirmation',
        body: requestedConfirmationNote,
    });
    const [loadedConfirmationNote, setLoadedConfirmationNote] = useState(
        requestedConfirmationNote,
    );
    const dispatchNoteForm = useForm({
        note_type: 'dispatch',
        body: requestedDispatchNote,
    });
    const [loadedDispatchNote, setLoadedDispatchNote] = useState(
        requestedDispatchNote,
    );
    const appointmentResultNoteForm = useForm({
        note_type: 'appointment_result',
        body: requestedAppointmentResultNote,
    });
    const [loadedAppointmentResultNote, setLoadedAppointmentResultNote] =
        useState(requestedAppointmentResultNote);
    const saleForm = useForm<{ amount: string; salesman?: string }>({
        amount: '',
    });

    useEffect(() => {
        let refreshing = false;

        const refreshLeads = () => {
            if (
                refreshing ||
                document.hidden ||
                isEditing ||
                saleModalOpen ||
                form.processing ||
                telemarketerNoteForm.processing ||
                confirmationNoteForm.processing ||
                dispatchNoteForm.processing ||
                appointmentResultNoteForm.processing ||
                saleForm.processing
            ) {
                return;
            }

            refreshing = true;
            router.reload({
                only: ['leads'],
                showProgress: false,
                onFinish: () => {
                    refreshing = false;
                },
            });
        };

        const interval = window.setInterval(refreshLeads, 5000);
        const refreshWhenVisible = () => {
            if (!document.hidden) {
                refreshLeads();
            }
        };

        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener(
                'visibilitychange',
                refreshWhenVisible,
            );
        };
    }, [
        appointmentResultNoteForm.processing,
        confirmationNoteForm.processing,
        dispatchNoteForm.processing,
        form.processing,
        isEditing,
        saleForm.processing,
        saleModalOpen,
        telemarketerNoteForm.processing,
    ]);

    const availableDateRows = useMemo(() => {
        const counts = new Map<string, number>();
        leads.forEach((lead) => {
            const key = calendarDateKey(lead[queue?.dateField ?? 'created_at']);
            if (!key) return;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        if (queue?.dateField === 'appointment_at') {
            return [...counts.entries()]
                .sort(([first], [second]) => first.localeCompare(second))
                .map(([key, count]) => {
                    const date = new Date(`${key}T12:00:00`);

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
                        count,
                    };
                });
        }

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
        }).filter((day) => day.count > 0);
    }, [leads, queue?.dateField]);

    const filterOptions = useMemo(
        () => ({
            companies: companies.map(
                (company) =>
                    [String(company.com_id), company.company] as [
                        string,
                        string,
                    ],
            ),
            sources: Array.from(
                new Set(leads.map((lead) => lead.source)),
            ).sort(),
            cities,
            products: products.map(
                (product) =>
                    [String(product.prod_id), product.product_name] as [
                        string,
                        string,
                    ],
            ),
            agents: Array.from(
                new Map(
                    leads.flatMap((lead) => [
                        ...(lead.agent
                            ? [
                                  [
                                      String(lead.agent.agent_id),
                                      lead.agent.agent_name,
                                  ] as [string, string],
                              ]
                            : []),
                        ...(lead.agent_assignments ?? []).flatMap(
                            (assignment) =>
                                assignment.agent
                                    ? [
                                          [
                                              String(assignment.agent.agent_id),
                                              assignment.agent.agent_name,
                                          ] as [string, string],
                                      ]
                                    : [],
                        ),
                    ]),
                ),
            ).sort((a, b) => a[1].localeCompare(b[1])),
            hasUnassignedAgents: leads.some((lead) => !lead.agent),
        }),
        [cities, companies, leads, products],
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
        const todayInDeviceTimezone = deviceDateKey(
            new Date().toISOString(),
        );

        return leads
            .filter((lead) => {
                const matchesDate =
                    selectedDate === 'all' ||
                    calendarDateKey(lead[queue?.dateField ?? 'created_at']) ===
                        selectedDate;
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

                const matchesStatus =
                    (lead.status || 'fresh') === selectedStatus;
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
                const matchesAgent =
                    agentFilter === 'all' ||
                    (agentFilter === 'unassigned'
                        ? !lead.agent
                        : String(lead.agent?.agent_id) === agentFilter ||
                          (lead.agent_assignments ?? []).some(
                              (assignment) =>
                                  String(assignment.agent?.agent_id) ===
                                  agentFilter,
                          ));

                return (
                    matchesDate &&
                    matchesSearch &&
                    matchesStatus &&
                    matchesCompany &&
                    matchesSource &&
                    matchesCity &&
                    matchesProduct &&
                    matchesAgent
                );
            })
            .sort((first, second) => {
                const firstIsToday =
                    deviceDateKey(first.appointment_at) ===
                    todayInDeviceTimezone;
                const secondIsToday =
                    deviceDateKey(second.appointment_at) ===
                    todayInDeviceTimezone;

                if (firstIsToday !== secondIsToday) {
                    return firstIsToday ? -1 : 1;
                }

                const dateField = queue?.dateField ?? 'created_at';
                const firstTime = first[dateField]
                    ? new Date(first[dateField] as string).getTime()
                    : 0;
                const secondTime = second[dateField]
                    ? new Date(second[dateField] as string).getTime()
                    : 0;
                const dateDifference =
                    (Number.isNaN(secondTime) ? 0 : secondTime) -
                    (Number.isNaN(firstTime) ? 0 : firstTime);

                return dateDifference || second.id - first.id;
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
        agentFilter,
        queue?.dateField,
    ]);

    const clearListFilters = () => {
        setSearch('');
        setSelectedDate('all');
        setSelectedStatus(queue?.status ?? 'fresh');
        setCompanyFilter('all');
        setSourceFilter('all');
        setCityFilter('all');
        setProductFilter('all');
        setAgentFilter('all');
        setIsRefreshing(true);

        router.reload({
            only: ['leads'],
            showProgress: false,
            onFinish: () => setIsRefreshing(false),
        });
    };

    const selected = leads.find((lead) => lead.id === selectedId) ?? null;

    const smsTemplateSections = useMemo(() => {
        if (!selected) return [];

        const appointment = selected.appointment_at
            ? new Date(selected.appointment_at)
            : null;
        const validAppointment =
            appointment && !Number.isNaN(appointment.getTime())
                ? appointment
                : null;
        const appointmentEnd = validAppointment
            ? new Date(validAppointment.getTime() + 60 * 60 * 1000)
            : null;
        const time = (date: Date) =>
            date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
        const shortDate = (date: Date) =>
            date.toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
            });
        const setDate = new Date(selected.created_at);
        const agentNames = [
            selected.agent?.agent_name,
            selected.second_agent?.agent_name,
        ].filter(Boolean);
        const salesmanNames = [
            selected.salesman_one?.salesman_name,
            selected.salesman_two?.salesman_name,
        ].filter(Boolean);
        const address = [
            selected.address,
            [selected.city, selected.state].filter(Boolean).join(', '),
            selected.zip_code,
        ]
            .filter(Boolean)
            .join(' ');
        const phones = [
            selected.primary_number,
            selected.secondary_number,
            selected.mobile_number,
        ].filter(Boolean);
        const confirmation =
            latestNoteBody(selected, 'confirmation') ||
            selected.confirmation_notes ||
            '';
        const project = [
            selected.product?.product_name,
            latestNoteBody(selected, 'telemarketer') ||
                selected.telemarketer_notes,
        ]
            .filter(Boolean)
            .join(' – ');
        const assignment =
            validAppointment &&
            !Number.isNaN(setDate.getTime()) &&
            (agentNames.length > 0 || salesmanNames.length > 0)
                ? `${agentNames.join(' & ') || 'Agent'} – ${salesmanNames.join(' & ') || 'Salesman'}: Set ${shortDate(setDate)} (${setDate.toLocaleDateString('en-US', { weekday: 'long' })}), ${time(validAppointment)}–${appointmentEnd ? time(appointmentEnd) : ''}.`
                : '';

        return [
            {
                key: 'heading' as const,
                label: 'Confirmed lead heading',
                value: validAppointment
                    ? `CONFIRMED LEAD ${time(validAppointment)}`
                    : 'CONFIRMED LEAD',
            },
            {
                key: 'customer' as const,
                label: 'Customer name',
                value: selected.customer_name?.toUpperCase() ?? '',
            },
            { key: 'address' as const, label: 'Address', value: address },
            {
                key: 'phones' as const,
                label: 'Phone numbers',
                value: phones.join('\n'),
            },
            {
                key: 'email' as const,
                label: 'Email',
                value: selected.email ?? '',
            },
            {
                key: 'project' as const,
                label: 'Project and telemarketer notes',
                value: project,
            },
            {
                key: 'confirmation' as const,
                label: 'Confirmation note',
                value: confirmation,
            },
            {
                key: 'appointment' as const,
                label: 'Agent, salesman, and appointment',
                value: assignment,
            },
        ].filter((section) => section.value.trim() !== '');
    }, [selected]);

    const smsTemplateText = useMemo(
        () =>
            smsTemplateSections
                .filter((section) =>
                    smsTemplateFields.includes(section.key),
                )
                .map((section) => section.value.trim())
                .join('\n\n'),
        [smsTemplateFields, smsTemplateSections],
    );

    const openSmsTemplate = () => {
        setSmsTemplateFields(
            smsTemplateSections.map((section) => section.key),
        );
        setSmsTemplateOpen(true);
    };

    const copySmsTemplate = async () => {
        if (!smsTemplateText) return;

        try {
            await navigator.clipboard.writeText(smsTemplateText);
            setSmsTemplateOpen(false);
            notify({
                title: 'Lead message copied',
                message:
                    'The selected lead information is ready to paste into SMS.',
                tone: 'success',
            });
        } catch {
            notify({
                title: 'Could not copy message',
                message:
                    'Your browser blocked clipboard access. Select and copy the preview manually.',
                tone: 'warning',
            });
        }
    };

    const selectLead = (lead: Lead) => {
        const latestTelemarketerNote = latestNoteBody(lead, 'telemarketer');
        const latestConfirmationNote = latestNoteBody(lead, 'confirmation');
        const latestDispatchNote = latestNoteBody(lead, 'dispatch');
        const latestAppointmentResultNote = latestNoteBody(
            lead,
            'appointment_result',
        );
        setSelectedId(lead.id);
        setAppointmentResultDraft(lead.appointment_result ?? '');
        setSalesmanOneDraft(String(lead.salesman_one?.salesman_id ?? ''));
        setSalesmanTwoDraft(String(lead.salesman_two?.salesman_id ?? ''));
        setIsEditing(false);
        setHistoryType(null);
        setRecordingsOpen(false);
        telemarketerNoteForm.setData('body', latestTelemarketerNote);
        setLoadedTelemarketerNote(latestTelemarketerNote);
        telemarketerNoteForm.clearErrors();
        confirmationNoteForm.setData('body', latestConfirmationNote);
        setLoadedConfirmationNote(latestConfirmationNote);
        confirmationNoteForm.clearErrors();
        dispatchNoteForm.setData('body', latestDispatchNote);
        setLoadedDispatchNote(latestDispatchNote);
        dispatchNoteForm.clearErrors();
        appointmentResultNoteForm.setData('body', latestAppointmentResultNote);
        setLoadedAppointmentResultNote(latestAppointmentResultNote);
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
            appointment_at: appointmentInputValue(lead.appointment_at ?? ''),
            appointment_result: lead.appointment_result ?? '',
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
            onSuccess: () => {
                setAppointmentResultDraft(form.data.appointment_result);
                setSalesmanOneDraft(form.data.salesman_1_id);
                setSalesmanTwoDraft(form.data.salesman_2_id);
                setIsEditing(false);
                router.flushAll();
            },
        });
    };

    const saveTelemarketerNote = () => {
        const body = telemarketerNoteForm.data.body.trim();
        if (!selected || !body || body === loadedTelemarketerNote.trim()) {
            return;
        }

        telemarketerNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    telemarketerNoteForm.setData('body', body);
                    setLoadedTelemarketerNote(body);
                },
            },
        );
    };

    const saveConfirmationNote = () => {
        const body = confirmationNoteForm.data.body.trim();
        if (!selected || !body || body === loadedConfirmationNote.trim()) {
            return;
        }

        confirmationNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    confirmationNoteForm.setData('body', body);
                    setLoadedConfirmationNote(body);
                },
            },
        );
    };

    const saveDispatchNote = () => {
        const body = dispatchNoteForm.data.body.trim();
        if (!selected || !body || body === loadedDispatchNote.trim()) {
            return;
        }

        dispatchNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    dispatchNoteForm.setData('body', body);
                    setLoadedDispatchNote(body);
                },
            },
        );
    };

    const saveAppointmentResultNote = () => {
        const body = appointmentResultNoteForm.data.body.trim();
        if (!selected || !body || body === loadedAppointmentResultNote.trim()) {
            return;
        }

        appointmentResultNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    appointmentResultNoteForm.setData('body', body);
                    setLoadedAppointmentResultNote(body);
                },
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

    const saveSalesman = (field: 'salesman_1_id' | 'salesman_2_id') => {
        if (!selected) {
            return;
        }

        setSavingAssignment(
            field === 'salesman_1_id' ? 'salesman_1' : 'salesman_2',
        );

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/salesmen`,
            {
                salesman_1_id: salesmanOneDraft || null,
                salesman_2_id: salesmanTwoDraft || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
                onFinish: () => setSavingAssignment(null),
            },
        );
    };

    const saveAppointmentResult = () => {
        if (!selected) {
            return;
        }

        setSavingAssignment('appointment');

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/appointment-result`,
            { appointment_result: appointmentResultDraft || null },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
                onFinish: () => setSavingAssignment(null),
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
    const expandedNote = expandedNoteType
        ? {
              telemarketer: {
                  title: 'Telemarketer notes',
                  value: telemarketerNoteForm.data.body,
                  setValue: (value: string) =>
                      telemarketerNoteForm.setData('body', value),
                  save: saveTelemarketerNote,
                  processing: telemarketerNoteForm.processing,
                  unchanged:
                      telemarketerNoteForm.data.body.trim() ===
                      loadedTelemarketerNote.trim(),
                  error: telemarketerNoteForm.errors.body,
              },
              confirmation: {
                  title: 'Confirmation notes',
                  value: confirmationNoteForm.data.body,
                  setValue: (value: string) =>
                      confirmationNoteForm.setData('body', value),
                  save: saveConfirmationNote,
                  processing: confirmationNoteForm.processing,
                  unchanged:
                      confirmationNoteForm.data.body.trim() ===
                      loadedConfirmationNote.trim(),
                  error: confirmationNoteForm.errors.body,
              },
              dispatch: {
                  title: 'Dispatch notes',
                  value: dispatchNoteForm.data.body,
                  setValue: (value: string) =>
                      dispatchNoteForm.setData('body', value),
                  save: saveDispatchNote,
                  processing: dispatchNoteForm.processing,
                  unchanged:
                      dispatchNoteForm.data.body.trim() ===
                      loadedDispatchNote.trim(),
                  error: dispatchNoteForm.errors.body,
              },
              appointment_result: {
                  title: 'Appointment result notes',
                  value: appointmentResultNoteForm.data.body,
                  setValue: (value: string) =>
                      appointmentResultNoteForm.setData('body', value),
                  save: saveAppointmentResultNote,
                  processing: appointmentResultNoteForm.processing,
                  unchanged:
                      appointmentResultNoteForm.data.body.trim() ===
                      loadedAppointmentResultNote.trim(),
                  error: appointmentResultNoteForm.errors.body,
              },
          }[expandedNoteType]
        : null;
    const displayedHistory =
        historyType === 'all'
            ? (selected?.notes ?? [])
            : (selected?.notes.filter(
                  (note) => note.note_type === historyType,
              ) ?? []);
    const displayedTimeline = useMemo(() => {
        if (historyType !== 'all' || !selected) {
            return displayedHistory.map((note) => ({
                kind: 'note' as const,
                id: note.id,
                created_at: note.created_at,
                note,
            }));
        }

        return (selected.movements ?? [])
            .map((movement) => ({
                kind: 'movement' as const,
                id: movement.id,
                created_at: movement.created_at,
                movement,
            }))
            .sort(
                (first, second) =>
                    new Date(second.created_at).getTime() -
                    new Date(first.created_at).getTime(),
            );
    }, [displayedHistory, historyType, selected]);

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
        ['history', 'History', History, 'history'],
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
                            {availableDateRows.map((day) => (
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
                            {availableDateRows.length === 0 && (
                                <div className="lead-dates__empty">
                                    {queue?.dateField === 'appointment_at'
                                        ? 'No appointment dates in this queue.'
                                        : 'No leads in the last 30 days.'}
                                </div>
                            )}
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
                                    className={`lead-filter-reset${isRefreshing ? 'lead-filter-reset--loading' : ''}`}
                                    onClick={clearListFilters}
                                    disabled={isRefreshing}
                                    aria-label="Refresh leads and reset filters"
                                    title="Refresh leads and reset filters"
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
                                <label>
                                    <UserRound />
                                    <select
                                        value={agentFilter}
                                        onChange={(event) =>
                                            setAgentFilter(event.target.value)
                                        }
                                    >
                                        <option value="all">All agents</option>
                                        {filterOptions.hasUnassignedAgents && (
                                            <option value="unassigned">
                                                Unassigned
                                            </option>
                                        )}
                                        {filterOptions.agents.map(
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
                                {(queue?.dateField ?? 'appointment_at') === 'appointment_at'
                                    ? 'Appointment'
                                    : 'Created'}
                            </span>
                            <span className="lead-browser__attempts-heading">
                                Attempts
                            </span>
                        </div>
                        <div className="lead-browser__list">
                            {filteredLeads.map((lead) => (
                                <button
                                    type="button"
                                    key={lead.id}
                                    className={[
                                        'lead-browser-row',
                                        selectedId === lead.id
                                            ? 'lead-browser-row--active'
                                            : '',
                                        isInstantAppointment(lead)
                                            ? 'lead-browser-row--instant'
                                            : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    onClick={() => selectLead(lead)}
                                >
                                    <span>
                                        <span className="lead-browser-row__name">
                                            <strong>
                                                {lead.customer_name}
                                            </strong>
                                            {isInstantAppointment(lead) && (
                                                <span className="lead-browser-row__instant-badge">
                                                    Instant
                                                </span>
                                            )}
                                        </span>
                                        <small>
                                            {lead.product?.product_name ??
                                                'No product'}
                                        </small>
                                    </span>
                                    <span>{lead.city}</span>
                                    <span>
                                        {(queue?.dateField ?? 'appointment_at') === 'appointment_at'
                                            ? lead.appointment_at
                                                ? formatAppointmentDate(
                                                      lead.appointment_at,
                                                  )
                                                : 'No appointment'
                                            : formatDate(lead.created_at)}
                                    </span>
                                    <span className="lead-browser-row__attempts">
                                        {(lead.ring_central_calls?.length ??
                                            0) +
                                            (newCallAttempts[lead.id] ?? 0)}
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
                                            <button
                                                type="button"
                                                className="lead-address-action lead-address-action--recordings"
                                                onClick={() =>
                                                    setRecordingsOpen(true)
                                                }
                                            >
                                                <Headphones />
                                                <span>
                                                    Call attempts{' '}
                                                    {(selected
                                                        .ring_central_calls
                                                        ?.length ?? 0) +
                                                        (newCallAttempts[
                                                            selected.id
                                                        ] ?? 0)}
                                                </span>
                                            </button>
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
                                                        leadId={selected.id}
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
                                                        leadId={selected.id}
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
                                                        leadId={selected.id}
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
                                        {[
                                            'dispatched',
                                            'rehash',
                                            '555',
                                            'his',
                                            'kit',
                                        ].includes(queue?.status ?? '') && (
                                            <label>
                                                <span>Appointment result</span>
                                                <select
                                                    value={
                                                        form.data
                                                            .appointment_result
                                                    }
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'appointment_result',
                                                            event.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select result
                                                    </option>
                                                    <option value="PNS">
                                                        PNS
                                                    </option>
                                                    <option value="PNS No Rehash">
                                                        PNS No Rehash
                                                    </option>
                                                    <option value="2 ND Meeting">
                                                        2 ND Meeting
                                                    </option>
                                                    <option value="Salesman Sent">
                                                        Salesman Sent
                                                    </option>
                                                    <option value="Sold and Cancel">
                                                        Sold and Cancel
                                                    </option>
                                                </select>
                                                {form.errors
                                                    .appointment_result && (
                                                    <em>
                                                        {
                                                            form.errors
                                                                .appointment_result
                                                        }
                                                    </em>
                                                )}
                                            </label>
                                        )}
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
                                            <span>
                                                Original agent / reassign
                                            </span>
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
                                                                leadId={
                                                                    selected.id
                                                                }
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
                                                                leadId={
                                                                    selected.id
                                                                }
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
                                                                leadId={
                                                                    selected.id
                                                                }
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
                                                            {selected.appointment_at
                                                                ? formatAppointmentDate(
                                                                      selected.appointment_at,
                                                                  )
                                                                : 'Not scheduled'}
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
                                                            Original agent
                                                        </small>
                                                        <strong>
                                                            {selected.agent
                                                                ?.agent_name ??
                                                                '—'}
                                                        </strong>
                                                    </span>
                                                </div>
                                                <div>
                                                    <UserRound />
                                                    <span>
                                                        <small>
                                                            Assign another agent
                                                        </small>
                                                        <select
                                                            className="lead-inline-assignment"
                                                            value=""
                                                            onChange={(event) =>
                                                                assignSecondAgent(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Select agent
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
                                                {(
                                                    selected.agent_assignments ??
                                                    []
                                                )
                                                    .filter(
                                                        (assignment) =>
                                                            !assignment.is_original,
                                                    )
                                                    .map(
                                                        (assignment, index) => (
                                                            <div
                                                                key={
                                                                    assignment.id
                                                                }
                                                            >
                                                                <UserRound />
                                                                <span>
                                                                    <small>
                                                                        Agent{' '}
                                                                        {index +
                                                                            2}
                                                                    </small>
                                                                    <strong>
                                                                        {assignment
                                                                            .agent
                                                                            ?.agent_name ??
                                                                            'Unknown'}
                                                                    </strong>
                                                                    <small>
                                                                        {assignment
                                                                            .assigner
                                                                            ?.username ??
                                                                            'System'}{' '}
                                                                        ·{' '}
                                                                        {formatDate(
                                                                            assignment.created_at,
                                                                        )}
                                                                    </small>
                                                                </span>
                                                            </div>
                                                        ),
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
                                                        {[
                                                            'dispatched',
                                                            'kit',
                                                        ].includes(
                                                            queue?.status ?? '',
                                                        ) && (
                                                            <div>
                                                                <CalendarClock />
                                                                <span>
                                                                    <small>
                                                                        Appointment
                                                                        result
                                                                    </small>
                                                                    <div className="lead-inline-save-field">
                                                                        <select
                                                                            className="lead-inline-assignment"
                                                                            value={
                                                                                appointmentResultDraft
                                                                            }
                                                                            onChange={(
                                                                                event,
                                                                            ) =>
                                                                                setAppointmentResultDraft(
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
                                                                                2
                                                                                ND
                                                                                Meeting
                                                                            </option>
                                                                            <option value="Salesman Sent">
                                                                                Salesman
                                                                                Sent
                                                                            </option>
                                                                            <option value="Sold and Cancel">
                                                                                Sold
                                                                                and
                                                                                Cancel
                                                                            </option>
                                                                        </select>
                                                                        <button
                                                                            type="button"
                                                                            className="lead-inline-save"
                                                                            onClick={
                                                                                saveAppointmentResult
                                                                            }
                                                                            disabled={
                                                                                savingAssignment !==
                                                                                    null ||
                                                                                appointmentResultDraft ===
                                                                                    (selected.appointment_result ??
                                                                                        '')
                                                                            }
                                                                            aria-label="Save appointment result"
                                                                            title="Save appointment result"
                                                                        >
                                                                            <Save />
                                                                        </button>
                                                                    </div>
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <UserRound />
                                                            <span>
                                                                <small>
                                                                    Salesman 1
                                                                </small>
                                                                <div className="lead-inline-save-field">
                                                                    <select
                                                                        className="lead-inline-assignment"
                                                                        value={
                                                                            salesmanOneDraft
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            setSalesmanOneDraft(
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
                                                                                        salesmanTwoDraft ===
                                                                                        String(
                                                                                            salesman.salesman_id,
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        salesman.salesman_name
                                                                                    }
                                                                                </option>
                                                                            ),
                                                                        )}
                                                                    </select>
                                                                    <button
                                                                        type="button"
                                                                        className="lead-inline-save"
                                                                        onClick={() =>
                                                                            saveSalesman(
                                                                                'salesman_1_id',
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            savingAssignment !==
                                                                                null ||
                                                                            salesmanOneDraft ===
                                                                                String(
                                                                                    selected
                                                                                        .salesman_one
                                                                                        ?.salesman_id ??
                                                                                        '',
                                                                                )
                                                                        }
                                                                        aria-label="Save salesman 1"
                                                                        title="Save salesman 1"
                                                                    >
                                                                        <Save />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="lead-inline-save lead-inline-sms"
                                                                        onClick={
                                                                            openSmsTemplate
                                                                        }
                                                                        aria-label="Create SMS copy for this lead"
                                                                        title="Select lead details to copy"
                                                                    >
                                                                        <MessageCircle />
                                                                    </button>
                                                                </div>
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <UserRound />
                                                            <span>
                                                                <small>
                                                                    Salesman 2
                                                                </small>
                                                                <div className="lead-inline-save-field">
                                                                    <select
                                                                        className="lead-inline-assignment"
                                                                        value={
                                                                            salesmanTwoDraft
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            setSalesmanTwoDraft(
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
                                                                                        salesmanOneDraft ===
                                                                                        String(
                                                                                            salesman.salesman_id,
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        salesman.salesman_name
                                                                                    }
                                                                                </option>
                                                                            ),
                                                                        )}
                                                                    </select>
                                                                    <button
                                                                        type="button"
                                                                        className="lead-inline-save"
                                                                        onClick={() =>
                                                                            saveSalesman(
                                                                                'salesman_2_id',
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            savingAssignment !==
                                                                                null ||
                                                                            salesmanTwoDraft ===
                                                                                String(
                                                                                    selected
                                                                                        .salesman_two
                                                                                        ?.salesman_id ??
                                                                                        '',
                                                                                )
                                                                        }
                                                                        aria-label="Save salesman 2"
                                                                        title="Save salesman 2"
                                                                    >
                                                                        <Save />
                                                                    </button>
                                                                </div>
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

                                        <article className="lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--telemarketer">
                                            <div className="lead-note-heading">
                                                <h3>Telemarketer notes</h3>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedNoteType(
                                                            'telemarketer',
                                                        )
                                                    }
                                                    title="Open large note editor"
                                                >
                                                    <Maximize2 /> Expand
                                                </button>
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
                                                        !telemarketerNoteForm.data.body.trim() ||
                                                        telemarketerNoteForm.data.body.trim() ===
                                                            loadedTelemarketerNote.trim()
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
                                        <article className="lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--confirmation">
                                            <div className="lead-note-heading">
                                                <h3>Confirmation notes</h3>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedNoteType(
                                                            'confirmation',
                                                        )
                                                    }
                                                    title="Open large note editor"
                                                >
                                                    <Maximize2 /> Expand
                                                </button>
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
                                                        !confirmationNoteForm.data.body.trim() ||
                                                        confirmationNoteForm.data.body.trim() ===
                                                            loadedConfirmationNote.trim()
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
                                                <article className="lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--dispatch">
                                                    <div className="lead-note-heading">
                                                        <h3>Dispatch notes</h3>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedNoteType(
                                                                    'dispatch',
                                                                )
                                                            }
                                                            title="Open large note editor"
                                                        >
                                                            <Maximize2 /> Expand
                                                        </button>
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
                                                                !dispatchNoteForm.data.body.trim() ||
                                                                dispatchNoteForm.data.body.trim() ===
                                                                    loadedDispatchNote.trim()
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
                                                    <article className="lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--appointment-result">
                                                        <div className="lead-note-heading">
                                                            <h3>
                                                                Appointment
                                                                result notes
                                                            </h3>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setExpandedNoteType(
                                                                        'appointment_result',
                                                                    )
                                                                }
                                                                title="Open large note editor"
                                                            >
                                                                <Maximize2 />{' '}
                                                                Expand
                                                            </button>
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
                                                                    !appointmentResultNoteForm.data.body.trim() ||
                                                                    appointmentResultNoteForm.data.body.trim() ===
                                                                        loadedAppointmentResultNote.trim()
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

                {expandedNoteType && expandedNote && selected && (
                    <div
                        className="lead-note-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lead-expanded-note-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setExpandedNoteType(null);
                            }
                        }}
                    >
                        <section className="lead-note-modal__card lead-expanded-note">
                            <header>
                                <div>
                                    <span>
                                        <Maximize2 />
                                    </span>
                                    <div>
                                        <h2 id="lead-expanded-note-title">
                                            {expandedNote.title}
                                        </h2>
                                        <p>
                                            {selected.customer_name} · Lead #
                                            {selected.id}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setExpandedNoteType(null)}
                                    aria-label="Close large note editor"
                                >
                                    <X />
                                </button>
                            </header>
                            <div className="lead-expanded-note__editor">
                                <textarea
                                    autoFocus
                                    value={expandedNote.value}
                                    onChange={(event) =>
                                        expandedNote.setValue(
                                            event.target.value,
                                        )
                                    }
                                    placeholder={`Write ${expandedNote.title.toLowerCase()}…`}
                                />
                                {expandedNote.error && (
                                    <em>{expandedNote.error}</em>
                                )}
                            </div>
                            <footer className="lead-expanded-note__actions">
                                <button
                                    type="button"
                                    onClick={() => setExpandedNoteType(null)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        expandedNote.processing ||
                                        !expandedNote.value.trim() ||
                                        expandedNote.unchanged
                                    }
                                    onClick={() => expandedNote.save()}
                                >
                                    <Save />
                                    {expandedNote.processing
                                        ? 'Saving…'
                                        : 'Save note'}
                                </button>
                            </footer>
                        </section>
                    </div>
                )}

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

                {recordingsOpen && selected && (
                    <div
                        className="lead-note-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lead-recordings-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setRecordingsOpen(false);
                            }
                        }}
                    >
                        <section className="lead-note-modal__card lead-recordings-modal">
                            <header>
                                <div>
                                    <span>
                                        <Headphones />
                                    </span>
                                    <div>
                                        <h2 id="lead-recordings-title">
                                            Calls & recordings
                                        </h2>
                                        <p>
                                            {selected.customer_name} · Lead #
                                            {selected.id}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRecordingsOpen(false)}
                                    aria-label="Close recordings"
                                >
                                    <X />
                                </button>
                            </header>
                            <div className="lead-recordings-summary">
                                <strong>
                                    {(selected.ring_central_calls?.length ??
                                        0) +
                                        (newCallAttempts[selected.id] ??
                                            0)}{' '}
                                    call attempts
                                </strong>
                                <span>
                                    {selected.ring_central_calls?.filter(
                                        (call) => call.recording_path,
                                    ).length ?? 0}{' '}
                                    recordings available
                                </span>
                            </div>
                            <div className="lead-recordings-list">
                                {(selected.ring_central_calls ?? []).map(
                                    (call) => (
                                        <article key={call.id}>
                                            <div className="lead-recordings-list__details">
                                                <strong>
                                                    {call.caller?.username ??
                                                        'Unknown user'}
                                                </strong>
                                                <span>{call.phone_number}</span>
                                                <time>
                                                    {formatDate(
                                                        call.started_at ??
                                                            call.initiated_at,
                                                    )}
                                                </time>
                                            </div>
                                            <div className="lead-recordings-list__status">
                                                <b>
                                                    {call.result ??
                                                        'Waiting for RingCentral'}
                                                </b>
                                                <span>
                                                    {Math.floor(
                                                        call.duration_seconds /
                                                            60,
                                                    )}
                                                    :
                                                    {String(
                                                        call.duration_seconds %
                                                            60,
                                                    ).padStart(2, '0')}
                                                </span>
                                            </div>
                                            {call.recording_path ? (
                                                <audio
                                                    controls
                                                    preload="none"
                                                    src={`/lead-workflow/leads-shop/${selected.id}/ringcentral-calls/${call.id}/recording`}
                                                />
                                            ) : (
                                                <small>
                                                    {call.result
                                                        ? 'No recording is available for this call.'
                                                        : 'The call result is being synchronized.'}
                                                </small>
                                            )}
                                        </article>
                                    ),
                                )}
                                {(selected.ring_central_calls ?? []).length ===
                                    0 && (
                                    <div className="lead-note-history__empty">
                                        <Headphones />
                                        <strong>No calls recorded yet</strong>
                                        <span>
                                            Calls launched from this lead will
                                            appear here.
                                        </span>
                                    </div>
                                )}
                            </div>
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
                        <section
                            className={`lead-note-modal__card lead-note-modal__card--history ${historyType === 'all' ? 'lead-note-modal__card--activity-history' : 'lead-note-modal__card--notes-history'}`}
                        >
                            <header>
                                <div>
                                    <span>
                                        <History />
                                    </span>
                                    <div>
                                        <h2 id="lead-note-history-title">
                                            {historyType === 'all'
                                                ? 'Lead activity history'
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
                                {displayedTimeline.map((entry) =>
                                    entry.kind === 'movement' ? (
                                        <article
                                            key={`movement-${entry.id}`}
                                            className="lead-note-history__movement"
                                        >
                                            <div>
                                                <strong>
                                                    {entry.movement.mover
                                                        ?.username ?? 'System'}
                                                </strong>
                                                <time>
                                                    {formatDate(
                                                        entry.movement
                                                            .created_at,
                                                    )}
                                                </time>
                                            </div>
                                            <span className="lead-movement-label">
                                                Lead moved
                                            </span>
                                            <p>
                                                <b>
                                                    {workflowLocation(
                                                        entry.movement
                                                            .from_status,
                                                    )}
                                                </b>
                                                <span aria-hidden="true">
                                                    {' '}
                                                    →{' '}
                                                </span>
                                                <b>
                                                    {workflowLocation(
                                                        entry.movement
                                                            .to_status,
                                                    )}
                                                </b>
                                            </p>
                                        </article>
                                    ) : (
                                        <article key={`note-${entry.id}`}>
                                            <div>
                                                <strong>
                                                    {entry.note.creator
                                                        ?.username ??
                                                        'Unknown user'}
                                                </strong>
                                                <time>
                                                    {formatDate(
                                                        entry.note.created_at,
                                                    )}
                                                </time>
                                            </div>
                                            <span
                                                className={`lead-history-event-label${entry.note.note_type === 'salesman_sent' ? 'lead-history-event-label--salesman' : ''}`}
                                            >
                                                {historyNoteLabel(
                                                    entry.note.note_type,
                                                )}
                                            </span>
                                            <p>{entry.note.body}</p>
                                        </article>
                                    ),
                                )}
                                {displayedTimeline.length === 0 && (
                                    <div className="lead-note-history__empty">
                                        <History />
                                        <strong>No history yet</strong>
                                        <span>
                                            {historyType === 'all'
                                                ? 'Lead movements will appear here.'
                                                : 'Saved notes will appear here.'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {smsTemplateOpen && selected && (
                    <div
                        className="lead-note-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lead-sms-template-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setSmsTemplateOpen(false);
                            }
                        }}
                    >
                        <section className="lead-note-modal__card lead-sms-template">
                            <header>
                                <div>
                                    <span>
                                        <MessageCircle />
                                    </span>
                                    <div>
                                        <h2 id="lead-sms-template-title">
                                            Copy lead message
                                        </h2>
                                        <p>
                                            Choose the information to include
                                            for {selected.customer_name}.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSmsTemplateOpen(false)}
                                    aria-label="Close SMS template"
                                >
                                    <X />
                                </button>
                            </header>
                            <div className="lead-sms-template__body">
                                <div className="lead-sms-template__choices">
                                    <div className="lead-sms-template__select-actions">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSmsTemplateFields(
                                                    smsTemplateSections.map(
                                                        (section) =>
                                                            section.key,
                                                    ),
                                                )
                                            }
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSmsTemplateFields([])
                                            }
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    {smsTemplateSections.map((section) => (
                                        <label key={section.key}>
                                            <input
                                                type="checkbox"
                                                checked={smsTemplateFields.includes(
                                                    section.key,
                                                )}
                                                onChange={() =>
                                                    setSmsTemplateFields(
                                                        (current) =>
                                                            current.includes(
                                                                section.key,
                                                            )
                                                                ? current.filter(
                                                                      (key) =>
                                                                          key !==
                                                                          section.key,
                                                                  )
                                                                : [
                                                                      ...current,
                                                                      section.key,
                                                                  ],
                                                    )
                                                }
                                            />
                                            <span>
                                                <strong>
                                                    {section.label}
                                                </strong>
                                                <small>{section.value}</small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <label className="lead-sms-template__preview">
                                    <span>Message preview</span>
                                    <textarea
                                        readOnly
                                        value={smsTemplateText}
                                        aria-label="SMS message preview"
                                    />
                                </label>
                            </div>
                            <footer className="lead-sms-template__actions">
                                <button
                                    type="button"
                                    onClick={() => setSmsTemplateOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={copySmsTemplate}
                                    disabled={!smsTemplateText}
                                >
                                    <MessageCircle />
                                    Copy message
                                </button>
                            </footer>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
