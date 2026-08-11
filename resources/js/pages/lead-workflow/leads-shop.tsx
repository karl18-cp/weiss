import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Archive,
    Ban,
    BadgeCheck,
    Building2,
    CalendarClock,
    CheckCircle2,
    CircleDollarSign,
    Clock3,
    History,
    Headphones,
    LockKeyhole,
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
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import '@/../css/leads-shop.css';
import { RingCentralCallButton } from '@/components/ringcentral-call-button';
import { useSystemModal } from '@/components/system-modal-provider';
import { zillowSearchUrl } from '@/lib/address-search';
import {
    appointmentDate,
    appointmentInputValue,
    formatAppointmentDate,
} from '@/lib/appointment-date';
import { formatPhoneNumber } from '@/lib/phone-number';

const CONFIRM_URGENCY_WINDOW_MS = 2 * 60 * 60 * 1000;
const CRM_TIMEZONE = 'America/Los_Angeles';
const crmClockFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CRM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

const crmWallClockNow = (): Date => {
    const parts = Object.fromEntries(
        crmClockFormatter
            .formatToParts(new Date())
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, Number(part.value)]),
    );

    return new Date(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
    );
};

const isUrgentConfirmLead = (lead: Lead): boolean => {
    if (lead.status !== 'confirmed' || !lead.appointment_at) return false;

    const appointment = appointmentDate(lead.appointment_at);
    const millisecondsUntilAppointment =
        appointment.getTime() - crmWallClockNow().getTime();

    return (
        millisecondsUntilAppointment >= 0 &&
        millisecondsUntilAppointment <= CONFIRM_URGENCY_WINDOW_MS
    );
};

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
    state: string;
    latitude: number | null;
    longitude: number | null;
    email: string | null;
    years_in_house: number;
    house_age: number | null;
    needs_financing: boolean | null;
    house_value: string | null;
    appointment_at: string | null;
    appointment_result: string | null;
    telemarketer_notes: string;
    source: string;
    status: string;
    confirmation_notes: string | null;
    created_at: string;
    rehash_at: string | null;
    company: { com_id: number; company: string; prefix: string } | null;
    product: { prod_id: number; product_name: string } | null;
    agent: { agent_id: number; agent_name: string } | null;
    second_agent: { agent_id: number; agent_name: string } | null;
    second_manager: { manager_id: number; manager_name: string } | null;
    duplicate_of: {
        id: number;
        customer_name: string;
        primary_number: string;
        created_at: string;
        status: string;
        project?: { id: number } | null;
    } | null;
    agent_assignments?: LeadAgentAssignment[];
    salesman_one: {
        salesman_id: number;
        salesman_name: string;
        phone: string | null;
    } | null;
    salesman_two: {
        salesman_id: number;
        salesman_name: string;
        phone: string | null;
    } | null;
    notes: LeadNote[];
    appointment_result_notes?: LeadNote[];
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
    'telemarketer' | 'confirmation' | 'dispatch' | 'appointment_result';
type DateField = 'created_at' | 'appointment_at';
type LeadCardLayout = {
    primaryColumn: number;
    informationRow: number;
};

const LEAD_CARD_LAYOUT_KEY = 'weiss:lead-card-layout';
const DEFAULT_LEAD_CARD_LAYOUT: LeadCardLayout = {
    primaryColumn: 66,
    informationRow: 62,
};

const permissionModuleForPath = (path: string): string | null => {
    const modules: [string, string][] = [
        ['/lead-workflow/leads-shop', 'leads_shop'],
        ['/lead-workflow/confirm-leads', 'confirm_leads'],
        ['/lead-workflow/dispatch-leads', 'dispatch_leads'],
        ['/lead-workflow/sag', 'sag'],
        ['/lead-workflow/reschedule', 'reschedule'],
        ['/lead-workflow/rehash', 'rehash'],
        ['/lead-workflow/555', '555'],
        ['/lead-workflow/la', 'la'],
        ['/lead-workflow/his', 'his'],
        ['/lead-workflow/toss-leads', 'toss_leads'],
        ['/lead-workflow/keep-in-touch', 'keep_in_touch'],
    ];

    return modules.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
};

const loadLeadCardLayout = (): LeadCardLayout => {
    try {
        const saved = JSON.parse(
            window.localStorage.getItem(LEAD_CARD_LAYOUT_KEY) ?? 'null',
        ) as Partial<LeadCardLayout> | null;

        return {
            primaryColumn:
                typeof saved?.primaryColumn === 'number'
                    ? Math.min(78, Math.max(50, saved.primaryColumn))
                    : DEFAULT_LEAD_CARD_LAYOUT.primaryColumn,
            informationRow:
                typeof saved?.informationRow === 'number'
                    ? Math.min(75, Math.max(38, saved.informationRow))
                    : DEFAULT_LEAD_CARD_LAYOUT.informationRow,
        };
    } catch {
        return DEFAULT_LEAD_CARD_LAYOUT;
    }
};

const latestNoteBody = (lead: Lead | null, noteType: string): string => {
    if (!lead) return '';

    const latest = [...lead.notes]
        .filter((note) => note.note_type === noteType)
        .sort((a, b) => b.id - a.id)[0];

    if (latest) return latest.body;

    if (noteType === 'appointment_result') {
        return lead.appointment_result_notes?.[0]?.body ?? '';
    }

    return noteType === 'telemarketer' ? (lead.telemarketer_notes ?? '') : '';
};

const latestLeadNote = (
    lead: Lead | null,
    noteType: string,
): LeadNote | null => {
    if (!lead) return null;

    return (
        [...lead.notes]
            .filter((note) => note.note_type === noteType)
            .sort((a, b) => b.id - a.id)[0] ?? null
    );
};

const formatCity = (city?: string | null) =>
    (city ?? '').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const requiredEditFieldClass = (
    value: string | number | null | undefined,
    extraClass = '',
) =>
    [
        extraClass,
        'lead-edit-field--required',
        String(value ?? '').trim() === '' ? 'lead-edit-field--missing' : '',
    ]
        .filter(Boolean)
        .join(' ');

export type CompanyOption = { com_id: number; company: string };
export type ProductOption = { prod_id: number; product_name: string };
export type AgentOption = { agent_id: number; agent_name: string };
export type SalesmanOption = { salesman_id: number; salesman_name: string };

type DateRow = { key: string; count: number };
type MovementDestination = { status: string; label: string; count: number };
type QueueManager = { id: string; name: string; count: number };

