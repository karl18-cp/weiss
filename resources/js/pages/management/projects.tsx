import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowUpDown,
    BriefcaseBusiness,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CircleDollarSign,
    ClipboardList,
    Eye,
    ExternalLink,
    FileSpreadsheet,
    FileText,
    FolderSync,
    History,
    Landmark,
    Mail,
    MapPin,
    Pencil,
    Phone,
    PhoneCall,
    Plus,
    Printer,
    Search,
    Trash2,
    Upload,
    UserRound,
    Users,
} from 'lucide-react';
import {
    Fragment,
    createElement,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import '@/../css/projects.css';
import '@/../css/projects-tab-themes.css';
import { useSystemModal } from '@/components/system-modal-provider';
import { RingCentralCallButton } from '@/components/ringcentral-call-button';
import { AttachmentPreviewGallery } from '@/components/attachment-preview-gallery';
import { SearchableSelect } from '@/components/searchable-select';
import { appointmentDate, appointmentInputValue } from '@/lib/appointment-date';
import { formatPhoneNumber } from '@/lib/phone-number';
import type { Auth } from '@/types/auth';
import { CRM_TIME_ZONE, crmDateKey } from '@/lib/crm-time';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type ProductOption = { prod_id: number; product_name: string };
type CompanyOption = { com_id: number; company: string; prefix: string };
type AgentOption = { agent_id: number; agent_name: string };
type SalesmanOption = {
    salesman_id: number;
    salesman_name: string;
    phone: string | null;
};
type ManagerOption = { manager_id: number; manager_name: string };
type ProjectStatusFilter =
    'all' | 'new' | 'progress' | 'completed' | 'canceled';
type ProjectSortDirection = 'asc' | 'desc';
type AccountingSortKey =
    | 'date'
    | 'company'
    | 'project'
    | 'counterparty'
    | 'invoice'
    | 'paymentMethod'
    | 'requestedBy'
    | 'status'
    | 'amount'
    | 'reference'
    | 'category'
    | 'notes'
    | 'qb'
    | 'file';
type InvoiceSortKey =
    | 'date'
    | 'number'
    | 'chargedBy'
    | 'amount'
    | 'balance'
    | 'notes'
    | 'status';
type InvoicePayableSortKey =
    | 'date'
    | 'reference'
    | 'payTo'
    | 'requestedBy'
    | 'status'
    | 'amount'
    | 'notes';
type ProjectSortKey =
    | 'signed'
    | 'status'
    | 'customer'
    | 'company'
    | 'projectNumber'
    | 'city'
    | 'phone'
    | 'agent'
    | 'salesman'
    | 'sale'
    | 'product'
    | 'notes';

type ProjectSale = {
    id: number;
    type: 'original' | 'referral';
    amount: string;
    sale_date: string;
    product: ProductOption | null;
    salesman: SalesmanOption | null;
};

type ScheduledPayment = {
    id: number;
    expected_date: string;
    payment_stage: string;
    amount: string;
    qb: boolean;
    printed_sent: boolean;
    notes: string | null;
};

type ContractorOption = { con_id: number; contractor: string };
type VendorOption = { vendor_id: number; vendor: string };

type ProjectInvoice = {
    id: number;
    project_sale_id: number | null;
    project_document_id: number | null;
    invoice_number: string;
    invoice_date: string;
    amount: string;
    notes: string | null;
    status: 'pending' | 'ok_to_pay' | 'paid';
    file_name: string | null;
    file_mime: string | null;
    file_size: number | null;
    contractor: ContractorOption | null;
    vendor: VendorOption | null;
};

type AccountingTransaction = {
    id: number;
    project_sale_id: number | null;
    project_document_id: number | null;
    type: 'receivable' | 'payable';
    category: string;
    transaction_date: string;
    payment_method:
        | 'check'
        | 'zelle'
        | 'credit_card'
        | 'wire_transfer'
        | 'square_transfer'
        | 'cash'
        | null;
    reference_number: string | null;
    invoice_order_number: string | null;
    counterparty: string | null;
    requested_by: string | null;
    contractor: ContractorOption | null;
    vendor: VendorOption | null;
    salesman: SalesmanOption | null;
    company: CompanyOption | null;
    amount: string;
    status: 'pending' | 'deposit' | 'ok_to_pay' | 'paid';
    qb: boolean;
    notes: string | null;
    file_name: string | null;
    file_mime: string | null;
    file_size: number | null;
    scheduled_payments: ScheduledPayment[];
    invoice: ProjectInvoice | null;
};

type ProjectDocument = {
    key: string;
    type:
        | 'Contract'
        | 'Project Upload'
        | 'Invoice'
        | 'Receivable'
        | 'Payable'
        | 'Sale Contract';
    fileName: string;
    date: string;
    notes: string;
    status: string;
    mime: string;
    size: number | null;
    url: string;
};

type ProjectPaymentCheck = {
    id: number;
    type: 'lead_cost' | 'commission';
    amount: string;
    file_name: string | null;
    file_mime: string | null;
    file_size: number | null;
    paid_at: string | null;
};

type BalanceView = 'receivable' | 'payable' | 'invoice';

type BalanceItem = {
    key: string;
    project: Project;
    label: string;
    counterparty: string;
    date: string;
    status: string;
    balance: number;
};

type ProjectCommissionBreakdown = {
    project_id: number;
    project_number: string | null;
    accounting: {
        sale_amount: number;
        received_commissionable: number;
        project_balance: number;
        lead_cost: number;
        expenses_commissionable: number;
        open_invoices: number;
        gross_profit: number;
        salesman_commission: number;
        office_commission: number;
        total_commission: number;
        total_commission_paid: number;
        profit_net: number;
    };
    salesmen: Array<{
        salesman_id: number;
        salesman_name: string;
        original_sale: number;
        change_orders: number;
        total_sale: number;
        received: number;
        project_balance: number;
        expenses: number;
        open_invoices: number;
        lead_cost_rate: number;
        lead_cost: number;
        change_order_lead_cost_rate: number;
        change_order_lead_cost: number;
        commission_base: number;
        gross_profit: number;
        commission_rate: number;
        commission_due: number;
        maximum_commission: number;
        commission_paid: number;
        commission_balance: number;
        sale_breakdown: Array<{
            sale_id: number;
            type: 'original' | 'referral';
            stake_percent: number;
            sale_share: number;
            received_share: number;
            expense_share: number;
            commission_base: number;
            commission_due: number;
            maximum_commission: number;
        }>;
    }>;
};

type Project = {
    id: number;
    contract_file_name: string | null;
    contract_file_mime: string | null;
    contract_file_size: number | null;
    lead_id: number | null;
    tele_lead_excluded: boolean;
    project_number: string | null;
    amount: string;
    status: string;
    created_at: string;
    sales: ProjectSale[];
    scheduled_payments: ScheduledPayment[];
    invoices: ProjectInvoice[];
    accounting_transactions: AccountingTransaction[];
    documents: Array<{
        id: number;
        project_invoice_id: number | null;
        project_accounting_transaction_id: number | null;
        project_sale_id: number | null;
        category: string;
        file_name: string;
        file_mime: string | null;
        file_size: number | null;
        created_at: string;
    }>;
    payment_checks: ProjectPaymentCheck[];
    activity_logs: Array<{
        id: number;
        subject_type: string;
        action: string;
        description: string;
        old_values: Record<string, unknown> | null;
        new_values: Record<string, unknown> | null;
        created_at: string;
        actor: { acc_id: number; username: string } | null;
    }>;
    contractors: Array<ContractorOption & { pivot: { position: number } }>;
    lead: {
        id: number;
        project_family_id: number | null;
        created_at: string;
        customer_name: string;
        appointment_at: string;
        city: string;
        primary_number: string;
        secondary_number: string | null;
        mobile_number: string | null;
        email: string | null;
        address: string;
        state: string;
        zip_code: string;
        source: string;
        telemarketer_notes: string;
        company: CompanyOption | null;
        product: ProductOption | null;
        agent: AgentOption | null;
        second_agent: AgentOption | null;
        salesman_one: SalesmanOption | null;
        salesman_two: SalesmanOption | null;
        notes: {
            id: number;
            note_type: string;
            body: string;
            created_at: string;
        }[];
    };
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

const localDateValue = () => crmDateKey();

const dateTimeInputValue = (value: string | null) => {
    if (!value) return '';

    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: CRM_TIME_ZONE,
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

const formatFileSize = (bytes: number | null) => {
    if (!bytes) {
        return '—';
    }

    return bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const projectInvoiceHasAttachment = (
    invoice: ProjectInvoice,
    documents: Project['documents'],
) =>
    Boolean(
        invoice.file_name ||
            invoice.project_document_id ||
            documents.some(
                (document) => document.project_invoice_id === invoice.id,
            ),
    );

const accountingTransactionHasAttachment = (
    transaction: AccountingTransaction,
    documents: Project['documents'],
) =>
    Boolean(
        transaction.file_name ||
            transaction.project_document_id ||
            documents.some(
                (document) =>
                    document.project_accounting_transaction_id ===
                    transaction.id,
            ),
    );

const historyFieldLabel = (field: string) =>
    field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const historyValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const invoiceStatusLabels: Record<ProjectInvoice['status'], string> = {
    pending: 'Pending',
    ok_to_pay: 'OK 2 Pay',
    paid: 'Paid',
};

const accountingStatusLabels: Record<AccountingTransaction['status'], string> =
    {
        pending: 'Pending',
        deposit: 'Deposit',
        ok_to_pay: 'OK 2 Pay',
        paid: 'Paid',
    };

const invoiceNumberWithPrefix = (value: string) => {
    const suffix = value.replace(/^INV[#-]?/i, '').replace(/\s+/g, '');

    return `INV#${suffix}`;
};

const invoiceNumberSuffix = (value: string) =>
    invoiceNumberWithPrefix(value).slice(4);

const paymentPrefixes = {
    check: 'CH#',
    zelle: 'ZELLE',
    credit_card: 'CC-',
    wire_transfer: 'WIRE-',
    square_transfer: 'SQUARE-',
    cash: 'CASH-',
} as const;

const paymentMethodLabels = {
    check: 'Check',
    zelle: 'Zelle',
    credit_card: 'Credit Card',
    wire_transfer: 'Wire Transfer',
    square_transfer: 'Square Transfer',
    cash: 'Cash',
} as const;

const cashReferenceCode = () =>
    `CASH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const paymentReference = (method: keyof typeof paymentPrefixes, value = '') => {
    const knownPrefix = Object.values(paymentPrefixes).find((prefix) =>
        value.toUpperCase().startsWith(prefix),
    );
    const suffix = (knownPrefix ? value.slice(knownPrefix.length) : value)
        .replace(/\s+/g, '')
        .replace(/^CH#/i, '')
        .replace(/^ZELLE/i, '')
        .replace(/^CC-/i, '')
        .replace(/^WIRE-/i, '')
        .replace(/^SQUARE-/i, '');

    return `${paymentPrefixes[method]}${suffix}`;
};

export default function Projects({
    projects,
    products,
    companies,
    agents,
    salesmen,
    managers,
    contractors,
    vendors,
    requesters,
    currentRequester,
    googleDriveUrl,
}: {
    projects: Project[];
    products: ProductOption[];
    companies: CompanyOption[];
    agents: AgentOption[];
    salesmen: SalesmanOption[];
    managers: ManagerOption[];
    contractors: ContractorOption[];
    vendors: VendorOption[];
    requesters: string[];
    currentRequester: string | null;
    googleDriveUrl: string | null;
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const canGeneratePaymentCodes =
        auth.user.role === 'admin' ||
        auth.permissions?.generate_payment_codes === 'edit';
    const sbhCompanyId = String(
        companies.find(
            (company) => company.prefix.trim().toUpperCase() === 'SBH',
        )?.com_id ?? '',
    );
    const { confirm } = useSystemModal();
    const projectWorkspaceStorageKey = 'weiss.projects.workspace';
    const projectFiltersStorageKey = 'weiss.projects.filters';
    const storedProjectWorkspace = (() => {
        try {
            return JSON.parse(
                window.sessionStorage.getItem(projectWorkspaceStorageKey) ??
                    '{}',
            ) as { projectId?: number; tab?: string };
        } catch {
            return {} as { projectId?: number; tab?: string };
        }
    })();
    const queryParameters = new URLSearchParams(window.location.search);
    const storedProjectFilters = (() => {
        try {
            return JSON.parse(
                window.localStorage.getItem(projectFiltersStorageKey) ?? '{}',
            ) as {
                status?: ProjectStatusFilter;
                company?: string;
                salesman?: string;
                dateFrom?: string;
                dateTo?: string;
                search?: string;
                sort?: {
                    key: ProjectSortKey;
                    direction: ProjectSortDirection;
                };
            };
        } catch {
            return {};
        }
    })();
    const requestedProjectId = Number(queryParameters.get('project')) || null;
    const restoredProjectId =
        requestedProjectId ?? Number(storedProjectWorkspace.projectId) ?? null;
    const isSearchFocus = queryParameters.get('focus') === 'search';
    const focusedProjectRowRef = useRef<HTMLTableRowElement | null>(null);
    const [activeTab, setActiveTab] = useState<
        'PRJ' | 'DTL' | 'SP' | 'INV' | 'ACT' | 'TTL' | 'DOC' | 'HIS'
    >(() => {
        const requestedTab =
            queryParameters.get('tab') ?? storedProjectWorkspace.tab;

        return ['DTL', 'SP', 'INV', 'ACT', 'TTL', 'DOC', 'HIS'].includes(requestedTab ?? '')
            ? (requestedTab as 'DTL' | 'SP' | 'INV' | 'ACT' | 'TTL' | 'DOC' | 'HIS')
            : 'PRJ';
    });
    const [projectStatusFilter, setProjectStatusFilter] =
        useState<ProjectStatusFilter>(() =>
            ['all', 'new', 'progress', 'completed', 'canceled'].includes(
                storedProjectFilters.status ?? '',
            )
                ? (storedProjectFilters.status as ProjectStatusFilter)
                : 'progress',
        );
    const [projectCompanyFilter, setProjectCompanyFilter] = useState(
        storedProjectFilters.company ?? 'all',
    );
    const [projectSalesmanFilter, setProjectSalesmanFilter] = useState(
        storedProjectFilters.salesman ?? 'all',
    );
    const [projectDateFrom, setProjectDateFrom] = useState(
        storedProjectFilters.dateFrom ?? '',
    );
    const [projectDateTo, setProjectDateTo] = useState(
        storedProjectFilters.dateTo ?? '',
    );
    const [projectSearch, setProjectSearch] = useState(
        storedProjectFilters.search ?? '',
    );
    const [projectSort, setProjectSort] = useState<{
        key: ProjectSortKey;
        direction: ProjectSortDirection;
    }>(() => storedProjectFilters.sort ?? { key: 'signed', direction: 'desc' });
    const [selectedId, setSelectedId] = useState<number | null>(() =>
        activeTab !== 'PRJ' &&
        projects.some((project) => project.id === restoredProjectId)
            ? restoredProjectId
            : null,
    );
    const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
    const [expandedSaleProjectIds, setExpandedSaleProjectIds] = useState<
        number[]
    >([]);
    const contractorAssignmentForm = useForm({
        contractor_ids: ['', '', '', ''] as string[],
    });
    const [selectedScheduledPaymentId, setSelectedScheduledPaymentId] =
        useState<number | null>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
        null,
    );
    const [invoiceSort, setInvoiceSort] = useState<{
        key: InvoiceSortKey;
        direction: ProjectSortDirection;
    }>({ key: 'date', direction: 'desc' });
    const [invoicePayableSort, setInvoicePayableSort] = useState<{
        key: InvoicePayableSortKey;
        direction: ProjectSortDirection;
    }>({ key: 'date', direction: 'desc' });
    const [accountingMode, setAccountingMode] = useState<
        'receivable' | 'payable' | 'commission'
    >('receivable');
    const [accountingSort, setAccountingSort] = useState<{
        key: AccountingSortKey;
        direction: ProjectSortDirection;
    }>({ key: 'date', direction: 'desc' });
    const [selectedAccountingId, setSelectedAccountingId] = useState<
        number | null
    >(null);
    const [commissionBreakdown, setCommissionBreakdown] =
        useState<ProjectCommissionBreakdown | null>(null);
    const [commissionBreakdownLoading, setCommissionBreakdownLoading] =
        useState(false);
    const [selectedDocumentKey, setSelectedDocumentKey] = useState<
        string | null
    >(null);
    const documentUploadForm = useForm<{
        files: File[];
        target_type: 'project' | 'invoice' | 'accounting' | 'sale' | 'completion';
        target_id: string;
        completion_audience?: 'office' | 'salesman';
        completion_salesman_id?: string;
    }>({ files: [], target_type: 'project', target_id: '', completion_audience: 'office', completion_salesman_id: '' });
    const [completionModalOpen, setCompletionModalOpen] = useState(false);
    const [completionAudience, setCompletionAudience] = useState<'office' | 'salesman'>('office');
    const [completionSalesmanId, setCompletionSalesmanId] = useState('');
    const [paymentCheckType, setPaymentCheckType] = useState<
        'lead_cost' | 'commission' | null
    >(null);
    const paymentCheckForm = useForm<{ amount: string; check_file: File | null }>({
        amount: '',
        check_file: null,
    });
    const [
        accountingAttachmentTransaction,
        setAccountingAttachmentTransaction,
    ] = useState<AccountingTransaction | null>(null);
    const [saleAttachmentSale, setSaleAttachmentSale] =
        useState<ProjectSale | null>(null);
    const [contractViewerProject, setContractViewerProject] =
        useState<Project | null>(null);
    const [editingProjectDetails, setEditingProjectDetails] = useState(false);
    const [creatingProject, setCreatingProject] = useState(false);
    const [creatingCustomerProject, setCreatingCustomerProject] =
        useState(false);
    const [syncingDriveFolders, setSyncingDriveFolders] = useState(false);
    const [projectOnlySelectionMode, setProjectOnlySelectionMode] =
        useState(false);
    const [balanceView, setBalanceView] = useState<BalanceView | null>(null);
    const [selectedProjectOnlyIds, setSelectedProjectOnlyIds] = useState<
        number[]
    >([]);
    const [updatingProjectOnly, setUpdatingProjectOnly] = useState(false);
    const projectDetailsForm = useForm({
        project_number: '',
        status: 'new',
        company_id: '',
        product_id: '',
        customer_name: '',
        primary_number: '',
        secondary_number: '',
        mobile_number: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        source: '',
        appointment_at: '',
        lead_created_at: '',
        agent_id: '',
        agent_2_id: '',
        salesman_1_id: '',
        salesman_2_id: '',
    });
    const projectCreateForm = useForm({
        customer_name: '',
        contact_name: '',
        primary_number: '',
        mobile_number: '',
        email: '',
        address: '',
        city: '',
        state: 'CA',
        zip_code: '',
        company_id: '',
        product_id: '',
        telemarketer_id: '',
        salesman_id: '',
        manager_id: '',
        project_number: '',
        status: 'new',
        amount: '',
        budget: '',
        notes: '',
        signed_date: localDateValue(),
    });
    const customerProjectForm = useForm({
        company_id: '',
        product_id: '',
        appointment_at: '',
        salesman_1_id: '',
        salesman_2_id: '',
        amount: '',
        notes: '',
    });

    const closeProjectCreate = () => {
        setCreatingProject(false);
        projectCreateForm.clearErrors();
    };

    const saveNewProject = () => {
        projectCreateForm.post('/management/projects', {
            preserveScroll: true,
            onSuccess: () => {
                setCreatingProject(false);
                projectCreateForm.reset();
                projectCreateForm.setData('signed_date', localDateValue());
            },
        });
    };

    const openCustomerProjectCreate = () => {
        if (!selected || selected.lead.id === 0) return;

        customerProjectForm.setData({
            company_id: String(selected.lead.company?.com_id ?? ''),
            product_id: '',
            appointment_at: '',
            salesman_1_id: '',
            salesman_2_id: '',
            amount: '',
            notes: '',
        });
        customerProjectForm.clearErrors();
        setCreatingCustomerProject(true);
    };

    const saveCustomerProject = () => {
        if (!selected) return;

        customerProjectForm.post(
            `/management/projects/${selected.id}/customer-projects`,
            {
                onSuccess: () => {
                    setCreatingCustomerProject(false);
                    customerProjectForm.reset();
                },
            },
        );
    };

    const deleteCustomerProject = async () => {
        if (!selected || selected.id === rootCustomerProjectId) return;

        const accepted = await confirm({
            title: 'Delete this customer project?',
            message: `${projectNumber(selected)} and only its own sales, invoices, receivables, payables, commissions, and files will be permanently deleted. The customer’s other projects will remain.`,
            confirmLabel: 'Delete project',
            tone: 'danger',
        });

        if (accepted) {
            router.delete(`/management/projects/${selected.id}`, {
                onSuccess: () => {
                    setSelectedId(null);
                    setActiveTab('PRJ');
                },
            });
        }
    };

    const syncDriveFolders = async () => {
        const accepted = await confirm({
            title: 'Sync project folders?',
            message:
                'The CRM will create missing folders inside Open projects. Existing matching folders will be skipped.',
            confirmLabel: 'Sync folders',
            tone: 'info',
        });

        if (!accepted) return;

        setSyncingDriveFolders(true);
        router.post(
            '/management/projects/sync-drive-folders',
            {},
            {
                preserveScroll: true,
                onFinish: () => setSyncingDriveFolders(false),
            },
        );
    };
    const [saleModal, setSaleModal] = useState<{
        mode: 'create' | 'edit';
        sale: ProjectSale | null;
    } | null>(null);
    const saleForm = useForm({
        amount: '',
        sale_date: '',
        product_id: '',
        salesman_id: '',
        destination: 'current',
        project_number: '',
        files: [] as File[],
    });
    const [scheduledPaymentModal, setScheduledPaymentModal] = useState<{
        mode: 'create' | 'edit';
        scheduledPayment: ScheduledPayment | null;
    } | null>(null);
    const scheduledPaymentForm = useForm({
        expected_date: '',
        payment_stage: '',
        amount: '',
        qb: false,
        printed_sent: false,
        notes: '',
    });
    const [invoiceModal, setInvoiceModal] = useState<{
        mode: 'create' | 'edit';
        invoice: ProjectInvoice | null;
    } | null>(null);
    const [invoiceFilePreview, setInvoiceFilePreview] = useState<{
        url: string;
        mime: string;
    } | null>(null);
    const [isInvoiceFileDragging, setIsInvoiceFileDragging] = useState(false);
    const [invoiceContractorSearch, setInvoiceContractorSearch] = useState('');
    const invoiceForm = useForm<{
        invoice_number: string;
        invoice_date: string;
        contractor_id: string;
        vendor_id: string;
        amount: string;
        notes: string;
        files: File[];
        project_document_id: string;
        project_sale_id: string;
    }>({
        invoice_number: 'INV#',
        invoice_date: '',
        contractor_id: '',
        vendor_id: '',
        amount: '',
        notes: '',
        files: [],
        project_document_id: '',
        project_sale_id: '',
    });
    const [accountingModal, setAccountingModal] = useState<{
        mode: 'create' | 'edit';
        transaction: AccountingTransaction | null;
    } | null>(null);
    const [payablePaymentModalOpen, setPayablePaymentModalOpen] =
        useState(false);
    const [receivableQbModal, setReceivableQbModal] = useState<{
        transaction: AccountingTransaction;
        paymentMethod: keyof typeof paymentPrefixes;
        referenceNumber: string;
        error: string;
    } | null>(null);
    const [receivableQbDetailsOpen, setReceivableQbDetailsOpen] =
        useState(false);
    const [accountingFilePreview, setAccountingFilePreview] = useState<{
        url: string;
        mime: string;
        isLocal: boolean;
    } | null>(null);
    const [isAccountingFileDragging, setIsAccountingFileDragging] =
        useState(false);
    const accountingForm = useForm<{
        type: 'receivable' | 'payable';
        unassigned: boolean;
        company_id: string;
        category: string;
        transaction_date: string;
        payment_method:
            | 'check'
            | 'zelle'
            | 'credit_card'
            | 'wire_transfer'
            | 'square_transfer'
            | 'cash';
        reference_number: string;
        invoice_order_number: string;
        counterparty: string;
        contractor_id: string;
        vendor_id: string;
        salesman_id: string;
        requested_by: string;
        amount: string;
        status: AccountingTransaction['status'];
        notes: string;
        file: File | null;
        project_document_id: string;
        project_invoice_id: string;
        project_sale_id: string;
        scheduled_payment_ids: number[];
    }>({
        type: 'receivable',
        unassigned: false,
        company_id: '',
        category: 'Customer Payment',
        transaction_date: '',
        payment_method: 'check',
        reference_number: '',
        invoice_order_number: '',
        counterparty: '',
        contractor_id: '',
        vendor_id: '',
        salesman_id: '',
        requested_by: '',
        amount: '',
        status: 'pending',
        notes: '',
        file: null,
        project_document_id: '',
        project_invoice_id: '',
        project_sale_id: '',
        scheduled_payment_ids: [],
    });
    const total = projects.reduce(
        (sum, project) =>
            sum +
            project.sales.reduce(
                (saleTotal, sale) => saleTotal + Number(sale.amount),
                0,
            ),
        0,
    );

    const projectNumber = (project: Project) => {
        if (project.project_number?.trim()) {
            return project.project_number;
        }

        return 'Not assigned';
    };

    const plainNote = (value: string | null | undefined) =>
        (value || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+/g, ' ')
            .trim();

    const latestNote = (project: Project) =>
        plainNote(
            project.lead.notes[0]?.body || project.lead.telemarketer_notes,
        ) || '—';

    const selected = useMemo(
        () => projects.find((project) => project.id === selectedId) ?? null,
        [projects, selectedId],
    );
    const customerProjects = useMemo(() => {
        if (!selected || selected.lead.id === 0) return [];

        const familyId =
            selected.lead.project_family_id ?? selected.lead.id;

        return projects.filter(
            (project) =>
                project.lead.id !== 0 &&
                (project.lead.project_family_id ?? project.lead.id) ===
                    familyId,
        );
    }, [projects, selected]);
    const rootCustomerProjectId = useMemo(() => {
        if (!selected || customerProjects.length === 0) return null;
        const familyId = selected.lead.project_family_id ?? selected.lead.id;

        return customerProjects.find((project) => project.lead.id === familyId)?.id
            ?? Math.min(...customerProjects.map((project) => project.id));
    }, [customerProjects, selected]);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (selectedId) {
            url.searchParams.set('project', String(selectedId));
            url.searchParams.set('tab', activeTab);
            window.sessionStorage.setItem(
                projectWorkspaceStorageKey,
                JSON.stringify({ projectId: selectedId, tab: activeTab }),
            );
        } else {
            url.searchParams.delete('project');
            url.searchParams.delete('tab');
            window.sessionStorage.removeItem(projectWorkspaceStorageKey);
        }
        window.history.replaceState(window.history.state, '', url);
    }, [selectedId, activeTab]);

    useEffect(() => {
        window.localStorage.setItem(
            projectFiltersStorageKey,
            JSON.stringify({
                status: projectStatusFilter,
                company: projectCompanyFilter,
                salesman: projectSalesmanFilter,
                dateFrom: projectDateFrom,
                dateTo: projectDateTo,
                search: projectSearch,
                sort: projectSort,
            }),
        );
    }, [
        projectStatusFilter,
        projectCompanyFilter,
        projectSalesmanFilter,
        projectDateFrom,
        projectDateTo,
        projectSearch,
        projectSort,
    ]);

    useEffect(() => {
        const assigned = [...(selected?.contractors ?? [])]
            .sort(
                (first, second) => first.pivot.position - second.pivot.position,
            )
            .map((contractor) => String(contractor.con_id));
        contractorAssignmentForm.setData(
            'contractor_ids',
            Array.from({ length: 4 }, (_, index) => assigned[index] ?? ''),
        );
        contractorAssignmentForm.clearErrors();
    }, [selectedId]);

    const saveContractorAssignments = (event: React.FormEvent) => {
        event.preventDefault();
        if (!selected) return;

        contractorAssignmentForm.patch(
            `/management/projects/${selected.id}/contractors`,
            { preserveScroll: true },
        );
    };

    const projectSalesmanIds = (project: Project) =>
        Array.from(
            new Set(
                [
                    project.lead.salesman_one?.salesman_id,
                    project.lead.salesman_two?.salesman_id,
                    ...project.sales.map((sale) => sale.salesman?.salesman_id),
                ].filter((id): id is number => id !== undefined && id !== null),
            ),
        );

    const assignedProjectSalesmen = selected
        ? Array.from(
              new Map(
                  [
                      selected.lead.salesman_one,
                      selected.lead.salesman_two,
                      ...selected.sales.map((sale) => sale.salesman),
                  ]
                      .filter(
                          (salesman): salesman is SalesmanOption =>
                              salesman !== null,
                      )
                      .map((salesman) => [salesman.salesman_id, salesman]),
              ).values(),
          )
        : [];

    const originalProjectSalesmanIds = (project: Project) => {
        const referralOnlySalesmanIds = new Set(
            project.sales
                .filter((sale) => sale.type === 'referral')
                .map((sale) => sale.salesman?.salesman_id)
                .filter(
                    (id): id is number => id !== undefined && id !== null,
                ),
        );

        return Array.from(
            new Set(
                [
                    project.lead.salesman_one?.salesman_id,
                    project.lead.salesman_two?.salesman_id,
                ].filter(
                    (id): id is number =>
                        id !== undefined &&
                        id !== null &&
                        !referralOnlySalesmanIds.has(id),
                ),
            ),
        );
    };

    const projectSaleTotal = (project: Project) =>
        project.sales.reduce((sum, sale) => sum + Number(sale.amount), 0);

    const projectAppointmentTime = (project: Project) => {
        if (!project.lead.appointment_at) return 0;

        const time = appointmentDate(project.lead.appointment_at).getTime();

        return Number.isNaN(time) ? 0 : time;
    };

    const projectSaleContribution = (
        project: Project,
        saleType?: ProjectSale['type'],
    ) => {
        const matchingSales = project.sales.filter(
            (sale) => !saleType || sale.type === saleType,
        );

        if (projectSalesmanFilter === 'all') {
            return matchingSales.reduce(
                (sum, sale) => sum + Number(sale.amount),
                0,
            );
        }

        const selectedSalesmanId = Number(projectSalesmanFilter);
        const originalSalesmen = originalProjectSalesmanIds(project);
        const isOriginalSalesman =
            originalSalesmen.includes(selectedSalesmanId);
        const originalStake = 1 / Math.max(1, originalSalesmen.length);

        return matchingSales.reduce((sum, sale) => {
            if (isOriginalSalesman) {
                return sum + Number(sale.amount) * originalStake;
            }

            // A referral-only salesman is not present on the original sale,
            // but their assigned referral must still appear in Salesman Share.
            if (
                sale.type === 'referral' &&
                sale.salesman?.salesman_id === selectedSalesmanId
            ) {
                return sum + Number(sale.amount);
            }

            return sum;
        }, 0);
    };

    const matchesProjectSearch = (project: Project) => {
        const query = projectSearch.trim().toLocaleLowerCase();
        if (!query) return true;

        return [
            projectNumber(project),
            project.lead.customer_name,
            project.lead.address,
            project.lead.city,
            project.lead.state,
            project.lead.zip_code,
            project.lead.primary_number,
            project.lead.mobile_number,
            project.lead.email,
            project.lead.company?.company,
            project.lead.company?.prefix,
            project.lead.agent?.agent_name,
            project.lead.second_agent?.agent_name,
            project.lead.salesman_one?.salesman_name,
            project.lead.salesman_two?.salesman_name,
            ...project.sales.map((sale) => sale.salesman?.salesman_name),
            project.lead.product?.product_name,
            latestNote(project),
        ]
            .filter(Boolean)
            .some((value) =>
                String(value).toLocaleLowerCase().includes(query),
            );
    };

    const matchesProjectFilters = (project: Project, includeStatus = true) => {
        if (
            includeStatus &&
            projectStatusFilter !== 'all' &&
            (project.status || 'new') !== projectStatusFilter
        ) return false;
        if (
            projectCompanyFilter !== 'all' &&
            String(project.lead.company?.com_id ?? '') !== projectCompanyFilter
        ) return false;
        if (
            projectSalesmanFilter !== 'all' &&
            !projectSalesmanIds(project).some(
                (id) => String(id) === projectSalesmanFilter,
            )
        ) return false;

        const signedDate = projectAppointmentTime(project)
            ? crmDateKey(appointmentDate(project.lead.appointment_at))
            : '';
        if ((projectDateFrom || projectDateTo) && !signedDate) return false;
        if (projectDateFrom && signedDate < projectDateFrom) return false;
        if (projectDateTo && signedDate > projectDateTo) return false;

        return matchesProjectSearch(project);
    };

    const filteredProjects = useMemo(() => {
        const statusFiltered = projects.filter((project) =>
            matchesProjectFilters(project),
        );
        const valueFor = (project: Project): string | number => {
            switch (projectSort.key) {
                case 'signed':
                    return projectAppointmentTime(project);
                case 'status':
                    return project.status || 'new';
                case 'customer':
                    return project.lead.customer_name;
                case 'company':
                    return project.lead.company?.prefix ?? '';
                case 'projectNumber':
                    return projectNumber(project);
                case 'city':
                    return project.lead.city;
                case 'phone':
                    return project.lead.primary_number;
                case 'agent':
                    return project.lead.agent?.agent_name ?? '';
                case 'salesman':
                    return [
                        project.lead.salesman_one?.salesman_name,
                        project.lead.salesman_two?.salesman_name,
                    ]
                        .filter(Boolean)
                        .join(' & ');
                case 'sale':
                    return projectSaleTotal(project);
                case 'product':
                    return project.lead.product?.product_name ?? '';
                case 'notes':
                    return latestNote(project);
            }
        };

        const sorted = [...statusFiltered].sort((left, right) => {
            const leftValue = valueFor(left);
            const rightValue = valueFor(right);
            const comparison =
                typeof leftValue === 'number' && typeof rightValue === 'number'
                    ? leftValue - rightValue
                    : String(leftValue).localeCompare(
                          String(rightValue),
                          undefined,
                          {
                              numeric: true,
                              sensitivity: 'base',
                          },
                      );

            return projectSort.direction === 'asc' ? comparison : -comparison;
        });

        if (isSearchFocus && requestedProjectId) {
            sorted.sort((left, right) =>
                left.id === requestedProjectId
                    ? -1
                    : right.id === requestedProjectId
                      ? 1
                      : 0,
            );
        }

        return sorted;
    }, [
        isSearchFocus,
        projects,
        projectCompanyFilter,
        projectDateFrom,
        projectDateTo,
        projectSalesmanFilter,
        projectSearch,
        projectSort,
        projectStatusFilter,
        requestedProjectId,
    ]);

    useEffect(() => {
        if (!isSearchFocus || !requestedProjectId) return;

        setProjectStatusFilter('all');
        setProjectCompanyFilter('all');
        setProjectSalesmanFilter('all');
        setProjectDateFrom('');
        setProjectDateTo('');
        setProjectSearch('');
        const frame = window.requestAnimationFrame(() => {
            focusedProjectRowRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [filteredProjects.length, isSearchFocus, requestedProjectId]);

    const toggleProjectSort = (key: ProjectSortKey) => {
        setProjectSort((current) => ({
            key,
            direction:
                current.key === key
                    ? current.direction === 'asc'
                        ? 'desc'
                        : 'asc'
                    : key === 'signed' || key === 'sale'
                      ? 'desc'
                      : 'asc',
        }));
    };

    const selectableProjectIds = filteredProjects
        .filter((project) => project.lead_id !== null)
        .map((project) => project.id);
    const allVisibleProjectsSelected =
        selectableProjectIds.length > 0 &&
        selectableProjectIds.every((id) => selectedProjectOnlyIds.includes(id));

    const toggleProjectOnlySelection = (projectId: number) => {
        if (!selectableProjectIds.includes(projectId)) return;

        setSelectedProjectOnlyIds((current) =>
            current.includes(projectId)
                ? current.filter((id) => id !== projectId)
                : [...current, projectId],
        );
    };

    const cancelProjectOnlySelection = () => {
        setProjectOnlySelectionMode(false);
        setSelectedProjectOnlyIds([]);
    };

    const bulkUpdateProjectOnly = (projectOnly: boolean) => {
        if (selectedProjectOnlyIds.length === 0 || updatingProjectOnly) return;

        router.patch(
            '/management/projects/tele-lead-visibility/bulk',
            {
                project_ids: selectedProjectOnlyIds,
                project_only: projectOnly,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setUpdatingProjectOnly(true),
                onFinish: () => setUpdatingProjectOnly(false),
                onSuccess: cancelProjectOnlySelection,
            },
        );
    };

    const sortableProjectHeader = (key: ProjectSortKey, label: string) => {
        const active = projectSort.key === key;

        return (
            <th
                aria-sort={
                    active
                        ? projectSort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                        : 'none'
                }
            >
                <button
                    type="button"
                    className={
                        active ? 'projects-sort is-active' : 'projects-sort'
                    }
                    onClick={() => toggleProjectSort(key)}
                    title={`Sort by ${label}`}
                >
                    <span>{label}</span>
                    {active ? (
                        projectSort.direction === 'asc' ? (
                            <ChevronUp aria-hidden="true" />
                        ) : (
                            <ChevronDown aria-hidden="true" />
                        )
                    ) : (
                        <ArrowUpDown aria-hidden="true" />
                    )}
                </button>
            </th>
        );
    };
    const projectStatusCounts = useMemo(() => {
        const scopedProjects = projects.filter((project) =>
            matchesProjectFilters(project, false),
        );

        return {
            all: scopedProjects.length,
            new: scopedProjects.filter(
                (project) => (project.status || 'new') === 'new',
            ).length,
            progress: scopedProjects.filter(
                (project) => project.status === 'progress',
            ).length,
            completed: scopedProjects.filter(
                (project) => project.status === 'completed',
            ).length,
            canceled: scopedProjects.filter(
                (project) => project.status === 'canceled',
            ).length,
        };
    }, [
        projects,
        projectCompanyFilter,
        projectDateFrom,
        projectDateTo,
        projectSalesmanFilter,
        projectSearch,
    ]);

    const projectInvoiceContractorIds = new Set(
        selected?.invoices
            .map((invoice) => invoice.contractor?.con_id)
            .filter((id): id is number => id !== undefined) ?? [],
    );
    const contractorsWithProjectInvoices = contractors.filter((contractor) =>
        projectInvoiceContractorIds.has(contractor.con_id),
    );
    const otherContractors = contractors.filter(
        (contractor) => !projectInvoiceContractorIds.has(contractor.con_id),
    );
    const payableRecipientOptions = [
        { value: '', label: 'No contractor or vendor' },
        ...contractorsWithProjectInvoices.map((contractor) => ({
            value: `contractor:${contractor.con_id}`,
            label: `Contractor — ${contractor.contractor}`,
            keywords: 'contractor invoice',
        })),
        ...otherContractors.map((contractor) => ({
            value: `contractor:${contractor.con_id}`,
            label: `Contractor — ${contractor.contractor}`,
            keywords: 'contractor',
        })),
        ...vendors.map((vendor) => ({
            value: `vendor:${vendor.vendor_id}`,
            label: `Vendor — ${vendor.vendor}`,
            keywords: 'vendor',
        })),
    ];
    const selectableContractorIds = new Set(
        contractors.map((contractor) => contractor.con_id),
    );
    const assignedProjectContractors = [...(selected?.contractors ?? [])]
        .filter((contractor) => selectableContractorIds.has(contractor.con_id))
        .sort((left, right) => left.pivot.position - right.pivot.position);
    const assignedProjectContractorIds = new Set(
        assignedProjectContractors.map((contractor) => contractor.con_id),
    );
    const availableInvoiceContractors = contractors.filter(
        (contractor) => !assignedProjectContractorIds.has(contractor.con_id),
    );
    const normalizedInvoiceContractorSearch = invoiceContractorSearch
        .trim()
        .toLocaleLowerCase();
    const searchedAssignedProjectContractors =
        assignedProjectContractors.filter((contractor) =>
            contractor.contractor
                .toLocaleLowerCase()
                .includes(normalizedInvoiceContractorSearch),
        );
    const searchedAvailableInvoiceContractors =
        availableInvoiceContractors.filter((contractor) =>
            contractor.contractor
                .toLocaleLowerCase()
                .includes(normalizedInvoiceContractorSearch),
        );
    const searchedInvoiceVendors = vendors.filter((vendor) =>
        vendor.vendor
            .toLocaleLowerCase()
            .includes(normalizedInvoiceContractorSearch),
    );
    const payableInvoices = (selected?.invoices ?? []).filter((invoice) => {
        if (accountingForm.data.contractor_id) {
            return String(invoice.contractor?.con_id ?? '') === accountingForm.data.contractor_id;
        }

        if (accountingForm.data.vendor_id) {
            return String(invoice.vendor?.vendor_id ?? '') === accountingForm.data.vendor_id;
        }

        return true;
    });
    const requesterOptions = Array.from(
        new Set(
            [currentRequester, ...requesters].filter(
                (requester): requester is string => Boolean(requester),
            ),
        ),
    );
    const projectDocuments: ProjectDocument[] = selected
        ? [
              ...(selected.contract_file_name
                  ? [
                        {
                            key: `contract-${selected.id}`,
                            type: 'Contract' as const,
                            fileName: selected.contract_file_name,
                            date: selected.created_at,
                            notes: 'Signed sales contract',
                            status: 'Attached',
                            mime: selected.contract_file_mime ?? '',
                            size: selected.contract_file_size,
                            url: `/management/projects/${selected.id}/contract-file`,
                        },
                    ]
                  : []),
              ...selected.documents.map((document) => ({
                  key: `project-document-${document.id}`,
                  type: document.project_sale_id
                      ? ('Sale Contract' as const)
                      : document.project_invoice_id
                        ? ('Invoice' as const)
                        : document.project_accounting_transaction_id
                          ? selected.accounting_transactions.find(
                                (transaction) =>
                                    transaction.id ===
                                    document.project_accounting_transaction_id,
                            )?.type === 'receivable'
                              ? ('Receivable' as const)
                              : ('Payable' as const)
                          : ('Project Upload' as const),
                  fileName: document.file_name,
                  date: document.created_at,
                  notes: document.category,
                  status: 'Available',
                  mime: document.file_mime ?? '',
                  size: document.file_size,
                  url: `/management/projects/${selected.id}/documents/${document.id}/file`,
              })),
              ...selected.invoices
                  .filter((invoice) => invoice.file_name)
                  .map((invoice) => ({
                      key: `invoice-${invoice.id}`,
                      type: 'Invoice' as const,
                      fileName: invoice.file_name ?? invoice.invoice_number,
                      date: invoice.invoice_date,
                      notes: invoice.notes || invoice.invoice_number,
                      status: invoiceStatusLabels[invoice.status],
                      mime: invoice.file_mime ?? '',
                      size: invoice.file_size,
                      url: `/management/projects/${selected.id}/invoices/${invoice.id}/file`,
                  })),
              ...selected.accounting_transactions
                  .filter((transaction) => transaction.file_name)
                  .map((transaction) => ({
                      key: `accounting-${transaction.id}`,
                      type:
                          transaction.type === 'receivable'
                              ? ('Receivable' as const)
                              : ('Payable' as const),
                      fileName:
                          transaction.file_name ?? transaction.reference_number,
                      date: transaction.transaction_date,
                      notes: transaction.notes || transaction.reference_number,
                      status: accountingStatusLabels[transaction.status],
                      mime: transaction.file_mime ?? '',
                      size: transaction.file_size,
                      url: `/management/projects/${selected.id}/accounting-transactions/${transaction.id}/file`,
                  })),
          ].sort(
              (first, second) =>
                  new Date(second.date).getTime() -
                  new Date(first.date).getTime(),
          )
        : [];
    const selectedDocument =
        projectDocuments.find(
            (document) => document.key === selectedDocumentKey,
        ) ?? null;

    const selectProject = (project: Project) => {
        router.get(
            '/management/projects',
            {
                project: project.id,
                tab: activeTab === 'PRJ' ? 'DTL' : activeTab,
            },
            {
                preserveState: false,
                preserveScroll: true,
            },
        );
    };

    const returnToProjectList = () => {
        setActiveTab('PRJ');
        setSelectedId(null);
        setSelectedSaleId(null);
        setSelectedScheduledPaymentId(null);
        setSelectedInvoiceId(null);
        setSelectedAccountingId(null);
        setSelectedDocumentKey(null);
        setEditingProjectDetails(false);
    };

    const beginProjectDetailsEdit = () => {
        if (!selected) return;

        projectDetailsForm.setData({
            project_number: selected.project_number ?? '',
            status: selected.status || 'new',
            company_id: sbhCompanyId,
            product_id: String(selected.lead.product?.prod_id ?? ''),
            customer_name: selected.lead.customer_name,
            primary_number: selected.lead.primary_number,
            secondary_number: selected.lead.secondary_number ?? '',
            mobile_number: selected.lead.mobile_number ?? '',
            email: selected.lead.email ?? '',
            address: selected.lead.address,
            city: selected.lead.city,
            state: selected.lead.state,
            zip_code: selected.lead.zip_code,
            source: selected.lead.source,
            appointment_at: appointmentInputValue(
                selected.lead.appointment_at ?? '',
            ),
            lead_created_at: dateTimeInputValue(selected.lead.created_at),
            agent_id: String(selected.lead.agent?.agent_id ?? ''),
            agent_2_id: String(selected.lead.second_agent?.agent_id ?? ''),
            salesman_1_id: String(
                selected.lead.salesman_one?.salesman_id ?? '',
            ),
            salesman_2_id: String(
                selected.lead.salesman_two?.salesman_id ?? '',
            ),
        });
        projectDetailsForm.clearErrors();
        setEditingProjectDetails(true);
    };

    const saveProjectDetails = () => {
        if (!selected) return;

        projectDetailsForm.put(`/management/projects/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => setEditingProjectDetails(false),
            onError: () => {
                document
                    .querySelector('.project-details-save-errors')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
        });
    };

    const noteByType = (project: Project, type: string) =>
        plainNote(
            project.lead.notes.find((note) => note.note_type === type)?.body,
        ) || '—';

    const salesmanAssignmentHistory = (project: Project) =>
        project.lead.notes
            .filter((note) =>
                ['salesman_sent', 'salesman_assignment'].includes(
                    note.note_type,
                ),
            )
            .sort(
                (first, second) =>
                    new Date(second.created_at).getTime() -
                    new Date(first.created_at).getTime(),
            );

    const salesSummary = useMemo(() => {
        const scopedProjects = projects.filter((project) =>
            matchesProjectFilters(project),
        );
        const contributionFor = (
            project: Project,
            saleType?: ProjectSale['type'],
        ) =>
            project.sales
                .filter((sale) => !saleType || sale.type === saleType)
                .reduce((sum, sale) => sum + Number(sale.amount), 0);
        const activeProjects = scopedProjects.filter(
            (project) => project.status !== 'canceled',
        );
        const canceledProjects = scopedProjects.filter(
            (project) => project.status === 'canceled',
        );

        return {
            total: activeProjects.reduce(
                (sum, project) => sum + contributionFor(project),
                0,
            ),
            referral: activeProjects.reduce(
                (sum, project) => sum + contributionFor(project, 'referral'),
                0,
            ),
            original: activeProjects.reduce(
                (sum, project) => sum + contributionFor(project, 'original'),
                0,
            ),
            canceled: canceledProjects.reduce(
                (sum, project) => sum + contributionFor(project),
                0,
            ),
        };
    }, [
        projects,
        projectCompanyFilter,
        projectDateFrom,
        projectDateTo,
        projectSalesmanFilter,
        projectSearch,
        projectStatusFilter,
    ]);

    const selectedProjectSummary = useMemo(() => {
        if (!selected) return null;

        const transactionTotal = (
            type: AccountingTransaction['type'],
            commissions: boolean,
        ) =>
            selected.accounting_transactions
                .filter((transaction) => {
                    const isCommission = transaction.category
                        .toLowerCase()
                        .includes('commission');

                    return (
                        transaction.type === type &&
                        (type === 'receivable' || isCommission === commissions)
                    );
                })
                .reduce(
                    (sum, transaction) => sum + Number(transaction.amount),
                    0,
                );
        const saleTotal = (type: ProjectSale['type']) =>
            selected.sales
                .filter((sale) => sale.type === type)
                .reduce((sum, sale) => sum + Number(sale.amount), 0);

        return {
            total: projectSaleTotal(selected),
            receivables: transactionTotal('receivable', false),
            invoices: selected.invoices.reduce(
                (sum, invoice) => sum + Number(invoice.amount),
                0,
            ),
            original: saleTotal('original'),
            referral: saleTotal('referral'),
            payables: selected.accounting_transactions
                .filter((transaction) => transaction.type === 'payable')
                .reduce(
                    (sum, transaction) => sum + Number(transaction.amount),
                    0,
                ),
            commissions: transactionTotal('payable', true),
        };
    }, [projectSalesmanFilter, selected]);

    const compactSaleDate = (value: string) => {
        const date = new Date(
            value.includes('T') ? value : `${value}T12:00:00`,
        );

        return Number.isNaN(date.getTime())
            ? '—'
            : new Intl.DateTimeFormat('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  timeZone: CRM_TIME_ZONE,
              }).format(date);
    };

    const scheduledPaymentTotal = (project: Project) =>
        project.scheduled_payments.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0,
        );

    const scheduleBalance = (project: Project) =>
        Math.max(0, projectSaleTotal(project) - scheduledPaymentTotal(project));

    const scheduledPaymentBalances = (project: Project) => {
        const balances = new Map(
            project.scheduled_payments.map((payment) => [
                payment.id,
                Number(payment.amount),
            ]),
        );

        [...project.accounting_transactions]
            .filter(
                (transaction) =>
                    transaction.type === 'receivable' &&
                    transaction.status === 'deposit',
            )
            .sort((first, second) => first.id - second.id)
            .forEach((transaction) => {
                let remaining = Number(transaction.amount);
                const linkedIds = new Set(
                    transaction.scheduled_payments.map((payment) => payment.id),
                );

                project.scheduled_payments.forEach((payment) => {
                    if (remaining <= 0 || !linkedIds.has(payment.id)) {
                        return;
                    }

                    const currentBalance = balances.get(payment.id) ?? 0;
                    const applied = Math.min(remaining, currentBalance);
                    balances.set(payment.id, currentBalance - applied);
                    remaining -= applied;
                });
            });

        return balances;
    };

    const scheduledPaymentBalance = (
        project: Project,
        payment: ScheduledPayment,
    ) =>
        scheduledPaymentBalances(project).get(payment.id) ??
        Number(payment.amount);

    const projectInvoiceTotal = (project: Project) =>
        project.invoices.reduce(
            (sum, invoice) => sum + Number(invoice.amount),
            0,
        );

    const projectInvoiceBalance = (project: Project, invoice: ProjectInvoice) =>
        Math.max(
            0,
            Number(invoice.amount) -
                project.accounting_transactions
                    .filter(
                        (transaction) =>
                            transaction.type === 'payable' &&
                            transaction.invoice?.id === invoice.id &&
                            transaction.status === 'paid',
                    )
                    .reduce(
                        (total, transaction) =>
                            total + Number(transaction.amount),
                        0,
                ),
        );

    const selectedInvoice =
        selected?.invoices.find(
            (invoice) => invoice.id === selectedInvoiceId,
        ) ?? null;
    const selectedInvoicePayables =
        selected && selectedInvoice
            ? selected.accounting_transactions.filter(
                  (transaction) =>
                      transaction.type === 'payable' &&
                      transaction.invoice?.id === selectedInvoice.id,
              )
            : [];

    const compareSortValues = (
        left: string | number,
        right: string | number,
        direction: ProjectSortDirection,
    ) => {
        const comparison =
            typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right), undefined, {
                      numeric: true,
                      sensitivity: 'base',
                  });

        return direction === 'asc' ? comparison : -comparison;
    };
    const sortedInvoices = selected
        ? [...selected.invoices].sort((left, right) => {
              const value = (invoice: ProjectInvoice) => {
                  switch (invoiceSort.key) {
                      case 'date':
                          return invoice.invoice_date;
                      case 'number':
                          return invoice.invoice_number;
                      case 'chargedBy':
                          return (
                              invoice.contractor?.contractor ??
                              invoice.vendor?.vendor ??
                              ''
                          );
                      case 'amount':
                          return Number(invoice.amount);
                      case 'balance':
                          return projectInvoiceBalance(selected, invoice);
                      case 'notes':
                          return invoice.notes ?? '';
                      case 'status':
                          return invoiceStatusLabels[invoice.status];
                  }
              };

              return (
                  compareSortValues(
                      value(left),
                      value(right),
                      invoiceSort.direction,
                  ) || left.id - right.id
              );
          })
        : [];
    const sortedInvoicePayables = [...selectedInvoicePayables].sort(
        (left, right) => {
            const value = (payable: AccountingTransaction) => {
                switch (invoicePayableSort.key) {
                    case 'date':
                        return payable.transaction_date;
                    case 'reference':
                        return payable.reference_number ?? '';
                    case 'payTo':
                        return (
                            payable.contractor?.contractor ||
                            payable.vendor?.vendor ||
                            selectedInvoice?.contractor?.contractor ||
                            selectedInvoice?.vendor?.vendor ||
                            ''
                        );
                    case 'requestedBy':
                        return payable.requested_by ?? '';
                    case 'status':
                        return accountingStatusLabels[payable.status];
                    case 'amount':
                        return Number(payable.amount);
                    case 'notes':
                        return payable.notes ?? '';
                }
            };

            return (
                compareSortValues(
                    value(left),
                    value(right),
                    invoicePayableSort.direction,
                ) || left.id - right.id
            );
        },
    );
    const sortableTableHeader = (
        label: string,
        active: boolean,
        direction: ProjectSortDirection,
        onClick: () => void,
    ) => (
        <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button
                type="button"
                className={active ? 'projects-sort is-active' : 'projects-sort'}
                onClick={onClick}
                title={`Sort by ${label}`}
            >
                <span>{label}</span>
                {active ? (
                    direction === 'asc' ? (
                        <ChevronUp aria-hidden="true" />
                    ) : (
                        <ChevronDown aria-hidden="true" />
                    )
                ) : (
                    <ArrowUpDown aria-hidden="true" />
                )}
            </button>
        </th>
    );
    const sortableInvoiceHeader = (key: InvoiceSortKey, label: string) =>
        sortableTableHeader(
            label,
            invoiceSort.key === key,
            invoiceSort.direction,
            () =>
                setInvoiceSort((current) => ({
                    key,
                    direction:
                        current.key === key && current.direction === 'asc'
                            ? 'desc'
                            : 'asc',
                })),
        );
    const sortableInvoicePayableHeader = (
        key: InvoicePayableSortKey,
        label: string,
    ) =>
        sortableTableHeader(
            label,
            invoicePayableSort.key === key,
            invoicePayableSort.direction,
            () =>
                setInvoicePayableSort((current) => ({
                    key,
                    direction:
                        current.key === key && current.direction === 'asc'
                            ? 'desc'
                            : 'asc',
                })),
        );

    const outstandingBalances = useMemo<Record<BalanceView, BalanceItem[]>>(
        () => ({
            receivable: projects.flatMap((project) =>
                project.accounting_transactions
                    .filter(
                        (transaction) =>
                            transaction.type === 'receivable' &&
                            transaction.status === 'pending' &&
                            !transaction.qb &&
                            Number(transaction.amount) > 0,
                    )
                    .map((transaction) => ({
                        key: `receivable-${transaction.id}`,
                        project,
                        label:
                            transaction.reference_number ||
                            transaction.category,
                        counterparty:
                            transaction.counterparty ||
                            project.lead.customer_name,
                        date: transaction.transaction_date,
                        status: accountingStatusLabels[transaction.status],
                        balance: Number(transaction.amount),
                    })),
            ),
            payable: projects.flatMap((project) =>
                project.accounting_transactions
                    .filter(
                        (transaction) =>
                            transaction.type === 'payable' &&
                            transaction.status !== 'paid' &&
                            Number(transaction.amount) > 0,
                    )
                    .map((transaction) => ({
                        key: `payable-${transaction.id}`,
                        project,
                        label:
                            transaction.reference_number ||
                            transaction.category,
                        counterparty:
                            transaction.counterparty || 'Unassigned vendor',
                        date: transaction.transaction_date,
                        status: accountingStatusLabels[transaction.status],
                        balance: Number(transaction.amount),
                    })),
            ),
            invoice: projects.flatMap((project) =>
                project.invoices.flatMap((invoice) => {
                    const balance = projectInvoiceBalance(project, invoice);

                    return balance > 0
                        ? [
                              {
                                  key: `invoice-${invoice.id}`,
                                  project,
                                  label: invoice.invoice_number,
                                  counterparty:
                                      invoice.contractor?.contractor ??
                                      invoice.vendor?.vendor ??
                                      'Unknown vendor',
                                  date: invoice.invoice_date,
                                  status: invoiceStatusLabels[invoice.status],
                                  balance,
                              },
                          ]
                        : [];
                }),
            ),
        }),
        [projects],
    );

    const balanceTotals = {
        receivable: outstandingBalances.receivable.reduce(
            (sum, item) => sum + item.balance,
            0,
        ),
        payable: outstandingBalances.payable.reduce(
            (sum, item) => sum + item.balance,
            0,
        ),
        invoice: outstandingBalances.invoice.reduce(
            (sum, item) => sum + item.balance,
            0,
        ),
    };

    const projectSalesmen = (project: Project) =>
        [
            project.lead.salesman_one?.salesman_name,
            project.lead.salesman_two?.salesman_name,
        ]
            .filter(Boolean)
            .join(' & ') || 'Unassigned';

    const selectedSale =
        selected?.sales.find((sale) => sale.id === selectedSaleId) ?? null;
    const selectedSaleHasFiles = Boolean(
        selectedSale &&
            selected?.documents.some(
                (document) => document.project_sale_id === selectedSale.id,
            ),
    );
    const selectedScheduledPayment =
        selected?.scheduled_payments.find(
            (payment) => payment.id === selectedScheduledPaymentId,
        ) ?? null;
    const selectedScheduledReceivables =
        selected && selectedScheduledPayment
            ? selected.accounting_transactions.filter(
                  (transaction) =>
                      transaction.type === 'receivable' &&
                      transaction.scheduled_payments.some(
                          (payment) =>
                              payment.id === selectedScheduledPayment.id,
                      ),
              )
            : [];
    const selectedAccountingTransaction =
        selected?.accounting_transactions.find(
            (transaction) => transaction.id === selectedAccountingId,
        ) ?? null;
    const visibleAccountingTransactions =
        selected?.accounting_transactions.filter((transaction) => {
            const isCommission =
                transaction.type === 'payable' &&
                transaction.category.toLowerCase().includes('commission');

            if (accountingMode === 'commission') {
                return isCommission;
            }

            return (
                transaction.type === accountingMode &&
                (accountingMode !== 'payable' || !isCommission)
            );
        }) ?? [];
    const accountingSortValue = (transaction: AccountingTransaction) => {
        switch (accountingSort.key) {
            case 'date':
                return transaction.transaction_date;
            case 'company':
                return selected?.lead.company?.prefix ?? '';
            case 'project':
                return selected ? projectNumber(selected) : '';
            case 'counterparty':
                return (
                    transaction.counterparty ||
                    transaction.vendor?.vendor ||
                    transaction.contractor?.contractor ||
                    transaction.salesman?.salesman_name ||
                    transaction.invoice?.vendor?.vendor ||
                    transaction.invoice?.contractor?.contractor ||
                    ''
                );
            case 'invoice':
                return (
                    transaction.invoice_order_number ||
                    transaction.invoice?.invoice_number ||
                    ''
                );
            case 'paymentMethod':
                return transaction.payment_method
                    ? paymentMethodLabels[transaction.payment_method]
                    : '';
            case 'requestedBy':
                return transaction.requested_by ?? '';
            case 'status':
                return accountingStatusLabels[transaction.status];
            case 'amount':
                return Number(transaction.amount);
            case 'reference':
                return transaction.reference_number ?? '';
            case 'category':
                return transaction.category;
            case 'notes':
                return transaction.notes ?? '';
            case 'qb':
                return transaction.qb ? 1 : 0;
            case 'file':
                return transaction.file_name ?? '';
        }
    };
    const sortedAccountingTransactions = [...visibleAccountingTransactions].sort(
        (left, right) => {
            const leftValue = accountingSortValue(left);
            const rightValue = accountingSortValue(right);
            const comparison =
                typeof leftValue === 'number' && typeof rightValue === 'number'
                    ? leftValue - rightValue
                    : String(leftValue).localeCompare(String(rightValue), undefined, {
                          numeric: true,
                          sensitivity: 'base',
                      });

            return (
                (accountingSort.direction === 'asc' ? comparison : -comparison) ||
                left.id - right.id
            );
        },
    );

    const sortableAccountingHeader = (
        key: AccountingSortKey,
        label: string,
    ) => {
        const active = accountingSort.key === key;

        return (
            <th aria-sort={active ? (accountingSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button
                    type="button"
                    className={active ? 'projects-sort is-active' : 'projects-sort'}
                    onClick={() =>
                        setAccountingSort((current) => ({
                            key,
                            direction:
                                current.key === key && current.direction === 'asc'
                                    ? 'desc'
                                    : 'asc',
                        }))
                    }
                    title={`Sort by ${label}`}
                >
                    <span>{label}</span>
                    {active ? (
                        accountingSort.direction === 'asc' ? (
                            <ChevronUp aria-hidden="true" />
                        ) : (
                            <ChevronDown aria-hidden="true" />
                        )
                    ) : (
                        <ArrowUpDown aria-hidden="true" />
                    )}
                </button>
            </th>
        );
    };

    const invoiceFileUrl = (project: Project, invoice: ProjectInvoice) =>
        `/management/projects/${project.id}/invoices/${invoice.id}/file`;

    const openNewInvoice = () => {
        if (!selected) {
            return;
        }

        invoiceForm.setData({
            invoice_number: 'INV#',
            invoice_date: crmDateKey(),
            contractor_id: '',
            vendor_id: '',
            amount: '',
            notes: '',
            file: null,
            project_document_id: '',
            project_sale_id: '',
        });
        invoiceForm.clearErrors();
        setInvoiceContractorSearch('');
        setInvoiceFilePreview(null);
        setInvoiceModal({ mode: 'create', invoice: null });
    };

    const openEditInvoice = (invoice: ProjectInvoice) => {
        if (!selected) {
            return;
        }

        invoiceForm.setData({
            invoice_number: invoiceNumberWithPrefix(invoice.invoice_number),
            invoice_date: invoice.invoice_date.slice(0, 10),
            contractor_id: invoice.contractor
                ? String(invoice.contractor.con_id)
                : '',
            vendor_id: invoice.vendor ? String(invoice.vendor.vendor_id) : '',
            amount: invoice.amount,
            notes: invoice.notes ?? '',
            file: null,
            project_document_id: String(invoice.project_document_id ?? ''),
            project_sale_id: String(invoice.project_sale_id ?? ''),
        });
        invoiceForm.clearErrors();
        setInvoiceContractorSearch('');
        setInvoiceFilePreview(
            invoice.file_name && invoice.file_mime
                ? {
                      url: invoiceFileUrl(selected, invoice),
                      mime: invoice.file_mime,
                  }
                : null,
        );
        setInvoiceModal({ mode: 'edit', invoice });
    };

    const chooseInvoiceFile = (file: File | null) => {
        invoiceForm.setData('file', file);
        if (file) invoiceForm.setData('project_document_id', '');

        if (!file) {
            setInvoiceFilePreview(null);

            return;
        }

        setInvoiceFilePreview({
            url: URL.createObjectURL(file),
            mime: file.type,
        });
    };

    const chooseAccountingFile = (file: File | null) => {
        if (accountingFilePreview?.isLocal) {
            URL.revokeObjectURL(accountingFilePreview.url);
        }

        accountingForm.setData('file', file);
        if (file) accountingForm.setData('project_document_id', '');
        setAccountingFilePreview(
            file
                ? {
                      url: URL.createObjectURL(file),
                      mime: file.type,
                      isLocal: true,
                  }
                : null,
        );
    };

    const submitInvoice = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selected || !invoiceModal) {
            return;
        }

        const url =
            invoiceModal.mode === 'edit' && invoiceModal.invoice
                ? `/management/projects/${selected.id}/invoices/${invoiceModal.invoice.id}`
                : `/management/projects/${selected.id}/invoices`;

        invoiceForm.post(url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setInvoiceModal(null);
                setInvoiceFilePreview(null);
                invoiceForm.reset();
                router.flushAll();
            },
        });
    };

    const deleteInvoice = async (invoice: ProjectInvoice) => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete vendor payment?',
            message: `${invoice.invoice_number} and its attached file will be permanently deleted.`,
            confirmLabel: 'Delete invoice',
            tone: 'danger',
        });

        if (confirmed) {
            router.delete(
                `/management/projects/${selected.id}/invoices/${invoice.id}`,
                {
                    preserveScroll: true,
                    onSuccess: () => setSelectedInvoiceId(null),
                },
            );
        }
    };

    const openNewAccountingTransaction = () => {
        if (!selected) {
            return;
        }

        accountingForm.setData({
            type: accountingMode === 'receivable' ? 'receivable' : 'payable',
            unassigned: false,
            company_id: String(selected.lead.company?.com_id ?? ''),
            category:
                accountingMode === 'receivable'
                    ? 'Customer Payment'
                    : accountingMode === 'commission'
                      ? 'Commission (default)'
                      : 'Vendor Payment',
            transaction_date: crmDateKey(),
            payment_method: 'check',
            reference_number: '',
            invoice_order_number: '',
            counterparty:
                accountingMode === 'receivable'
                    ? selected.lead.customer_name
                    : '',
            contractor_id: '',
            vendor_id: '',
            salesman_id: '',
            requested_by: currentRequester ?? '',
            amount: '',
            status: 'pending',
            notes: '',
            file: null,
            project_document_id: '',
            project_invoice_id: '',
            project_sale_id: '',
            scheduled_payment_ids: [],
        });
        accountingForm.clearErrors();
        setAccountingFilePreview(null);
        setAccountingModal({ mode: 'create', transaction: null });
    };

    const loadCommissionBreakdown = async () => {
        if (!selected) return;

        setCommissionBreakdownLoading(true);
        setCommissionBreakdown(null);

        try {
            const response = await fetch(
                `/management/projects/${selected.id}/commission-breakdown`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) throw new Error('Unable to load commissions');
            setCommissionBreakdown(
                (await response.json()) as ProjectCommissionBreakdown,
            );
        } finally {
            setCommissionBreakdownLoading(false);
        }
    };

    const openCompletionModal = () => {
        setCompletionAudience('office');
        setCompletionSalesmanId('');
        documentUploadForm.setData({
            files: [], target_type: 'completion', target_id: '',
            completion_audience: 'office', completion_salesman_id: '',
        });
        documentUploadForm.clearErrors();
        setCompletionModalOpen(true);
        if (!commissionBreakdown) void loadCommissionBreakdown();
    };

    const openPaymentCheckModal = async (type: 'lead_cost' | 'commission') => {
        const existing = selected?.payment_checks.find((check) => check.type === type);
        paymentCheckForm.setData({ amount: existing?.amount ?? '', check_file: null });
        paymentCheckForm.clearErrors();
        setPaymentCheckType(type);

        if (!existing && !commissionBreakdown && selected) {
            setCommissionBreakdownLoading(true);
            try {
                const response = await fetch(`/management/projects/${selected.id}/commission-breakdown`, {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) return;
                const breakdown = (await response.json()) as ProjectCommissionBreakdown;
                setCommissionBreakdown(breakdown);
                paymentCheckForm.setData('amount', String(
                    type === 'lead_cost'
                        ? breakdown.accounting.lead_cost
                        : breakdown.accounting.salesman_commission,
                ));
            } finally {
                setCommissionBreakdownLoading(false);
            }
        } else if (!existing && commissionBreakdown) {
            paymentCheckForm.setData('amount', String(
                type === 'lead_cost'
                    ? commissionBreakdown.accounting.lead_cost
                    : commissionBreakdown.accounting.salesman_commission,
            ));
        }
    };

    useEffect(() => {
        if (activeTab === 'TTL' && selectedId) {
            void loadCommissionBreakdown();
        }
    }, [activeTab, selectedId]);

    useEffect(() => {
        if (activeTab === 'ACT' && selectedId) {
            void loadCommissionBreakdown();
        }
    }, [activeTab, selectedId]);

    const openEditAccountingTransaction = (
        transaction: AccountingTransaction,
    ) => {
        accountingForm.setData({
            type: transaction.type,
            unassigned: false,
            company_id: String(
                transaction.company?.com_id ??
                    selected?.lead.company?.com_id ??
                    sbhCompanyId,
            ),
            category: transaction.category,
            transaction_date: transaction.transaction_date.slice(0, 10),
            payment_method: transaction.payment_method ?? 'check',
            reference_number: transaction.reference_number
                ? paymentReference(
                      transaction.payment_method ?? 'check',
                      transaction.reference_number,
                  )
                : '',
            invoice_order_number: transaction.invoice_order_number ?? '',
            counterparty:
                transaction.type === 'receivable'
                    ? (selected?.lead.customer_name ?? '')
                    : accountingMode === 'commission'
                      ? (transaction.salesman?.salesman_name ?? '')
                    : (transaction.contractor?.contractor ??
                      transaction.vendor?.vendor ??
                      ''),
            contractor_id: String(transaction.contractor?.con_id ?? ''),
            vendor_id: String(transaction.vendor?.vendor_id ?? ''),
            salesman_id: String(transaction.salesman?.salesman_id ?? ''),
            requested_by: transaction.requested_by ?? currentRequester ?? '',
            amount: transaction.amount,
            status: transaction.status,
            notes: transaction.notes ?? '',
            file: null,
            project_document_id: String(transaction.project_document_id ?? ''),
            project_invoice_id: String(transaction.invoice?.id ?? ''),
            project_sale_id: String(transaction.project_sale_id ?? ''),
            scheduled_payment_ids: transaction.scheduled_payments.map(
                (payment) => payment.id,
            ),
        });
        accountingForm.clearErrors();
        setAccountingFilePreview(
            transaction.file_name && selected
                ? {
                      url: `/management/projects/${selected.id}/accounting-transactions/${transaction.id}/file`,
                      mime: transaction.file_mime ?? '',
                      isLocal: false,
                  }
                : null,
        );
        setAccountingModal({ mode: 'edit', transaction });
    };

    const submitAccountingTransaction = (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!selected || !accountingModal) {
            return;
        }

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setAccountingModal(null);
                accountingForm.reset();
                router.flushAll();
            },
        };

        if (accountingModal.mode === 'create') {
            accountingForm.post(
                `/management/projects/${selected.id}/accounting-transactions`,
                options,
            );
        } else if (accountingModal.transaction) {
            accountingForm.post(
                `/management/projects/${selected.id}/accounting-transactions/${accountingModal.transaction.id}`,
                options,
            );
        }
    };

    const deleteAccountingTransaction = async (
        transaction: AccountingTransaction,
    ) => {
        if (!selected) {
            return;
        }

        const accepted = await confirm({
            title: `Delete ${transaction.type}?`,
            message: `${transaction.reference_number} for ${currencyFormatter.format(Number(transaction.amount))} will be permanently deleted.`,
            confirmLabel: 'Delete transaction',
            tone: 'danger',
        });

        if (accepted) {
            router.delete(
                `/management/projects/${selected.id}/accounting-transactions/${transaction.id}`,
                {
                    preserveScroll: true,
                    onSuccess: () => setSelectedAccountingId(null),
                },
            );
        }
    };

    const updateReceivableQb = (
        transaction: AccountingTransaction,
        qb: boolean,
        paymentMethod?: keyof typeof paymentPrefixes,
        referenceNumber?: string,
    ) => {
        if (!selected) return;

        router.patch(
            `/management/projects/${selected.id}/accounting-transactions/${transaction.id}/qb`,
            {
                qb,
                payment_method: paymentMethod,
                reference_number: referenceNumber,
            },
            {
                preserveScroll: true,
                onSuccess: () => setReceivableQbModal(null),
                onError: (errors) =>
                    setReceivableQbModal((current) =>
                        current
                            ? {
                                  ...current,
                                  error: String(
                                      errors.reference_number ||
                                          errors.payment_method ||
                                          errors.status ||
                                          'Unable to move this receivable to QB.',
                                  ),
                              }
                            : current,
                    ),
            },
        );
    };

    const requestReceivableQb = (
        transaction: AccountingTransaction,
        checked: boolean,
    ) => {
        if (!checked) {
            updateReceivableQb(transaction, false);
            return;
        }

        const method = transaction.payment_method ?? 'check';
        const prefix = paymentPrefixes[method];

        setReceivableQbModal({
            transaction,
            paymentMethod: method,
            referenceNumber:
                transaction.reference_number ||
                (method === 'zelle' ? '' : prefix),
            error: '',
        });
        setReceivableQbDetailsOpen(false);
    };

    const openReferralSale = () => {
        saleForm.setData({
            amount: '',
            sale_date: crmDateKey(),
            product_id: '',
            salesman_id: '',
            destination: 'current',
            project_number: '',
            files: [],
        });
        saleForm.clearErrors();
        setSaleModal({ mode: 'create', sale: null });
    };

    const openEditSale = (sale: ProjectSale) => {
        saleForm.setData({
            amount: sale.amount,
            sale_date: sale.sale_date.slice(0, 10),
            product_id: String(sale.product?.prod_id ?? ''),
            salesman_id: String(sale.salesman?.salesman_id ?? ''),
            destination: 'current',
            project_number: '',
            files: [],
        });
        saleForm.clearErrors();
        setSaleModal({ mode: 'edit', sale });
    };

    const submitSale = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selected || !saleModal) {
            return;
        }

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setSaleModal(null);
                saleForm.reset();
                router.flushAll();
            },
        };

        if (saleModal.mode === 'create') {
            saleForm.post(`/management/projects/${selected.id}/sales`, {
                ...options,
                forceFormData: true,
            });
        } else if (saleModal.sale) {
            saleForm.post(
                `/management/projects/${selected.id}/sales/${saleModal.sale.id}`,
                { ...options, forceFormData: true },
            );
        }
    };

    const deleteReferralSale = async (sale: ProjectSale) => {
        if (!selected || sale.type === 'original') {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete referral sale?',
            message: `${currencyFormatter.format(Number(sale.amount))} will be permanently removed from this project.`,
            confirmLabel: 'Delete referral',
            tone: 'danger',
        });

        if (confirmed) {
            router.delete(
                `/management/projects/${selected.id}/sales/${sale.id}`,
                {
                    preserveScroll: true,
                    onSuccess: () => setSelectedSaleId(null),
                },
            );
        }
    };

    const deleteSaleDocument = async (document: Project['documents'][number]) => {
        if (!selected || !saleAttachmentSale || document.project_sale_id !== saleAttachmentSale.id) {
            return;
        }

        const confirmed = await confirm({
            title: 'Remove attached file?',
            message: `${document.file_name} will be permanently removed from this sale and the project DOC tab.`,
            confirmLabel: 'Remove file',
            tone: 'danger',
        });

        if (confirmed) {
            router.delete(
                `/management/projects/${selected.id}/documents/${document.id}`,
                { preserveScroll: true },
            );
        }
    };

    const openNewScheduledPayment = () => {
        if (!selected || scheduleBalance(selected) <= 0) {
            return;
        }

        scheduledPaymentForm.setData({
            expected_date: crmDateKey(),
            payment_stage: '',
            amount: '',
            qb: false,
            printed_sent: false,
            notes: '',
        });
        scheduledPaymentForm.clearErrors();
        setScheduledPaymentModal({
            mode: 'create',
            scheduledPayment: null,
        });
    };

    const openEditScheduledPayment = (payment: ScheduledPayment) => {
        scheduledPaymentForm.setData({
            expected_date: payment.expected_date.slice(0, 10),
            payment_stage: payment.payment_stage,
            amount: payment.amount,
            qb: payment.qb,
            printed_sent: payment.printed_sent,
            notes: payment.notes ?? '',
        });
        scheduledPaymentForm.clearErrors();
        setScheduledPaymentModal({
            mode: 'edit',
            scheduledPayment: payment,
        });
    };

    const submitScheduledPayment = (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!selected || !scheduledPaymentModal) {
            return;
        }

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setScheduledPaymentModal(null);
                scheduledPaymentForm.reset();
                router.flushAll();
            },
        };

        if (scheduledPaymentModal.mode === 'create') {
            scheduledPaymentForm.post(
                `/management/projects/${selected.id}/scheduled-payments`,
                options,
            );
        } else if (scheduledPaymentModal.scheduledPayment) {
            scheduledPaymentForm.put(
                `/management/projects/${selected.id}/scheduled-payments/${scheduledPaymentModal.scheduledPayment.id}`,
                options,
            );
        }
    };

    const deleteScheduledPayment = async (payment: ScheduledPayment) => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete scheduled payment?',
            message: `${currencyFormatter.format(Number(payment.amount))} scheduled for ${dateFormatter.format(new Date(payment.expected_date))} will be permanently removed.`,
            confirmLabel: 'Delete payment',
            tone: 'danger',
        });

        if (confirmed) {
            router.delete(
                `/management/projects/${selected.id}/scheduled-payments/${payment.id}`,
                {
                    preserveScroll: true,
                    onSuccess: () => setSelectedScheduledPaymentId(null),
                },
            );
        }
    };

    return (
        <>
            <Head title="Projects" />
            <main className={`projects-page is-tab-${activeTab.toLowerCase()}`}>
                <header className="projects-header">
                    <div>
                        <span>Management</span>
                        <h1>Projects</h1>
                        <p>Sold leads accepted from the Dispatch workflow.</p>
                    </div>
                    {activeTab === 'PRJ' && (
                        <div
                            className="projects-status-filter projects-header-status-filter"
                            aria-label="Filter projects by status"
                        >
                            {(
                                [
                                    ['all', 'All'],
                                    ['new', 'New'],
                                    ['progress', 'In Progress'],
                                    ['completed', 'Completed'],
                                    ['canceled', 'Cancelled'],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={
                                        projectStatusFilter === value
                                            ? 'is-active'
                                            : ''
                                    }
                                    aria-pressed={projectStatusFilter === value}
                                    onClick={() =>
                                        setProjectStatusFilter(value)
                                    }
                                >
                                    <span>{label}</span>
                                    <strong>
                                        {projectStatusCounts[value]}
                                    </strong>
                                </button>
                            ))}
                            <div className="projects-header-entity-filters">
                                <label className="projects-header-search">
                                    <span>Search projects</span>
                                    <div>
                                        <Search />
                                        <input
                                            type="search"
                                            value={projectSearch}
                                            onChange={(event) =>
                                                setProjectSearch(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Customer, project #, city…"
                                            aria-label="Search projects"
                                        />
                                    </div>
                                </label>
                                <label>
                                    <span>Company</span>
                                    <select
                                        value={projectCompanyFilter}
                                        onChange={(event) =>
                                            setProjectCompanyFilter(
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="all">
                                            All companies
                                        </option>
                                        {companies.map((company) => (
                                            <option
                                                key={company.com_id}
                                                value={company.com_id}
                                            >
                                                {company.prefix ||
                                                    company.company}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span>Salesman</span>
                                    <select
                                        value={projectSalesmanFilter}
                                        onChange={(event) =>
                                            setProjectSalesmanFilter(
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="all">
                                            All salesmen
                                        </option>
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
                            </div>
                        </div>
                    )}
                    <div className="projects-header-actions">
                        {(
                            [
                                ['receivable', 'Receivables'],
                                ['payable', 'Payables'],
                                ['invoice', 'Invoices'],
                            ] as const
                        ).map(([view, label]) => (
                            <Fragment key={view}>
                                {activeTab === 'PRJ' &&
                                    view === 'receivable' && (
                                        <div className="projects-header-date-filter">
                                            <span>
                                                {projectDateFrom || projectDateTo
                                                    ? 'Signed date range'
                                                    : 'All dates'}
                                            </span>
                                            <div>
                                                <input
                                                    type="date"
                                                    value={projectDateFrom}
                                                    max={projectDateTo || undefined}
                                                    onChange={(event) =>
                                                        setProjectDateFrom(event.target.value)
                                                    }
                                                    aria-label="Signed date from"
                                                />
                                                <span aria-hidden="true">to</span>
                                                <input
                                                    type="date"
                                                    value={projectDateTo}
                                                    min={projectDateFrom || undefined}
                                                    onChange={(event) =>
                                                        setProjectDateTo(event.target.value)
                                                    }
                                                    aria-label="Signed date to"
                                                />
                                                {(projectDateFrom || projectDateTo) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setProjectDateFrom('');
                                                            setProjectDateTo('');
                                                        }}
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                <button
                                    type="button"
                                    className="projects-balance-button"
                                    onClick={() =>
                                        router.visit(
                                            view === 'receivable'
                                                ? '/management/receivables'
                                                : view === 'payable'
                                                  ? '/management/payables'
                                                  : '/management/invoices',
                                        )
                                    }
                                    title={`${currencyFormatter.format(balanceTotals[view])} outstanding`}
                                >
                                    <span>{label}</span>
                                    <strong>
                                        {outstandingBalances[view].length}
                                    </strong>
                                </button>
                            </Fragment>
                        ))}
                        <button
                            type="button"
                            className="projects-add-project"
                            onClick={() => {
                                projectCreateForm.clearErrors();
                                setCreatingProject(true);
                            }}
                        >
                            <Plus />
                            Add project
                        </button>
                        <button
                            type="button"
                            className="projects-drive-sync"
                            onClick={syncDriveFolders}
                            disabled={syncingDriveFolders}
                        >
                            <FolderSync
                                className={
                                    syncingDriveFolders ? 'is-spinning' : ''
                                }
                            />
                            {syncingDriveFolders
                                ? 'Syncing folders…'
                                : 'Sync project folders'}
                        </button>
                        {googleDriveUrl
                            ? createElement(
                                  'a',
                                  {
                                      className: 'projects-drive-sync',
                                      href: googleDriveUrl,
                                      target: '_blank',
                                      rel: 'noopener noreferrer',
                                  },
                                  createElement(ExternalLink),
                                  'Open Google Drive',
                              )
                            : null}
                        <div className="projects-summary">
                            <CircleDollarSign />
                            <div>
                                <strong>
                                    {currencyFormatter.format(total)}
                                </strong>
                                <span>{projects.length} active projects</span>
                            </div>
                        </div>
                    </div>
                </header>

                <Dialog
                    open={balanceView !== null}
                    onOpenChange={(open) => {
                        if (!open) setBalanceView(null);
                    }}
                >
                    {balanceView && (
                        <DialogContent className="projects-balance-modal">
                            <DialogHeader>
                                <DialogTitle>
                                    Outstanding {balanceView} balances
                                </DialogTitle>
                                <DialogDescription>
                                    All projects with a remaining balance.
                                    Total:{' '}
                                    {currencyFormatter.format(
                                        balanceTotals[balanceView],
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="projects-balance-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Customer</th>
                                            <th>
                                                {balanceView === 'invoice'
                                                    ? 'Invoice'
                                                    : 'Record'}
                                            </th>
                                            <th>
                                                {balanceView === 'receivable'
                                                    ? 'Received from'
                                                    : 'Pay to'}
                                            </th>
                                            <th>Date</th>
                                            <th>Status</th>
                                            <th>Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {outstandingBalances[balanceView].map(
                                            (item) => (
                                                <tr
                                                    key={item.key}
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        selectProject(
                                                            item.project,
                                                        );
                                                        setActiveTab(
                                                            balanceView ===
                                                                'invoice'
                                                                ? 'INV'
                                                                : 'ACT',
                                                        );
                                                        if (
                                                            balanceView !==
                                                            'invoice'
                                                        ) {
                                                            setAccountingMode(
                                                                balanceView,
                                                            );
                                                        }
                                                        setBalanceView(null);
                                                    }}
                                                >
                                                    <td>
                                                        {projectNumber(
                                                            item.project,
                                                        )}
                                                    </td>
                                                    <td>
                                                        {
                                                            item.project.lead
                                                                .customer_name
                                                        }
                                                    </td>
                                                    <td>{item.label}</td>
                                                    <td>{item.counterparty}</td>
                                                    <td>
                                                        {dateFormatter.format(
                                                            new Date(item.date),
                                                        )}
                                                    </td>
                                                    <td>{item.status}</td>
                                                    <td>
                                                        <strong>
                                                            {currencyFormatter.format(
                                                                item.balance,
                                                            )}
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                        {outstandingBalances[balanceView]
                                            .length === 0 && (
                                            <tr>
                                                <td colSpan={7}>
                                                    No outstanding balances.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={() => setBalanceView(null)}
                                >
                                    Close
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    )}
                </Dialog>

                <section
                    className={`project-context-bar project-sales-summary${selectedProjectSummary ? ' has-project' : ''}`}
                    aria-live="polite"
                    aria-label={
                        selectedProjectSummary
                            ? `Accounting summary for ${selected?.project_number ?? `project ${selected?.id}`}`
                            : 'Sales summary for the selected filters'
                    }
                >
                    {(
                        selectedProjectSummary
                            ? [
                                  ['Total sales', selectedProjectSummary.total],
                                  ['Original sale', selectedProjectSummary.original],
                                  ['Referral sale', selectedProjectSummary.referral],
                                  ['Total receivables', selectedProjectSummary.receivables],
                                  ['Total payables', selectedProjectSummary.payables],
                              ]
                            : [
                                  ['Total sales', salesSummary.total],
                                  ['Total referral sale', salesSummary.referral],
                                  ['Original sale', salesSummary.original],
                                  ['Cancelled sales', salesSummary.canceled],
                              ]
                    ).map(([label, amount]) => (
                        <div key={label}>
                            <small>{label}</small>
                            <strong>{currencyFormatter.format(amount)}</strong>
                            <span>
                                {selectedProjectSummary
                                    ? selected?.project_number || `Project ${selected?.id}`
                                    : projectDateFrom || projectDateTo
                                    ? `${projectDateFrom || 'Beginning'} – ${projectDateTo || 'Today'}`
                                    : 'All dates'}
                            </span>
                        </div>
                    ))}
                </section>

                {selected && activeTab !== 'PRJ' && (
                    <section className="project-selected-banner" aria-label="Selected project">
                        <div className="project-selected-banner__identity">
                            <span><UserRound /></span>
                            <div>
                                <small>SELECTED PROJECT</small>
                                <strong>{selected.lead.customer_name}</strong>
                            </div>
                        </div>
                        <dl>
                            <div><dt>Project #</dt><dd>{projectNumber(selected)}</dd></div>
                            <div><dt>Company</dt><dd>{selected.lead.company?.prefix || selected.lead.company?.company || '—'}</dd></div>
                            <div><dt>Status</dt><dd>{selected.status.replaceAll('_', ' ')}</dd></div>
                            <div><dt>Salesman</dt><dd>{[selected.lead.salesman_one?.salesman_name, selected.lead.salesman_two?.salesman_name].filter(Boolean).join(' & ') || 'Unassigned'}</dd></div>
                        </dl>
                        <button type="button" onClick={returnToProjectList}>Change project</button>
                    </section>
                )}

                <div className="projects-workspace">
                    <nav
                        className="projects-subtabs"
                        aria-label="Project sections"
                    >
                        {[
                            ['PRJ', 'Projects'],
                            ['DTL', 'Project details'],
                            ['SP', 'Sales proposals'],
                            ['INV', 'Invoices'],
                            ['ACT', 'Accounting'],
                            ['TTL', 'Totals & commissions'],
                            ['DOC', 'Documents'],
                            ['HIS', 'Project history'],
                        ].map(([shortLabel, label]) => {
                            const isAvailable =
                                shortLabel === 'PRJ' ||
                                ((shortLabel === 'DTL' ||
                                    shortLabel === 'SP' ||
                                    shortLabel === 'INV' ||
                                    shortLabel === 'ACT' ||
                                    shortLabel === 'TTL' ||
                                    shortLabel === 'DOC' ||
                                    shortLabel === 'HIS') &&
                                    selected !== null);

                            return (
                                <button
                                    type="button"
                                    key={shortLabel}
                                    className={
                                        activeTab === shortLabel
                                            ? 'is-active'
                                            : ''
                                    }
                                    aria-current={
                                        activeTab === shortLabel
                                            ? 'page'
                                            : undefined
                                    }
                                    aria-label={label}
                                    title={label}
                                    disabled={!isAvailable}
                                    onClick={() => {
                                        if (shortLabel === 'PRJ') {
                                            returnToProjectList();
                                        } else if (
                                            shortLabel === 'DTL' ||
                                            shortLabel === 'SP' ||
                                            shortLabel === 'INV' ||
                                            shortLabel === 'ACT' ||
                                            shortLabel === 'TTL' ||
                                            shortLabel === 'DOC' ||
                                            shortLabel === 'HIS'
                                        ) {
                                            setActiveTab(shortLabel);
                                        }
                                    }}
                                >
                                    {shortLabel}
                                </button>
                            );
                        })}
                    </nav>

                    {activeTab === 'HIS' && selected && (
                        <section className="project-history-panel">
                            <header className="project-history-header">
                                <span><History /></span>
                                <div>
                                    <small>PROJECT ACTIVITY</small>
                                    <h2>History for {projectNumber(selected)}</h2>
                                    <p>Every recorded project, sale, invoice, accounting, payment, and document change.</p>
                                </div>
                            </header>
                            <div className="project-history-list">
                                {(selected.activity_logs ?? []).map((entry) => {
                                    const fields = Array.from(new Set([
                                        ...Object.keys(entry.old_values ?? {}),
                                        ...Object.keys(entry.new_values ?? {}),
                                    ])).filter((field) => field !== 'id' && field !== 'project_id');

                                    return (
                                        <article key={entry.id} className={`is-${entry.action}`}>
                                            <div className="project-history-marker"><History /></div>
                                            <div className="project-history-content">
                                                <header>
                                                    <div><strong>{entry.description}</strong><span>{entry.subject_type.replace('Project', '') || 'Project'}</span></div>
                                                    <time>{new Intl.DateTimeFormat('en-US', { timeZone: CRM_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}</time>
                                                </header>
                                                <p>By {entry.actor?.username || 'System'}</p>
                                                {fields.length > 0 && (
                                                    <dl>
                                                        {fields.map((field) => (
                                                            <div key={field}>
                                                                <dt>{historyFieldLabel(field)}</dt>
                                                                {entry.action !== 'created' && <dd className="was">{historyValue(entry.old_values?.[field])}</dd>}
                                                                <dd>{historyValue(entry.new_values?.[field])}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                                {(selected.activity_logs ?? []).length === 0 && (
                                    <div className="project-history-empty"><History /><strong>No project history recorded yet</strong><span>New changes will appear here after activity logging is activated.</span></div>
                                )}
                            </div>
                        </section>
                    )}

                    {activeTab === 'DOC' && selected && (
                        <section className="project-documents-panel">
                            <header className="project-documents-header">
                                <div>
                                    <span>
                                        <FileText />
                                    </span>
                                    <div>
                                        <small>Project documents</small>
                                        <h2>
                                            Documents for{' '}
                                            {projectNumber(selected)}
                                        </h2>
                                        <p>
                                            Invoice, receivable, and payable
                                            attachments for this project.
                                        </p>
                                    </div>
                                </div>
                                <div className="project-documents-upload-area">
                                    <strong>
                                        {projectDocuments.length}{' '}
                                        {projectDocuments.length === 1
                                            ? 'document'
                                            : 'documents'}
                                    </strong>
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            documentUploadForm.post(
                                                `/management/projects/${selected.id}/documents`,
                                                {
                                                    forceFormData: true,
                                                    preserveScroll: true,
                                                    onSuccess: () =>
                                                        documentUploadForm.reset(),
                                                },
                                            );
                                        }}
                                    >
                                        <select
                                            value={`${documentUploadForm.data.target_type}:${documentUploadForm.data.target_id}`}
                                            onChange={(event) => {
                                                const [
                                                    targetType,
                                                    targetId = '',
                                                ] =
                                                    event.target.value.split(
                                                        ':',
                                                    );
                                                documentUploadForm.setData(
                                                    (data) => ({
                                                        ...data,
                                                        target_type:
                                                            targetType as
                                                                | 'project'
                                                                | 'invoice'
                                                                | 'accounting',
                                                        target_id: targetId,
                                                    }),
                                                );
                                            }}
                                        >
                                            <option value="project:">
                                                General project files
                                            </option>
                                            <optgroup label="Invoices">
                                                {selected.invoices.map(
                                                    (invoice) => (
                                                        <option
                                                            key={`invoice-${invoice.id}`}
                                                            value={`invoice:${invoice.id}`}
                                                        >
                                                            {
                                                                invoice.invoice_number
                                                            }
                                                        </option>
                                                    ),
                                                )}
                                            </optgroup>
                                            <optgroup label="Receivables and payables">
                                                {selected.accounting_transactions.map(
                                                    (transaction) => (
                                                        <option
                                                            key={`accounting-${transaction.id}`}
                                                            value={`accounting:${transaction.id}`}
                                                        >
                                                            {transaction.type ===
                                                            'receivable'
                                                                ? 'Receivable'
                                                                : 'Payable'}{' '}
                                                            ·{' '}
                                                            {transaction.reference_number ||
                                                                transaction.category}{' '}
                                                            ·{' '}
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    transaction.amount,
                                                                ),
                                                            )}
                                                        </option>
                                                    ),
                                                )}
                                            </optgroup>
                                        </select>
                                        <label>
                                            <Upload />
                                            <span>
                                                {documentUploadForm.data.files
                                                    .length
                                                    ? `${documentUploadForm.data.files.length} selected`
                                                    : 'Choose files'}
                                            </span>
                                            <input
                                                type="file"
                                                multiple
                                                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                                onChange={(event) =>
                                                    documentUploadForm.setData(
                                                        'files',
                                                        Array.from(
                                                            event.target
                                                                .files ?? [],
                                                        ),
                                                    )
                                                }
                                            />
                                        </label>
                                        <button
                                            type="submit"
                                            disabled={
                                                documentUploadForm.processing ||
                                                documentUploadForm.data.files
                                                    .length === 0
                                            }
                                        >
                                            {documentUploadForm.processing
                                                ? 'Uploading…'
                                                : 'Upload'}
                                        </button>
                                    </form>
                                </div>
                            </header>

                            <div className="project-documents-workspace">
                                <div className="project-documents-list">
                                    <div className="project-documents-table-wrap">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>File name</th>
                                                    <th>Date</th>
                                                    <th>Notes</th>
                                                    <th>Status</th>
                                                    <th>Size</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectDocuments.map(
                                                    (document) => (
                                                        <tr
                                                            key={document.key}
                                                            className={
                                                                selectedDocumentKey ===
                                                                document.key
                                                                    ? 'is-selected'
                                                                    : ''
                                                            }
                                                            onClick={() =>
                                                                setSelectedDocumentKey(
                                                                    document.key,
                                                                )
                                                            }
                                                        >
                                                            <td>
                                                                <span
                                                                    className={`is-${document.type.toLowerCase()}`}
                                                                >
                                                                    {
                                                                        document.type
                                                                    }
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    {
                                                                        document.fileName
                                                                    }
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                {dateFormatter.format(
                                                                    new Date(
                                                                        document.date,
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td>
                                                                {document.notes}
                                                            </td>
                                                            <td>
                                                                {
                                                                    document.status
                                                                }
                                                            </td>
                                                            <td>
                                                                {formatFileSize(
                                                                    document.size,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                                {projectDocuments.length ===
                                                    0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="project-documents-empty"
                                                        >
                                                            <FileText />
                                                            <strong>
                                                                No project
                                                                documents
                                                            </strong>
                                                            <span>
                                                                Files attached
                                                                to invoices,
                                                                receivables, or
                                                                payables will
                                                                appear here.
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <aside className="project-document-preview">
                                    <header>
                                        <div>
                                            <Eye />
                                            <span>Document preview</span>
                                        </div>
                                        {selectedDocument && (
                                            <a
                                                href={selectedDocument.url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Open file
                                            </a>
                                        )}
                                    </header>
                                    <div className="project-document-preview__canvas">
                                        {!selectedDocument ? (
                                            <div>
                                                <FileText />
                                                <strong>
                                                    No document selected
                                                </strong>
                                                <span>
                                                    Select a document to preview
                                                    it here.
                                                </span>
                                            </div>
                                        ) : selectedDocument.mime.startsWith(
                                              'image/',
                                          ) ? (
                                            <img
                                                src={selectedDocument.url}
                                                alt={selectedDocument.fileName}
                                            />
                                        ) : selectedDocument.mime ===
                                          'application/pdf' ? (
                                            <iframe
                                                src={selectedDocument.url}
                                                title={
                                                    selectedDocument.fileName
                                                }
                                            />
                                        ) : (
                                            <div>
                                                <FileText />
                                                <strong>
                                                    Preview unavailable
                                                </strong>
                                                <a
                                                    href={selectedDocument.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Open document
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <dl>
                                        <div>
                                            <dt>Customer</dt>
                                            <dd>
                                                {selected.lead.customer_name}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Project #</dt>
                                            <dd>{projectNumber(selected)}</dd>
                                        </div>
                                        <div>
                                            <dt>Company</dt>
                                            <dd>
                                                {selected.lead.company
                                                    ?.prefix || '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Address</dt>
                                            <dd>
                                                {selected.lead.address},{' '}
                                                {selected.lead.city},{' '}
                                                {selected.lead.state}{' '}
                                                {selected.lead.zip_code}
                                            </dd>
                                        </div>
                                    </dl>
                                </aside>
                            </div>
                        </section>
                    )}

                    {activeTab === 'TTL' && selected && (
                        <section className="project-totals-panel">
                            <header className="project-totals-header">
                                <div>
                                    <CircleDollarSign />
                                    <div>
                                        <small>Project totals &amp; commissions</small>
                                        <h2>{projectNumber(selected)}</h2>
                                        <p>Accounting totals and salesman commission breakdowns.</p>
                                    </div>
                                </div>
                                <div className="project-totals-actions">
                                    <button type="button" onClick={openCompletionModal}>
                                        <FileText /> Completion
                                    </button>
                                    <button type="button" onClick={() => setActiveTab('INV')}>
                                        Open invoices
                                    </button>
                                    <button type="button" onClick={() => void loadCommissionBreakdown()}>
                                        Refresh totals
                                    </button>
                                </div>
                            </header>
                            {commissionBreakdownLoading ? (
                                <div className="project-commission-message">Loading totals…</div>
                            ) : commissionBreakdown ? (
                                <div
                                    className="project-totals-grid"
                                    style={{
                                        gridTemplateColumns: `repeat(${Math.max(2, Math.min(4, commissionBreakdown.salesmen.length + 1))}, minmax(0, 1fr))`,
                                    }}
                                >
                                    <section className="project-accounting-totals-card">
                                        <header>Accounting Totals</header>
                                        <dl>
                                            <div><dt>Sale amount</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.sale_amount)}</dd></div>
                                            <div><dt>Collected receivables</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.received_commissionable)}</dd></div>
                                            <div className="is-total"><dt>Project's balance</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.project_balance)}</dd></div>
                                            <div><dt>− Lead cost</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.lead_cost)}</dd></div>
                                            <div><dt>− Expenses (Comm.)</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.expenses_commissionable)}</dd></div>
                                            <div><dt>− Open invoices</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.open_invoices)}</dd></div>
                                            <div className="is-base"><dt>Gross Profit</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.gross_profit)}</dd></div>
                                            <div><dt>Office commission (50%)</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.office_commission)}</dd></div>
                                            <div><dt>Salesman commission (50%)</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.salesman_commission)}</dd></div>
                                            <div><dt>− Total commission paid</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.total_commission_paid)}</dd></div>
                                            <div className="is-net"><dt>Office share</dt><dd>{currencyFormatter.format(commissionBreakdown.accounting.profit_net)}</dd></div>
                                        </dl>
                                    </section>
                                    {commissionBreakdown.salesmen.map((row) => (
                                        <section className="project-salesman-total-card" key={row.salesman_id}>
                                            <header>
                                                <span>PRT</span>
                                                <strong>{row.salesman_name}</strong>
                                            </header>
                                            <dl>
                                                <div><dt>Total sale</dt><dd>{currencyFormatter.format(row.total_sale)}</dd></div>
                                                <div><dt>Stake / sale share</dt><dd>{row.sale_breakdown[0]?.stake_percent ?? 0}%</dd></div>
                                                <div><dt>Received (Comm.)</dt><dd>{currencyFormatter.format(row.received)}</dd></div>
                                                <div className="is-total"><dt>Project's balance</dt><dd>{currencyFormatter.format(row.project_balance)}</dd></div>
                                                <div><dt>− Expenses (Comm.)</dt><dd>{currencyFormatter.format(row.expenses)}</dd></div>
                                                <div><dt>− Open invoices</dt><dd>{currencyFormatter.format(row.open_invoices)}</dd></div>
                                                <div><dt>− {row.lead_cost_rate}% Lead cost</dt><dd>{currencyFormatter.format(row.lead_cost)}</dd></div>
                                                <div><dt>− {row.change_order_lead_cost_rate}% Change order lead cost</dt><dd>{currencyFormatter.format(row.change_order_lead_cost)}</dd></div>
                                                <div className="is-base"><dt>Gross Profit share</dt><dd>{currencyFormatter.format(row.gross_profit)}</dd></div>
                                                <div><dt>Salesman commission (50%)</dt><dd>{currencyFormatter.format(row.commission_due)}</dd></div>
                                                <div><dt>Maximum future commission</dt><dd>{currencyFormatter.format(row.maximum_commission)}</dd></div>
                                                <div><dt>− Commission paid</dt><dd>{currencyFormatter.format(row.commission_paid)}</dd></div>
                                                <div className="is-balance"><dt>Commission balance</dt><dd>{currencyFormatter.format(row.commission_balance)}</dd></div>
                                            </dl>
                                        </section>
                                    ))}
                                    {commissionBreakdown.salesmen.length === 0 && (
                                        <div className="project-commission-message">No salesman is assigned to this project.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="project-commission-message">
                                    Select Refresh totals to load the breakdown.
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'ACT' && selected && (
                        <section className="project-accounting-panel">
                            <header className="project-accounting-header">
                                <div>
                                    <span>
                                        <Landmark />
                                    </span>
                                    <div>
                                        <small>Project accounting</small>
                                        <h2>
                                            Transactions for{' '}
                                            {projectNumber(selected)}
                                        </h2>
                                        <p>
                                            Receivables, payables, and their
                                            optional project records.
                                        </p>
                                    </div>
                                </div>
                                <div className="project-accounting-actions">
                                    <a
                                        className="project-accounting-export"
                                        href={`/management/projects/${selected.id}/accounting/export/receivable`}
                                    >
                                        <FileSpreadsheet /> Download receivables
                                    </a>
                                    <a
                                        className="project-accounting-export"
                                        href={`/management/projects/${selected.id}/accounting/export/payable`}
                                    >
                                        <FileSpreadsheet /> Download payables
                                    </a>
                                    <div className="project-accounting-modes">
                                        {(
                                            [
                                                'receivable',
                                                'payable',
                                                'commission',
                                            ] as const
                                        ).map((mode) => (
                                            <button
                                                type="button"
                                                key={mode}
                                                className={
                                                    accountingMode === mode
                                                        ? 'is-active'
                                                        : ''
                                                }
                                                onClick={() => {
                                                    setAccountingMode(mode);
                                                    setSelectedAccountingId(
                                                        null,
                                                    );
                                                }}
                                            >
                                                {mode === 'receivable'
                                                    ? 'Receivables'
                                                    : mode === 'payable'
                                                      ? 'Payables'
                                                      : 'Commissions'}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="is-primary"
                                        onClick={openNewAccountingTransaction}
                                    >
                                        <Plus /> New
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            selectedAccountingTransaction &&
                                            openEditAccountingTransaction(
                                                selectedAccountingTransaction,
                                            )
                                        }
                                        disabled={
                                            !selectedAccountingTransaction
                                        }
                                    >
                                        <Pencil /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="is-delete"
                                        onClick={() =>
                                            selectedAccountingTransaction &&
                                            void deleteAccountingTransaction(
                                                selectedAccountingTransaction,
                                            )
                                        }
                                        disabled={
                                            !selectedAccountingTransaction
                                        }
                                    >
                                        <Trash2 /> Delete
                                    </button>
                                </div>
                            </header>

                            <div className="project-accounting-table-wrap">
                                <table className="project-accounting-table">
                                    <thead>
                                        {accountingMode !== 'receivable' ? (
                                            <tr>
                                                {sortableAccountingHeader('date', 'Req. 2 Pay @')}
                                                {sortableAccountingHeader('company', 'CMP')}
                                                {sortableAccountingHeader('project', 'Proj. #')}
                                                {sortableAccountingHeader('counterparty', 'Pay To')}
                                                {sortableAccountingHeader('invoice', 'Pay For (Invoice)')}
                                                {sortableAccountingHeader('paymentMethod', 'Payment Method')}
                                                {sortableAccountingHeader('requestedBy', 'Req. By')}
                                                {sortableAccountingHeader('status', 'Status')}
                                                {sortableAccountingHeader('amount', '$ Amount To Pay')}
                                                {sortableAccountingHeader('reference', 'Check #')}
                                                {sortableAccountingHeader('category', 'Category')}
                                                {sortableAccountingHeader('notes', 'Notes')}
                                                {sortableAccountingHeader('file', 'File')}
                                            </tr>
                                        ) : (
                                            <tr>
                                                {sortableAccountingHeader('date', 'Date')}
                                                {sortableAccountingHeader('reference', 'Reference #')}
                                                {sortableAccountingHeader('counterparty', 'Received From')}
                                                {sortableAccountingHeader('notes', 'Notes')}
                                                {sortableAccountingHeader('amount', 'Amount')}
                                                {sortableAccountingHeader('status', 'Status')}
                                                {sortableAccountingHeader('qb', 'QB')}
                                                {sortableAccountingHeader('category', 'Category')}
                                                {sortableAccountingHeader('file', 'File')}
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {sortedAccountingTransactions.map(
                                            (transaction) => {
                                                const fileUrl = `/management/projects/${selected.id}/accounting-transactions/${transaction.id}/file`;

                                                return (
                                                    <tr
                                                        key={transaction.id}
                                                        className={
                                                            selectedAccountingId ===
                                                            transaction.id
                                                                ? 'is-selected'
                                                                : ''
                                                        }
                                                        onClick={() =>
                                                            setSelectedAccountingId(
                                                                transaction.id,
                                                            )
                                                        }
                                                    >
                                                        <td
                                                            className={
                                                                originalProjectSalesmanIds(
                                                                    selected,
                                                                ).length > 1
                                                                    ? 'projects-shared-sale-date'
                                                                    : undefined
                                                            }
                                                            title={
                                                                originalProjectSalesmanIds(
                                                                    selected,
                                                                ).length > 1
                                                                    ? 'Sale shared by two assigned salesmen'
                                                                    : undefined
                                                            }
                                                        >
                                                            {dateFormatter.format(
                                                                new Date(
                                                                    transaction.transaction_date,
                                                                ),
                                                            )}
                                                        </td>
                                                        {accountingMode !==
                                                        'receivable' ? (
                                                            <>
                                                                <td>
                                                                    {selected
                                                                        .lead
                                                                        .company
                                                                        ?.prefix ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    {projectNumber(
                                                                        selected,
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {transaction.counterparty ||
                                                                        transaction
                                                                            .vendor
                                                                            ?.vendor ||
                                                                        transaction
                                                                            .contractor
                                                                            ?.contractor ||
                                                                        transaction
                                                                            .salesman
                                                                            ?.salesman_name ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    {transaction.invoice_order_number ||
                                                                        transaction
                                                                            .invoice
                                                                            ?.invoice_number ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    {transaction.payment_method
                                                                        ? paymentMethodLabels[
                                                                              transaction
                                                                                  .payment_method
                                                                          ]
                                                                        : '—'}
                                                                </td>
                                                                <td>
                                                                    {transaction.requested_by ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    <span className="project-accounting-status">
                                                                        {
                                                                            accountingStatusLabels[
                                                                                transaction
                                                                                    .status
                                                                            ]
                                                                        }
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <strong>
                                                                        {currencyFormatter.format(
                                                                            Number(
                                                                                transaction.amount,
                                                                            ),
                                                                        )}
                                                                    </strong>
                                                                </td>
                                                                <td>
                                                                    <button
                                                                        className={`project-accounting-reference-link attachment-status-tag ${accountingTransactionHasAttachment(transaction, selected.documents) ? 'has-attachment' : 'no-attachment'}`}
                                                                        type="button"
                                                                        onClick={(
                                                                            event,
                                                                        ) => {
                                                                            event.stopPropagation();
                                                                            documentUploadForm.setData(
                                                                                {
                                                                                    files: [],
                                                                                    target_type:
                                                                                        'accounting',
                                                                                    target_id:
                                                                                        String(
                                                                                            transaction.id,
                                                                                        ),
                                                                                },
                                                                            );
                                                                            documentUploadForm.clearErrors();
                                                                            setAccountingAttachmentTransaction(
                                                                                transaction,
                                                                            );
                                                                        }}
                                                                    >
                                                                        {transaction.reference_number ||
                                                                            'Add file'}
                                                                    </button>
                                                                </td>
                                                                <td>
                                                                    {
                                                                        transaction.category
                                                                    }
                                                                </td>
                                                                <td className="project-accounting-notes">
                                                                    {transaction.notes ||
                                                                        '—'}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td>
                                                                    <button
                                                                        className={`project-accounting-reference-link attachment-status-tag ${accountingTransactionHasAttachment(transaction, selected.documents) ? 'has-attachment' : 'no-attachment'}`}
                                                                        type="button"
                                                                        onClick={(
                                                                            event,
                                                                        ) => {
                                                                            event.stopPropagation();
                                                                            documentUploadForm.setData(
                                                                                {
                                                                                    files: [],
                                                                                    target_type:
                                                                                        'accounting',
                                                                                    target_id:
                                                                                        String(
                                                                                            transaction.id,
                                                                                        ),
                                                                                },
                                                                            );
                                                                            documentUploadForm.clearErrors();
                                                                            setAccountingAttachmentTransaction(
                                                                                transaction,
                                                                            );
                                                                        }}
                                                                    >
                                                                        {transaction.reference_number ||
                                                                            'Add file'}
                                                                    </button>
                                                                </td>
                                                                <td>
                                                                    {transaction.counterparty ||
                                                                        transaction
                                                                            .invoice
                                                                            ?.vendor
                                                                            ?.vendor ||
                                                                        transaction
                                                                            .invoice
                                                                            ?.contractor
                                                                            ?.contractor ||
                                                                        '—'}
                                                                </td>
                                                                <td className="project-accounting-notes">
                                                                    {transaction.notes ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    <strong>
                                                                        {currencyFormatter.format(
                                                                            Number(
                                                                                transaction.amount,
                                                                            ),
                                                                        )}
                                                                    </strong>
                                                                </td>
                                                                <td>
                                                                    {
                                                                        accountingStatusLabels[
                                                                            transaction
                                                                                .status
                                                                        ]
                                                                    }
                                                                </td>
                                                                <td>
                                                                    <input
                                                                        className="project-accounting-qb"
                                                                        type="checkbox"
                                                                        aria-label="Move receivable to QB"
                                                                        checked={
                                                                            transaction.qb
                                                                        }
                                                                        onClick={(
                                                                            event,
                                                                        ) =>
                                                                            event.stopPropagation()
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            requestReceivableQb(
                                                                                transaction,
                                                                                event
                                                                                    .target
                                                                                    .checked,
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td>
                                                                    {
                                                                        transaction.category
                                                                    }
                                                                </td>
                                                            </>
                                                        )}
                                                        <td>
                                                            {transaction.file_name ? (
                                                                <a
                                                                    href={
                                                                        fileUrl
                                                                    }
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    onClick={(
                                                                        event,
                                                                    ) =>
                                                                        event.stopPropagation()
                                                                    }
                                                                >
                                                                    View
                                                                </a>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            },
                                        )}
                                        {visibleAccountingTransactions.length ===
                                            0 && (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        accountingMode !==
                                                        'receivable'
                                                            ? 13
                                                            : 9
                                                    }
                                                    className="project-accounting-empty"
                                                >
                                                    <Landmark />
                                                    <strong>
                                                        No {accountingMode}
                                                        {accountingMode ===
                                                        'commission'
                                                            ? ' payments'
                                                            : 's'}
                                                    </strong>
                                                    <span>
                                                        Click New to record the
                                                        first {accountingMode}
                                                        {accountingMode ===
                                                        'commission'
                                                            ? ' payment'
                                                            : ''}
                                                        .
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <footer className="project-accounting-totals">
                                <div>
                                    <small>Total receivables</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            selected.accounting_transactions
                                                .filter(
                                                    (item) =>
                                                        item.type ===
                                                        'receivable',
                                                )
                                                .reduce(
                                                    (sum, item) =>
                                                        sum +
                                                        Number(item.amount),
                                                    0,
                                                ),
                                        )}
                                    </strong>
                                </div>
                                <div>
                                    <small>Total payables</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            selected.accounting_transactions
                                                .filter(
                                                    (item) =>
                                                        item.type === 'payable',
                                                )
                                                .reduce(
                                                    (sum, item) =>
                                                        sum +
                                                        Number(item.amount),
                                                    0,
                                                ),
                                        )}
                                    </strong>
                                </div>
                                <div>
                                    <small>Balance to collect</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            Math.max(
                                                0,
                                                projectSaleTotal(selected) -
                                                    selected.accounting_transactions
                                                        .filter(
                                                            (item) =>
                                                                item.type ===
                                                                'receivable',
                                                        )
                                                        .reduce(
                                                            (sum, item) =>
                                                                sum +
                                                                Number(
                                                                    item.amount,
                                                                ),
                                                            0,
                                                        ),
                                            ),
                                        )}
                                    </strong>
                                </div>
                                <div>
                                    <small>Total commission balance</small>
                                    <strong>
                                        {commissionBreakdownLoading
                                            ? 'Loading…'
                                            : currencyFormatter.format(
                                                  commissionBreakdown?.salesmen.reduce(
                                                      (sum, salesman) =>
                                                          sum +
                                                          Number(
                                                              salesman.commission_balance,
                                                          ),
                                                      0,
                                                  ) ?? 0,
                                              )}
                                    </strong>
                                </div>
                            </footer>
                        </section>
                    )}

                    {activeTab === 'INV' && selected && (
                        <section className="project-invoices-panel">
                            <header className="project-invoices-header">
                                <div>
                                    <span>
                                        <FileText />
                                    </span>
                                    <div>
                                        <small>Vendor payments</small>
                                        <h2>
                                            Invoices for{' '}
                                            {projectNumber(selected)}
                                        </h2>
                                        <p>
                                            Select an invoice to preview, edit,
                                            delete, or update its status.
                                        </p>
                                    </div>
                                </div>
                                <div className="project-schedule-toolbar">
                                    <button
                                        type="button"
                                        className="is-primary"
                                        onClick={openNewInvoice}
                                    >
                                        <Plus /> New
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            selectedInvoice &&
                                            openEditInvoice(selectedInvoice)
                                        }
                                        disabled={!selectedInvoice}
                                    >
                                        <Pencil /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="is-delete"
                                        onClick={() =>
                                            selectedInvoice &&
                                            void deleteInvoice(selectedInvoice)
                                        }
                                        disabled={!selectedInvoice}
                                    >
                                        <Trash2 /> Delete
                                    </button>
                                </div>
                            </header>

                            <div className="project-invoices-body">
                                <div className="project-invoices-list">
                                    <div className="project-invoices-table-wrap">
                                        <table className="project-invoices-table">
                                            <thead>
                                                <tr>
                                                    {sortableInvoiceHeader('date', 'Date')}
                                                    {sortableInvoiceHeader('number', 'Invoice #')}
                                                    {sortableInvoiceHeader('chargedBy', 'Charged by')}
                                                    {sortableInvoiceHeader('amount', 'Amount')}
                                                    {sortableInvoiceHeader('balance', 'Balance')}
                                                    {sortableInvoiceHeader('notes', 'Notes')}
                                                    {sortableInvoiceHeader('status', 'Status')}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedInvoices.map(
                                                    (invoice) => (
                                                        <tr
                                                            key={invoice.id}
                                                            className={
                                                                selectedInvoiceId ===
                                                                invoice.id
                                                                    ? 'is-selected'
                                                                    : ''
                                                            }
                                                            onClick={() =>
                                                                setSelectedInvoiceId(
                                                                    invoice.id,
                                                                )
                                                            }
                                                        >
                                                            <td>
                                                                {dateFormatter.format(
                                                                    new Date(
                                                                        invoice.invoice_date,
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td>
                                                                <strong className={`attachment-status-tag ${projectInvoiceHasAttachment(invoice, selected.documents) ? 'has-attachment' : 'no-attachment'}`}>
                                                                    {
                                                                        invoice.invoice_number
                                                                    }
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                {invoice
                                                                    .contractor
                                                                    ?.contractor ??
                                                                    invoice
                                                                        .vendor
                                                                        ?.vendor ??
                                                                    'Unknown vendor'}
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    {currencyFormatter.format(
                                                                        Number(
                                                                            invoice.amount,
                                                                        ),
                                                                    )}
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                {currencyFormatter.format(
                                                                    projectInvoiceBalance(
                                                                        selected,
                                                                        invoice,
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td className="project-invoice-notes">
                                                                {invoice.notes ||
                                                                    '—'}
                                                            </td>
                                                            <td
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                            >
                                                                <span
                                                                    className={`project-invoice-status is-${invoice.status}`}
                                                                >
                                                                    {
                                                                        invoiceStatusLabels[
                                                                            invoice
                                                                                .status
                                                                        ]
                                                                    }
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                                {selected.invoices.length ===
                                                    0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={7}
                                                            className="project-invoice-empty"
                                                        >
                                                            <FileText />
                                                            <strong>
                                                                No vendor
                                                                invoices
                                                            </strong>
                                                            <span>
                                                                Add the first
                                                                invoice for this
                                                                project.
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <section className="project-invoice-linked">
                                        <header>
                                            <div>
                                                <small>Linked payables</small>
                                                <strong>
                                                    {selectedInvoice
                                                        ? selectedInvoice.invoice_number
                                                        : 'Select an invoice'}
                                                </strong>
                                            </div>
                                            <span>
                                                {selectedInvoicePayables.length}{' '}
                                                {selectedInvoicePayables.length ===
                                                1
                                                    ? 'payable'
                                                    : 'payables'}
                                            </span>
                                        </header>
                                        <div>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        {sortableInvoicePayableHeader('date', 'Date')}
                                                        {sortableInvoicePayableHeader('reference', 'Reference #')}
                                                        {sortableInvoicePayableHeader('payTo', 'Pay to')}
                                                        {sortableInvoicePayableHeader('requestedBy', 'Requested by')}
                                                        {sortableInvoicePayableHeader('status', 'Status')}
                                                        {sortableInvoicePayableHeader('amount', 'Amount')}
                                                        {sortableInvoicePayableHeader('notes', 'Notes')}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedInvoicePayables.map(
                                                        (payable) => (
                                                            <tr
                                                                key={payable.id}
                                                            >
                                                                <td>
                                                                    {dateFormatter.format(
                                                                        new Date(
                                                                            payable.transaction_date,
                                                                        ),
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <strong>
                                                                        {
                                                                            payable.reference_number
                                                                        }
                                                                    </strong>
                                                                </td>
                                                                <td>
                                                                    {payable
                                                                        .contractor
                                                                        ?.contractor ||
                                                                        payable
                                                                            .vendor
                                                                            ?.vendor ||
                                                                        selectedInvoice
                                                                            ?.contractor
                                                                            ?.contractor ||
                                                                        selectedInvoice
                                                                            ?.vendor
                                                                            ?.vendor ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    {payable.requested_by ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`project-invoice-linked-status is-${payable.status}`}
                                                                    >
                                                                        {
                                                                            invoiceStatusLabels[
                                                                                payable
                                                                                    .status
                                                                            ]
                                                                        }
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <strong>
                                                                        {currencyFormatter.format(
                                                                            Number(
                                                                                payable.amount,
                                                                            ),
                                                                        )}
                                                                    </strong>
                                                                </td>
                                                                <td
                                                                    title={
                                                                        payable.notes ??
                                                                        ''
                                                                    }
                                                                >
                                                                    {payable.notes ||
                                                                        '—'}
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                    {selectedInvoicePayables.length ===
                                                        0 && (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="project-invoice-linked-empty"
                                                            >
                                                                {selectedInvoice
                                                                    ? 'No payables are connected to this invoice.'
                                                                    : 'Select an invoice above to view its payables.'}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                    <footer className="project-invoice-total">
                                        <span>Total invoices</span>
                                        <strong>
                                            {currencyFormatter.format(
                                                projectInvoiceTotal(selected),
                                            )}
                                        </strong>
                                    </footer>
                                </div>

                                <aside className="project-invoice-preview">
                                    <header>
                                        <div>
                                            <Eye />
                                            <span>File preview</span>
                                        </div>
                                        {selectedInvoice?.file_name && (
                                            <a
                                                href={invoiceFileUrl(
                                                    selected,
                                                    selectedInvoice,
                                                )}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Open file
                                            </a>
                                        )}
                                    </header>
                                    {selectedInvoice?.file_name ? (
                                        <div className="project-invoice-preview__file">
                                            {selectedInvoice.file_mime?.startsWith(
                                                'image/',
                                            ) ? (
                                                <img
                                                    src={invoiceFileUrl(
                                                        selected,
                                                        selectedInvoice,
                                                    )}
                                                    alt={`${selectedInvoice.invoice_number} attachment`}
                                                />
                                            ) : (
                                                <iframe
                                                    src={invoiceFileUrl(
                                                        selected,
                                                        selectedInvoice,
                                                    )}
                                                    title={`${selectedInvoice.invoice_number} attachment`}
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="project-invoice-preview__empty">
                                            <Upload />
                                            <strong>
                                                {selectedInvoice
                                                    ? 'No file attached'
                                                    : 'Select an invoice'}
                                            </strong>
                                            <span>
                                                {selectedInvoice
                                                    ? 'Edit this invoice to attach a PDF or image.'
                                                    : 'Its uploaded invoice file will appear here.'}
                                            </span>
                                        </div>
                                    )}
                                </aside>
                            </div>
                        </section>
                    )}

                    {activeTab === 'SP' && selected && (
                        <section className="project-schedule-panel">
                            <header className="project-schedule-header">
                                <div>
                                    <span>
                                        <CalendarDays />
                                    </span>
                                    <div>
                                        <small>Schedule payments</small>
                                        <h2>
                                            Payment plan for{' '}
                                            {projectNumber(selected)}
                                        </h2>
                                        <p>
                                            Select a row to edit or delete its
                                            scheduled payment.
                                        </p>
                                    </div>
                                </div>
                                <div className="project-schedule-toolbar">
                                    <button
                                        type="button"
                                        className="is-primary"
                                        onClick={openNewScheduledPayment}
                                        disabled={
                                            scheduleBalance(selected) <= 0
                                        }
                                        title={
                                            scheduleBalance(selected) <= 0
                                                ? 'The full contract total is already scheduled'
                                                : 'Add scheduled payment'
                                        }
                                    >
                                        <Plus /> New
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            selectedScheduledPayment &&
                                            openEditScheduledPayment(
                                                selectedScheduledPayment,
                                            )
                                        }
                                        disabled={!selectedScheduledPayment}
                                    >
                                        <Pencil /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="is-delete"
                                        onClick={() =>
                                            selectedScheduledPayment &&
                                            void deleteScheduledPayment(
                                                selectedScheduledPayment,
                                            )
                                        }
                                        disabled={!selectedScheduledPayment}
                                    >
                                        <Trash2 /> Delete
                                    </button>
                                </div>
                            </header>

                            <div className="project-schedule-table-wrap">
                                <table className="project-schedule-table">
                                    <thead>
                                        <tr>
                                            <th>Expected date</th>
                                            <th>Should be paid upon</th>
                                            <th>Amount</th>
                                            <th>Balance</th>
                                            <th>QB</th>
                                            <th>Printed / Sent</th>
                                            <th>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selected.scheduled_payments.map(
                                            (payment) => (
                                                <tr
                                                    key={payment.id}
                                                    className={
                                                        selectedScheduledPaymentId ===
                                                        payment.id
                                                            ? 'is-selected'
                                                            : ''
                                                    }
                                                    onClick={() =>
                                                        setSelectedScheduledPaymentId(
                                                            payment.id,
                                                        )
                                                    }
                                                >
                                                    <td>
                                                        {dateFormatter.format(
                                                            new Date(
                                                                payment.expected_date,
                                                            ),
                                                        )}
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {
                                                                payment.payment_stage
                                                            }
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    payment.amount,
                                                                ),
                                                            )}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {currencyFormatter.format(
                                                            scheduledPaymentBalance(
                                                                selected,
                                                                payment,
                                                            ),
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`project-schedule-flag ${payment.qb ? 'is-complete' : ''}`}
                                                        >
                                                            {payment.qb ? (
                                                                <CheckCircle2 />
                                                            ) : (
                                                                'No'
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`project-schedule-flag ${payment.printed_sent ? 'is-complete' : ''}`}
                                                        >
                                                            {payment.printed_sent
                                                                ? 'Yes'
                                                                : 'No'}
                                                        </span>
                                                    </td>
                                                    <td className="project-schedule-notes">
                                                        {payment.notes || '—'}
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                        {selected.scheduled_payments.length ===
                                            0 && (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="project-schedule-empty"
                                                >
                                                    <CalendarDays />
                                                    <strong>
                                                        No scheduled payments
                                                    </strong>
                                                    <span>
                                                        Add the first payment
                                                        milestone for this
                                                        project.
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <section className="project-schedule-linked">
                                <header>
                                    <div>
                                        <small>Linked receivables</small>
                                        <strong>
                                            {selectedScheduledPayment
                                                ? selectedScheduledPayment.payment_stage
                                                : 'Select a scheduled payment'}
                                        </strong>
                                    </div>
                                    <span>
                                        {selectedScheduledReceivables.length}{' '}
                                        {selectedScheduledReceivables.length ===
                                        1
                                            ? 'receivable'
                                            : 'receivables'}
                                    </span>
                                </header>
                                <div>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Reference #</th>
                                                <th>Received from</th>
                                                <th>Status</th>
                                                <th>Amount</th>
                                                <th>Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedScheduledReceivables.map(
                                                (receivable) => (
                                                    <tr key={receivable.id}>
                                                        <td>
                                                            {dateFormatter.format(
                                                                new Date(
                                                                    receivable.transaction_date,
                                                                ),
                                                            )}
                                                        </td>
                                                        <td>
                                                            <strong>
                                                                {
                                                                    receivable.reference_number
                                                                }
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            {receivable.counterparty ||
                                                                selected.lead
                                                                    .customer_name}
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`project-schedule-linked-status is-${receivable.status}`}
                                                            >
                                                                {
                                                                    invoiceStatusLabels[
                                                                        receivable
                                                                            .status
                                                                    ]
                                                                }
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <strong>
                                                                {currencyFormatter.format(
                                                                    Number(
                                                                        receivable.amount,
                                                                    ),
                                                                )}
                                                            </strong>
                                                        </td>
                                                        <td
                                                            title={
                                                                receivable.notes ??
                                                                ''
                                                            }
                                                        >
                                                            {receivable.notes ||
                                                                '—'}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                            {selectedScheduledReceivables.length ===
                                                0 && (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="project-schedule-linked-empty"
                                                    >
                                                        {selectedScheduledPayment
                                                            ? 'No receivables are connected to this scheduled payment.'
                                                            : 'Select a scheduled payment above to view its receivables.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <footer className="project-schedule-summary">
                                <div>
                                    <small>Total contract</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            projectSaleTotal(selected),
                                        )}
                                    </strong>
                                </div>
                                <div>
                                    <small>Total scheduled payments</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            scheduledPaymentTotal(selected),
                                        )}
                                    </strong>
                                </div>
                                <div
                                    className={
                                        scheduleBalance(selected) === 0
                                            ? 'is-complete'
                                            : ''
                                    }
                                >
                                    <small>Schedule balance</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            scheduleBalance(selected),
                                        )}
                                    </strong>
                                </div>
                            </footer>
                        </section>
                    )}

                    {activeTab === 'PRJ' && (
                        <section className="projects-panel">
                            <div className="projects-table-toolbar">
                                <div className="projects-project-only-actions">
                                    {!projectOnlySelectionMode ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setProjectOnlySelectionMode(
                                                    true,
                                                )
                                            }
                                        >
                                            Manage project-only
                                        </button>
                                    ) : (
                                        <>
                                            <span>
                                                {selectedProjectOnlyIds.length}{' '}
                                                selected
                                            </span>
                                            <button
                                                type="button"
                                                disabled={
                                                    selectedProjectOnlyIds.length ===
                                                        0 || updatingProjectOnly
                                                }
                                                onClick={() =>
                                                    bulkUpdateProjectOnly(true)
                                                }
                                            >
                                                Mark project only
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    selectedProjectOnlyIds.length ===
                                                        0 || updatingProjectOnly
                                                }
                                                onClick={() =>
                                                    bulkUpdateProjectOnly(false)
                                                }
                                            >
                                                Show in Tele Leads
                                            </button>
                                            <button
                                                type="button"
                                                className="is-cancel"
                                                disabled={updatingProjectOnly}
                                                onClick={
                                                    cancelProjectOnlySelection
                                                }
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="projects-table-wrap">
                                <table className="projects-table">
                                    <thead>
                                        <tr>
                                            {projectOnlySelectionMode && (
                                                <th className="projects-project-only-heading">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                allVisibleProjectsSelected
                                                            }
                                                            disabled={
                                                                selectableProjectIds.length ===
                                                                0
                                                            }
                                                            aria-label="Select all visible projects"
                                                            onChange={() =>
                                                                setSelectedProjectOnlyIds(
                                                                    allVisibleProjectsSelected
                                                                        ? selectedProjectOnlyIds.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  !selectableProjectIds.includes(
                                                                                      id,
                                                                                  ),
                                                                          )
                                                                        : Array.from(
                                                                              new Set(
                                                                                  [
                                                                                      ...selectedProjectOnlyIds,
                                                                                      ...selectableProjectIds,
                                                                                  ],
                                                                              ),
                                                                          ),
                                                                )
                                                            }
                                                        />
                                                        Select
                                                    </label>
                                                </th>
                                            )}
                                            {sortableProjectHeader(
                                                'signed',
                                                'Signed',
                                            )}
                                            {sortableProjectHeader(
                                                'status',
                                                'Status',
                                            )}
                                            <th>Type</th>
                                            <th>Status Sale</th>
                                            {sortableProjectHeader(
                                                'customer',
                                                'Customer',
                                            )}
                                            {sortableProjectHeader(
                                                'company',
                                                'Company',
                                            )}
                                            {sortableProjectHeader(
                                                'projectNumber',
                                                'Project Number',
                                            )}
                                            {sortableProjectHeader(
                                                'city',
                                                'City',
                                            )}
                                            {sortableProjectHeader(
                                                'phone',
                                                'Phone',
                                            )}
                                            {sortableProjectHeader(
                                                'agent',
                                                'Agent',
                                            )}
                                            {sortableProjectHeader(
                                                'salesman',
                                                'Salesman',
                                            )}
                                            {sortableProjectHeader(
                                                'sale',
                                                'Sale',
                                            )}
                                            {sortableProjectHeader(
                                                'product',
                                                'Product',
                                            )}
                                            <th>Contract</th>
                                            {sortableProjectHeader(
                                                'notes',
                                                'Notes',
                                            )}
                                            <th>Salesman Share</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProjects.map((project) => {
                                            const referralSales =
                                                project.sales.filter(
                                                    (sale) =>
                                                        sale.type ===
                                                        'referral',
                                                );
                                            const hasReferralSale =
                                                referralSales.length > 0;
                                            const salesExpanded =
                                                expandedSaleProjectIds.includes(
                                                    project.id,
                                                );

                                            return (
                                                <Fragment key={project.id}>
                                                    <tr
                                                        ref={
                                                            isSearchFocus &&
                                                            requestedProjectId ===
                                                                project.id
                                                                ? focusedProjectRowRef
                                                                : undefined
                                                        }
                                                        data-project-id={
                                                            project.id
                                                        }
                                                        className={[
                                                            selectedId ===
                                                            project.id
                                                                ? 'is-selected'
                                                                : '',
                                                            isSearchFocus &&
                                                            requestedProjectId ===
                                                                project.id
                                                                ? 'is-search-target'
                                                                : '',
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ')}
                                                        onClick={() =>
                                                            selectProject(
                                                                project,
                                                            )
                                                        }
                                                    >
                                                        {projectOnlySelectionMode && (
                                                            <td
                                                                className="projects-project-only"
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProjectOnlyIds.includes(
                                                                        project.id,
                                                                    )}
                                                                    disabled={
                                                                        project.lead_id ===
                                                                        null
                                                                    }
                                                                    aria-label={`Select ${project.lead?.customer_name || project.project_number || `project ${project.id}`}`}
                                                                    title={
                                                                        project.lead_id ===
                                                                        null
                                                                            ? 'Standalone projects are already project-only'
                                                                            : 'Select project'
                                                                    }
                                                                    onChange={() =>
                                                                        toggleProjectOnlySelection(
                                                                            project.id,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        )}
                                                        <td>
                                                            {projectAppointmentTime(
                                                                project,
                                                            )
                                                                ? dateFormatter.format(
                                                                      appointmentDate(
                                                                          project
                                                                              .lead
                                                                              .appointment_at,
                                                                      ),
                                                                  )
                                                                : '—'}
                                                        </td>
                                                        <td>
                                                            <span className="projects-status">
                                                                {project.status ||
                                                                    'new'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`projects-record-type ${project.lead_id === null || project.tele_lead_excluded ? 'is-project-only' : 'is-lead'}`}
                                                            >
                                                                {project.lead_id ===
                                                                    null ||
                                                                project.tele_lead_excluded
                                                                    ? 'Project only'
                                                                    : 'Lead'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="projects-sale-status-cell">
                                                                <strong>
                                                                    {hasReferralSale
                                                                        ? 'N/R'
                                                                        : 'N'}
                                                                </strong>
                                                                {hasReferralSale && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(
                                                                            event,
                                                                        ) => {
                                                                            event.stopPropagation();
                                                                            setExpandedSaleProjectIds(
                                                                                (
                                                                                    current,
                                                                                ) =>
                                                                                    current.includes(
                                                                                        project.id,
                                                                                    )
                                                                                        ? current.filter(
                                                                                              (
                                                                                                  id,
                                                                                              ) =>
                                                                                                  id !==
                                                                                                  project.id,
                                                                                          )
                                                                                        : [
                                                                                              ...current,
                                                                                              project.id,
                                                                                          ],
                                                                            );
                                                                        }}
                                                                        aria-expanded={
                                                                            salesExpanded
                                                                        }
                                                                        aria-label={`${salesExpanded ? 'Collapse' : 'Expand'} sales for ${project.lead.customer_name}`}
                                                                    >
                                                                        {salesExpanded ? (
                                                                            <ChevronUp />
                                                                        ) : (
                                                                            <ChevronDown />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <strong>
                                                                {
                                                                    project.lead
                                                                        .customer_name
                                                                }
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <strong>
                                                                {project.lead
                                                                    .company
                                                                    ?.prefix ??
                                                                    '—'}
                                                            </strong>
                                                        </td>
                                                        <td className="projects-number">
                                                            <button
                                                                type="button"
                                                                className="projects-number-contract-button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setContractViewerProject(project);
                                                                }}
                                                            >
                                                                {projectNumber(project)}
                                                            </button>
                                                        </td>
                                                        <td>
                                                            {project.lead.city}
                                                        </td>
                                                        <td>
                                                            {formatPhoneNumber(
                                                                project.lead
                                                                    .primary_number,
                                                            )}
                                                        </td>
                                                        <td>
                                                            {project.lead.agent
                                                                ?.agent_name ??
                                                                '—'}
                                                        </td>
                                                        <td>
                                                            {[
                                                                project.lead
                                                                    .salesman_one
                                                                    ?.salesman_name,
                                                                project.lead
                                                                    .salesman_two
                                                                    ?.salesman_name,
                                                                ...project.sales.map(
                                                                    (sale) =>
                                                                        sale.salesman
                                                                            ?.salesman_name,
                                                                ),
                                                            ]
                                                                .filter(Boolean)
                                                                .filter(
                                                                    (name, index, names) =>
                                                                        names.indexOf(name) === index,
                                                                )
                                                                .join(' & ')}
                                                        </td>
                                                        <td className="projects-amount">
                                                            {currencyFormatter.format(
                                                                projectSaleTotal(project),
                                                            )}
                                                        </td>
                                                        <td>
                                                            {project.lead
                                                                .product
                                                                ?.product_name ??
                                                                '—'}
                                                        </td>
                                                        <td>—</td>
                                                        <td
                                                            className="projects-notes"
                                                            title={latestNote(
                                                                project,
                                                            )}
                                                        >
                                                            {latestNote(
                                                                project,
                                                            )}
                                                        </td>
                                                        <td className="projects-amount projects-salesman-share">
                                                            {projectSalesmanFilter ===
                                                            'all'
                                                                ? '-'
                                                                : currencyFormatter.format(
                                                                      projectSaleContribution(
                                                                          project,
                                                                      ),
                                                                  )}
                                                        </td>
                                                    </tr>
                                                    {hasReferralSale &&
                                                        salesExpanded && (
                                                            <tr className="projects-sale-breakdown-row">
                                                                <td
                                                                    colSpan={
                                                                        projectOnlySelectionMode
                                                                            ? 18
                                                                            : 17
                                                                    }
                                                                >
                                                                    <div className="projects-sale-breakdown">
                                                                        {project.sales.map(
                                                                            (
                                                                                sale,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        sale.id
                                                                                    }
                                                                                >
                                                                                    <strong>
                                                                                        {sale.type ===
                                                                                        'original'
                                                                                            ? 'New'
                                                                                            : Number(sale.amount) < 0
                                                                                              ? 'Discount'
                                                                                              : `Referral ${referralSales.findIndex((referral) => referral.id === sale.id) + 1}`}
                                                                                    </strong>
                                                                                    <span>
                                                                                        {currencyFormatter.format(
                                                                                            Number(
                                                                                                sale.amount,
                                                                                            ),
                                                                                        )}
                                                                                    </span>
                                                                                    <span>
                                                                                        {compactSaleDate(
                                                                                            sale.sale_date,
                                                                                        )}
                                                                                    </span>
                                                                                    <span>
                                                                                        {sale
                                                                                            .product
                                                                                            ?.product_name ??
                                                                                            '—'}
                                                                                    </span>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                </Fragment>
                                            );
                                        })}

                                        {filteredProjects.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        projectOnlySelectionMode
                                                            ? 18
                                                            : 17
                                                    }
                                                    className="projects-empty"
                                                >
                                                    <BriefcaseBusiness />
                                                    <strong>
                                                        No{' '}
                                                        {projectStatusFilter ===
                                                        'all'
                                                            ? ''
                                                            : projectStatusFilter ===
                                                                'progress'
                                                              ? 'in progress '
                                                              : `${projectStatusFilter} `}
                                                        projects
                                                    </strong>
                                                    <span>
                                                        Choose another status to
                                                        view matching projects.
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {activeTab === 'DTL' && selected && (
                        <section className="project-details-panel">
                            <header className="project-details-header">
                                <div>
                                    <button
                                        type="button"
                                        onClick={returnToProjectList}
                                        aria-label="Back to projects"
                                    >
                                        <ArrowLeft />
                                    </button>
                                    <span className="project-details-mark">
                                        {selected.lead.customer_name
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                    <div>
                                        <small>{projectNumber(selected)}</small>
                                        <h2>{selected.lead.customer_name}</h2>
                                    </div>
                                </div>
                                <div className="project-details-header__meta">
                                    {customerProjects.length > 0 && (
                                        <label className="project-family-switcher">
                                            <span>Customer project</span>
                                            <select
                                                value={selected.id}
                                                onChange={(event) => {
                                                    const nextProject =
                                                        customerProjects.find(
                                                            (project) =>
                                                                project.id ===
                                                                Number(
                                                                    event.target
                                                                        .value,
                                                                ),
                                                        );

                                                    if (nextProject) {
                                                        selectProject(
                                                            nextProject,
                                                        );
                                                    }
                                                }}
                                            >
                                                {customerProjects.map(
                                                    (project) => (
                                                        <option
                                                            key={project.id}
                                                            value={project.id}
                                                        >
                                                            {projectNumber(
                                                                project,
                                                            )}{' '}
                                                            —{' '}
                                                            {project.lead
                                                                .product
                                                                ?.product_name ??
                                                                'No product'}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                    )}
                                    {selected.lead.id !== 0 && (
                                        <button
                                            type="button"
                                            className="project-add-sale"
                                            onClick={openCustomerProjectCreate}
                                        >
                                            <Plus />
                                            New project for this customer
                                        </button>
                                    )}
                                    {rootCustomerProjectId !== null &&
                                        selected.id !== rootCustomerProjectId && (
                                            <button
                                                type="button"
                                                className="project-delete-customer-project"
                                                onClick={() => void deleteCustomerProject()}
                                            >
                                                <Trash2 />
                                                Delete this project
                                            </button>
                                        )}
                                    <span className="projects-status">
                                        {selected.status || 'new'}
                                    </span>
                                    <small>
                                        Signed{' '}
                                        {dateFormatter.format(
                                            new Date(selected.created_at),
                                        )}
                                    </small>
                                    <button
                                        type="button"
                                        className="project-add-sale"
                                        onClick={
                                            editingProjectDetails
                                                ? saveProjectDetails
                                                : beginProjectDetailsEdit
                                        }
                                        disabled={projectDetailsForm.processing}
                                    >
                                        <Pencil />
                                        {projectDetailsForm.processing
                                            ? 'Saving…'
                                            : editingProjectDetails
                                              ? 'Save details'
                                              : 'Edit details'}
                                    </button>
                                </div>
                            </header>

                            {editingProjectDetails &&
                                Object.keys(projectDetailsForm.errors).length >
                                    0 && (
                                    <div
                                        className="project-details-save-errors"
                                        role="alert"
                                    >
                                        <strong>
                                            Project details were not saved.
                                        </strong>
                                        <span>
                                            {
                                                Object.values(
                                                    projectDetailsForm.errors,
                                                )[0]
                                            }
                                        </span>
                                    </div>
                                )}

                            <div className="project-details-grid">
                                <article className="project-detail-card project-detail-card--customer">
                                    <header>
                                        <span>
                                            <UserRound />
                                        </span>
                                        <div>
                                            <h3>Customer information</h3>
                                            <p>Contact and property details</p>
                                        </div>
                                    </header>
                                    <div className="project-detail-fields">
                                        <div className="is-wide">
                                            <UserRound />
                                            <span>
                                                <small>Customer</small>
                                                {editingProjectDetails ? (
                                                    <input
                                                        value={
                                                            projectDetailsForm
                                                                .data
                                                                .customer_name
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'customer_name',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <strong>
                                                        {
                                                            selected.lead
                                                                .customer_name
                                                        }
                                                    </strong>
                                                )}
                                            </span>
                                        </div>
                                        <div className="is-wide">
                                            <MapPin />
                                            <span>
                                                <small>Address</small>
                                                {editingProjectDetails ? (
                                                    <div className="project-inline-address">
                                                        <input
                                                            className="is-wide"
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .address
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'address',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Street address"
                                                        />
                                                        <input
                                                            value={
                                                                projectDetailsForm
                                                                    .data.city
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'city',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="City"
                                                        />
                                                        <input
                                                            value={
                                                                projectDetailsForm
                                                                    .data.state
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'state',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="State"
                                                        />
                                                        <input
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .zip_code
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'zip_code',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="ZIP code"
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <strong>
                                                            {
                                                                selected.lead
                                                                    .address
                                                            }
                                                        </strong>
                                                        <em>
                                                            {selected.lead.city}
                                                            ,{' '}
                                                            {
                                                                selected.lead
                                                                    .state
                                                            }{' '}
                                                            {
                                                                selected.lead
                                                                    .zip_code
                                                            }
                                                        </em>
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <div>
                                            <Phone />
                                            <span>
                                                <small>Primary phone</small>
                                                <span className="project-call-row">
                                                    {editingProjectDetails ? (
                                                        <input
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .primary_number
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'primary_number',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <strong>
                                                            {formatPhoneNumber(
                                                                selected.lead
                                                                    .primary_number,
                                                            )}
                                                        </strong>
                                                    )}
                                                    {(editingProjectDetails
                                                        ? projectDetailsForm
                                                              .data
                                                              .primary_number
                                                        : selected.lead
                                                              .primary_number
                                                    )?.trim() && (
                                                        <RingCentralCallButton
                                                            leadId={
                                                                selected.lead
                                                                    .id ||
                                                                undefined
                                                            }
                                                            phone={
                                                                editingProjectDetails
                                                                    ? projectDetailsForm
                                                                          .data
                                                                          .primary_number
                                                                    : selected
                                                                          .lead
                                                                          .primary_number
                                                            }
                                                            phoneSlot="primary"
                                                            className="project-call-button"
                                                            title="Call customer with RingCentral"
                                                        >
                                                            <PhoneCall />
                                                            <span>Call</span>
                                                        </RingCentralCallButton>
                                                    )}
                                                </span>
                                            </span>
                                        </div>
                                        <div>
                                            <Phone />
                                            <span>
                                                <small>Mobile</small>
                                                {editingProjectDetails ? (
                                                    <input
                                                        value={
                                                            projectDetailsForm
                                                                .data
                                                                .mobile_number
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'mobile_number',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <strong>
                                                        {formatPhoneNumber(
                                                            selected.lead
                                                                .mobile_number,
                                                        )}
                                                    </strong>
                                                )}
                                            </span>
                                        </div>
                                        <div>
                                            <Phone />
                                            <span>
                                                <small>Secondary phone</small>
                                                {editingProjectDetails ? (
                                                    <input
                                                        value={
                                                            projectDetailsForm
                                                                .data
                                                                .secondary_number
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'secondary_number',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <strong>
                                                        {formatPhoneNumber(
                                                            selected.lead
                                                                .secondary_number,
                                                        )}
                                                    </strong>
                                                )}
                                            </span>
                                        </div>
                                        <div className="is-wide">
                                            <Mail />
                                            <span>
                                                <small>Email</small>
                                                {editingProjectDetails ? (
                                                    <input
                                                        type="email"
                                                        value={
                                                            projectDetailsForm
                                                                .data.email
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'email',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <strong>
                                                        {selected.lead.email ||
                                                            'No email provided'}
                                                    </strong>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </article>

                                <article className="project-detail-card project-detail-card--overview">
                                    <header>
                                        <span>
                                            <BriefcaseBusiness />
                                        </span>
                                        <div>
                                            <h3>Project overview</h3>
                                            <p>Current project information</p>
                                        </div>
                                        <div className="project-overview-actions">
                                            <button
                                                type="button"
                                                className={selected.documents.some((document) => document.category.startsWith('Completion Form')) ? 'has-file' : ''}
                                                onClick={openCompletionModal}
                                            >
                                                <FileText /> Completion
                                            </button>
                                            {(['lead_cost', 'commission'] as const).map((type) => {
                                                const check = selected.payment_checks.find((item) => item.type === type);
                                                return (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        className={check?.file_name ? 'has-file' : ''}
                                                        onClick={() => void openPaymentCheckModal(type)}
                                                        title={type === 'lead_cost' ? 'Lead Cost' : 'Total Commission'}
                                                    >
                                                        <CircleDollarSign /> {type === 'lead_cost' ? 'LC' : 'CO'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </header>
                                    <div className="project-overview-grid">
                                        <div>
                                            <small>Project number</small>
                                            {editingProjectDetails ? (
                                                <>
                                                    <input
                                                        value={
                                                            projectDetailsForm
                                                                .data
                                                                .project_number
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'project_number',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Enter a project number manually or leave blank"
                                                    />
                                                    {projectDetailsForm.errors
                                                        .project_number && (
                                                        <em>
                                                            {
                                                                projectDetailsForm
                                                                    .errors
                                                                    .project_number
                                                            }
                                                        </em>
                                                    )}
                                                </>
                                            ) : (
                                                <strong>
                                                    {projectNumber(selected)}
                                                </strong>
                                            )}
                                        </div>
                                        <div>
                                            <small>Company</small>
                                            {editingProjectDetails ? (
                                                <>
                                                    <select
                                                        value={
                                                            projectDetailsForm
                                                                .data.company_id
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'company_id',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Select company
                                                        </option>
                                                        {companies.map(
                                                            (company) => (
                                                                <option
                                                                    key={
                                                                        company.com_id
                                                                    }
                                                                    value={
                                                                        company.com_id
                                                                    }
                                                                >
                                                                    {
                                                                        company.company
                                                                    }{' '}
                                                                    (
                                                                    {
                                                                        company.prefix
                                                                    }
                                                                    )
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    {projectDetailsForm.errors
                                                        .company_id && (
                                                        <em>
                                                            {
                                                                projectDetailsForm
                                                                    .errors
                                                                    .company_id
                                                            }
                                                        </em>
                                                    )}
                                                </>
                                            ) : (
                                                <strong>
                                                    {selected.lead.company
                                                        ?.prefix || '—'}
                                                </strong>
                                            )}
                                        </div>
                                        <div>
                                            <small>Product</small>
                                            {editingProjectDetails ? (
                                                <>
                                                    <select
                                                        value={
                                                            projectDetailsForm
                                                                .data.product_id
                                                        }
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'product_id',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Select product
                                                        </option>
                                                        {products.map(
                                                            (product) => (
                                                                <option
                                                                    key={
                                                                        product.prod_id
                                                                    }
                                                                    value={
                                                                        product.prod_id
                                                                    }
                                                                >
                                                                    {
                                                                        product.product_name
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    {projectDetailsForm.errors
                                                        .product_id && (
                                                        <em>
                                                            {
                                                                projectDetailsForm
                                                                    .errors
                                                                    .product_id
                                                            }
                                                        </em>
                                                    )}
                                                </>
                                            ) : (
                                                <strong>
                                                    {selected.lead.product
                                                        ?.product_name || '—'}
                                                </strong>
                                            )}
                                        </div>
                                        <div>
                                            <small>Lead source</small>
                                            {editingProjectDetails ? (
                                                <input
                                                    value={
                                                        projectDetailsForm.data
                                                            .source
                                                    }
                                                    onChange={(event) =>
                                                        projectDetailsForm.setData(
                                                            'source',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <strong>
                                                    {selected.lead.source}
                                                </strong>
                                            )}
                                        </div>
                                        <div>
                                            <small>Appointment</small>
                                            {editingProjectDetails ? (
                                                <input
                                                    type="datetime-local"
                                                    value={
                                                        projectDetailsForm.data
                                                            .appointment_at
                                                    }
                                                    onChange={(event) =>
                                                        projectDetailsForm.setData(
                                                            'appointment_at',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <strong>
                                                    {selected.lead
                                                        .appointment_at
                                                        ? dateFormatter.format(
                                                              appointmentDate(
                                                                  selected.lead
                                                                      .appointment_at,
                                                              ),
                                                          )
                                                        : '—'}
                                                </strong>
                                            )}
                                        </div>
                                        <div>
                                            <small>Lead created</small>
                                            {editingProjectDetails ? (
                                                <input
                                                    type="datetime-local"
                                                    value={
                                                        projectDetailsForm.data
                                                            .lead_created_at
                                                    }
                                                    onChange={(event) =>
                                                        projectDetailsForm.setData(
                                                            'lead_created_at',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <strong>
                                                    {dateFormatter.format(
                                                        new Date(
                                                            selected.lead
                                                                .created_at,
                                                        ),
                                                    )}
                                                </strong>
                                            )}
                                        </div>
                                        <div>
                                            <small>Status</small>
                                            {editingProjectDetails ? (
                                                <>
                                                    <select
                                                        value={
                                                            projectDetailsForm
                                                                .data.status
                                                        }
                                                        onChange={(event) => {
                                                            const status =
                                                                event.target
                                                                    .value;
                                                            projectDetailsForm.setData(
                                                                'status',
                                                                status,
                                                            );
                                                        }}
                                                    >
                                                        <option value="new">
                                                            New
                                                        </option>
                                                        <option value="progress">
                                                            Progress
                                                        </option>
                                                        <option value="completed">
                                                            Completed
                                                        </option>
                                                        <option value="canceled">
                                                            Canceled
                                                        </option>
                                                    </select>
                                                    {projectDetailsForm.errors
                                                        .status && (
                                                        <em>
                                                            {
                                                                projectDetailsForm
                                                                    .errors
                                                                    .status
                                                            }
                                                        </em>
                                                    )}
                                                </>
                                            ) : (
                                                <strong className="is-blue">
                                                    {selected.status || 'new'}
                                                </strong>
                                            )}
                                        </div>
                                        <div className="project-overview-ownership">
                                            <small>
                                                Lead and sales ownership
                                            </small>
                                            <div>
                                                <span>
                                                    <small>Main agent</small>
                                                    {editingProjectDetails ? (
                                                        <select
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .agent_id
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'agent_id',
                                                                    event.target
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
                                                                    >
                                                                        {
                                                                            agent.agent_name
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    ) : (
                                                        <strong>
                                                            {selected.lead.agent
                                                                ?.agent_name ||
                                                                'Unassigned'}
                                                        </strong>
                                                    )}
                                                </span>
                                                <span>
                                                    <small>Second agent</small>
                                                    {editingProjectDetails ? (
                                                        <select
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .agent_2_id
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'agent_2_id',
                                                                    event.target
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
                                                                            String(
                                                                                agent.agent_id,
                                                                            ) ===
                                                                            projectDetailsForm
                                                                                .data
                                                                                .agent_id
                                                                        }
                                                                    >
                                                                        {
                                                                            agent.agent_name
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    ) : (
                                                        <strong>
                                                            {selected.lead
                                                                .second_agent
                                                                ?.agent_name ||
                                                                'Unassigned'}
                                                        </strong>
                                                    )}
                                                </span>
                                                <span>
                                                    <small>Salesman 1</small>
                                                    {editingProjectDetails ? (
                                                        <select
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .salesman_1_id
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'salesman_1_id',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Unassigned
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
                                                    ) : (
                                                        <span className="project-call-row">
                                                            <strong>
                                                                {selected.lead
                                                                    .salesman_one
                                                                    ?.salesman_name ||
                                                                    'Unassigned'}
                                                            </strong>
                                                            {selected.lead.salesman_one?.phone?.trim() && (
                                                                <RingCentralCallButton
                                                                    phone={
                                                                        selected
                                                                            .lead
                                                                            .salesman_one
                                                                            .phone
                                                                    }
                                                                    phoneSlot="primary"
                                                                    className="project-call-button"
                                                                    title={`Call ${selected.lead.salesman_one.salesman_name} with RingCentral`}
                                                                >
                                                                    <PhoneCall />
                                                                    <span>
                                                                        Call
                                                                    </span>
                                                                </RingCentralCallButton>
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                                <span>
                                                    <small>Salesman 2</small>
                                                    {editingProjectDetails ? (
                                                        <select
                                                            value={
                                                                projectDetailsForm
                                                                    .data
                                                                    .salesman_2_id
                                                            }
                                                            onChange={(event) =>
                                                                projectDetailsForm.setData(
                                                                    'salesman_2_id',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Unassigned
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
                                                                        disabled={
                                                                            String(
                                                                                salesman.salesman_id,
                                                                            ) ===
                                                                            projectDetailsForm
                                                                                .data
                                                                                .salesman_1_id
                                                                        }
                                                                    >
                                                                        {
                                                                            salesman.salesman_name
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    ) : (
                                                        <span className="project-call-row">
                                                            <strong>
                                                                {selected.lead
                                                                    .salesman_two
                                                                    ?.salesman_name ||
                                                                    'Unassigned'}
                                                            </strong>
                                                            {selected.lead.salesman_two?.phone?.trim() && (
                                                                <RingCentralCallButton
                                                                    phone={
                                                                        selected
                                                                            .lead
                                                                            .salesman_two
                                                                            .phone
                                                                    }
                                                                    phoneSlot="primary"
                                                                    className="project-call-button"
                                                                    title={`Call ${selected.lead.salesman_two.salesman_name} with RingCentral`}
                                                                >
                                                                    <PhoneCall />
                                                                    <span>
                                                                        Call
                                                                    </span>
                                                                </RingCentralCallButton>
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            {editingProjectDetails &&
                                                (projectDetailsForm.errors
                                                    .agent_id ||
                                                    projectDetailsForm.errors
                                                        .agent_2_id ||
                                                    projectDetailsForm.errors
                                                        .salesman_1_id ||
                                                    projectDetailsForm.errors
                                                        .salesman_2_id) && (
                                                    <em>
                                                        {projectDetailsForm
                                                            .errors.agent_id ||
                                                            projectDetailsForm
                                                                .errors
                                                                .agent_2_id ||
                                                            projectDetailsForm
                                                                .errors
                                                                .salesman_1_id ||
                                                            projectDetailsForm
                                                                .errors
                                                                .salesman_2_id}
                                                    </em>
                                                )}
                                        </div>
                                    </div>
                                </article>

                                <article className="project-detail-card project-detail-card--sale">
                                    <header>
                                        <span>
                                            <CircleDollarSign />
                                        </span>
                                        <div>
                                            <h3>Sales information</h3>
                                            <p>Original and referral sales</p>
                                        </div>
                                        <div className="project-sale-summary">
                                            <small>Total sale</small>
                                            <strong>
                                                {currencyFormatter.format(
                                                    projectSaleTotal(selected),
                                                )}
                                            </strong>
                                            <span>
                                                {selected.sales.length}{' '}
                                                {selected.sales.length === 1
                                                    ? 'sale'
                                                    : 'sales'}
                                            </span>
                                        </div>
                                    </header>
                                    <div className="project-sales-table-wrap">
                                        <table className="project-sales-table">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Sale</th>
                                                    <th>Date</th>
                                                    <th>Product</th>
                                                    <th>Referral salesman</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selected.sales.map(
                                                    (sale, saleIndex) => (
                                                        <tr
                                                            key={sale.id}
                                                            className={`${sale.type === 'original' ? 'is-original' : ''} ${selectedSaleId === sale.id ? 'is-selected' : ''}`}
                                                            onClick={() =>
                                                                setSelectedSaleId(
                                                                    sale.id,
                                                                )
                                                            }
                                                        >
                                                            <td>
                                                                <span
                                                                    className={`project-sale-type project-sale-type--${sale.type}`}
                                                                >
                                                                    {sale.type ===
                                                                    'original'
                                                                        ? 'Original'
                                                                        : Number(
                                                                                sale.amount,
                                                                            ) < 0
                                                                          ? 'Discount'
                                                                        : `Referral ${
                                                                              selected.sales
                                                                                  .slice(
                                                                                      0,
                                                                                      saleIndex +
                                                                                          1,
                                                                                  )
                                                                                  .filter(
                                                                                      (
                                                                                          item,
                                                                                      ) =>
                                                                                          item.type ===
                                                                                          'referral',
                                                                                  )
                                                                                  .length
                                                                          }`}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    {currencyFormatter.format(
                                                                        Number(
                                                                            sale.amount,
                                                                        ),
                                                                    )}
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                {dateFormatter.format(
                                                                    new Date(
                                                                        sale.sale_date,
                                                                    ),
                                                                )}
                                                            </td>
                                                            <td>
                                                                <strong className="project-sale-product">
                                                                    {sale
                                                                        .product
                                                                        ?.product_name ||
                                                                        'No product'}
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                {sale.type ===
                                                                    'referral'
                                                                    ? sale
                                                                          .salesman
                                                                          ?.salesman_name ||
                                                                      'Original salesman only'
                                                                    : 'Original salesman'}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                                {selected.sales.length ===
                                                    0 && (
                                                    <tr className="project-sales-empty">
                                                        <td colSpan={5}>
                                                            No sales recorded
                                                            for this project.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="project-sale-toolbar">
                                        <a
                                            className="project-print-cover"
                                            href={`/management/projects/${selected.id}/cover-page`}
                                            download
                                        >
                                            <Printer /> Download cover page
                                        </a>
                                        <button
                                            type="button"
                                            className="project-print-cover"
                                            onClick={openCompletionModal}
                                        >
                                            <FileText /> Completion
                                        </button>
                                        <button
                                            type="button"
                                            className="project-add-sale"
                                            onClick={openReferralSale}
                                        >
                                            <Plus /> New referral
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                selectedSale &&
                                                openEditSale(selectedSale)
                                            }
                                            disabled={!selectedSale}
                                        >
                                            <Pencil /> Edit selected
                                        </button>
                                        <button
                                            type="button"
                                            className={
                                                selectedSale &&
                                                !selectedSaleHasFiles
                                                    ? 'is-missing-file'
                                                    : undefined
                                            }
                                            onClick={() => {
                                                if (!selectedSale) return;
                                                documentUploadForm.setData({
                                                    files: [],
                                                    target_type: 'sale',
                                                    target_id: String(
                                                        selectedSale.id,
                                                    ),
                                                });
                                                documentUploadForm.clearErrors();
                                                setSaleAttachmentSale(
                                                    selectedSale,
                                                );
                                            }}
                                            disabled={!selectedSale}
                                            title={
                                                selectedSale &&
                                                !selectedSaleHasFiles
                                                    ? 'No files are attached to this sale'
                                                    : 'View or upload files for the selected sale'
                                            }
                                        >
                                            <Upload /> Files
                                        </button>
                                        <button
                                            type="button"
                                            className="is-delete"
                                            onClick={() =>
                                                selectedSale &&
                                                deleteReferralSale(selectedSale)
                                            }
                                            disabled={
                                                !selectedSale ||
                                                selectedSale.type === 'original'
                                            }
                                            title={
                                                selectedSale?.type ===
                                                'original'
                                                    ? 'The original sale cannot be deleted'
                                                    : 'Delete selected referral sale'
                                            }
                                        >
                                            <Trash2 /> Delete referral
                                        </button>
                                    </div>
                                    <p className="project-sale-hint">
                                        Select a sale above to edit it. The
                                        original sale is protected from
                                        deletion.
                                    </p>
                                </article>

                                <article className="project-detail-card project-detail-card--team">
                                    <header>
                                        <span>
                                            <Users />
                                        </span>
                                        <div>
                                            <h3>Assigned team</h3>
                                            <p>Project contractors</p>
                                        </div>
                                    </header>
                                    <form
                                        className="project-contractor-assignments"
                                        onSubmit={saveContractorAssignments}
                                    >
                                        <div>
                                            {contractorAssignmentForm.data.contractor_ids.map(
                                                (contractorId, index) => (
                                                    <label key={index}>
                                                        <span>
                                                            Contractor{' '}
                                                            {index + 1}
                                                        </span>
                                                        <select
                                                            value={contractorId}
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                const next = [
                                                                    ...contractorAssignmentForm
                                                                        .data
                                                                        .contractor_ids,
                                                                ];
                                                                next[index] =
                                                                    event.target.value;
                                                                contractorAssignmentForm.setData(
                                                                    'contractor_ids',
                                                                    next,
                                                                );
                                                            }}
                                                        >
                                                            <option value="">
                                                                Unassigned
                                                            </option>
                                                            {contractors.map(
                                                                (
                                                                    contractor,
                                                                ) => {
                                                                    const selectedElsewhere =
                                                                        contractorAssignmentForm.data.contractor_ids.some(
                                                                            (
                                                                                selectedContractorId,
                                                                                selectedIndex,
                                                                            ) =>
                                                                                selectedIndex !==
                                                                                    index &&
                                                                                selectedContractorId ===
                                                                                    String(
                                                                                        contractor.con_id,
                                                                                    ),
                                                                        );

                                                                    return (
                                                                        <option
                                                                            key={
                                                                                contractor.con_id
                                                                            }
                                                                            value={
                                                                                contractor.con_id
                                                                            }
                                                                            disabled={
                                                                                selectedElsewhere
                                                                            }
                                                                        >
                                                                            {
                                                                                contractor.contractor
                                                                            }
                                                                            {selectedElsewhere
                                                                                ? ' — Already selected'
                                                                                : ''}
                                                                        </option>
                                                                    );
                                                                },
                                                            )}
                                                        </select>
                                                    </label>
                                                ),
                                            )}
                                        </div>
                                        {contractorAssignmentForm.errors
                                            .contractor_ids && (
                                            <em>
                                                {
                                                    contractorAssignmentForm
                                                        .errors.contractor_ids
                                                }
                                            </em>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={
                                                contractorAssignmentForm.processing
                                            }
                                        >
                                            <Users />{' '}
                                            {contractorAssignmentForm.processing
                                                ? 'Saving…'
                                                : 'Save assigned team'}
                                        </button>
                                    </form>
                                </article>

                                <article className="project-detail-card project-detail-card--notes">
                                    <header>
                                        <span>
                                            <ClipboardList />
                                        </span>
                                        <div>
                                            <h3>Project notes</h3>
                                            <p>
                                                Notes carried through the lead
                                                workflow
                                            </p>
                                        </div>
                                    </header>
                                    <div className="project-notes-grid">
                                        <div>
                                            <small>Telemarketer</small>
                                            <p>
                                                {noteByType(
                                                    selected,
                                                    'telemarketer',
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <small>Confirmation</small>
                                            <p>
                                                {noteByType(
                                                    selected,
                                                    'confirmation',
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <small>Dispatch</small>
                                            <p>
                                                {noteByType(
                                                    selected,
                                                    'dispatch',
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <small>Quality control</small>
                                            <p>
                                                {noteByType(
                                                    selected,
                                                    'quality_control',
                                                )}
                                            </p>
                                        </div>
                                        <div className="project-salesman-history">
                                            <small>
                                                Salesman assignment history
                                            </small>
                                            {salesmanAssignmentHistory(selected)
                                                .length > 0 ? (
                                                <ul>
                                                    {salesmanAssignmentHistory(
                                                        selected,
                                                    ).map((note) => (
                                                        <li key={note.id}>
                                                            <span>
                                                                {plainNote(
                                                                    note.body,
                                                                )}
                                                            </span>
                                                            <time>
                                                                {new Date(
                                                                    note.created_at,
                                                                ).toLocaleString()}
                                                            </time>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p>
                                                    No previous salesman
                                                    assignments recorded.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            </div>
                        </section>
                    )}
                </div>

                <Dialog
                    open={creatingProject}
                    onOpenChange={(open) =>
                        open ? setCreatingProject(true) : closeProjectCreate()
                    }
                >
                    <DialogContent className="project-create-modal">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                saveNewProject();
                            }}
                        >
                            <DialogHeader>
                                <DialogTitle>Add project</DialogTitle>
                                <DialogDescription>
                                    Create a standalone project. This will not
                                    create a lead or appear in Tele Leads.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="project-create-form">
                                <label>
                                    <span>Customer name</span>
                                    <input
                                        value={
                                            projectCreateForm.data.customer_name
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'customer_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.customer_name}
                                    </small>
                                </label>
                                <label>
                                    <span>Contact</span>
                                    <input
                                        value={
                                            projectCreateForm.data.contact_name
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'contact_name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.contact_name}
                                    </small>
                                </label>
                                <label>
                                    <span>Phone</span>
                                    <input
                                        type="tel"
                                        value={
                                            projectCreateForm.data
                                                .primary_number
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'primary_number',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {
                                            projectCreateForm.errors
                                                .primary_number
                                        }
                                    </small>
                                </label>
                                <label>
                                    <span>Mobile number</span>
                                    <input
                                        type="tel"
                                        value={
                                            projectCreateForm.data.mobile_number
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'mobile_number',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.mobile_number}
                                    </small>
                                </label>
                                <label>
                                    <span>Company</span>
                                    <select
                                        value={
                                            projectCreateForm.data.company_id
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
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
                                    <small>
                                        {projectCreateForm.errors.company_id}
                                    </small>
                                </label>
                                <label>
                                    <span>Product</span>
                                    <select
                                        value={
                                            projectCreateForm.data.product_id
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
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
                                    <small>
                                        {projectCreateForm.errors.product_id}
                                    </small>
                                </label>
                                <label>
                                    <span>Telemarketer</span>
                                    <select
                                        value={
                                            projectCreateForm.data
                                                .telemarketer_id
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'telemarketer_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select telemarketer
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
                                    <small>
                                        {
                                            projectCreateForm.errors
                                                .telemarketer_id
                                        }
                                    </small>
                                </label>
                                <label>
                                    <span>Salesman</span>
                                    <select
                                        value={
                                            projectCreateForm.data.salesman_id
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'salesman_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select salesman
                                        </option>
                                        {salesmen.map((salesman) => (
                                            <option
                                                key={salesman.salesman_id}
                                                value={salesman.salesman_id}
                                            >
                                                {salesman.salesman_name}
                                            </option>
                                        ))}
                                    </select>
                                    <small>
                                        {projectCreateForm.errors.salesman_id}
                                    </small>
                                </label>
                                <label>
                                    <span>Original sale</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={projectCreateForm.data.amount}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'amount',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.amount}
                                    </small>
                                </label>
                                <label>
                                    <span>Budget</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={projectCreateForm.data.budget}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'budget',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.budget}
                                    </small>
                                </label>
                                <label>
                                    <span>Signed date</span>
                                    <input
                                        type="date"
                                        value={
                                            projectCreateForm.data.signed_date
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'signed_date',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.signed_date}
                                    </small>
                                </label>
                                <label>
                                    <span>Status</span>
                                    <select
                                        value={projectCreateForm.data.status}
                                        onChange={(event) => {
                                            const status = event.target.value;
                                            projectCreateForm.setData(
                                                'status',
                                                status,
                                            );
                                        }}
                                    >
                                        <option value="new">New</option>
                                        <option value="progress">
                                            In Progress
                                        </option>
                                        <option value="completed">
                                            Completed
                                        </option>
                                        <option value="canceled">
                                            Canceled
                                        </option>
                                    </select>
                                    <small>
                                        {projectCreateForm.errors.status}
                                    </small>
                                </label>
                                <label>
                                    <span>Project number</span>
                                    <input
                                        placeholder={
                                            'Leave blank to assign automatically'
                                        }
                                        value={
                                            projectCreateForm.data
                                                .project_number
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'project_number',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {
                                            projectCreateForm.errors
                                                .project_number
                                        }
                                    </small>
                                </label>
                                <label className="is-wide">
                                    <span>Address</span>
                                    <input
                                        value={projectCreateForm.data.address}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'address',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.address}
                                    </small>
                                </label>
                                <label>
                                    <span>City</span>
                                    <input
                                        value={projectCreateForm.data.city}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'city',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.city}
                                    </small>
                                </label>
                                <label>
                                    <span>State</span>
                                    <input
                                        value={projectCreateForm.data.state}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'state',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.state}
                                    </small>
                                </label>
                                <label>
                                    <span>ZIP code</span>
                                    <input
                                        value={projectCreateForm.data.zip_code}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'zip_code',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.zip_code}
                                    </small>
                                </label>
                                <label>
                                    <span>Email</span>
                                    <input
                                        type="email"
                                        value={projectCreateForm.data.email}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'email',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.email}
                                    </small>
                                </label>
                                <label>
                                    <span>Manager</span>
                                    <select
                                        value={
                                            projectCreateForm.data.manager_id
                                        }
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'manager_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Select manager</option>
                                        {managers.map((manager) => (
                                            <option
                                                key={manager.manager_id}
                                                value={manager.manager_id}
                                            >
                                                {manager.manager_name}
                                            </option>
                                        ))}
                                    </select>
                                    <small>
                                        {projectCreateForm.errors.manager_id}
                                    </small>
                                </label>
                                <label className="is-full">
                                    <span>Notes</span>
                                    <textarea
                                        value={projectCreateForm.data.notes}
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'notes',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {projectCreateForm.errors.notes}
                                    </small>
                                </label>
                            </div>

                            <DialogFooter>
                                <button
                                    type="button"
                                    className="project-modal-cancel"
                                    onClick={closeProjectCreate}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="project-modal-save"
                                    disabled={projectCreateForm.processing}
                                >
                                    {projectCreateForm.processing
                                        ? 'Adding…'
                                        : 'Add project'}
                                </button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={creatingCustomerProject}
                    onOpenChange={(open) => {
                        if (!open && !customerProjectForm.processing) {
                            setCreatingCustomerProject(false);
                            customerProjectForm.clearErrors();
                        }
                    }}
                >
                    <DialogContent className="project-create-modal">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                saveCustomerProject();
                            }}
                        >
                            <DialogHeader>
                                <DialogTitle>
                                    New project for{' '}
                                    {selected?.lead.customer_name}
                                </DialogTitle>
                                <DialogDescription>
                                    Customer contact information is reused. The
                                    appointment, product, salesmen, sale, and
                                    accounting remain separate for this project.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="project-create-form">
                                <div className="project-create-auto-number">
                                    <strong>Project number</strong>
                                    <span>
                                        Assigned automatically from{' '}
                                        {selected ? projectNumber(selected).replace(/\.\d+$/, '') : 'the original project'}
                                        : .1, .2, .3, and onward.
                                    </span>
                                </div>
                                <label>
                                    <span>Company</span>
                                    <select
                                        value={
                                            customerProjectForm.data.company_id
                                        }
                                        onChange={(event) =>
                                            customerProjectForm.setData(
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
                                    <small>
                                        {customerProjectForm.errors.company_id}
                                    </small>
                                </label>
                                <label>
                                    <span>Appointment</span>
                                    <input
                                        type="datetime-local"
                                        value={
                                            customerProjectForm.data
                                                .appointment_at
                                        }
                                        onChange={(event) =>
                                            customerProjectForm.setData(
                                                'appointment_at',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {
                                            customerProjectForm.errors
                                                .appointment_at
                                        }
                                    </small>
                                </label>
                                <label>
                                    <span>Product</span>
                                    <select
                                        value={
                                            customerProjectForm.data.product_id
                                        }
                                        onChange={(event) =>
                                            customerProjectForm.setData(
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
                                    <small>
                                        {customerProjectForm.errors.product_id}
                                    </small>
                                </label>
                                <label>
                                    <span>Salesman 1</span>
                                    <select
                                        value={
                                            customerProjectForm.data
                                                .salesman_1_id
                                        }
                                        onChange={(event) =>
                                            customerProjectForm.setData(
                                                'salesman_1_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Unassigned</option>
                                        {salesmen.map((salesman) => (
                                            <option
                                                key={salesman.salesman_id}
                                                value={salesman.salesman_id}
                                            >
                                                {salesman.salesman_name}
                                            </option>
                                        ))}
                                    </select>
                                    <small>
                                        {
                                            customerProjectForm.errors
                                                .salesman_1_id
                                        }
                                    </small>
                                </label>
                                <label>
                                    <span>Salesman 2</span>
                                    <select
                                        value={
                                            customerProjectForm.data
                                                .salesman_2_id
                                        }
                                        onChange={(event) =>
                                            customerProjectForm.setData(
                                                'salesman_2_id',
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Unassigned</option>
                                        {salesmen.map((salesman) => (
                                            <option
                                                key={salesman.salesman_id}
                                                value={salesman.salesman_id}
                                                disabled={
                                                    String(
                                                        salesman.salesman_id,
                                                    ) ===
                                                    customerProjectForm.data
                                                        .salesman_1_id
                                                }
                                            >
                                                {salesman.salesman_name}
                                            </option>
                                        ))}
                                    </select>
                                    <small>
                                        {
                                            customerProjectForm.errors
                                                .salesman_2_id
                                        }
                                    </small>
                                </label>
                                <label>
                                    <span>Original sale</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={customerProjectForm.data.amount}
                                        onChange={(event) =>
                                            customerProjectForm.setData(
                                                'amount',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {customerProjectForm.errors.amount}
                                    </small>
                                </label>
                                <label className="is-full">
                                    <span>Project notes</span>
                                    <textarea
                                        value={customerProjectForm.data.notes}
                                        onChange={(event) =>
                                            customerProjectForm.setData(
                                                'notes',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <small>
                                        {customerProjectForm.errors.notes}
                                    </small>
                                </label>
                            </div>

                            <DialogFooter>
                                <button
                                    type="button"
                                    className="project-modal-cancel"
                                    onClick={() =>
                                        setCreatingCustomerProject(false)
                                    }
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="project-modal-save"
                                    disabled={customerProjectForm.processing}
                                >
                                    {customerProjectForm.processing
                                        ? 'Creating…'
                                        : 'Create customer project'}
                                </button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={saleModal !== null}
                    onOpenChange={(open) => {
                        if (!open && !saleForm.processing) {
                            setSaleModal(null);
                        }
                    }}
                >
                    {saleModal && (
                        <DialogContent className="project-sale-modal">
                            <form onSubmit={submitSale}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {saleModal.mode === 'create'
                                            ? 'Add referral sale'
                                            : `Edit ${saleModal.sale?.type} sale`}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Enter the sale amount, effective date,
                                        product, and optional referral salesman
                                        for this project.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="project-sale-form">
                                    {accountingForm.data.type !== 'payable' && (
                                        <label>
                                            <span>Sale amount</span>
                                            <div className="project-sale-amount-input">
                                                <strong>$</strong>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    value={saleForm.data.amount}
                                                    onChange={(event) =>
                                                        saleForm.setData(
                                                            'amount',
                                                            event.target.value,
                                                        )
                                                    }
                                                    autoFocus
                                                />
                                            </div>
                                            {saleForm.errors.amount && (
                                                <small>
                                                    {saleForm.errors.amount}
                                                </small>
                                            )}
                                            {saleModal.sale?.type !==
                                                'original' && (
                                                <small>
                                                    Enter a negative amount to
                                                    record a discount.
                                                </small>
                                            )}
                                        </label>
                                    )}
                                    {accountingForm.data.type !== 'payable' && (
                                        <label>
                                            <span>Sale date</span>
                                            <input
                                                type="date"
                                                value={saleForm.data.sale_date}
                                                onChange={(event) =>
                                                    saleForm.setData(
                                                        'sale_date',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {saleForm.errors.sale_date && (
                                                <small>
                                                    {saleForm.errors.sale_date}
                                                </small>
                                            )}
                                        </label>
                                    )}
                                    <label>
                                        <span>Product</span>
                                        <select
                                            value={saleForm.data.product_id}
                                            onChange={(event) =>
                                                saleForm.setData(
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
                                        {saleForm.errors.product_id && (
                                            <small>
                                                {saleForm.errors.product_id}
                                            </small>
                                        )}
                                    </label>
                                    {(saleModal.mode === 'create' ||
                                        saleModal.sale?.type === 'referral') && (
                                        <label>
                                            <span>Referral salesman</span>
                                            <select
                                                value={saleForm.data.salesman_id}
                                                onChange={(event) =>
                                                    saleForm.setData(
                                                        'salesman_id',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    No second salesman
                                                </option>
                                                {salesmen
                                                    .filter(
                                                        (salesman) =>
                                                            salesman.salesman_id !==
                                                            (selected?.lead
                                                                .salesman_one
                                                                ?.salesman_id ??
                                                                null),
                                                    )
                                                    .map((salesman) => (
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
                                                    ))}
                                            </select>
                                            {saleForm.errors.salesman_id && (
                                                <small>
                                                    {
                                                        saleForm.errors
                                                            .salesman_id
                                                    }
                                                </small>
                                            )}
                                        </label>
                                    )}
                                    {saleModal.mode === 'create' && (
                                        <label>
                                            <span>Project destination</span>
                                            <select
                                                value={saleForm.data.destination}
                                                onChange={(event) => {
                                                    const destination =
                                                        event.target.value;
                                                    saleForm.setData((data) => ({
                                                        ...data,
                                                        destination,
                                                        project_number:
                                                            destination ===
                                                            'new_project'
                                                                ? data.project_number
                                                                : '',
                                                    }));
                                                }}
                                            >
                                                <option value="current">
                                                    Current project —{' '}
                                                    {selected?.project_number ??
                                                        `Project ${selected?.id}`}
                                                </option>
                                                <option value="new_project">
                                                    Create a separate project
                                                    number
                                                </option>
                                            </select>
                                            <small>
                                                A separate project keeps its
                                                commissions, invoices,
                                                receivables, and payables
                                                independent.
                                            </small>
                                            {saleForm.errors.destination && (
                                                <small>
                                                    {
                                                        saleForm.errors
                                                            .destination
                                                    }
                                                </small>
                                            )}
                                        </label>
                                    )}
                                    {saleModal.mode === 'create' &&
                                        saleForm.data.destination ===
                                            'new_project' && (
                                            <div className="project-sale-auto-number">
                                                <strong>New project number</strong>
                                                <span>
                                                    Assigned automatically as the next number after{' '}
                                                    {selected?.project_number?.replace(/\.\d+$/, '') ?? 'this project'}
                                                    —for example .1, then .2.
                                                </span>
                                            </div>
                                        )}
                                    <label className="project-sale-files">
                                        <span>Contracts, files, or photos</span>
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                            onChange={(event) =>
                                                saleForm.setData(
                                                    'files',
                                                    Array.from(
                                                        event.target.files ??
                                                            [],
                                                    ),
                                                )
                                            }
                                        />
                                        <small>
                                            {saleForm.data.files.length
                                                ? `${saleForm.data.files.length} files selected`
                                                : 'You can select up to 20 files at once.'}
                                        </small>
                                        {saleForm.errors.files && (
                                            <small>
                                                {saleForm.errors.files}
                                            </small>
                                        )}
                                    </label>
                                </div>
                                <DialogFooter className="project-sale-modal__footer">
                                    <button
                                        type="button"
                                        onClick={() => setSaleModal(null)}
                                        disabled={saleForm.processing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saleForm.processing}
                                    >
                                        {saleForm.processing
                                            ? 'Saving…'
                                            : saleModal.mode === 'create'
                                              ? 'Add referral'
                                              : 'Save changes'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog
                    open={scheduledPaymentModal !== null}
                    onOpenChange={(open) => {
                        if (!open && !scheduledPaymentForm.processing) {
                            setScheduledPaymentModal(null);
                        }
                    }}
                >
                    {scheduledPaymentModal && selected && (
                        <DialogContent className="project-schedule-modal">
                            <form onSubmit={submitScheduledPayment}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {scheduledPaymentModal.mode === 'create'
                                            ? 'Add scheduled payment'
                                            : 'Edit scheduled payment'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Create a payment milestone without
                                        exceeding the project contract.{' '}
                                        {currencyFormatter.format(
                                            scheduleBalance(selected) +
                                                Number(
                                                    scheduledPaymentModal
                                                        .scheduledPayment
                                                        ?.amount ?? 0,
                                                ),
                                        )}{' '}
                                        is available for this entry.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="project-schedule-form">
                                    <label>
                                        <span>Expected date</span>
                                        <input
                                            type="date"
                                            value={
                                                scheduledPaymentForm.data
                                                    .expected_date
                                            }
                                            onChange={(event) =>
                                                scheduledPaymentForm.setData(
                                                    'expected_date',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        {scheduledPaymentForm.errors
                                            .expected_date && (
                                            <small>
                                                {
                                                    scheduledPaymentForm.errors
                                                        .expected_date
                                                }
                                            </small>
                                        )}
                                    </label>
                                    <label>
                                        <span>Should be paid upon</span>
                                        <input
                                            type="text"
                                            list="payment-stage-options"
                                            placeholder="Select or enter a milestone"
                                            value={
                                                scheduledPaymentForm.data
                                                    .payment_stage
                                            }
                                            onChange={(event) =>
                                                scheduledPaymentForm.setData(
                                                    'payment_stage',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <datalist id="payment-stage-options">
                                            <option value="Down Payment" />
                                            <option value="Upon Finance" />
                                            <option value="Upon Material Delivery" />
                                            <option value="Upon Installation" />
                                            <option value="Upon Completion" />
                                        </datalist>
                                        {scheduledPaymentForm.errors
                                            .payment_stage && (
                                            <small>
                                                {
                                                    scheduledPaymentForm.errors
                                                        .payment_stage
                                                }
                                            </small>
                                        )}
                                    </label>
                                    <label>
                                        <span>Amount</span>
                                        <div className="project-sale-amount-input">
                                            <strong>$</strong>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                value={
                                                    scheduledPaymentForm.data
                                                        .amount
                                                }
                                                onChange={(event) =>
                                                    scheduledPaymentForm.setData(
                                                        'amount',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        {scheduledPaymentForm.errors.amount && (
                                            <small>
                                                {
                                                    scheduledPaymentForm.errors
                                                        .amount
                                                }
                                            </small>
                                        )}
                                    </label>
                                    <fieldset className="project-schedule-options">
                                        <legend>Processing status</legend>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={
                                                    scheduledPaymentForm.data.qb
                                                }
                                                onChange={(event) =>
                                                    scheduledPaymentForm.setData(
                                                        'qb',
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                            Added to QuickBooks
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={
                                                    scheduledPaymentForm.data
                                                        .printed_sent
                                                }
                                                onChange={(event) =>
                                                    scheduledPaymentForm.setData(
                                                        'printed_sent',
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                            Printed / Sent
                                        </label>
                                    </fieldset>
                                    <label className="is-wide">
                                        <span>Notes</span>
                                        <textarea
                                            placeholder="Add schedule payment notes…"
                                            value={
                                                scheduledPaymentForm.data.notes
                                            }
                                            onChange={(event) =>
                                                scheduledPaymentForm.setData(
                                                    'notes',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        {scheduledPaymentForm.errors.notes && (
                                            <small>
                                                {
                                                    scheduledPaymentForm.errors
                                                        .notes
                                                }
                                            </small>
                                        )}
                                    </label>
                                </div>
                                <DialogFooter className="project-sale-modal__footer">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setScheduledPaymentModal(null)
                                        }
                                        disabled={
                                            scheduledPaymentForm.processing
                                        }
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            scheduledPaymentForm.processing
                                        }
                                    >
                                        {scheduledPaymentForm.processing
                                            ? 'Saving…'
                                            : scheduledPaymentModal.mode ===
                                                'create'
                                              ? 'Add payment'
                                              : 'Save changes'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog
                    open={accountingModal !== null}
                    onOpenChange={(open) => {
                        if (!open && !accountingForm.processing) {
                            setAccountingModal(null);
                        }
                    }}
                >
                    {accountingModal && selected && (
                        <DialogContent
                            className={`project-accounting-modal${accountingMode === 'commission' ? ' is-commission' : ''}`}
                        >
                            <form onSubmit={submitAccountingTransaction}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {accountingModal.mode === 'create'
                                            ? `New ${accountingMode === 'commission' ? 'Commission' : accountingForm.data.type}`
                                            : `Edit ${accountingMode === 'commission' ? 'Commission' : accountingForm.data.type}`}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {accountingMode === 'commission'
                                            ? 'Record a commission payment for a salesman assigned to this project.'
                                            : `Record a ${accountingForm.data.unassigned ? 'standalone' : 'project'} ${accountingForm.data.type}. Linking a ${accountingForm.data.type === 'receivable' ? 'scheduled payment' : 'vendor payment'} is optional.`}
                                    </DialogDescription>
                                </DialogHeader>

                                {accountingModal.mode === 'create' &&
                                    accountingMode !== 'commission' && (
                                    <label className="project-accounting-unassigned">
                                        <input
                                            type="checkbox"
                                            checked={
                                                accountingForm.data.unassigned
                                            }
                                            onChange={(event) =>
                                                accountingForm.setData(
                                                    (data) => ({
                                                        ...data,
                                                        unassigned:
                                                            event.target
                                                                .checked,
                                                        project_invoice_id: '',
                                                        scheduled_payment_ids:
                                                            [],
                                                        counterparty:
                                                            event.target
                                                                .checked &&
                                                            data.type ===
                                                                'receivable'
                                                                ? ''
                                                                : data.counterparty,
                                                    }),
                                                )
                                            }
                                        />
                                        <span>
                                            <strong>
                                                Unassigned / not related to a
                                                project
                                            </strong>
                                            <small>
                                                Save this record in the global
                                                receivables or payables register
                                                without connecting it to the
                                                selected project.
                                            </small>
                                        </span>
                                    </label>
                                )}

                                <div className="project-accounting-form-top">
                                    {!accountingForm.data.unassigned &&
                                        accountingMode !== 'commission' && (
                                            <label>
                                                <span>Related sale</span>
                                                <select
                                                    value={accountingForm.data.project_sale_id}
                                                    onChange={(event) =>
                                                        accountingForm.setData('project_sale_id', event.target.value)
                                                    }
                                                >
                                                    <option value="">Project-wide / auto allocate</option>
                                                    {selected.sales.map((sale, index) => (
                                                        <option key={sale.id} value={sale.id}>
                                                            {sale.type === 'original' ? 'Original sale' : `Referral sale ${index}`}
                                                            {' — '}{currencyFormatter.format(Number(sale.amount))}
                                                        </option>
                                                    ))}
                                                </select>
                                                {accountingForm.errors.project_sale_id && (
                                                    <small>{accountingForm.errors.project_sale_id}</small>
                                                )}
                                            </label>
                                        )}
                                    {accountingForm.data.type === 'payable' && (
                                        <label>
                                            <span>Company</span>
                                            <select
                                                value={
                                                    accountingForm.data
                                                        .company_id
                                                }
                                                onChange={(event) =>
                                                    accountingForm.setData(
                                                        'company_id',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    No company selected
                                                </option>
                                                {companies.map((company) => (
                                                    <option
                                                        key={company.com_id}
                                                        value={company.com_id}
                                                    >
                                                        {company.company} (
                                                        {company.prefix})
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    {accountingForm.data.type === 'payable' && (
                                        <label>
                                            <span>
                                                {accountingMode === 'commission'
                                                    ? 'Salesman'
                                                    : 'Salesman (optional)'}
                                            </span>
                                            <SearchableSelect
                                                value={
                                                    accountingForm.data
                                                        .salesman_id
                                                }
                                                onChange={(value) =>
                                                    accountingForm.setData(
                                                        (data) => ({
                                                            ...data,
                                                            salesman_id: value,
                                                            counterparty:
                                                                accountingMode ===
                                                                'commission'
                                                                    ? (assignedProjectSalesmen.find(
                                                                          (
                                                                              salesman,
                                                                          ) =>
                                                                              String(
                                                                                  salesman.salesman_id,
                                                                              ) ===
                                                                              value,
                                                                      )
                                                                          ?.salesman_name ??
                                                                      '')
                                                                    : data.counterparty,
                                                            amount:
                                                                accountingMode ===
                                                                'commission'
                                                                    ? String(
                                                                          commissionBreakdown?.salesmen.find(
                                                                              (
                                                                                  row,
                                                                              ) =>
                                                                                  String(
                                                                                      row.salesman_id,
                                                                                  ) ===
                                                                                  value,
                                                                          )
                                                                              ?.commission_balance ??
                                                                              '',
                                                                      )
                                                                    : data.amount,
                                                        }),
                                                    )
                                                }
                                                searchPlaceholder="Search salesmen…"
                                                options={[
                                                    {
                                                        value: '',
                                                        label:
                                                            accountingMode ===
                                                            'commission'
                                                                ? 'Select assigned salesman'
                                                                : 'No salesman',
                                                    },
                                                    ...(accountingMode ===
                                                    'commission'
                                                        ? assignedProjectSalesmen
                                                        : salesmen
                                                    ).map(
                                                        (salesman) => ({
                                                            value: String(
                                                                salesman.salesman_id,
                                                            ),
                                                            label: salesman.salesman_name,
                                                        }),
                                                    ),
                                                ]}
                                            />
                                            {accountingMode === 'commission' &&
                                                assignedProjectSalesmen.length ===
                                                    0 && (
                                                    <small>
                                                        Assign a salesman to this
                                                        project before adding a
                                                        commission.
                                                    </small>
                                                )}
                                            {accountingForm.errors
                                                .salesman_id && (
                                                <small>
                                                    {
                                                        accountingForm.errors
                                                            .salesman_id
                                                    }
                                                </small>
                                            )}
                                        </label>
                                    )}
                                    <label>
                                        <span>Category</span>
                                        <select
                                            value={accountingForm.data.category}
                                            onChange={(event) =>
                                                accountingForm.setData(
                                                    'category',
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            {accountingMode === 'commission' ? (
                                                <option value="Commission (default)">
                                                    Commission (Default)
                                                </option>
                                            ) : accountingForm.data.type ===
                                              'receivable' ? (
                                                <>
                                                    <option value="Customer Payment">
                                                        Customer Payment
                                                    </option>
                                                    <option value="Scheduled Payment">
                                                        Scheduled Payment
                                                    </option>
                                                    <option value="Deposit">
                                                        Deposit
                                                    </option>
                                                    <option value="Other Receivable">
                                                        Other Receivable
                                                    </option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Vendor Payment">
                                                        Vendor Payment
                                                    </option>
                                                    <option value="Invoice Payment">
                                                        Invoice Payment
                                                    </option>
                                                    <option value="Expense">
                                                        Expense
                                                    </option>
                                                    <option value="Other Payable">
                                                        Other Payable
                                                    </option>
                                                </>
                                            )}
                                        </select>
                                    </label>
                                    {accountingForm.data.type === 'payable' &&
                                        accountingForm.data.category ===
                                            'Vendor Payment' && (
                                            <label>
                                                <span>
                                                    Invoice / order number
                                                </span>
                                                <input
                                                    type="text"
                                                    maxLength={100}
                                                    placeholder="Enter invoice or order number"
                                                    value={
                                                        accountingForm.data
                                                            .invoice_order_number
                                                    }
                                                    onChange={(event) =>
                                                        accountingForm.setData(
                                                            'invoice_order_number',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </label>
                                        )}
                                    <label>
                                        <span>Date</span>
                                        <input
                                            type="date"
                                            value={
                                                accountingForm.data
                                                    .transaction_date
                                            }
                                            onChange={(event) =>
                                                accountingForm.setData(
                                                    'transaction_date',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>Payment method</span>
                                        <select
                                            value={
                                                accountingForm.data
                                                    .payment_method
                                            }
                                            onChange={(event) => {
                                                const method = event.target
                                                    .value as AccountingTransaction['payment_method'];
                                                accountingForm.setData(
                                                    (data) => ({
                                                        ...data,
                                                        payment_method: method,
                                                        reference_number:
                                                            paymentReference(
                                                                method,
                                                            ),
                                                    }),
                                                );
                                            }}
                                        >
                                            {Object.entries(
                                                paymentMethodLabels,
                                            ).map(([value, label]) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Reference # (optional)</span>
                                        <div className="project-accounting-reference">
                                            <strong>
                                                {
                                                    paymentPrefixes[
                                                        accountingForm.data
                                                            .payment_method
                                                    ]
                                                }
                                            </strong>
                                            <input
                                                type="text"
                                                placeholder="Reference number"
                                                value={accountingForm.data.reference_number.slice(
                                                    paymentPrefixes[
                                                        accountingForm.data
                                                            .payment_method
                                                    ].length,
                                                )}
                                                onChange={(event) =>
                                                    accountingForm.setData(
                                                        (data) => ({
                                                            ...data,
                                                            reference_number:
                                                                paymentReference(
                                                                    data.payment_method,
                                                                    event.target
                                                                        .value,
                                                                ),
                                                            status:
                                                                data.type ===
                                                                    'payable' &&
                                                                event.target.value.trim() !==
                                                                    ''
                                                                    ? 'paid'
                                                                    : data.status,
                                                        }),
                                                    )
                                                }
                                            />
                                        </div>
                                        {accountingForm.errors
                                            .reference_number && (
                                            <small>
                                                {
                                                    accountingForm.errors
                                                        .reference_number
                                                }
                                            </small>
                                        )}
                                        {accountingForm.data.payment_method ===
                                            'cash' &&
                                            canGeneratePaymentCodes && (
                                                <button
                                                    className="project-generate-payment-code"
                                                    type="button"
                                                    onClick={() =>
                                                        accountingForm.setData(
                                                            (data) => ({
                                                                ...data,
                                                                reference_number:
                                                                    cashReferenceCode(),
                                                                status:
                                                                    data.type ===
                                                                    'payable'
                                                                        ? 'paid'
                                                                        : data.status,
                                                            }),
                                                        )
                                                    }
                                                >
                                                    Generate code
                                                </button>
                                            )}
                                    </label>
                                    <label>
                                        <span>Amount</span>
                                        <div className="project-accounting-amount">
                                            <strong>$</strong>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                value={
                                                    accountingForm.data.amount
                                                }
                                                onChange={(event) =>
                                                    accountingForm.setData(
                                                        'amount',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        {accountingForm.errors.amount && (
                                            <small>
                                                {accountingForm.errors.amount}
                                            </small>
                                        )}
                                    </label>
                                    <label>
                                        <span>Status</span>
                                        <select
                                            value={accountingForm.data.status}
                                            onChange={(event) => {
                                                const status = event.target
                                                    .value as AccountingTransaction['status'];
                                                accountingForm.setData(
                                                    'status',
                                                    status,
                                                );
                                                if (
                                                    (accountingForm.data
                                                        .type === 'payable' &&
                                                        status === 'paid') ||
                                                    (accountingForm.data
                                                        .type ===
                                                        'receivable' &&
                                                        status === 'deposit')
                                                ) {
                                                    setPayablePaymentModalOpen(
                                                        true,
                                                    );
                                                }
                                            }}
                                        >
                                            {Object.entries(
                                                accountingForm.data.type ===
                                                    'receivable'
                                                    ? {
                                                          pending: 'Pending',
                                                          deposit: 'Deposit',
                                                      }
                                                    : invoiceStatusLabels,
                                            ).map(([value, label]) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                        {accountingForm.errors.status && (
                                            <small>
                                                {accountingForm.errors.status}
                                            </small>
                                        )}
                                    </label>
                                </div>

                                <div
                                    className={`project-accounting-form-body${accountingForm.data.unassigned ? 'is-unassigned' : ''}`}
                                >
                                    {!accountingForm.data.unassigned &&
                                        accountingMode !== 'commission' &&
                                        (accountingForm.data.type ===
                                        'receivable' ? (
                                            <section>
                                                <header>
                                                    <div>
                                                        <h3>
                                                            Scheduled payments
                                                        </h3>
                                                        <p>
                                                            Optional—select any
                                                            schedules included
                                                            in this receivable.
                                                        </p>
                                                    </div>
                                                    <span>
                                                        {
                                                            accountingForm.data
                                                                .scheduled_payment_ids
                                                                .length
                                                        }{' '}
                                                        selected
                                                    </span>
                                                </header>
                                                <div className="project-accounting-link-list">
                                                    {selected.scheduled_payments.map(
                                                        (payment) => {
                                                            const isChecked =
                                                                accountingForm.data.scheduled_payment_ids.includes(
                                                                    payment.id,
                                                                );

                                                            return (
                                                                <label
                                                                    key={
                                                                        payment.id
                                                                    }
                                                                    className={
                                                                        isChecked
                                                                            ? 'is-selected'
                                                                            : ''
                                                                    }
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            isChecked
                                                                        }
                                                                        onChange={() =>
                                                                            accountingForm.setData(
                                                                                'scheduled_payment_ids',
                                                                                isChecked
                                                                                    ? accountingForm.data.scheduled_payment_ids.filter(
                                                                                          (
                                                                                              id,
                                                                                          ) =>
                                                                                              id !==
                                                                                              payment.id,
                                                                                      )
                                                                                    : [
                                                                                          ...accountingForm
                                                                                              .data
                                                                                              .scheduled_payment_ids,
                                                                                          payment.id,
                                                                                      ],
                                                                            )
                                                                        }
                                                                    />
                                                                    <span>
                                                                        <strong>
                                                                            {
                                                                                payment.payment_stage
                                                                            }
                                                                        </strong>
                                                                        <small>
                                                                            {dateFormatter.format(
                                                                                new Date(
                                                                                    payment.expected_date,
                                                                                ),
                                                                            )}
                                                                        </small>
                                                                    </span>
                                                                    <b>
                                                                        {currencyFormatter.format(
                                                                            Number(
                                                                                payment.amount,
                                                                            ),
                                                                        )}
                                                                    </b>
                                                                </label>
                                                            );
                                                        },
                                                    )}
                                                    {selected.scheduled_payments
                                                        .length === 0 && (
                                                        <div className="project-accounting-link-empty">
                                                            No scheduled
                                                            payments exist. You
                                                            can still save this
                                                            receivable.
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        ) : (
                                            <section>
                                                <header>
                                                    <div>
                                                        <h3>Vendor payment</h3>
                                                        <p>
                                                            Optionally connect
                                                            this payable to an
                                                            invoice.
                                                        </p>
                                                    </div>
                                                </header>
                                                <div className="project-accounting-payable-fields">
                                                    <label>
                                                        <span>
                                                            Company (CMP)
                                                        </span>
                                                        <SearchableSelect
                                                            value={
                                                                accountingForm
                                                                    .data
                                                                    .company_id
                                                            }
                                                            onChange={(value) =>
                                                                accountingForm.setData(
                                                                    'company_id',
                                                                    value,
                                                                )
                                                            }
                                                            searchPlaceholder="Search companies…"
                                                            options={[
                                                                {
                                                                    value: '',
                                                                    label: 'No company selected',
                                                                },
                                                                ...companies.map(
                                                                    (
                                                                        company,
                                                                    ) => ({
                                                                        value: String(
                                                                            company.com_id,
                                                                        ),
                                                                        label: `${company.company} (${company.prefix})`,
                                                                    }),
                                                                ),
                                                            ]}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span>Project #</span>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={projectNumber(
                                                                selected,
                                                            )}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span>Connect to invoice</span>
                                                        <SearchableSelect
                                                            value={accountingForm.data.project_invoice_id}
                                                            onChange={(value) => {
                                                                const invoice = selected.invoices.find((item) => String(item.id) === value);
                                                                accountingForm.setData((data) => ({
                                                                    ...data,
                                                                    project_invoice_id: value,
                                                                    contractor_id: invoice?.contractor?.con_id ? String(invoice.contractor.con_id) : '',
                                                                    vendor_id: invoice?.vendor?.vendor_id ? String(invoice.vendor.vendor_id) : '',
                                                                    counterparty: invoice?.contractor?.contractor ?? invoice?.vendor?.vendor ?? '',
                                                                    amount: invoice ? projectInvoiceBalance(selected, invoice).toFixed(2) : data.amount,
                                                                }));
                                                            }}
                                                            searchPlaceholder="Search project invoices…"
                                                            options={[
                                                                { value: '', label: 'Not connected to an invoice' },
                                                                ...payableInvoices.map((invoice) => ({
                                                                    value: String(invoice.id),
                                                                    label: `${invoice.invoice_number} — Balance ${currencyFormatter.format(projectInvoiceBalance(selected, invoice))}`,
                                                                })),
                                                            ]}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span>Pay to</span>
                                                        <SearchableSelect
                                                            value={
                                                                accountingForm
                                                                    .data
                                                                    .contractor_id
                                                                    ? `contractor:${accountingForm.data.contractor_id}`
                                                                    : accountingForm
                                                                            .data
                                                                            .vendor_id
                                                                      ? `vendor:${accountingForm.data.vendor_id}`
                                                                      : ''
                                                            }
                                                            options={
                                                                payableRecipientOptions
                                                            }
                                                            placeholder="Select contractor or vendor"
                                                            searchPlaceholder="Search contractors or vendors…"
                                                            onChange={(
                                                                value,
                                                            ) => {
                                                                const contractorId =
                                                                    value.startsWith(
                                                                        'contractor:',
                                                                    )
                                                                        ? value.slice(
                                                                              11,
                                                                          )
                                                                        : '';
                                                                const vendorId =
                                                                    value.startsWith(
                                                                        'vendor:',
                                                                    )
                                                                        ? value.slice(
                                                                              7,
                                                                          )
                                                                        : '';
                                                                const counterparty =
                                                                    contractorId
                                                                        ? contractors.find(
                                                                              (
                                                                                  item,
                                                                              ) =>
                                                                                  item.con_id ===
                                                                                  Number(
                                                                                      contractorId,
                                                                                  ),
                                                                          )
                                                                              ?.contractor
                                                                        : vendors.find(
                                                                              (
                                                                                  item,
                                                                              ) =>
                                                                                  item.vendor_id ===
                                                                                  Number(
                                                                                      vendorId,
                                                                                  ),
                                                                          )
                                                                              ?.vendor;
                                                                accountingForm.setData(
                                                                    (data) => ({
                                                                        ...data,
                                                                        contractor_id:
                                                                            contractorId,
                                                                        vendor_id:
                                                                            vendorId,
                                                                        counterparty:
                                                                            counterparty ??
                                                                            '',
                                                                        project_invoice_id:
                                                                            '',
                                                                    }),
                                                                );
                                                            }}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span>
                                                            Requested by
                                                        </span>
                                                        <select
                                                            value={
                                                                accountingForm
                                                                    .data
                                                                    .requested_by
                                                            }
                                                            onChange={(event) =>
                                                                accountingForm.setData(
                                                                    'requested_by',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Select requester
                                                            </option>
                                                            {requesterOptions.map(
                                                                (requester) => (
                                                                    <option
                                                                        key={
                                                                            requester
                                                                        }
                                                                        value={
                                                                            requester
                                                                        }
                                                                    >
                                                                        {
                                                                            requester
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    </label>
                                                </div>
                                                <div className="project-accounting-invoice-picker">
                                                    <strong>
                                                        Invoice details
                                                    </strong>
                                                    {payableInvoices.length ===
                                                      0 ? (
                                                        <div className="project-accounting-invoice-picker__empty">
                                                            This contractor or
                                                            vendor has no
                                                            invoices in the
                                                            selected project.
                                                        </div>
                                                    ) : (
                                                        <table>
                                                            <thead>
                                                                <tr>
                                                                    <th>
                                                                        Invoice
                                                                        #
                                                                    </th>
                                                                    <th>
                                                                        Date
                                                                    </th>
                                                                    <th>
                                                                        Amount
                                                                    </th>
                                                                    <th>
                                                                        Balance
                                                                    </th>
                                                                    <th>
                                                                        Status
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {payableInvoices.map(
                                                                    (
                                                                        invoice,
                                                                    ) => {
                                                                        const balance =
                                                                            projectInvoiceBalance(
                                                                                selected,
                                                                                invoice,
                                                                            );
                                                                        const isSelected =
                                                                            accountingForm
                                                                                .data
                                                                                .project_invoice_id ===
                                                                            String(
                                                                                invoice.id,
                                                                            );

                                                                        return (
                                                                            <tr
                                                                                key={
                                                                                    invoice.id
                                                                                }
                                                                                className={
                                                                                    isSelected
                                                                                        ? 'is-selected'
                                                                                        : ''
                                                                                }
                                                                                onClick={() =>
                                                                                    accountingForm.setData(
                                                                                        (
                                                                                            data,
                                                                                        ) => ({
                                                                                            ...data,
                                                                                            project_invoice_id:
                                                                                                String(
                                                                                                    invoice.id,
                                                                                                ),
                                                                                            contractor_id:
                                                                                                invoice.contractor?.con_id
                                                                                                    ? String(invoice.contractor.con_id)
                                                                                                    : '',
                                                                                            vendor_id:
                                                                                                invoice.vendor?.vendor_id
                                                                                                    ? String(invoice.vendor.vendor_id)
                                                                                                    : '',
                                                                                            counterparty:
                                                                                                invoice.contractor?.contractor ??
                                                                                                invoice.vendor?.vendor ??
                                                                                                '',
                                                                                            amount: balance.toFixed(
                                                                                                2,
                                                                                            ),
                                                                                        }),
                                                                                    )
                                                                                }
                                                                            >
                                                                                <td>
                                                                                    <input
                                                                                        type="radio"
                                                                                        readOnly
                                                                                        checked={
                                                                                            isSelected
                                                                                        }
                                                                                        aria-label={`Select ${invoice.invoice_number}`}
                                                                                    />{' '}
                                                                                    {
                                                                                        invoice.invoice_number
                                                                                    }
                                                                                </td>
                                                                                <td>
                                                                                    {dateFormatter.format(
                                                                                        new Date(
                                                                                            invoice.invoice_date,
                                                                                        ),
                                                                                    )}
                                                                                </td>
                                                                                <td>
                                                                                    {currencyFormatter.format(
                                                                                        Number(
                                                                                            invoice.amount,
                                                                                        ),
                                                                                    )}
                                                                                </td>
                                                                                <td>
                                                                                    {currencyFormatter.format(
                                                                                        balance,
                                                                                    )}
                                                                                </td>
                                                                                <td>
                                                                                    {
                                                                                        invoiceStatusLabels[
                                                                                            invoice
                                                                                                .status
                                                                                        ]
                                                                                    }
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    },
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </section>
                                        ))}

                                    <section>
                                        <header>
                                            <div>
                                                <h3>Transaction details</h3>
                                                <p>
                                                    Add an optional note for
                                                    this accounting record.
                                                </p>
                                            </div>
                                        </header>
                                        <label className="project-accounting-notes-field">
                                            <span>
                                                {accountingForm.data.type ===
                                                'receivable'
                                                    ? 'Received from'
                                                    : accountingMode ===
                                                        'commission'
                                                      ? 'Commission paid to'
                                                      : 'Paid to'}
                                            </span>
                                            <input
                                                type="text"
                                                value={
                                                    accountingForm.data
                                                        .counterparty
                                                }
                                                readOnly={
                                                    !accountingForm.data
                                                        .unassigned ||
                                                    accountingForm.data.type ===
                                                        'payable'
                                                }
                                                aria-readonly={
                                                    !accountingForm.data
                                                        .unassigned ||
                                                    accountingForm.data.type ===
                                                        'payable'
                                                }
                                                onChange={(event) =>
                                                    accountingForm.setData(
                                                        'counterparty',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <small>
                                                {accountingForm.data.type ===
                                                'receivable'
                                                    ? 'Automatically set from the customer of the selected project.'
                                                    : accountingMode ===
                                                        'commission'
                                                      ? 'Automatically set from the selected salesman.'
                                                      : 'Automatically set from the selected contractor.'}
                                            </small>
                                            <span>
                                                Use existing project file
                                            </span>
                                            <select
                                                value={
                                                    accountingForm.data
                                                        .project_document_id
                                                }
                                                onChange={(event) => {
                                                    accountingForm.setData(
                                                        'project_document_id',
                                                        event.target.value,
                                                    );
                                                    if (event.target.value)
                                                        chooseAccountingFile(
                                                            null,
                                                        );
                                                }}
                                            >
                                                <option value="">
                                                    Upload a new file instead
                                                </option>
                                                {(
                                                    selected?.documents ?? []
                                                ).map((document) => (
                                                    <option
                                                        key={document.id}
                                                        value={document.id}
                                                    >
                                                        {document.file_name}
                                                    </option>
                                                ))}
                                            </select>
                                            {accountingForm.errors
                                                .project_document_id && (
                                                <small>
                                                    {
                                                        accountingForm.errors
                                                            .project_document_id
                                                    }
                                                </small>
                                            )}
                                            <span>Attachment</span>
                                            <label
                                                className={`project-accounting-file-picker${isAccountingFileDragging ? 'is-dragging' : ''}`}
                                                onDragEnter={(event) => {
                                                    event.preventDefault();
                                                    setIsAccountingFileDragging(
                                                        true,
                                                    );
                                                }}
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    event.dataTransfer.dropEffect =
                                                        'copy';
                                                }}
                                                onDragLeave={(event) => {
                                                    if (
                                                        !event.currentTarget.contains(
                                                            event.relatedTarget as Node,
                                                        )
                                                    ) {
                                                        setIsAccountingFileDragging(
                                                            false,
                                                        );
                                                    }
                                                }}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    setIsAccountingFileDragging(
                                                        false,
                                                    );
                                                    chooseAccountingFile(
                                                        event.dataTransfer
                                                            .files?.[0] ?? null,
                                                    );
                                                }}
                                            >
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                    onChange={(event) =>
                                                        chooseAccountingFile(
                                                            event.target
                                                                .files?.[0] ??
                                                                null,
                                                        )
                                                    }
                                                />
                                                <Upload />
                                                <strong>
                                                    {accountingForm.data.file
                                                        ?.name ||
                                                        accountingModal
                                                            .transaction
                                                            ?.file_name ||
                                                        'Drop PDF or image here'}
                                                </strong>
                                                <small>
                                                    or click to browse
                                                </small>
                                            </label>
                                            {accountingFilePreview && (
                                                <a
                                                    href={
                                                        accountingFilePreview.url
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Preview attached file
                                                </a>
                                            )}
                                            <span>Notes</span>
                                            <textarea
                                                placeholder="Accounting notes…"
                                                value={
                                                    accountingForm.data.notes
                                                }
                                                onChange={(event) =>
                                                    accountingForm.setData(
                                                        'notes',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                    </section>
                                </div>

                                <DialogFooter className="project-sale-modal__footer">
                                    <button
                                        type="button"
                                        onClick={() => setAccountingModal(null)}
                                        disabled={accountingForm.processing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={accountingForm.processing}
                                    >
                                        {accountingForm.processing
                                            ? 'Saving…'
                                            : `Save ${accountingMode === 'commission' ? 'commission' : accountingForm.data.type}`}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog
                    open={payablePaymentModalOpen}
                    onOpenChange={(open) => {
                        setPayablePaymentModalOpen(open);
                        if (!open && accountingForm.data.status === 'paid') {
                            accountingForm.setData('status', 'ok_to_pay');
                        }
                    }}
                >
                    <DialogContent className="project-sale-modal project-payment-confirm-modal">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                accountingForm.clearErrors(
                                    'payment_method',
                                    'reference_number',
                                );
                                setPayablePaymentModalOpen(false);
                            }}
                        >
                            <DialogHeader>
                                <DialogTitle>
                                    {accountingForm.data.status === 'deposit'
                                        ? 'Record receivable deposit'
                                        : 'Mark payable as paid'}
                                </DialogTitle>
                                <DialogDescription>
                                    Select the payment method. The check or
                                    reference number is optional.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="project-accounting-form-top">
                                <label>
                                    <span>Payment method</span>
                                    <select
                                        required
                                        value={
                                            accountingForm.data.payment_method
                                        }
                                        onChange={(event) => {
                                            const method = event.target
                                                .value as keyof typeof paymentPrefixes;
                                            accountingForm.setData((data) => ({
                                                ...data,
                                                payment_method: method,
                                                reference_number:
                                                    paymentReference(method),
                                            }));
                                        }}
                                    >
                                        {Object.entries(
                                            paymentMethodLabels,
                                        ).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span>
                                        Check / reference number (optional)
                                    </span>
                                    <div className="project-accounting-reference">
                                        <strong>
                                            {
                                                paymentPrefixes[
                                                    accountingForm.data
                                                        .payment_method
                                                ]
                                            }
                                        </strong>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Enter number"
                                            value={accountingForm.data.reference_number.slice(
                                                paymentPrefixes[
                                                    accountingForm.data
                                                        .payment_method
                                                ].length,
                                            )}
                                            onChange={(event) =>
                                                accountingForm.setData(
                                                    'reference_number',
                                                    paymentReference(
                                                        accountingForm.data
                                                            .payment_method,
                                                        event.target.value,
                                                    ),
                                                )
                                            }
                                        />
                                    </div>
                                    {accountingForm.errors.reference_number && (
                                        <small>
                                            {
                                                accountingForm.errors
                                                    .reference_number
                                            }
                                        </small>
                                    )}
                                </label>
                            </div>
                            <DialogFooter className="project-sale-modal__footer">
                                <button
                                    type="button"
                                    onClick={() => {
                                        accountingForm.setData(
                                            'status',
                                            'ok_to_pay',
                                        );
                                        setPayablePaymentModalOpen(false);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit">Confirm paid</button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={paymentCheckType !== null}
                    onOpenChange={(open) => !open && !paymentCheckForm.processing && setPaymentCheckType(null)}
                >
                    {selected && paymentCheckType && (() => {
                        const existing = selected.payment_checks.find((check) => check.type === paymentCheckType);
                        const label = paymentCheckType === 'lead_cost' ? 'Lead Cost (LC)' : 'Total Commission (CO)';

                        return (
                            <DialogContent className="project-accounting-attachment-modal">
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        paymentCheckForm.post(`/management/projects/${selected.id}/payment-checks/${paymentCheckType}`, {
                                            forceFormData: true,
                                            preserveScroll: true,
                                            onSuccess: () => setPaymentCheckType(null),
                                        });
                                    }}
                                >
                                    <DialogHeader>
                                        <DialogTitle>{label}</DialogTitle>
                                        <DialogDescription>
                                            Track this amount separately from job costs. Attaching the check marks it paid.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="project-accounting-form-top">
                                        <label>
                                            Amount
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={paymentCheckForm.data.amount}
                                                onChange={(event) => paymentCheckForm.setData('amount', event.target.value)}
                                                required
                                            />
                                            {paymentCheckForm.errors.amount && <small>{paymentCheckForm.errors.amount}</small>}
                                        </label>
                                        <div className={`project-payment-check-status ${existing?.file_name ? 'is-paid' : ''}`}>
                                            <small>Status</small>
                                            <strong>{existing?.file_name ? 'Paid' : 'Pending'}</strong>
                                        </div>
                                    </div>
                                    {existing?.file_name && (
                                        <div className="project-accounting-attachment-list">
                                            <div className="project-accounting-attachment-list__item">
                                                <FileText />
                                                <span>{existing.file_name}</span>
                                                <a href={`/management/projects/${selected.id}/payment-checks/${existing.id}/file`} target="_blank" rel="noreferrer">View / print</a>
                                                <button
                                                    type="button"
                                                    onClick={() => router.delete(`/management/projects/${selected.id}/payment-checks/${existing.id}/file`, {
                                                        preserveScroll: true,
                                                        onSuccess: () => setPaymentCheckType(null),
                                                    })}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <label className="project-accounting-attachment-upload">
                                        <Upload />
                                        <strong>{paymentCheckForm.data.check_file?.name ?? (existing?.file_name ? 'Replace check' : 'Upload / scan check')}</strong>
                                        <small>PDF, JPG, PNG, WebP, HEIC, or HEIF</small>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                            onChange={(event) => paymentCheckForm.setData('check_file', event.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                    {paymentCheckForm.errors.check_file && <small>{paymentCheckForm.errors.check_file}</small>}
                                    <DialogFooter className="project-sale-modal__footer">
                                        <button type="button" onClick={() => setPaymentCheckType(null)}>Cancel</button>
                                        <button type="submit" disabled={paymentCheckForm.processing || commissionBreakdownLoading}>
                                            {paymentCheckForm.processing ? 'Saving...' : 'Save'}
                                        </button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        );
                    })()}
                </Dialog>

                <Dialog
                    open={completionModalOpen}
                    onOpenChange={(open) => !documentUploadForm.processing && setCompletionModalOpen(open)}
                >
                    {selected && (
                        <DialogContent className="project-accounting-attachment-modal">
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    documentUploadForm.post(`/management/projects/${selected.id}/documents`, {
                                        forceFormData: true,
                                        preserveScroll: true,
                                        onSuccess: () => documentUploadForm.setData('files', []),
                                    });
                                }}
                            >
                                <DialogHeader>
                                    <DialogTitle>Completion form</DialogTitle>
                                    <DialogDescription>
                                        Choose the accounting copy, export a printable PDF, or attach completed forms. Multiple files are supported.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="project-accounting-form-top">
                                    <label>
                                        Copy for
                                        <select
                                            value={completionAudience}
                                            onChange={(event) => {
                                                const audience = event.target.value as 'office' | 'salesman';
                                                setCompletionAudience(audience);
                                                documentUploadForm.setData('completion_audience', audience);
                                                if (audience === 'office') {
                                                    setCompletionSalesmanId('');
                                                    documentUploadForm.setData('completion_salesman_id', '');
                                                }
                                            }}
                                        >
                                            <option value="office">Office — all accounting totals</option>
                                            <option value="salesman">Salesman — salesman totals only</option>
                                        </select>
                                    </label>
                                    {completionAudience === 'salesman' && (
                                        <label>
                                            Salesman
                                            <select
                                                value={completionSalesmanId}
                                                onChange={(event) => {
                                                    setCompletionSalesmanId(event.target.value);
                                                    documentUploadForm.setData('completion_salesman_id', event.target.value);
                                                }}
                                                required
                                            >
                                                <option value="">Select salesman</option>
                                                {(commissionBreakdown?.salesmen ?? []).map((row) => (
                                                    <option key={row.salesman_id} value={row.salesman_id}>{row.salesman_name}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                </div>
                                <div className="project-accounting-attachment-list">
                                    {selected.documents
                                        .filter((document) => document.category.startsWith('Completion Form'))
                                        .map((document) => (
                                            <div key={document.id} className="project-accounting-attachment-list__item">
                                                <FileText /><span>{document.file_name}</span>
                                                <a href={`/management/projects/${selected.id}/documents/${document.id}/file`} target="_blank" rel="noreferrer">View / print</a>
                                            </div>
                                        ))}
                                    {selected.documents.every((document) => !document.category.startsWith('Completion Form')) && <p>No completion forms uploaded yet.</p>}
                                </div>
                                <label className="project-accounting-attachment-upload">
                                    <Upload />
                                    <strong>{documentUploadForm.data.files.length ? `${documentUploadForm.data.files.length} files selected` : 'Choose completion forms'}</strong>
                                    <small>PDF, JPG, PNG, WebP, HEIC, or HEIF</small>
                                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(event) => documentUploadForm.setData('files', Array.from(event.target.files ?? []))} />
                                </label>
                                <DialogFooter className="project-sale-modal__footer">
                                    <a
                                        className="project-print-cover"
                                        href={`/management/projects/${selected.id}/completion-form?audience=${completionAudience}${completionAudience === 'salesman' ? `&salesman_id=${completionSalesmanId}` : ''}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-disabled={completionAudience === 'salesman' && !completionSalesmanId}
                                        onClick={(event) => completionAudience === 'salesman' && !completionSalesmanId && event.preventDefault()}
                                    >
                                        <Printer /> Export / print PDF
                                    </a>
                                    <button type="submit" disabled={documentUploadForm.processing || documentUploadForm.data.files.length === 0 || (completionAudience === 'salesman' && !completionSalesmanId)}>
                                        {documentUploadForm.processing ? 'Uploading...' : 'Upload forms'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog
                    open={saleAttachmentSale !== null}
                    onOpenChange={(open) =>
                        !open &&
                        !documentUploadForm.processing &&
                        setSaleAttachmentSale(null)
                    }
                >
                    {saleAttachmentSale && selected && (
                        <DialogContent className="project-accounting-attachment-modal">
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    documentUploadForm.post(
                                        `/management/projects/${selected.id}/documents`,
                                        {
                                            forceFormData: true,
                                            preserveScroll: true,
                                            onSuccess: () => {
                                                setSaleAttachmentSale(null);
                                                documentUploadForm.reset();
                                            },
                                        },
                                    );
                                }}
                            >
                                <DialogHeader>
                                    <DialogTitle>
                                        {saleAttachmentSale.type === 'original'
                                            ? 'Original sale files'
                                            : 'Referral sale files'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        View existing contracts and photos or
                                        attach more. Files also appear in DOC
                                        and Google Drive.
                                    </DialogDescription>
                                </DialogHeader>
                                <AttachmentPreviewGallery
                                    files={selected.documents
                                        .filter(
                                            (document) =>
                                                document.project_sale_id ===
                                                saleAttachmentSale.id,
                                        )
                                        .map((document) => ({
                                            name: document.file_name,
                                            mime: document.file_mime,
                                            url: `/management/projects/${selected.id}/documents/${document.id}/file`,
                                        }))}
                                />
                                <div className="project-accounting-attachment-list">
                                    {selected.documents
                                        .filter(
                                            (document) =>
                                                document.project_sale_id ===
                                                saleAttachmentSale.id,
                                        )
                                        .map((document) => (
                                            <div
                                                key={document.id}
                                                className="project-accounting-attachment-list__item"
                                            >
                                                <FileText />
                                                <span>
                                                    {document.file_name}
                                                </span>
                                                <a
                                                    href={`/management/projects/${selected.id}/documents/${document.id}/file`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    View
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => void deleteSaleDocument(document)}
                                                    aria-label={`Remove ${document.file_name}`}
                                                >
                                                    <Trash2 /> Remove
                                                </button>
                                            </div>
                                        ))}
                                    {selected.documents.every(
                                        (document) =>
                                            document.project_sale_id !==
                                            saleAttachmentSale.id,
                                    ) && <p>No files attached yet.</p>}
                                </div>
                                <label className="project-accounting-attachment-upload">
                                    <Upload />
                                    <strong>
                                        {documentUploadForm.data.files.length
                                            ? `${documentUploadForm.data.files.length} files selected`
                                            : 'Choose files or photos'}
                                    </strong>
                                    <small>
                                        PDF, JPG, PNG, WebP, HEIC, or HEIF
                                    </small>
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                        onChange={(event) =>
                                            documentUploadForm.setData(
                                                'files',
                                                Array.from(
                                                    event.target.files ?? [],
                                                ),
                                            )
                                        }
                                    />
                                </label>
                                {documentUploadForm.errors.files && (
                                    <small>
                                        {documentUploadForm.errors.files}
                                    </small>
                                )}
                                <DialogFooter className="project-sale-modal__footer">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSaleAttachmentSale(null)
                                        }
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            documentUploadForm.processing ||
                                            documentUploadForm.data.files
                                                .length === 0
                                        }
                                    >
                                        {documentUploadForm.processing
                                            ? 'Uploading...'
                                            : 'Upload files'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog open={contractViewerProject !== null} onOpenChange={(open) => !open && setContractViewerProject(null)}>
                    {contractViewerProject && (
                        <DialogContent className="project-contract-viewer-modal">
                            <DialogHeader>
                                <DialogTitle>{projectNumber(contractViewerProject)} contracts</DialogTitle>
                                <DialogDescription>Original and referral sale files attached to this project.</DialogDescription>
                            </DialogHeader>
                            {(['original', 'referral'] as const).map((saleType) => {
                                const saleIds = contractViewerProject.sales.filter((sale) => sale.type === saleType).map((sale) => sale.id);
                                const files = [
                                    ...(saleType === 'original' && contractViewerProject.contract_file_name ? [{
                                        name: contractViewerProject.contract_file_name,
                                        mime: contractViewerProject.contract_file_mime,
                                        url: `/management/projects/${contractViewerProject.id}/contract-file`,
                                    }] : []),
                                    ...contractViewerProject.documents.filter((document) => document.project_sale_id !== null && saleIds.includes(document.project_sale_id)).map((document) => ({
                                        name: document.file_name,
                                        mime: document.file_mime,
                                        url: `/management/projects/${contractViewerProject.id}/documents/${document.id}/file`,
                                    })),
                                ];
                                return (
                                    <section className="project-contract-viewer-group" key={saleType}>
                                        <h3>{saleType === 'original' ? 'Original sale contract' : 'Referral sale contract'}</h3>
                                        {files.length ? <AttachmentPreviewGallery files={files} /> : <p>No {saleType} sale contract attached.</p>}
                                    </section>
                                );
                            })}
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog
                    open={accountingAttachmentTransaction !== null}
                    onOpenChange={(open) =>
                        !open &&
                        !documentUploadForm.processing &&
                        setAccountingAttachmentTransaction(null)
                    }
                >
                    {accountingAttachmentTransaction && selected && (
                        <DialogContent className="project-accounting-attachment-modal">
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    documentUploadForm.post(
                                        `/management/projects/${selected.id}/documents`,
                                        {
                                            forceFormData: true,
                                            preserveScroll: true,
                                            onSuccess: () => {
                                                setAccountingAttachmentTransaction(
                                                    null,
                                                );
                                                documentUploadForm.reset();
                                            },
                                        },
                                    );
                                }}
                            >
                                <DialogHeader>
                                    <DialogTitle>
                                        {accountingAttachmentTransaction.reference_number ||
                                            `Files for this ${accountingAttachmentTransaction.type}`}
                                    </DialogTitle>
                                    <DialogDescription>
                                        View existing attachments or add PDFs,
                                        images, and photos. New files also
                                        appear in the DOC tab and Google Drive.
                                    </DialogDescription>
                                </DialogHeader>
                                <AttachmentPreviewGallery
                                    files={[
                                        ...(accountingAttachmentTransaction.file_name
                                            ? [
                                                  {
                                                      name: accountingAttachmentTransaction.file_name,
                                                      mime: accountingAttachmentTransaction.file_mime,
                                                      url: `/management/projects/${selected.id}/accounting-transactions/${accountingAttachmentTransaction.id}/file`,
                                                  },
                                              ]
                                            : []),
                                        ...selected.documents
                                            .filter(
                                                (document) =>
                                                    document.project_accounting_transaction_id ===
                                                    accountingAttachmentTransaction.id,
                                            )
                                            .map((document) => ({
                                                name: document.file_name,
                                                mime: document.file_mime,
                                                url: `/management/projects/${selected.id}/documents/${document.id}/file`,
                                            })),
                                    ]}
                                />
                                <div className="project-accounting-attachment-list">
                                    {accountingAttachmentTransaction.file_name && (
                                        <a
                                            href={`/management/projects/${selected.id}/accounting-transactions/${accountingAttachmentTransaction.id}/file`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <FileText />
                                            <span>
                                                {
                                                    accountingAttachmentTransaction.file_name
                                                }
                                            </span>
                                            <strong>View</strong>
                                        </a>
                                    )}
                                    {selected.documents
                                        .filter(
                                            (document) =>
                                                document.project_accounting_transaction_id ===
                                                accountingAttachmentTransaction.id,
                                        )
                                        .map((document) => (
                                            <a
                                                key={document.id}
                                                href={`/management/projects/${selected.id}/documents/${document.id}/file`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <FileText />
                                                <span>
                                                    {document.file_name}
                                                </span>
                                                <strong>View</strong>
                                            </a>
                                        ))}
                                    {!accountingAttachmentTransaction.file_name &&
                                        selected.documents.every(
                                            (document) =>
                                                document.project_accounting_transaction_id !==
                                                accountingAttachmentTransaction.id,
                                        ) && <p>No files attached yet.</p>}
                                </div>
                                <label className="project-accounting-attachment-upload">
                                    <Upload />
                                    <strong>
                                        {documentUploadForm.data.files.length
                                            ? `${documentUploadForm.data.files.length} files selected`
                                            : 'Choose files or photos'}
                                    </strong>
                                    <small>
                                        PDF, JPG, PNG, WebP, HEIC, or HEIF
                                    </small>
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                        onChange={(event) =>
                                            documentUploadForm.setData(
                                                'files',
                                                Array.from(
                                                    event.target.files ?? [],
                                                ),
                                            )
                                        }
                                    />
                                </label>
                                {documentUploadForm.errors.files && (
                                    <small>
                                        {documentUploadForm.errors.files}
                                    </small>
                                )}
                                <DialogFooter className="project-sale-modal__footer">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAccountingAttachmentTransaction(
                                                null,
                                            )
                                        }
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            documentUploadForm.processing ||
                                            documentUploadForm.data.files
                                                .length === 0
                                        }
                                    >
                                        {documentUploadForm.processing
                                            ? 'Uploading…'
                                            : 'Upload files'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

                <Dialog
                    open={receivableQbModal !== null}
                    onOpenChange={(open) => !open && setReceivableQbModal(null)}
                >
                    <DialogContent className="project-sale-modal">
                        <DialogHeader>
                            <DialogTitle>Confirm move to QB</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to mark this receivable as
                                QB? Review the details before confirming.
                            </DialogDescription>
                        </DialogHeader>
                        {receivableQbModal && (
                            <>
                                <div className="project-qb-confirm-summary">
                                    <span>Received from</span>
                                    <strong>
                                        {receivableQbModal.transaction
                                            .counterparty ||
                                            selected?.lead?.customer_name ||
                                            'Customer'}
                                    </strong>
                                    <span>Amount</span>
                                    <strong>
                                        {currencyFormatter.format(
                                            Number(
                                                receivableQbModal.transaction
                                                    .amount,
                                            ),
                                        )}
                                    </strong>
                                </div>
                                {receivableQbDetailsOpen && (
                                    <div className="project-qb-confirm-details">
                                        <div>
                                            <span>Project</span>
                                            <strong>
                                                {selected
                                                    ? projectNumber(selected)
                                                    : 'Unassigned'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Customer</span>
                                            <strong>
                                                {selected?.lead
                                                    ?.customer_name || '—'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Date</span>
                                            <strong>
                                                {
                                                    receivableQbModal
                                                        .transaction
                                                        .transaction_date
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Category</span>
                                            <strong>
                                                {
                                                    receivableQbModal
                                                        .transaction.category
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Status</span>
                                            <strong>
                                                {
                                                    receivableQbModal
                                                        .transaction.status
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Reference</span>
                                            <strong>
                                                {receivableQbModal.transaction
                                                    .reference_number || '—'}
                                            </strong>
                                        </div>
                                        <div className="is-wide">
                                            <span>Notes</span>
                                            <strong>
                                                {receivableQbModal.transaction
                                                    .notes || 'No notes'}
                                            </strong>
                                        </div>
                                        <div className="is-wide">
                                            <span>Attachments</span>
                                            <strong>
                                                {receivableQbModal.transaction
                                                    .file_name ||
                                                selected?.documents.some(
                                                    (document) =>
                                                        document.project_accounting_transaction_id ===
                                                        receivableQbModal
                                                            .transaction.id,
                                                )
                                                    ? 'Files attached'
                                                    : 'No files attached'}
                                            </strong>
                                        </div>
                                    </div>
                                )}
                                <div className="project-accounting-form-top">
                                    <label>
                                        <span>Payment method</span>
                                        <select
                                            value={
                                                receivableQbModal.paymentMethod
                                            }
                                            onChange={(event) => {
                                                const method = event.target
                                                    .value as keyof typeof paymentPrefixes;
                                                setReceivableQbModal(
                                                    (current) =>
                                                        current
                                                            ? {
                                                                  ...current,
                                                                  paymentMethod:
                                                                      method,
                                                                  referenceNumber:
                                                                      paymentPrefixes[
                                                                          method
                                                                      ],
                                                                  error: '',
                                                              }
                                                            : current,
                                                );
                                            }}
                                        >
                                            {Object.entries(
                                                paymentMethodLabels,
                                            ).map(([value, label]) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>
                                            Check / reference number (optional)
                                        </span>
                                        <div className="project-accounting-reference">
                                            <strong>
                                                {
                                                    paymentPrefixes[
                                                        receivableQbModal
                                                            .paymentMethod
                                                    ]
                                                }
                                            </strong>
                                            <input
                                                autoFocus
                                                value={receivableQbModal.referenceNumber.slice(
                                                    paymentPrefixes[
                                                        receivableQbModal
                                                            .paymentMethod
                                                    ].length,
                                                )}
                                                onChange={(event) =>
                                                    setReceivableQbModal(
                                                        (current) =>
                                                            current
                                                                ? {
                                                                      ...current,
                                                                      referenceNumber: `${paymentPrefixes[current.paymentMethod]}${event.target.value}`,
                                                                      error: '',
                                                                  }
                                                                : current,
                                                    )
                                                }
                                            />
                                        </div>
                                    </label>
                                    {receivableQbModal.error && (
                                        <small>{receivableQbModal.error}</small>
                                    )}
                                </div>
                            </>
                        )}
                        <DialogFooter className="project-sale-modal__footer">
                            <button
                                type="button"
                                onClick={() => setReceivableQbModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="is-secondary"
                                onClick={() =>
                                    setReceivableQbDetailsOpen((open) => !open)
                                }
                            >
                                <Eye />{' '}
                                {receivableQbDetailsOpen
                                    ? 'Hide details'
                                    : 'View details'}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    receivableQbModal &&
                                    updateReceivableQb(
                                        receivableQbModal.transaction,
                                        true,
                                        receivableQbModal.paymentMethod,
                                        receivableQbModal.referenceNumber,
                                    )
                                }
                            >
                                Yes, move to QB
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={invoiceModal !== null}
                    onOpenChange={(open) => {
                        if (!open && !invoiceForm.processing) {
                            setInvoiceModal(null);
                            setInvoiceFilePreview(null);
                        }
                    }}
                >
                    {invoiceModal && selected && (
                        <DialogContent className="project-invoice-modal">
                            <form onSubmit={submitInvoice}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {invoiceModal.mode === 'create'
                                            ? 'Add vendor payment'
                                            : 'Edit vendor payment'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        This invoice is connected to{' '}
                                        {projectNumber(selected)}. New invoices
                                        start in Pending status.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="project-invoice-form-layout">
                                    <div className="project-invoice-form">
                                        <label>
                                            <span>Invoice #</span>
                                            <div className="project-invoice-number-input">
                                                <strong>INV#</strong>
                                                <input
                                                    type="text"
                                                    placeholder="0001"
                                                    value={invoiceNumberSuffix(
                                                        invoiceForm.data
                                                            .invoice_number,
                                                    )}
                                                    onChange={(event) =>
                                                        invoiceForm.setData(
                                                            'invoice_number',
                                                            invoiceNumberWithPrefix(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                            {invoiceForm.errors
                                                .invoice_number && (
                                                <small>
                                                    {
                                                        invoiceForm.errors
                                                            .invoice_number
                                                    }
                                                </small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Charged by</span>
                                            <div className="project-invoice-contractor-picker">
                                                <input
                                                    type="search"
                                                    value={
                                                        invoiceContractorSearch
                                                    }
                                                    placeholder="Type contractor or vendor name"
                                                    autoComplete="off"
                                                    onChange={(event) =>
                                                        setInvoiceContractorSearch(
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                <select
                                                    value={
                                                        invoiceForm.data
                                                            .contractor_id
                                                            ? `contractor:${invoiceForm.data.contractor_id}`
                                                            : invoiceForm.data
                                                                    .vendor_id
                                                              ? `vendor:${invoiceForm.data.vendor_id}`
                                                              : ''
                                                    }
                                                    onChange={(event) => {
                                                        const [kind, id = ''] =
                                                            event.target.value.split(
                                                                ':',
                                                            );
                                                        invoiceForm.setData(
                                                            (data) => ({
                                                                ...data,
                                                                contractor_id:
                                                                    kind ===
                                                                    'contractor'
                                                                        ? id
                                                                        : '',
                                                                vendor_id:
                                                                    kind ===
                                                                    'vendor'
                                                                        ? id
                                                                        : '',
                                                            }),
                                                        );
                                                    }}
                                                >
                                                    <option value="">
                                                        Select contractor or
                                                        vendor
                                                    </option>
                                                    {searchedAssignedProjectContractors.length >
                                                        0 && (
                                                        <optgroup label="Assigned to this project">
                                                            {searchedAssignedProjectContractors.map(
                                                                (
                                                                    contractor,
                                                                ) => (
                                                                    <option
                                                                        key={`contractor:${contractor.con_id}`}
                                                                        value={`contractor:${contractor.con_id}`}
                                                                    >
                                                                        {`[Assigned ${contractor.pivot.position}] ${contractor.contractor}`}
                                                                    </option>
                                                                ),
                                                            )}
                                                        </optgroup>
                                                    )}
                                                    {searchedAvailableInvoiceContractors.length >
                                                        0 && (
                                                        <optgroup label="Other contractors">
                                                            {searchedAvailableInvoiceContractors.map(
                                                                (
                                                                    contractor,
                                                                ) => (
                                                                    <option
                                                                        key={`contractor:${contractor.con_id}`}
                                                                        value={`contractor:${contractor.con_id}`}
                                                                    >
                                                                        {
                                                                            contractor.contractor
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </optgroup>
                                                    )}
                                                    {searchedInvoiceVendors.length >
                                                        0 && (
                                                        <optgroup label="Vendors">
                                                            {searchedInvoiceVendors.map(
                                                                (vendor) => (
                                                                    <option
                                                                        key={`vendor-${vendor.vendor_id}`}
                                                                        value={`vendor:${vendor.vendor_id}`}
                                                                    >
                                                                        {
                                                                            vendor.vendor
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </optgroup>
                                                    )}
                                                    {searchedAssignedProjectContractors.length ===
                                                        0 &&
                                                        searchedAvailableInvoiceContractors.length ===
                                                            0 &&
                                                        searchedInvoiceVendors.length ===
                                                            0 && (
                                                            <option disabled>
                                                                No contractors
                                                                or vendors found
                                                            </option>
                                                        )}
                                                </select>
                                            </div>
                                            {invoiceForm.errors
                                                .contractor_id && (
                                                <small>
                                                    {
                                                        invoiceForm.errors
                                                            .contractor_id
                                                    }
                                                </small>
                                            )}
                                            {invoiceForm.errors.vendor_id && (
                                                <small>
                                                    {
                                                        invoiceForm.errors
                                                            .vendor_id
                                                    }
                                                </small>
                                            )}
                                        </label>
                                        <label className="is-wide">
                                            <span>Project address</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${selected.lead.address}, ${selected.lead.city}, ${selected.lead.state} ${selected.lead.zip_code}`}
                                            />
                                        </label>
                                        <label>
                                            <span>Project #</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={projectNumber(selected)}
                                            />
                                        </label>
                                        <label>
                                            <span>Related sale</span>
                                            <select
                                                value={invoiceForm.data.project_sale_id}
                                                onChange={(event) =>
                                                    invoiceForm.setData('project_sale_id', event.target.value)
                                                }
                                            >
                                                <option value="">Project-wide / auto allocate</option>
                                                {selected.sales.map((sale, index) => (
                                                    <option key={sale.id} value={sale.id}>
                                                        {sale.type === 'original' ? 'Original sale' : `Referral sale ${index}`}
                                                        {' — '}{currencyFormatter.format(Number(sale.amount))}
                                                    </option>
                                                ))}
                                            </select>
                                            {invoiceForm.errors.project_sale_id && (
                                                <small>{invoiceForm.errors.project_sale_id}</small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Date inserted</span>
                                            <input
                                                type="date"
                                                value={
                                                    invoiceForm.data
                                                        .invoice_date
                                                }
                                                onChange={(event) =>
                                                    invoiceForm.setData(
                                                        'invoice_date',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {invoiceForm.errors
                                                .invoice_date && (
                                                <small>
                                                    {
                                                        invoiceForm.errors
                                                            .invoice_date
                                                    }
                                                </small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Amount</span>
                                            <div className="project-sale-amount-input">
                                                <strong>$</strong>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    value={
                                                        invoiceForm.data.amount
                                                    }
                                                    onChange={(event) =>
                                                        invoiceForm.setData(
                                                            'amount',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                            {invoiceForm.errors.amount && (
                                                <small>
                                                    {invoiceForm.errors.amount}
                                                </small>
                                            )}
                                        </label>
                                        <label>
                                            <span>Status</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={
                                                    invoiceModal.invoice
                                                        ? invoiceStatusLabels[
                                                              invoiceModal
                                                                  .invoice
                                                                  .status
                                                          ]
                                                        : 'Pending'
                                                }
                                            />
                                            <em>
                                                Change status from the invoice
                                                table.
                                            </em>
                                        </label>
                                        <label className="is-wide">
                                            <span>Description / notes</span>
                                            <textarea
                                                placeholder="What is this invoice for?"
                                                value={invoiceForm.data.notes}
                                                onChange={(event) =>
                                                    invoiceForm.setData(
                                                        'notes',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            {invoiceForm.errors.notes && (
                                                <small>
                                                    {invoiceForm.errors.notes}
                                                </small>
                                            )}
                                        </label>
                                    </div>

                                    <aside className="project-invoice-upload">
                                        <div>
                                            <Upload />
                                            <span>Invoice file</span>
                                        </div>
                                        <label>
                                            <span>
                                                Use existing project file
                                            </span>
                                            <select
                                                value={
                                                    invoiceForm.data
                                                        .project_document_id
                                                }
                                                onChange={(event) => {
                                                    invoiceForm.setData(
                                                        'project_document_id',
                                                        event.target.value,
                                                    );
                                                    if (event.target.value)
                                                        chooseInvoiceFile(null);
                                                }}
                                            >
                                                <option value="">
                                                    Upload a new file instead
                                                </option>
                                                {(
                                                    selected?.documents ?? []
                                                ).map((document) => (
                                                    <option
                                                        key={document.id}
                                                        value={document.id}
                                                    >
                                                        {document.file_name}
                                                    </option>
                                                ))}
                                            </select>
                                            {invoiceForm.errors
                                                .project_document_id && (
                                                <small>
                                                    {
                                                        invoiceForm.errors
                                                            .project_document_id
                                                    }
                                                </small>
                                            )}
                                        </label>
                                        <label
                                            className={`project-invoice-file-picker${isInvoiceFileDragging ? 'is-dragging' : ''}`}
                                            onDragEnter={(event) => {
                                                event.preventDefault();
                                                setIsInvoiceFileDragging(true);
                                            }}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect =
                                                    'copy';
                                            }}
                                            onDragLeave={(event) => {
                                                if (
                                                    !event.currentTarget.contains(
                                                        event.relatedTarget as Node,
                                                    )
                                                ) {
                                                    setIsInvoiceFileDragging(
                                                        false,
                                                    );
                                                }
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                setIsInvoiceFileDragging(false);
                                                chooseInvoiceFile(
                                                    event.dataTransfer
                                                        .files?.[0] ?? null,
                                                );
                                            }}
                                        >
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                onChange={(event) =>
                                                    chooseInvoiceFile(
                                                        event.target
                                                            .files?.[0] ?? null,
                                                    )
                                                }
                                            />
                                            <Upload />
                                            <strong>
                                                {invoiceForm.data.file?.name ||
                                                    invoiceModal.invoice
                                                        ?.file_name ||
                                                    'Choose PDF or image'}
                                            </strong>
                                            <span>
                                                Drop here or click to browse ·
                                                Maximum file size: 10 MB
                                            </span>
                                        </label>
                                        {invoiceForm.errors.file && (
                                            <small>
                                                {invoiceForm.errors.file}
                                            </small>
                                        )}
                                        <div className="project-invoice-upload-preview">
                                            {invoiceFilePreview ? (
                                                invoiceFilePreview.mime.startsWith(
                                                    'image/',
                                                ) ? (
                                                    <img
                                                        src={
                                                            invoiceFilePreview.url
                                                        }
                                                        alt="Invoice upload preview"
                                                    />
                                                ) : (
                                                    <iframe
                                                        src={
                                                            invoiceFilePreview.url
                                                        }
                                                        title="Invoice upload preview"
                                                    />
                                                )
                                            ) : (
                                                <div>
                                                    <FileText />
                                                    <span>
                                                        File preview appears
                                                        here
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </aside>
                                </div>

                                <DialogFooter className="project-sale-modal__footer">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInvoiceModal(null);
                                            setInvoiceFilePreview(null);
                                        }}
                                        disabled={invoiceForm.processing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={invoiceForm.processing}
                                    >
                                        {invoiceForm.processing
                                            ? 'Saving…'
                                            : invoiceModal.mode === 'create'
                                              ? 'Save invoice'
                                              : 'Save changes'}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>
            </main>
        </>
    );
}