type PaginatedLeads = {
    data: Lead[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export type LeadsShopProps = {
    leads: PaginatedLeads | Lead[];
    companies: CompanyOption[];
    products: ProductOption[];
    cities: string[];
    agents: AgentOption[];
    salesmen?: SalesmanOption[];
    dateRows: DateRow[];
    queueTotal?: number;
    queueManagers?: QueueManager[];
    selectedQueueManager?: string;
    canViewAllQueueManagers?: boolean;
    selectedDate: string | null;
    selectedCity?: string;
    activeShopStatus?: string | null;
    verifyCount?: number;
    dateField: DateField;
    dateGranularity?: 'day' | 'month' | 'hybrid';
    timezoneOffset: number;
    movementDestinations?: MovementDestination[];
    createdDayTotal?: number;
    agentDayTotal?: number;
    overallDayTotal?: number;
    managerReturns?: { leads: number; managers: number };
    queue?: {
        title: string;
        description: string;
        status: string;
        listTitle: string;
        dateLabel: string;
        dateField: 'created_at' | 'appointment_at';
        dateGranularity?: 'day' | 'month' | 'hybrid';
        sortDirection?: 'asc' | 'desc';
        statusFilters?: [string, string][];
    };
};

const emptyLeadForm = {
    lead_created_at: '',
    customer_name: '',
    marital_status: '',
    primary_number: '',
    secondary_number: '',
    mobile_number: '',
    address: '',
    zip_code: '',
    city: '',
    state: '',
    email: '',
    years_in_house: '',
    house_age: '',
    needs_financing: '',
    house_value: '',
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

const leadFormData = (lead: Lead) => ({
    lead_created_at: createdAtInputValue(lead.created_at),
    customer_name: lead.customer_name,
    marital_status: lead.marital_status ?? '',
    primary_number: lead.primary_number,
    secondary_number: lead.secondary_number ?? '',
    mobile_number: lead.mobile_number ?? '',
    address: lead.address,
    zip_code: lead.zip_code,
    city: lead.city,
    state: lead.state,
    email: lead.email ?? '',
    years_in_house:
        lead.years_in_house == null ? '' : String(lead.years_in_house),
    house_age: lead.house_age == null ? '' : String(lead.house_age),
    needs_financing:
        lead.needs_financing == null ? '' : lead.needs_financing ? '1' : '0',
    house_value: lead.house_value ?? '',
    product_id: String(lead.product?.prod_id ?? ''),
    appointment_at: appointmentInputValue(lead.appointment_at ?? ''),
    appointment_result: lead.appointment_result ?? '',
    telemarketer_notes: lead.telemarketer_notes ?? '',
    company_id: String(lead.company?.com_id ?? ''),
    source: 'CallTools',
    agent_id: String(lead.agent?.agent_id ?? ''),
    salesman_1_id: String(lead.salesman_one?.salesman_id ?? ''),
    salesman_2_id: String(lead.salesman_two?.salesman_id ?? ''),
});

const createdAtInputValue = (value: string) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: CRM_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(new Date(value))
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
        timeZone: CRM_TIMEZONE,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));

const workflowLocation = (status: string | null) => {
    const locations: Record<string, string> = {
        fresh: 'Leads Shop / Freshly In',
        verify: 'Leads Shop / Verify',
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

const duplicateOriginalDestination = (lead: Lead['duplicate_of']) => {
    if (!lead) return null;

    const [label, path] = (() => {
        switch (lead.status) {
            case 'confirmed':
                return ['Confirm Leads', '/lead-workflow/confirm-leads'];
            case 'dispatched':
                return ['Dispatch Leads', '/lead-workflow/dispatch-leads'];
            case 'reschedule':
                return ['Reschedule', '/lead-workflow/reschedule'];
            case 'rehash':
            case 'rehash_ng':
            case 'rehash_toss':
            case 'rehash_cb':
                return ['Rehash', '/lead-workflow/rehash'];
            case '555':
                return ['555', '/lead-workflow/555'];
            case 'la':
                return ['LA', '/lead-workflow/la'];
            case 'his':
                return ['HIS', '/lead-workflow/his'];
            case 'toss':
                return ['TOSS Leads', '/lead-workflow/toss-leads'];
            case 'kit':
            case 'kit_ng':
            case 'kit_toss':
            case 'kit_cb':
                return ['Keep in Touch', '/lead-workflow/keep-in-touch'];
            case 'project':
            case 'sold':
            case 'sale':
                return ['Projects', '/management/projects'];
            default:
                return ['Leads Shop', '/lead-workflow/leads-shop'];
        }
    })();
    const url =
        path === '/management/projects' && lead.project
            ? `${path}?project=${lead.project.id}&focus=search`
            : `${path}?lead=${lead.id}&focus=search`;

    return { label, url };
};

const historyNoteLabel = (type: string) => {
    const labels: Record<string, string> = {
        telemarketer: 'Telemarketer note',
        confirmation: 'Confirmation note',
        dispatch: 'Dispatch note',
        appointment_result: 'Appointment result',
        appointment_date_change: 'Appointment date changed',
        salesman_sent: 'Salesman Sent',
        salesman_assignment: 'Salesman assignment',
        agent_reassigned: 'Agent reassigned',
    };

    return labels[type] ?? 'Lead note';
};

const salesmanHistoryTypes = new Set([
    'salesman_sent',
    'salesman_assignment',
]);

const belongsToNoteHistory = (
    note: LeadNote,
    historyType: EditableNoteType | 'all' | null,
) => {
    if (historyType === 'all') {
        return true;
    }

    if (!historyType) {
        return false;
    }

    if (
        (historyType === 'dispatch' ||
            historyType === 'appointment_result') &&
        salesmanHistoryTypes.has(note.note_type)
    ) {
        return true;
    }

    return note.note_type === historyType;
};

const calendarDateKey = (value: string | null | undefined) => {
    if (!value) return null;

    const datePart = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

    if (datePart) return datePart;

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
        ? null
        : new Intl.DateTimeFormat('en-CA', {
              timeZone: CRM_TIMEZONE,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
          }).format(parsed);
};

const californiaDateKey = (value: string | null | undefined) => {
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
        return value.slice(0, 10);
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : new Intl.DateTimeFormat('en-CA', {
              timeZone: CRM_TIMEZONE,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
          }).format(date);
};

const isInstantAppointment = (lead: Lead) => {
    const createdDate = californiaDateKey(lead.created_at);
    const appointmentDate = californiaDateKey(lead.appointment_at);

    return Boolean(
        createdDate && appointmentDate && createdDate === appointmentDate,
    );
};

const leadAddress = (lead: Lead) =>
    [lead.address, lead.city, lead.state, lead.zip_code]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');

const UNION_CITY_CA_COORDINATES = {
    latitude: 37.5934,
    longitude: -122.0438,
};
const EARTH_RADIUS_MILES = 3958.7613;

const distanceFromUnionCityMiles = (lead: Lead): number | null => {
    if (lead.latitude == null || lead.longitude == null) {
        return null;
    }

    const latitude = Number(lead.latitude);
    const longitude = Number(lead.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = toRadians(
        latitude - UNION_CITY_CA_COORDINATES.latitude,
    );
    const longitudeDelta = toRadians(
        longitude - UNION_CITY_CA_COORDINATES.longitude,
    );
    const originLatitude = toRadians(UNION_CITY_CA_COORDINATES.latitude);
    const leadLatitude = toRadians(latitude);
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(originLatitude) *
            Math.cos(leadLatitude) *
            Math.sin(longitudeDelta / 2) ** 2;

    return (
        2 *
        EARTH_RADIUS_MILES *
        Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
};

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
    const showsDispatchNotes =
        Boolean(queueStatus) &&
        ![
            'fresh',
            'raw',
            'cb',
            'naov',
            'verify',
            'confirmed',
            'rehash',
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
                            <span>Primary phone</span>
                            <strong>
                                <Phone />—
                            </strong>
                        </div>
                        <div>
                            <span>Years in house</span>
                            <strong>—</strong>
                        </div>
                        <div>
                            <span>Marital status</span>
                            <strong>—</strong>
                        </div>
                        <div>
                            <span>House built</span>
                            <strong>—</strong>
                        </div>
                        <div>
                            <span>Needs financing?</span>
                            <strong>—</strong>
                        </div>
                        <div>
                            <span>House value</span>
                            <strong>—</strong>
                        </div>
                        <div className="lead-detail-field--wide">
                            <span>Address</span>
                            <strong>
                                <MapPin />—
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
                {showsDispatchNotes && (
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
    leads: leadsPage,
    companies,
    products,
    cities,
    agents,
    salesmen = [],
    dateRows,
    queueTotal = 0,
    queueManagers = [],
    selectedQueueManager = 'all',
    canViewAllQueueManagers = false,
    selectedDate,
    selectedCity = 'all',
    activeShopStatus = null,
    verifyCount = 0,
    dateField: serverDateField,
    dateGranularity = 'day',
    timezoneOffset,
    movementDestinations = [],
    createdDayTotal = 0,
    agentDayTotal = 0,
    overallDayTotal = 0,
    managerReturns = { leads: 0, managers: 0 },
    queue,
}: LeadsShopProps) {
    const pagination: PaginatedLeads = Array.isArray(leadsPage)
        ? {
              data: leadsPage,
              current_page: 1,
              last_page: 1,
              per_page: leadsPage.length,
              total: leadsPage.length,
              prev_page_url: null,
              next_page_url: null,
          }
        : leadsPage;
    const leads = pagination.data;
    const movementCount = (status: string) =>
        movementDestinations.find(
            (destination) => destination.status === status,
        )?.count ?? 0;
    const confirmedDayTotal = movementCount('confirmed');
    const dispatchedDayTotal = movementCount('dispatched');
    const otherDayTotal = Math.max(
        0,
        createdDayTotal - confirmedDayTotal - dispatchedDayTotal,
    );
    const requestedLeadId =
        Number(new URLSearchParams(window.location.search).get('lead')) || null;
    const isSearchFocus =
        new URLSearchParams(window.location.search).get('focus') === 'search';
    const focusedLeadRowRef = useRef<HTMLButtonElement | null>(null);
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
    const { auth } = usePage().props;
    const { confirm, notify } = useSystemModal();
    const isKeepInTouchQueue = queue?.status === 'kit';
    const isProjectQueue = queue?.status === 'project';
    const isDispatchQueue =
        queue?.status === 'dispatched' ||
        window.location.pathname === '/lead-workflow/dispatch-leads';
    const managerQuery =
        isKeepInTouchQueue && selectedQueueManager !== 'all'
            ? { manager: selectedQueueManager }
            : {};
    const [search, setSearch] = useState(
        new URLSearchParams(window.location.search).get('search') ?? '',
    );
    useEffect(() => {
        const activeSearch =
            new URLSearchParams(window.location.search).get('search') ?? '';
        const nextSearch = search.trim();

        if (nextSearch === activeSearch) return;

        const timer = window.setTimeout(() => {
            router.get(
                window.location.pathname,
                nextSearch
                    ? {
                      search: nextSearch,
                      date_field: serverDateField,
                      ...(activeShopStatus === 'verify'
                          ? { queue_status: 'verify' }
                          : {}),
                      ...managerQuery,
                  }
                : {
                      date_field: serverDateField,
                      ...(activeShopStatus === 'verify'
                          ? { queue_status: 'verify' }
                          : {}),
                      ...managerQuery,
                  },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    only: [
                        'leads',
                        'dateRows',
                        'selectedDate',
                        'dateField',
                        'activeShopStatus',
                        'verifyCount',
                    ],
                },
            );
        }, 350);

        return () => window.clearTimeout(timer);
    }, [search, selectedQueueManager]);

    const [dateField, setDateField] = useState<DateField>(serverDateField);
    const [selectedStatus, setSelectedStatus] = useState(
        requestedLead?.status ?? activeShopStatus ?? queue?.status ?? 'fresh',
    );
    const [companyFilter, setCompanyFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [cityFilter, setCityFilter] = useState(selectedCity);
    const [productFilter, setProductFilter] = useState('all');
    const [agentFilter, setAgentFilter] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(
        requestedLeadId,
    );
    const [isDeleting, setIsDeleting] = useState(false);
    const [appointmentDateDraft, setAppointmentDateDraft] = useState(
        appointmentInputValue(requestedLead?.appointment_at ?? ''),
    );
    const appointmentDraftDate = appointmentDateDraft.slice(0, 10);
    const appointmentDraftTime = appointmentDateDraft.slice(11, 16);
    const currentPermissionModule = permissionModuleForPath(
        window.location.pathname,
    );
    const hasRestrictedQueueActions = [
        '/lead-workflow/555',
        '/lead-workflow/reschedule',
        '/lead-workflow/rehash',
        '/lead-workflow/la',
        '/lead-workflow/his',
        '/lead-workflow/sag',
    ].includes(window.location.pathname);
    const canUseRestrictedQueueActions =
        auth.user.role === 'admin' ||
        auth.permissions?.queue_action_buttons === 'edit';
    const canEditCurrentTab =
        auth.user.role === 'admin' ||
        (currentPermissionModule !== null &&
            auth.permissions?.[currentPermissionModule] === 'edit');
    const permissionModuleForStatus = (status: string): string | null => {
        if (status === 'confirmed') return 'confirm_leads';
        if (status === 'dispatched') return 'dispatch_leads';
        if (status === 'reschedule') return 'reschedule';
        if (['toss', 'rehash_toss', 'kit_toss'].includes(status))
            return 'toss_action';
        if (['rehash', 'rehash_ng', 'rehash_cb'].includes(status))
            return 'rehash';
        if (status === '555') return '555';
        if (status === 'la') return 'la';
        if (status === 'his') return 'his';
        if (['kit', 'kit_ng', 'kit_cb'].includes(status))
            return 'keep_in_touch';
        if (['raw', 'cb', 'naov', 'verify'].includes(status))
            return 'leads_shop';

        return null;
    };
    const canMoveToStatus = (status: string): boolean => {
        if (
            hasRestrictedQueueActions &&
            !canUseRestrictedQueueActions &&
            status !== 'fresh'
        ) {
            return false;
        }
        if (status === 'fresh' || status === 'history') return true;
        if (status === 'sale') return canEditCurrentTab;
        if (auth.user.role === 'admin') return true;

        const module = permissionModuleForStatus(status);

        return module !== null && auth.permissions?.[module] === 'edit';
    };
    const [appointmentResultDraft, setAppointmentResultDraft] = useState('');
    const [salesmanOneDraft, setSalesmanOneDraft] = useState('');
    const [salesmanTwoDraft, setSalesmanTwoDraft] = useState('');
    const [savingAssignment, setSavingAssignment] = useState<
        'appointment_date' | 'appointment' | 'salesman_1' | 'salesman_2' | null
    >(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [followUpDestination, setFollowUpDestination] = useState<
        'kit' | 'rehash' | 'reschedule' | null
    >(null);
    const [followUpAt, setFollowUpAt] = useState('');
    const [followUpError, setFollowUpError] = useState('');
    const [followUpProcessing, setFollowUpProcessing] = useState(false);
    const [duplicateResolving, setDuplicateResolving] = useState(false);
    const [dismissedDuplicateId, setDismissedDuplicateId] = useState<
        number | null
    >(null);

    useEffect(() => {
        setDismissedDuplicateId(null);
    }, [selectedId]);
    const [smsTemplateOpen, setSmsTemplateOpen] = useState(false);
    const [smsTemplateFields, setSmsTemplateFields] = useState<
        SmsTemplateField[]
    >([]);
    const [recordingsOpen, setRecordingsOpen] = useState(false);
    const detailGridRef = useRef<HTMLDivElement>(null);
    const [leadCardLayout, setLeadCardLayout] =
        useState<LeadCardLayout>(loadLeadCardLayout);
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
    const form = useForm(
        requestedLead ? leadFormData(requestedLead) : emptyLeadForm,
    );

    useEffect(() => {
        window.localStorage.setItem(
            LEAD_CARD_LAYOUT_KEY,
            JSON.stringify(leadCardLayout),
        );
    }, [leadCardLayout]);

    const resizeLeadCards = (
        axis: 'horizontal' | 'vertical',
        event: ReactPointerEvent<HTMLButtonElement>,
    ) => {
        const grid = detailGridRef.current;
        if (!grid) return;

        event.preventDefault();
        const rectangle = grid.getBoundingClientRect();
        document.body.classList.add('is-resizing-lead-cards');

        const handlePointerMove = (pointerEvent: PointerEvent) => {
            if (axis === 'horizontal') {
                const percentage =
                    ((pointerEvent.clientX - rectangle.left) /
                        rectangle.width) *
                    100;
                setLeadCardLayout((current) => ({
                    ...current,
                    primaryColumn: Math.min(78, Math.max(50, percentage)),
                }));
                return;
            }

            const percentage =
                ((pointerEvent.clientY - rectangle.top) / rectangle.height) *
                100;
            setLeadCardLayout((current) => ({
                ...current,
                informationRow: Math.min(75, Math.max(38, percentage)),
            }));
        };

        const stopResizing = () => {
            document.body.classList.remove('is-resizing-lead-cards');
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopResizing);
            window.removeEventListener('pointercancel', stopResizing);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopResizing, { once: true });
        window.addEventListener('pointercancel', stopResizing, { once: true });
    };

    const leadCardLayoutStyle = {
        '--lead-detail-primary-column': `${leadCardLayout.primaryColumn}%`,
        '--lead-detail-information-row': `${leadCardLayout.informationRow}%`,
    } as CSSProperties;

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
        body: '',
    });
    const [loadedConfirmationNote, setLoadedConfirmationNote] = useState(
        requestedConfirmationNote,
    );
    const dispatchNoteForm = useForm({
        note_type: 'dispatch',
        body: '',
    });
    const [loadedDispatchNote, setLoadedDispatchNote] = useState(
        requestedDispatchNote,
    );
    const appointmentResultNoteForm = useForm({
        note_type: 'appointment_result',
        body: '',
    });
    const [loadedAppointmentResultNote, setLoadedAppointmentResultNote] =
        useState(requestedAppointmentResultNote);
    const saleForm = useForm<{ amount: string; salesman?: string }>({
        amount: '',
    });
    const effectiveDateField = queue?.dateField ?? dateField;

    useEffect(() => {
        let refreshing = false;

        const refreshLeads = () => {
            if (
                refreshing ||
                document.hidden ||
                isEditing ||
                saleModalOpen ||
                followUpDestination !== null ||
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
        followUpDestination,
        isEditing,
        saleForm.processing,
        saleModalOpen,
        telemarketerNoteForm.processing,
    ]);

    const availableDateRows = useMemo(
        () =>
            dateRows.map(({ key, count }) => {
                if (key === 'unscheduled') {
                    return {
                        key,
                        count,
                        date: 'Unscheduled',
                        day: '',
                    };
                }

                const isMonth =
                    dateGranularity === 'month' ||
                    (dateGranularity === 'hybrid' && key.length === 7);
                const date = new Date(
                    `${isMonth ? `${key}-01` : key}T12:00:00`,
                );
                return {
                    key,
                    count,
                    date: new Intl.DateTimeFormat(
                        'en-US',
                        isMonth
                            ? { month: 'long', year: 'numeric' }
                            : {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: '2-digit',
                              },
                    ).format(date),
                    day: isMonth
                        ? ''
                        : new Intl.DateTimeFormat('en-US', {
                              weekday: 'short',
                          }).format(date),
                };
            }),
        [dateGranularity, dateRows],
    );

    const openDate = (
        key: string,
        nextDateField: DateField = effectiveDateField,
    ) => {
        setCityFilter('all');
        if (activeShopStatus === 'verify') setSelectedStatus('fresh');
        router.get(
            window.location.pathname,
            {
                date: key,
                date_field: nextDateField,
                ...managerQuery,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const filterByCity = (city: string) => {
        setCityFilter(city);
        setSelectedId(null);

        router.get(
            window.location.pathname,
            {
                date_field: effectiveDateField,
                ...(activeShopStatus === 'verify'
                    ? { queue_status: 'verify' }
                    : {}),
                ...managerQuery,
                ...(city !== 'all' ? { city } : {}),
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: [
                    'leads',
                    'selectedCity',
                    'activeShopStatus',
                    'verifyCount',
                ],
            },
        );
    };

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
                        ['verify', 'Verify'],
                    ] as const),
        [queue],
    );

    const statusCounts = useMemo(
        () =>
            Object.fromEntries(
                statusFilters.map(([status]) => [
                    status,
                    isProjectQueue
                        ? leads.length
                        : status === 'verify'
                        ? verifyCount
                        : leads.filter(
                              (lead) => (lead.status || 'fresh') === status,
                          ).length,
                ]),
            ),
        [isProjectQueue, leads, statusFilters, verifyCount],
    );

    const selectStatus = (status: string) => {
        if (queue || status === selectedStatus) return;

        setSelectedId(null);
        setSelectedStatus(status);

        if (status === 'verify' || activeShopStatus === 'verify') {
            router.get(
                window.location.pathname,
                {
                    ...(status === 'verify'
                        ? { queue_status: 'verify' }
                        : { date: selectedDate }),
                    date_field: effectiveDateField,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    only: [
                        'leads',
                        'activeShopStatus',
                        'verifyCount',
                        'selectedCity',
                    ],
                },
            );
        }
    };

    const filteredLeads = useMemo(() => {
        const query = search.trim().toLowerCase();
        const todayInCalifornia = californiaDateKey(new Date().toISOString());

        return leads
            .filter((lead) => {
                // The server already returns only the selected business-date
                // slice. Avoid filtering it again in the browser's timezone.
                const matchesDate = true;
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
                    isKeepInTouchQueue ||
                    isProjectQueue ||
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
                    californiaDateKey(first.appointment_at) ===
                    todayInCalifornia;
                const secondIsToday =
                    californiaDateKey(second.appointment_at) ===
                    todayInCalifornia;

                if (firstIsToday !== secondIsToday) {
                    return firstIsToday ? -1 : 1;
                }

                const firstTime = first[effectiveDateField]
                    ? new Date(first[effectiveDateField] as string).getTime()
                    : Number.POSITIVE_INFINITY;
                const secondTime = second[effectiveDateField]
                    ? new Date(second[effectiveDateField] as string).getTime()
                    : Number.POSITIVE_INFINITY;
                const missingTime =
                    queue?.sortDirection === 'asc'
                        ? Number.POSITIVE_INFINITY
                        : Number.NEGATIVE_INFINITY;
                const firstSortableTime =
                    Number.isNaN(firstTime) || !first[effectiveDateField]
                        ? missingTime
                        : firstTime;
                const secondSortableTime =
                    Number.isNaN(secondTime) || !second[effectiveDateField]
                        ? missingTime
                        : secondTime;
                const dateDifference =
                    queue?.sortDirection === 'asc'
                        ? firstSortableTime - secondSortableTime
                        : secondSortableTime - firstSortableTime;

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
        effectiveDateField,
        isKeepInTouchQueue,
        isProjectQueue,
        queue?.sortDirection,
    ]);

    useEffect(() => {
        if (!isSearchFocus || !requestedLeadId) return;

        const frame = window.requestAnimationFrame(() => {
            focusedLeadRowRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [filteredLeads.length, isSearchFocus, requestedLeadId]);

    const clearListFilters = () => {
        setSearch('');
        setSelectedStatus(queue?.status ?? 'fresh');
        setCompanyFilter('all');
        setSourceFilter('all');
        setCityFilter('all');
        setProductFilter('all');
        setAgentFilter('all');
        setIsRefreshing(true);

        router.get(
            window.location.pathname,
            {
                date: selectedDate,
                date_field: effectiveDateField,
                ...managerQuery,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['leads', 'selectedCity'],
                onFinish: () => setIsRefreshing(false),
            },
        );
    };

    const selected = leads.find((lead) => lead.id === selectedId) ?? null;
    const duplicateOriginal = duplicateOriginalDestination(
        selected?.duplicate_of ?? null,
    );

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
                .filter((section) => smsTemplateFields.includes(section.key))
                .map((section) => section.value.trim())
                .join('\n\n'),
        [smsTemplateFields, smsTemplateSections],
    );

    const openSmsTemplate = () => {
        setSmsTemplateFields(smsTemplateSections.map((section) => section.key));
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
        setAppointmentDateDraft(
            appointmentInputValue(lead.appointment_at ?? ''),
        );
        setAppointmentResultDraft(lead.appointment_result ?? '');
        setSalesmanOneDraft(String(lead.salesman_one?.salesman_id ?? ''));
        setSalesmanTwoDraft(String(lead.salesman_two?.salesman_id ?? ''));
        setIsEditing(false);
        setHistoryType(null);
        setRecordingsOpen(false);
        telemarketerNoteForm.setData('body', latestTelemarketerNote);
        setLoadedTelemarketerNote(latestTelemarketerNote);
        telemarketerNoteForm.clearErrors();
        confirmationNoteForm.setData('body', '');
        setLoadedConfirmationNote(latestConfirmationNote);
        confirmationNoteForm.clearErrors();
        dispatchNoteForm.setData('body', '');
        setLoadedDispatchNote(latestDispatchNote);
        dispatchNoteForm.clearErrors();
        appointmentResultNoteForm.setData('body', '');
        setLoadedAppointmentResultNote(latestAppointmentResultNote);
        appointmentResultNoteForm.clearErrors();
        form.setData(leadFormData(lead));
        form.clearErrors();
    };

    useEffect(() => {
        if (requestedLead && selectedId !== requestedLead.id) {
            selectLead(requestedLead);
        }
    }, [requestedLead?.id]);

    useEffect(() => {
        if (!search.trim() || requestedLeadId) return;

        const firstMatch = leads[0] ?? null;
        if (!firstMatch) {
            setSelectedId(null);

            return;
        }

        if (selectedId !== firstMatch.id) {
            selectLead(firstMatch);
        }

        const url = new URL(window.location.href);
        url.searchParams.set('lead', String(firstMatch.id));
        url.searchParams.set('date', selectedDate ?? '');
        url.searchParams.set('date_field', serverDateField);
        url.searchParams.delete('timezone_offset');
        window.history.replaceState(window.history.state, '', url);
    }, [leads, requestedLeadId, search, selectedDate, serverDateField]);

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
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                notify({
                    tone: 'error',
                    message:
                        typeof firstError === 'string'
                            ? firstError
                            : 'The lead could not be saved. Check the highlighted fields.',
                });
            },
        });
    };

    const deleteSampleLead = async () => {
        if (!selected || isDeleting) {
            return;
        }

        const approved = await confirm({
            title: 'Delete sample lead?',
            message: `${selected.customer_name} and all of its notes and activity will be permanently deleted. This cannot be undone.`,
            confirmLabel: 'Delete lead',
            tone: 'danger',
        });

        if (!approved) {
            return;
        }

        setIsDeleting(true);
        router.delete(`/lead-workflow/leads-shop/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedId(null);
                router.flushAll();
            },
            onFinish: () => setIsDeleting(false),
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
                    setExpandedNoteType(null);
                },
            },
        );
    };

    const saveConfirmationNote = () => {
        const body = confirmationNoteForm.data.body.trim();
        if (!selected || !body) {
            return;
        }

        confirmationNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    confirmationNoteForm.setData('body', '');
                    setLoadedConfirmationNote(body);
                    setExpandedNoteType(null);
                },
            },
        );
    };

    const saveDispatchNote = () => {
        const body = dispatchNoteForm.data.body.trim();
        if (!selected || !body) {
            return;
        }

        dispatchNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    dispatchNoteForm.setData('body', '');
                    setLoadedDispatchNote(body);
                    setExpandedNoteType(null);
                },
            },
        );
    };

    const saveAppointmentResultNote = () => {
        const body = appointmentResultNoteForm.data.body.trim();
        if (!selected || !body) {
            return;
        }

        appointmentResultNoteForm.post(
            `/lead-workflow/leads-shop/${selected.id}/notes`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    appointmentResultNoteForm.setData('body', '');
                    setLoadedAppointmentResultNote(body);
                    setExpandedNoteType(null);
                },
            },
        );
    };

    const updateLeadStatus = (status: string, followUp: string | null = null) => {
        if (!selected) {
            return;
        }

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/status`,
            {
                status,
                appointment_result_note:
                    appointmentResultNoteForm.data.body.trim() || null,
                follow_up_at: followUp,
            },
            {
                preserveScroll: true,
                onStart: () => setFollowUpProcessing(true),
                onSuccess: () => {
                    setFollowUpDestination(null);
                    setFollowUpAt('');
                    setFollowUpError('');
                    router.flushAll();
                },
                onError: (errors) => {
                    if (errors.follow_up_at) {
                        if (
                            ['kit', 'rehash', 'reschedule'].includes(status)
                        ) {
                            setFollowUpDestination(
                                status as 'kit' | 'rehash' | 'reschedule',
                            );
                        }
                        setFollowUpError(String(errors.follow_up_at));

                        return;
                    }
                    const message =
                        String(errors.status ?? errors.permission ?? '') ||
                        'The lead could not be moved. Please try again.';
                    const permissionDenied = /permission|authorized/i.test(
                        message,
                    );

                    notify({
                        title: permissionDenied
                            ? 'Permission required'
                            : 'Unable to move lead',
                        message,
                        tone: 'warning',
                    });
                },
                onFinish: () => setFollowUpProcessing(false),
            },
        );
    };

    const requestStatusUpdate = (status: string) => {
        if (
            isDispatchQueue &&
            ['kit', 'rehash', 'reschedule'].includes(status)
        ) {
            setFollowUpDestination(status as 'kit' | 'rehash' | 'reschedule');
            setFollowUpAt('');
            setFollowUpError('');

            return;
        }

        updateLeadStatus(status);
    };

    const resolveDuplicate = (action: 'merge' | 'delete') => {
        if (!selected?.duplicate_of || duplicateResolving) return;

        setDuplicateResolving(true);
        const url = `/lead-workflow/leads-shop/${selected.id}/duplicate${action === 'merge' ? '/merge' : ''}`;
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedId(null);
                setDismissedDuplicateId(null);
                router.flushAll();
            },
            onFinish: () => setDuplicateResolving(false),
        };

        if (action === 'merge') {
            router.post(url, {}, options);
        } else {
            router.delete(url, options);
        }
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

    const saveAppointmentDate = () => {
        if (!selected) {
            return;
        }

        setSavingAssignment('appointment_date');

        router.patch(
            `/lead-workflow/leads-shop/${selected.id}/appointment`,
            { appointment_at: appointmentDateDraft || null },
            {
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
                onError: (errors) =>
                    notify({
                        tone: 'error',
                        message: String(
                            errors.appointment_at ??
                                'The appointment could not be updated.',
                        ),
                    }),
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

    const telemarketerHistory =
        selected?.notes.filter((note) => note.note_type === 'telemarketer') ??
        [];
    const confirmationHistory =
        selected?.notes.filter((note) => note.note_type === 'confirmation') ??
        [];
    const dispatchHistory =
        selected?.notes.filter((note) =>
            belongsToNoteHistory(note, 'dispatch'),
        ) ?? [];
    const appointmentResultHistory =
        selected?.notes.filter(
            (note) => belongsToNoteHistory(note, 'appointment_result'),
        ) ?? [];
    const isDispatchNoteLocked = (noteType: EditableNoteType) =>
        noteType === 'telemarketer' ||
        (queue?.status === 'dispatched' && noteType === 'confirmation');
    const expandedNoteLocked = expandedNoteType
        ? isDispatchNoteLocked(expandedNoteType)
        : false;
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
                  unchanged: !confirmationNoteForm.data.body.trim(),
                  error: confirmationNoteForm.errors.body,
              },
              dispatch: {
                  title: 'Dispatch notes',
                  value: dispatchNoteForm.data.body,
                  setValue: (value: string) =>
                      dispatchNoteForm.setData('body', value),
                  save: saveDispatchNote,
                  processing: dispatchNoteForm.processing,
                  unchanged: !dispatchNoteForm.data.body.trim(),
                  error: dispatchNoteForm.errors.body,
              },
              appointment_result: {
                  title: 'Appointment result notes',
                  value: appointmentResultNoteForm.data.body,
                  setValue: (value: string) =>
                      appointmentResultNoteForm.setData('body', value),
                  save: saveAppointmentResultNote,
                  processing: appointmentResultNoteForm.processing,
                  unchanged: !appointmentResultNoteForm.data.body.trim(),
                  error: appointmentResultNoteForm.errors.body,
              },
          }[expandedNoteType]
        : null;
    const expandedNoteHistory = expandedNoteType
        ? [...(selected?.notes ?? [])]
              .filter((note) =>
                  belongsToNoteHistory(note, expandedNoteType),
              )
              .sort(
                  (left, right) =>
                      new Date(right.created_at).getTime() -
                      new Date(left.created_at).getTime(),
              )
        : [];
    const displayedHistory =
        historyType === 'all'
            ? (selected?.notes ?? [])
            : (selected?.notes.filter(
                  (note) => belongsToNoteHistory(note, historyType),
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

        return [
            ...(selected.movements ?? []).map((movement) => ({
                kind: 'movement' as const,
                id: movement.id,
                created_at: movement.created_at,
                movement,
            })),
            ...displayedHistory.map((note) => ({
                kind: 'note' as const,
                id: note.id,
                created_at: note.created_at,
                note,
            })),
        ].sort(
            (first, second) =>
                new Date(second.created_at).getTime() -
                new Date(first.created_at).getTime(),
        );
    }, [displayedHistory, historyType, selected]);

    const defaultWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['555', '555', Phone, '555'],
        ['kit', 'KIT', MessageCircle, 'kit'],
        ['raw', 'Raw', Archive, 'raw'],
        ['cb', 'Call Back', PhoneCall, 'callback'],
        ['verify', 'Verify', BadgeCheck, 'confirm'],
        ['history', 'History', History, 'history'],
    ] as const;
    const confirmWorkflowActions = [
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['555', '555', Phone, '555'],
        ['toss', 'TOSS', Trash2, 'toss'],
        ['history', 'History', History, 'history'],
    ] as const;
    const dispatchWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['kit', 'Keep in Touch', MessageCircle, 'callback'],
        ['rehash', 'Rehash', RotateCcw, 'toss'],
        ['555', '555', Phone, '555'],
        ['sale', 'Sale', CircleDollarSign, 'confirm'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['toss', 'TOSS', Trash2, 'toss'],
        ['history', 'History', History, 'history'],
    ] as const;
    const rescheduleWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['verify', 'Verify', BadgeCheck, 'confirm'],
        ['fresh', 'Leads Shop', ShoppingBag, 'raw'],
        ['history', 'History', History, 'history'],
    ] as const;
    const rehashWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['verify', 'Verify', BadgeCheck, 'confirm'],
        ['rehash_ng', 'NG', Ban, 'raw'],
        ['rehash_toss', 'TOSS', Trash2, 'toss'],
        ['rehash_cb', 'Call Back', PhoneCall, 'callback'],
        ['fresh', 'Leads Shop', ShoppingBag, 'raw'],
        ['history', 'History', History, 'history'],
    ] as const;
    const fiveFiveFiveWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['reschedule', 'Reschedule', CalendarClock, 'reschedule'],
        ['fresh', 'Leads Shop', ShoppingBag, 'raw'],
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
        ['verify', 'Verify', BadgeCheck, 'confirm'],
        ['toss', 'TOSS', Trash2, 'toss'],
        ['fresh', 'Leads Shop', ShoppingBag, 'raw'],
        ['history', 'History', History, 'history'],
    ] as const;
    const projectWorkflowActions = [
        ['fresh', 'Leads Shop', ShoppingBag, 'raw'],
        ['history', 'History', History, 'history'],
    ] as const;
    const keepInTouchWorkflowActions = [
        ['confirmed', 'Confirm', CheckCircle2, 'confirm'],
        ['dispatched', 'Dispatch', Truck, 'dispatch'],
        ['verify', 'Verify', BadgeCheck, 'confirm'],
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
                        : queue?.status === 'project'
                          ? projectWorkflowActions
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
                <header
                    className={`leads-shop-header ${!queue ? 'leads-shop-header--with-day-counts' : ''}`}
                >
                    <div className="leads-shop-header__identity">
                        <span className="leads-shop-header__icon">
                            {headerIcon}
                        </span>
                        <div>
                            <div className="leads-shop-header__title">
                                <h1>{queue?.title ?? 'Leads Shop'}</h1>
                                <strong>
                                    {queue ? queueTotal : overallDayTotal}
                                </strong>
                            </div>
                            <p>
                                {queue?.description ??
                                    'Browse and manage freshly imported leads.'}
                            </p>
                        </div>
                    </div>
                    {!queue && (
                        <div className="leads-shop-header__day-counts">
                            <span>
                                <small>Overall today</small>
                                <strong>{overallDayTotal}</strong>
                            </span>
                            <span>
                                <small>Agent leads</small>
                                <strong>{createdDayTotal}</strong>
                                <em>
                                    {agentDayTotal}{' '}
                                    {agentDayTotal === 1 ? 'agent' : 'agents'}
                                </em>
                            </span>
                            <span>
                                <small>Confirm</small>
                                <strong>{confirmedDayTotal}</strong>
                            </span>
                            <span>
                                <small>Dispatch</small>
                                <strong>{dispatchedDayTotal}</strong>
                            </span>
                            <span>
                                <small>Other</small>
                                <strong>{otherDayTotal}</strong>
                            </span>
                            <span>
                                <small>Manager leads</small>
                                <strong>{managerReturns.leads}</strong>
                                <em>
                                    {managerReturns.managers}{' '}
                                    {managerReturns.managers === 1
                                        ? 'manager'
                                        : 'managers'}
                                </em>
                            </span>
                        </div>
                    )}
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
                                    {effectiveDateField === 'appointment_at'
                                        ? 'appointment date'
                                        : 'created or rehash date'}
                                </p>
                            </div>
                            <CalendarClock />
                        </div>
                        {!queue && (
                            <label className="lead-dates__basis">
                                <span>Date based on</span>
                                <select
                                    value={dateField}
                                    onChange={(event) => {
                                        const nextField = event.target
                                            .value as DateField;
                                        setDateField(nextField);
                                        router.get(
                                            window.location.pathname,
                                            {
                                                date_field: nextField,
                                            },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                                replace: true,
                                            },
                                        );
                                    }}
                                >
                                    <option value="created_at">
                                        Lead created
                                    </option>
                                    <option value="appointment_at">
                                        Appointment date
                                    </option>
                                </select>
                            </label>
                        )}
                        <div
                            className={`lead-dates__columns${dateGranularity === 'month' ? ' lead-dates__columns--months' : ''}`}
                        >
                            <span>
                                {dateGranularity === 'month'
                                    ? 'Month'
                                    : dateGranularity === 'hybrid'
                                      ? 'Date / Month'
                                      : 'Date'}
                            </span>
                            {dateGranularity !== 'month' && <span>Day</span>}
                            <span>Count</span>
                        </div>
                        <div className="lead-dates__list">
                            {availableDateRows.map((day) => (
                                <button
                                    type="button"
                                    key={day.key}
                                    className={
                                        selectedDate === day.key
                                            ? `lead-date-row lead-date-row--active${dateGranularity === 'month' ? ' lead-date-row--months' : ''}`
                                            : `lead-date-row${dateGranularity === 'month' ? ' lead-date-row--months' : ''}`
                                    }
                                    onClick={() => openDate(day.key)}
                                >
                                    <span>{day.date}</span>
                                    {dateGranularity !== 'month' && (
                                        <span>{day.day}</span>
                                    )}
                                    <strong>{day.count}</strong>
                                </button>
                            ))}
                            {availableDateRows.length === 0 && (
                                <div className="lead-dates__empty">
                                    {effectiveDateField === 'appointment_at'
                                        ? `No appointment ${dateGranularity === 'month' ? 'months' : 'dates'} in this queue.`
                                        : 'No leads in the last 30 days.'}
                                </div>
                            )}
                        </div>
                    </aside>

                    <section className="lead-browser">
                        <div className="lead-browser__header">
                            <div>
                                <h2>
                                    {queue?.listTitle ?? 'Fresh leads'}
                                    {!queue && (
                                        <span className="lead-browser__created-total">
                                            {createdDayTotal} created
                                        </span>
                                    )}
                                </h2>
                                <p>
                                    {filteredLeads.length}{' '}
                                    {cityFilter !== 'all'
                                        ? `shown in ${formatCity(cityFilter)}`
                                        : activeShopStatus === 'verify'
                                          ? 'shown across all creation dates'
                                          : `shown for the selected ${selectedDate?.length === 7 ? 'month' : 'date'}`}
                                </p>
                            </div>
                            <span>Newest first</span>
                        </div>
                        <div className="lead-browser-filters">
                            <div className="lead-status-filters">
                                {isKeepInTouchQueue ? (
                                    <>
                                        {canViewAllQueueManagers && (
                                            <button
                                                type="button"
                                                className={
                                                    selectedQueueManager === 'all'
                                                        ? 'lead-status-filter lead-status-filter--active'
                                                        : 'lead-status-filter'
                                                }
                                                onClick={() =>
                                                    router.get(
                                                        window.location.pathname,
                                                        {
                                                            date: selectedDate,
                                                            date_field: effectiveDateField,
                                                        },
                                                        {
                                                            preserveState: true,
                                                            preserveScroll: true,
                                                            replace: true,
                                                        },
                                                    )
                                                }
                                            >
                                                All managers
                                                <span>{queueTotal}</span>
                                            </button>
                                        )}
                                        {queueManagers.map((manager) => (
                                            <button
                                                type="button"
                                                key={manager.id}
                                                className={
                                                    selectedQueueManager === manager.id
                                                        ? 'lead-status-filter lead-status-filter--active'
                                                        : 'lead-status-filter'
                                                }
                                                onClick={() =>
                                                    router.get(
                                                        window.location.pathname,
                                                        {
                                                            date: selectedDate,
                                                            date_field: effectiveDateField,
                                                            manager: manager.id,
                                                        },
                                                        {
                                                            preserveState: true,
                                                            preserveScroll: true,
                                                            replace: true,
                                                        },
                                                    )
                                                }
                                            >
                                                {manager.name}
                                                <span>{manager.count}</span>
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    statusFilters.map(([status, label]) => (
                                        <button
                                            type="button"
                                            key={status}
                                            className={
                                                selectedStatus === status
                                                    ? 'lead-status-filter lead-status-filter--active'
                                                    : 'lead-status-filter'
                                            }
                                            onClick={() =>
                                                selectStatus(status)
                                            }
                                        >
                                            {label}
                                            <span>{statusCounts[status] ?? 0}</span>
                                        </button>
                                    ))
                                )}
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
                                            filterByCity(event.target.value)
                                        }
                                    >
                                        <option value="all">All cities</option>
                                        {filterOptions.cities.map((city) => (
                                            <option key={city} value={city}>
                                                {formatCity(city)}
                                            </option>
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
                        <div
                            className={`lead-browser__columns ${queue?.status === 'dispatched' ? 'lead-browser__columns--with-do' : ''}`}
                        >
                            <span>Customer</span>
                            <span>City</span>
                            <span>Appointment</span>
                            {queue?.status === 'dispatched' && (
                                <span className="lead-browser__do-heading">
                                    DO
                                </span>
                            )}
                            <span className="lead-browser__attempts-heading">
                                Attempts
                            </span>
                        </div>
                        <div className="lead-browser__list">
                            {filteredLeads.map((lead) => (
                                <button
                                    type="button"
                                    key={lead.id}
                                    ref={
                                        isSearchFocus &&
                                        requestedLeadId === lead.id
                                            ? focusedLeadRowRef
                                            : undefined
                                    }
                                    data-lead-id={lead.id}
                                    className={[
                                        'lead-browser-row',
                                        queue?.status === 'dispatched'
                                            ? 'lead-browser-row--with-do'
                                            : '',
                                        selectedId === lead.id
                                            ? 'lead-browser-row--active'
                                            : '',
                                        isSearchFocus &&
                                        requestedLeadId === lead.id
                                            ? 'lead-browser-row--search-target'
                                            : '',
                                        isInstantAppointment(lead)
                                            ? 'lead-browser-row--instant'
                                            : '',
                                        queue?.status === 'confirmed' &&
                                        isUrgentConfirmLead(lead)
                                            ? 'lead-browser-row--confirm-urgent'
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
                                            {queue?.status === 'confirmed' &&
                                                isUrgentConfirmLead(lead) && (
                                                    <span className="lead-browser-row__urgent-badge">
                                                        Due soon
                                                    </span>
                                                )}
                                        </span>
                                        <small>
                                            {lead.product?.product_name ??
                                                'No product'}
                                        </small>
                                    </span>
                                    <span>{formatCity(lead.city)}</span>
                                    <span>
                                        {lead.appointment_at
                                            ? formatAppointmentDate(
                                                  lead.appointment_at,
                                              )
                                            : 'No appointment'}
                                    </span>
                                    {queue?.status === 'dispatched' && (
                                        <span
                                            className={`lead-browser-row__do ${lead.salesman_one || lead.salesman_two ? 'is-op' : 'is-di'}`}
                                            title={
                                                lead.salesman_one ||
                                                lead.salesman_two
                                                    ? 'Salesman assigned'
                                                    : 'Salesman not sent'
                                            }
                                        >
                                            {lead.salesman_one ||
                                            lead.salesman_two
                                                ? 'OP'
                                                : 'DI'}
                                        </span>
                                    )}
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
                        {pagination.last_page > 1 && (
                            <nav
                                className="lead-browser-pagination"
                                aria-label="Lead pages"
                            >
                                <button
                                    type="button"
                                    disabled={!pagination.prev_page_url}
                                    onClick={() =>
                                        pagination.prev_page_url &&
                                        router.visit(
                                            pagination.prev_page_url,
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Previous
                                </button>
                                <span>
                                    Page {pagination.current_page} of{' '}
                                    {pagination.last_page}
                                    <small>
                                        {pagination.total.toLocaleString()}{' '}
                                        leads
                                    </small>
                                </span>
                                <button
                                    type="button"
                                    disabled={!pagination.next_page_url}
                                    onClick={() =>
                                        pagination.next_page_url &&
                                        router.visit(
                                            pagination.next_page_url,
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Next
                                </button>
                            </nav>
                        )}
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
                                            <div className="lead-detail__name-row">
                                                <h2>
                                                    {selected.customer_name}
                                                </h2>
                                                <span className="lead-header-source">
                                                    {selected.source}
                                                </span>
                                            </div>
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
                                            {selected.rehash_at && (
                                                <small className="lead-created">
                                                    Rehash{' '}
                                                    {formatDate(
                                                        selected.rehash_at,
                                                    )}
                                                </small>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="lead-layout-reset"
                                            onClick={() =>
                                                setLeadCardLayout(
                                                    DEFAULT_LEAD_CARD_LAYOUT,
                                                )
                                            }
                                            title="Reset card sizes"
                                        >
                                            <SlidersHorizontal />
                                            Reset cards
                                        </button>
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
                                        {auth.user.role === 'admin' && (
                                            <button
                                                type="button"
                                                className="lead-detail-delete"
                                                disabled={isDeleting}
                                                onClick={deleteSampleLead}
                                            >
                                                <Trash2 />
                                                {isDeleting
                                                    ? 'Deleting…'
                                                    : 'Delete sample'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div className="lead-edit-grid">
                                        {selected.status === 'verify' && (
                                            <label>
                                                <span>Lead created (Pacific time)</span>
                                                <input
                                                    type="datetime-local"
                                                    value={form.data.lead_created_at}
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'lead_created_at',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                {form.errors.lead_created_at && (
                                                    <em>{form.errors.lead_created_at}</em>
                                                )}
                                            </label>
                                        )}
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.customer_name,
                                            )}
                                        >
                                            <span>Customer name</span>
                                            <input
                                                required
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.primary_number,
                                            )}
                                        >
                                            <span>Primary phone</span>
                                            <div className="lead-edit-phone">
                                                <input
                                                    required
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
                                                        phoneSlot="primary"
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
                                                        phoneSlot="secondary"
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
                                                        phoneSlot="mobile"
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.address,
                                                'lead-edit-field--wide',
                                            )}
                                        >
                                            <span>Address</span>
                                            <input
                                                required
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.city,
                                            )}
                                        >
                                            <span>City</span>
                                            <input
                                                required
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.state,
                                            )}
                                        >
                                            <span>State</span>
                                            <input
                                                required
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.zip_code,
                                            )}
                                        >
                                            <span>ZIP code</span>
                                            <input
                                                required
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
                                            <span>House built</span>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="e.g. 1995"
                                                value={form.data.house_age}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'house_age',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.house_age && (
                                                <em>{form.errors.house_age}</em>
                                            )}
                                        </label>
                                        <label>
                                            <span>Needs financing?</span>
                                            <select
                                                value={
                                                    form.data.needs_financing
                                                }
                                                onChange={(event) =>
                                                    form.setData(
                                                        'needs_financing',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select an answer
                                                </option>
                                                <option value="1">Yes</option>
                                                <option value="0">No</option>
                                            </select>
                                            {form.errors.needs_financing && (
                                                <em>
                                                    {
                                                        form.errors
                                                            .needs_financing
                                                    }
                                                </em>
                                            )}
                                        </label>
                                        <label>
                                            <span>House value</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.data.house_value}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'house_value',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {form.errors.house_value && (
                                                <em>
                                                    {form.errors.house_value}
                                                </em>
                                            )}
                                        </label>
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.product_id,
                                            )}
                                        >
                                            <span>Product</span>
                                            <select
                                                required
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.appointment_at,
                                            )}
                                        >
                                            <span>Appointment</span>
                                            <input
                                                required
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
                                        {queue && (
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.company_id,
                                            )}
                                        >
                                            <span>Company</span>
                                            <select
                                                required
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
                                        <label
                                            className={requiredEditFieldClass(
                                                form.data.agent_id,
                                            )}
                                        >
                                            <span>
                                                Original agent / reassign
                                            </span>
                                            <select
                                                required
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
                                        {queue && (
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
                                                </label>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={`lead-detail__grid ${queue?.status === 'dispatched' ? 'lead-detail__grid--dispatch' : queue?.status && !['fresh', 'raw', 'cb', 'naov', 'verify', 'confirmed'].includes(queue.status) ? 'lead-detail__grid--three-notes' : ''}`}
                                        ref={detailGridRef}
                                        style={leadCardLayoutStyle}
                                    >
                                        <article className="lead-detail-card lead-detail-card--customer">
                                            <h3>
                                                <UserRound />
                                                Customer information
                                            </h3>
                                            <div className="lead-detail-fields">
                                                <div>
                                                    <span>Primary phone</span>
                                                    <div className="lead-phone-value">
                                                        <strong>
                                                            <Phone />
                                                            {formatPhoneNumber(
                                                                selected.primary_number,
                                                            )}
                                                        </strong>
                                                        {selected.primary_number.trim() && (
                                                            <RingCentralCallButton
                                                                leadId={
                                                                    selected.id
                                                                }
                                                                phone={
                                                                    selected.primary_number
                                                                }
                                                                phoneSlot="primary"
                                                                title="Call primary phone with RingCentral"
                                                            >
                                                                <PhoneCall />
                                                            </RingCentralCallButton>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span>Years in house</span>
                                                    <strong>
                                                        {
                                                            selected.years_in_house
                                                        }
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span>Marital status</span>
                                                    <strong>
                                                        {
                                                            selected.marital_status
                                                        }
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span>House built</span>
                                                    <strong>
                                                        {selected.house_age ==
                                                        null
                                                            ? '—'
                                                            : selected.house_age}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span>
                                                        Needs financing?
                                                    </span>
                                                    <strong>
                                                        {selected.needs_financing ==
                                                        null
                                                            ? '—'
                                                            : selected.needs_financing
                                                              ? 'Yes'
                                                              : 'No'}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <span>House value</span>
                                                    <strong>
                                                        {selected.house_value ==
                                                        null
                                                            ? '—'
                                                            : Number(
                                                                  selected.house_value,
                                                              ).toLocaleString(
                                                                  'en-US',
                                                                  {
                                                                      style: 'currency',
                                                                      currency:
                                                                          'USD',
                                                                      maximumFractionDigits: 0,
                                                                  },
                                                              )}
                                                    </strong>
                                                </div>
                                                <div className="lead-detail-field--wide">
                                                    <span>Address</span>
                                                    <div className="lead-address-value">
                                                        <strong>
                                                            <MapPin />
                                                            {
                                                                selected.address
                                                            }, {selected.city},{' '}
                                                            {selected.state}{' '}
                                                            {selected.zip_code}
                                                        </strong>
                                                        {!queue &&
                                                            distanceFromUnionCityMiles(
                                                                selected,
                                                            ) !== null &&
                                                            distanceFromUnionCityMiles(
                                                                selected,
                                                            )! > 60 && (
                                                                <span className="lead-distance-warning">
                                                                    {Math.round(
                                                                        distanceFromUnionCityMiles(
                                                                            selected,
                                                                        )!,
                                                                    )}{' '}
                                                                    mi from
                                                                    Union City
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span>Secondary phone</span>
                                                    <div className="lead-phone-value">
                                                        <strong>
                                                            {formatPhoneNumber(
                                                                selected.secondary_number,
                                                            )}
                                                        </strong>
                                                        {selected.secondary_number?.trim() && (
                                                            <RingCentralCallButton
                                                                leadId={
                                                                    selected.id
                                                                }
                                                                phone={
                                                                    selected.secondary_number
                                                                }
                                                                phoneSlot="secondary"
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
                                                            {formatPhoneNumber(
                                                                selected.mobile_number,
                                                            )}
                                                        </strong>
                                                        {selected.mobile_number?.trim() && (
                                                            <RingCentralCallButton
                                                                leadId={
                                                                    selected.id
                                                                }
                                                                phone={
                                                                    selected.mobile_number
                                                                }
                                                                phoneSlot="mobile"
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
                                                {queue && (
                                                    <div className="lead-dispatch-assignments">
                                                        <label>
                                                            <span>
                                                                Appointment
                                                                result
                                                            </span>
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
                                                                        PNS No
                                                                        Rehash
                                                                    </option>
                                                                    <option value="2 ND Meeting">
                                                                        2 ND
                                                                        Meeting
                                                                    </option>
                                                                    <option value="Salesman Sent">
                                                                        Salesman
                                                                        Sent
                                                                    </option>
                                                                    <option value="Sold and Cancel">
                                                                        Sold and
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
                                                                >
                                                                    <Save />
                                                                </button>
                                                            </div>
                                                        </label>
                                                        <label>
                                                            <span>
                                                                Salesman 1
                                                            </span>
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
                                                                >
                                                                    <Save />
                                                                </button>
                                                            </div>
                                                        </label>
                                                        <label>
                                                            <span>
                                                                Salesman 2
                                                            </span>
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
                                                                >
                                                                    <Save />
                                                                </button>
                                                            </div>
                                                        </label>
                                                    </div>
                                                )}
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
                                                        <div className="lead-inline-save-field lead-inline-appointment">
                                                            <div className="lead-inline-appointment__inputs">
                                                                <input
                                                                    type="date"
                                                                    className="lead-inline-assignment"
                                                                    value={
                                                                        appointmentDraftDate
                                                                    }
                                                                    disabled={
                                                                        !canEditCurrentTab
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) => {
                                                                        const date =
                                                                            event
                                                                                .target
                                                                                .value;
                                                                        setAppointmentDateDraft(
                                                                            date
                                                                                ? `${date}T${appointmentDraftTime || '09:00'}`
                                                                                : '',
                                                                        );
                                                                    }}
                                                                    aria-label="Appointment date"
                                                                />
                                                                <input
                                                                    type="time"
                                                                    className="lead-inline-assignment"
                                                                    value={
                                                                        appointmentDraftTime
                                                                    }
                                                                    disabled={
                                                                        !canEditCurrentTab ||
                                                                        !appointmentDraftDate
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        setAppointmentDateDraft(
                                                                            `${appointmentDraftDate}T${event.target.value}`,
                                                                        )
                                                                    }
                                                                    aria-label="Appointment time"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="lead-inline-save"
                                                                onClick={
                                                                    saveAppointmentDate
                                                                }
                                                                disabled={
                                                                    !canEditCurrentTab ||
                                                                    savingAssignment !==
                                                                        null ||
                                                                    appointmentDateDraft ===
                                                                        appointmentInputValue(
                                                                            selected.appointment_at ??
                                                                                '',
                                                                        )
                                                                }
                                                                aria-label="Save appointment date and time"
                                                                title="Save appointment"
                                                            >
                                                                <Save />
                                                            </button>
                                                        </div>
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
                                                        <small>Agent 2</small>
                                                        <strong>
                                                            {selected
                                                                .second_manager
                                                                ?.manager_name ??
                                                                selected
                                                                    .second_agent
                                                                    ?.agent_name ??
                                                                '—'}
                                                        </strong>
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
                                                {false &&
                                                    queue?.status &&
                                                    ![
                                                        'fresh',
                                                        'raw',
                                                        'cb',
                                                        'naov',
                                                        'verify',
                                                    ].includes(
                                                        queue!.status,
                                                    ) && (
                                                        <>
                                                            {[
                                                                'dispatched',
                                                                'kit',
                                                            ].includes(
                                                                queue?.status ??
                                                                    '',
                                                            ) && (
                                                                <div className="lead-project-only-assignment">
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
                                                                                        (selected!.appointment_result ??
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
                                                            <div className="lead-project-only-assignment">
                                                                <UserRound />
                                                                <span>
                                                                    <small>
                                                                        Salesman
                                                                        1
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
                                                                                        selected!
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
                                                                        {queue?.status ===
                                                                            'dispatched' &&
                                                                            selected
                                                                                .salesman_one
                                                                                ?.phone && (
                                                                                <RingCentralCallButton
                                                                                    className="lead-inline-save lead-inline-sms"
                                                                                    leadId={selected.id}
                                                                                    phone={selected.salesman_one.phone}
                                                                                    phoneSlot="salesman_1"
                                                                                    title={`Call ${selected.salesman_one.salesman_name}`}
                                                                                >
                                                                                    <PhoneCall />
                                                                                </RingCentralCallButton>
                                                                            )}
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
                                                            <div className="lead-project-only-assignment">
                                                                <UserRound />
                                                                <span>
                                                                    <small>
                                                                        Salesman
                                                                        2
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
                                                                                        selected!
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
                                                                        {queue?.status ===
                                                                            'dispatched' &&
                                                                            selected
                                                                                .salesman_two
                                                                                ?.phone && (
                                                                                <RingCentralCallButton
                                                                                    className="lead-inline-save lead-inline-sms"
                                                                                    leadId={selected.id}
                                                                                    phone={selected.salesman_two.phone}
                                                                                    phoneSlot="salesman_2"
                                                                                    title={`Call ${selected.salesman_two.salesman_name}`}
                                                                                >
                                                                                    <PhoneCall />
                                                                                </RingCentralCallButton>
                                                                            )}
                                                                    </div>
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                <div className="lead-project-only-source">
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

                                        <article className="lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--telemarketer is-note-locked">
                                            <div className="lead-note-heading">
                                                <h3>Telemarketer notes</h3>
                                                <span className="lead-note-locked-badge">
                                                    <LockKeyhole /> Locked
                                                </span>
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
                                                readOnly={isDispatchNoteLocked(
                                                    'telemarketer',
                                                )}
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
                                                        isDispatchNoteLocked(
                                                            'telemarketer',
                                                        ) ||
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
                                        <article
                                            className={`lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--confirmation ${
                                                isDispatchNoteLocked(
                                                    'confirmation',
                                                )
                                                    ? 'is-note-locked'
                                                    : ''
                                            }`}
                                        >
                                            <div className="lead-note-heading">
                                                <h3>Confirmation notes</h3>
                                                {isDispatchNoteLocked(
                                                    'confirmation',
                                                ) && (
                                                    <span className="lead-note-locked-badge">
                                                        <LockKeyhole /> Locked
                                                    </span>
                                                )}
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
                                                readOnly
                                                value={loadedConfirmationNote}
                                                placeholder="Expand to add a confirmation note…"
                                            />
                                        </article>
                                        {queue?.status &&
                                            ![
                                                'fresh',
                                                'raw',
                                                'cb',
                                                'naov',
                                                'verify',
                                                'confirmed',
                                                'rehash',
                                            ].includes(queue.status) && (
                                                <>
                                                    <article className="lead-detail-card lead-detail-card--notes lead-live-notes lead-note-card--dispatch">
                                                        <div className="lead-note-heading">
                                                            <h3>
                                                                Dispatch notes
                                                            </h3>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setExpandedNoteType(
                                                                        'dispatch',
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
                                                                        'dispatch',
                                                                    )
                                                                }
                                                            >
                                                                <History />{' '}
                                                                History{' '}
                                                                <span>
                                                                    {
                                                                        dispatchHistory.length
                                                                    }
                                                                </span>
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            readOnly
                                                            value={loadedDispatchNote}
                                                            placeholder="Expand to add a dispatch note…"
                                                        />
                                                    </article>
                                                    {Boolean(queue) && (
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
                                                                readOnly
                                                                value={loadedAppointmentResultNote}
                                                                placeholder="Expand to add an appointment result note…"
                                                            />
                                                        </article>
                                                    )}
                                                </>
                                            )}
                                        <button
                                            type="button"
                                            className="lead-card-resize-handle lead-card-resize-handle--column"
                                            aria-label="Resize the information card columns"
                                            title="Drag to resize left and right cards"
                                            onPointerDown={(event) =>
                                                resizeLeadCards(
                                                    'horizontal',
                                                    event,
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="lead-card-resize-handle lead-card-resize-handle--row"
                                            aria-label="Resize the information and notes rows"
                                            title="Drag to resize information and notes cards"
                                            onPointerDown={(event) =>
                                                resizeLeadCards(
                                                    'vertical',
                                                    event,
                                                )
                                            }
                                        />
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
                                            !canMoveToStatus(status) ||
                                            (status !== 'history' &&
                                                selected?.status === status)
                                        }
                                        title={
                                            !canMoveToStatus(status)
                                                ? 'You do not have permission to move leads to this tab.'
                                                : undefined
                                        }
                                        onClick={() =>
                                            status === 'history'
                                                ? setHistoryType('all')
                                                : status === 'sale'
                                                  ? openSaleModal()
                                                  : requestStatusUpdate(status)
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
                        <section
                            className={`lead-note-modal__card lead-expanded-note ${
                                expandedNoteLocked ? 'is-note-locked' : ''
                            }`}
                        >
                            <header>
                                <div>
                                    <span>
                                        <Maximize2 />
                                    </span>
                                    <div>
                                        <h2 id="lead-expanded-note-title">
                                            {expandedNote.title}
                                        </h2>
                                        {expandedNoteLocked && (
                                            <span className="lead-note-locked-badge">
                                                <LockKeyhole /> Locked
                                            </span>
                                        )}
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
                            <div
                                className={`lead-expanded-note__editor ${expandedNoteLocked ? 'lead-expanded-note__editor--locked' : ''}`}
                            >
                                <div className="lead-expanded-note__saved">
                                    <div className="lead-expanded-note__history-heading">
                                        <History aria-hidden="true" />
                                        <strong>Note history</strong>
                                        <span>{expandedNoteHistory.length}</span>
                                    </div>
                                    {expandedNoteHistory.length > 0 ? (
                                        <div className="lead-expanded-note__history-list">
                                            {expandedNoteHistory.map(
                                                (note, index) => (
                                                    <article
                                                        className="lead-expanded-note__history-item"
                                                        key={note.id}
                                                    >
                                                        <div className="lead-expanded-note__latest">
                                                            <UserRound aria-hidden="true" />
                                                            <span>
                                                                {salesmanHistoryTypes.has(
                                                                    note.note_type,
                                                                )
                                                                    ? `${historyNoteLabel(note.note_type)} by `
                                                                    : index === 0
                                                                      ? 'Latest note by '
                                                                      : 'Note by '}
                                                                <strong>
                                                                    {expandedNoteType ===
                                                                    'telemarketer'
                                                                        ? (selected
                                                                              .agent
                                                                              ?.agent_name ??
                                                                          note
                                                                              .creator
                                                                              ?.username ??
                                                                          'Unknown agent')
                                                                        : (note
                                                                              .creator
                                                                              ?.username ??
                                                                          'Unknown user')}
                                                                </strong>
                                                            </span>
                                                            <time
                                                                dateTime={
                                                                    note.created_at
                                                                }
                                                            >
                                                                <Clock3 aria-hidden="true" />
                                                                {formatDate(
                                                                    note.created_at,
                                                                )}
                                                            </time>
                                                        </div>
                                                        <div className="lead-expanded-note__saved-body">
                                                            {note.body}
                                                        </div>
                                                    </article>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <div className="lead-expanded-note__history-empty">
                                            <MessageCircle aria-hidden="true" />
                                            <span>No saved notes yet.</span>
                                        </div>
                                    )}
                                </div>
                                {!expandedNoteLocked && (
                                    <div className="lead-expanded-note__new-note">
                                        <label htmlFor="expanded-new-note">
                                            Add a new note
                                        </label>
                                        <textarea
                                            id="expanded-new-note"
                                            autoFocus
                                            value={expandedNote.value}
                                            onChange={(event) =>
                                                expandedNote.setValue(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={`Write a new ${expandedNote.title.toLowerCase()}…`}
                                        />
                                    </div>
                                )}
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
                                        expandedNoteLocked ||
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

                {selected?.duplicate_of &&
                    dismissedDuplicateId !== selected.id && (
                        <div
                            className="lead-note-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="lead-duplicate-title"
                        >
                            <section className="lead-note-modal__card lead-sale-modal__card lead-duplicate-modal__card">
                                <header>
                                    <div>
                                        <span>
                                            <RotateCcw />
                                        </span>
                                        <div>
                                            <h2 id="lead-duplicate-title">
                                                Duplicate lead detected
                                            </h2>
                                            <p>
                                                This newer CallTools lead matches
                                                an older lead by phone number.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={duplicateResolving}
                                        onClick={() =>
                                            setDismissedDuplicateId(selected.id)
                                        }
                                        aria-label="Decide later"
                                        title="Decide later"
                                    >
                                        <X />
                                    </button>
                                </header>
                                <div className="lead-duplicate-modal__body">
                                    <div>
                                        <small>New duplicate</small>
                                        <strong>{selected.customer_name}</strong>
                                        <span>
                                            {formatPhoneNumber(
                                                selected.primary_number,
                                            )}
                                        </span>
                                    </div>
                                    <div>
                                        <small>Original lead to keep</small>
                                        <strong>
                                            {selected.duplicate_of.customer_name}
                                        </strong>
                                        <span>
                                            {formatPhoneNumber(
                                                selected.duplicate_of
                                                    .primary_number,
                                            )}
                                        </span>
                                        {duplicateOriginal && (
                                            <span className="lead-duplicate-modal__location">
                                                Current tab:{' '}
                                                <strong>
                                                    {duplicateOriginal.label}
                                                </strong>
                                            </span>
                                        )}
                                    </div>
                                    <p>
                                        Merge keeps the original lead and moves
                                        the new lead’s notes and available extra
                                        information into it. Delete removes only
                                        the newer duplicate.
                                    </p>
                                    <div className="lead-duplicate-modal__actions">
                                        {duplicateOriginal && (
                                            <button
                                                type="button"
                                                className="lead-duplicate-modal__view"
                                                disabled={duplicateResolving}
                                                onClick={() =>
                                                    router.visit(
                                                        duplicateOriginal.url,
                                                    )
                                                }
                                            >
                                                <Search /> View original lead
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={duplicateResolving}
                                            onClick={() =>
                                                resolveDuplicate('delete')
                                            }
                                        >
                                            <Trash2 /> Delete newest duplicate
                                        </button>
                                        <button
                                            type="button"
                                            disabled={duplicateResolving}
                                            onClick={() =>
                                                resolveDuplicate('merge')
                                            }
                                        >
                                            <RotateCcw />
                                            {duplicateResolving
                                                ? 'Resolving…'
                                                : 'Merge into original'}
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                {followUpDestination && selected && (
                    <div
                        className="lead-note-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="lead-follow-up-title"
                        onMouseDown={(event) => {
                            if (
                                event.target === event.currentTarget &&
                                !followUpProcessing
                            ) {
                                setFollowUpDestination(null);
                            }
                        }}
                    >
                        <section className="lead-note-modal__card lead-sale-modal__card">
                            <header>
                                <div>
                                    <span>
                                        <CalendarClock />
                                    </span>
                                    <div>
                                        <h2 id="lead-follow-up-title">
                                            Schedule follow-up call
                                        </h2>
                                        <p>
                                            Required before moving{' '}
                                            {selected.customer_name} to{' '}
                                            {workflowLocation(
                                                followUpDestination,
                                            )}.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={followUpProcessing}
                                    onClick={() =>
                                        setFollowUpDestination(null)
                                    }
                                    aria-label="Close follow-up modal"
                                >
                                    <X />
                                </button>
                            </header>

                            <form
                                className="lead-sale-modal__form lead-follow-up-modal__form"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (!followUpAt) {
                                        setFollowUpError(
                                            'Choose the follow-up date and time.',
                                        );

                                        return;
                                    }
                                    updateLeadStatus(
                                        followUpDestination,
                                        followUpAt,
                                    );
                                }}
                            >
                                <label>
                                    <span>When is the follow-up call?</span>
                                    <input
                                        type="datetime-local"
                                        required
                                        autoFocus
                                        value={followUpAt}
                                        onChange={(event) => {
                                            setFollowUpAt(event.target.value);
                                            setFollowUpError('');
                                        }}
                                    />
                                    {followUpError && (
                                        <small>{followUpError}</small>
                                    )}
                                </label>
                                <div className="lead-sale-modal__actions">
                                    <button
                                        type="button"
                                        disabled={followUpProcessing}
                                        onClick={() =>
                                            setFollowUpDestination(null)
                                        }
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            followUpProcessing || !followUpAt
                                        }
                                    >
                                        <CalendarClock />
                                        {followUpProcessing
                                            ? 'Moving lead…'
                                            : `Move to ${workflowLocation(followUpDestination)}`}
                                    </button>
                                </div>
                            </form>
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
                                                <span>
                                                    {formatPhoneNumber(
                                                        call.phone_number,
                                                    )}
                                                </span>
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
                                                    {entry.note.note_type ===
                                                    'telemarketer'
                                                        ? (selected.agent
                                                              ?.agent_name ??
                                                          entry.note.creator
                                                              ?.username ??
                                                          'Unknown agent')
                                                        : (entry.note.creator
                                                              ?.username ??
                                                          'Unknown user')}
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
                                                <strong>{section.label}</strong>
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
