import { Head, router, useForm } from '@inertiajs/react';
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
    FileText,
    FolderSync,
    Landmark,
    Mail,
    MapPin,
    Pencil,
    Phone,
    PhoneCall,
    Plus,
    Trash2,
    Upload,
    UserRound,
    Users,
} from 'lucide-react';
import { createElement, useMemo, useState } from 'react';
import '@/../css/projects.css';
import { useSystemModal } from '@/components/system-modal-provider';
import { RingCentralCallButton } from '@/components/ringcentral-call-button';
import { appointmentDate, appointmentInputValue } from '@/lib/appointment-date';
import { formatPhoneNumber } from '@/lib/phone-number';
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
type ProjectStatusFilter = 'all' | 'new' | 'progress' | 'completed';
type ProjectSortDirection = 'asc' | 'desc';
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

type ProjectInvoice = {
    id: number;
    invoice_number: string;
    invoice_date: string;
    amount: string;
    notes: string | null;
    status: 'pending' | 'ok_to_pay' | 'paid';
    file_name: string | null;
    file_mime: string | null;
    file_size: number | null;
    contractor: ContractorOption;
};

type AccountingTransaction = {
    id: number;
    type: 'receivable' | 'payable';
    category: string;
    transaction_date: string;
    payment_method: 'check' | 'zelle' | 'credit_card';
    reference_number: string;
    counterparty: string | null;
    requested_by: string | null;
    contractor: ContractorOption | null;
    amount: string;
    status: 'pending' | 'ok_to_pay' | 'paid';
    notes: string | null;
    file_name: string | null;
    file_mime: string | null;
    file_size: number | null;
    scheduled_payments: ScheduledPayment[];
    invoice: ProjectInvoice | null;
};

type ProjectDocument = {
    key: string;
    type: 'Invoice' | 'Receivable' | 'Payable';
    fileName: string;
    date: string;
    notes: string;
    status: string;
    mime: string;
    size: number | null;
    url: string;
};

type Project = {
    id: number;
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
    lead: {
        id: number;
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
        agent: { agent_name: string } | null;
        second_agent: { agent_name: string } | null;
        salesman_one: { salesman_name: string; phone: string | null } | null;
        salesman_two: { salesman_name: string; phone: string | null } | null;
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

const invoiceStatusLabels: Record<ProjectInvoice['status'], string> = {
    pending: 'Pending',
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
} as const;

const paymentMethodLabels = {
    check: 'Check',
    zelle: 'Zelle',
    credit_card: 'Credit Card',
} as const;

const paymentReference = (method: keyof typeof paymentPrefixes, value = '') => {
    const knownPrefix = Object.values(paymentPrefixes).find((prefix) =>
        value.toUpperCase().startsWith(prefix),
    );
    const suffix = (knownPrefix ? value.slice(knownPrefix.length) : value)
        .replace(/\s+/g, '')
        .replace(/^CH#/i, '')
        .replace(/^ZELLE/i, '')
        .replace(/^CC-/i, '');

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
    requesters: string[];
    currentRequester: string | null;
    googleDriveUrl: string | null;
}) {
    const { confirm } = useSystemModal();
    const requestedProjectId =
        Number(new URLSearchParams(window.location.search).get('project')) ||
        null;
    const [activeTab, setActiveTab] = useState<
        'PRJ' | 'DTL' | 'SP' | 'INV' | 'ACT' | 'DOC'
    >('PRJ');
    const [projectStatusFilter, setProjectStatusFilter] =
        useState<ProjectStatusFilter>('all');
    const [projectSort, setProjectSort] = useState<{
        key: ProjectSortKey;
        direction: ProjectSortDirection;
    }>({ key: 'signed', direction: 'desc' });
    const [selectedId, setSelectedId] = useState<number | null>(() =>
        projects.some((project) => project.id === requestedProjectId)
            ? requestedProjectId
            : null,
    );
    const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
    const [selectedScheduledPaymentId, setSelectedScheduledPaymentId] =
        useState<number | null>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
        null,
    );
    const [accountingMode, setAccountingMode] = useState<
        'receivable' | 'payable'
    >('receivable');
    const [selectedAccountingId, setSelectedAccountingId] = useState<
        number | null
    >(null);
    const [selectedDocumentKey, setSelectedDocumentKey] = useState<
        string | null
    >(null);
    const [editingProjectDetails, setEditingProjectDetails] = useState(false);
    const [creatingProject, setCreatingProject] = useState(false);
    const [syncingDriveFolders, setSyncingDriveFolders] = useState(false);
    const [projectOnlySelectionMode, setProjectOnlySelectionMode] =
        useState(false);
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
    const invoiceForm = useForm<{
        invoice_number: string;
        invoice_date: string;
        contractor_id: string;
        amount: string;
        notes: string;
        file: File | null;
    }>({
        invoice_number: 'INV#',
        invoice_date: '',
        contractor_id: '',
        amount: '',
        notes: '',
        file: null,
    });
    const [accountingModal, setAccountingModal] = useState<{
        mode: 'create' | 'edit';
        transaction: AccountingTransaction | null;
    } | null>(null);
    const [accountingFilePreview, setAccountingFilePreview] = useState<{
        url: string;
        mime: string;
        isLocal: boolean;
    } | null>(null);
    const accountingForm = useForm<{
        type: 'receivable' | 'payable';
        category: string;
        transaction_date: string;
        payment_method: 'check' | 'zelle' | 'credit_card';
        reference_number: string;
        counterparty: string;
        contractor_id: string;
        requested_by: string;
        amount: string;
        status: AccountingTransaction['status'];
        notes: string;
        file: File | null;
        project_invoice_id: string;
        scheduled_payment_ids: number[];
    }>({
        type: 'receivable',
        category: 'Customer Payment',
        transaction_date: '',
        payment_method: 'check',
        reference_number: 'CH#',
        counterparty: '',
        contractor_id: '',
        requested_by: '',
        amount: '',
        status: 'pending',
        notes: '',
        file: null,
        project_invoice_id: '',
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

        const prefix = project.lead.company?.prefix?.trim() || 'PROJECT';

        return `${prefix}-${String(project.id).padStart(5, '0')}`;
    };

    const latestNote = (project: Project) =>
        project.lead.notes[0]?.body || project.lead.telemarketer_notes || '—';

    const selected = useMemo(
        () => projects.find((project) => project.id === selectedId) ?? null,
        [projects, selectedId],
    );
    const filteredProjects = useMemo(() => {
        const statusFiltered =
            projectStatusFilter === 'all'
                ? projects
                : projects.filter(
                      (project) =>
                          (project.status || 'new') === projectStatusFilter,
                  );
        const valueFor = (project: Project): string | number => {
            switch (projectSort.key) {
                case 'signed':
                    return new Date(project.created_at).getTime();
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
                    return project.sales.reduce(
                        (sum, sale) => sum + Number(sale.amount),
                        0,
                    );
                case 'product':
                    return project.lead.product?.product_name ?? '';
                case 'notes':
                    return latestNote(project);
            }
        };

        return [...statusFiltered].sort((left, right) => {
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
    }, [projects, projectSort, projectStatusFilter]);

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
    const projectStatusCounts = useMemo(
        () => ({
            all: projects.length,
            new: projects.filter(
                (project) => (project.status || 'new') === 'new',
            ).length,
            progress: projects.filter(
                (project) => project.status === 'progress',
            ).length,
            completed: projects.filter(
                (project) => project.status === 'completed',
            ).length,
        }),
        [projects],
    );

    const projectInvoiceContractorIds = new Set(
        selected?.invoices.map((invoice) => invoice.contractor.con_id) ?? [],
    );
    const contractorsWithProjectInvoices = contractors.filter((contractor) =>
        projectInvoiceContractorIds.has(contractor.con_id),
    );
    const otherContractors = contractors.filter(
        (contractor) => !projectInvoiceContractorIds.has(contractor.con_id),
    );
    const payableInvoices =
        selected?.invoices.filter(
            (invoice) =>
                invoice.contractor.con_id ===
                Number(accountingForm.data.contractor_id),
        ) ?? [];
    const requesterOptions = Array.from(
        new Set(
            [currentRequester, ...requesters].filter(
                (requester): requester is string => Boolean(requester),
            ),
        ),
    );
    const projectDocuments: ProjectDocument[] = selected
        ? [
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
                      status: invoiceStatusLabels[transaction.status],
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
        setSelectedId(project.id);
        setSelectedSaleId(null);
        setSelectedScheduledPaymentId(null);
        setSelectedInvoiceId(null);
        setSelectedAccountingId(null);
        setSelectedDocumentKey(null);
        setEditingProjectDetails(false);
        projectDetailsForm.setData({
            project_number: projectNumber(project),
            status: project.status || 'new',
            company_id: String(project.lead.company?.com_id ?? ''),
            product_id: String(project.lead.product?.prod_id ?? ''),
            customer_name: project.lead.customer_name,
            primary_number: project.lead.primary_number,
            secondary_number: project.lead.secondary_number ?? '',
            mobile_number: project.lead.mobile_number ?? '',
            email: project.lead.email ?? '',
            address: project.lead.address,
            city: project.lead.city,
            state: project.lead.state,
            zip_code: project.lead.zip_code,
            source: project.lead.source,
            appointment_at: appointmentInputValue(
                project.lead.appointment_at ?? '',
            ),
            lead_created_at: dateTimeInputValue(project.lead.created_at),
        });
        projectDetailsForm.clearErrors();
    };

    const beginProjectDetailsEdit = () => {
        if (!selected) return;

        projectDetailsForm.setData({
            project_number: projectNumber(selected),
            status: selected.status || 'new',
            company_id: String(selected.lead.company?.com_id ?? ''),
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
        });
        projectDetailsForm.clearErrors();
        setEditingProjectDetails(true);
    };

    const saveProjectDetails = () => {
        if (!selected) return;

        projectDetailsForm.put(`/management/projects/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => setEditingProjectDetails(false),
        });
    };

    const noteByType = (project: Project, type: string) =>
        project.lead.notes.find((note) => note.note_type === type)?.body || '—';

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

    const projectSaleTotal = (project: Project) =>
        project.sales.reduce((sum, sale) => sum + Number(sale.amount), 0);

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
                    ['ok_to_pay', 'paid'].includes(transaction.status),
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
                            ['ok_to_pay', 'paid'].includes(transaction.status),
                    )
                    .reduce(
                        (total, transaction) =>
                            total + Number(transaction.amount),
                        0,
                    ),
        );

    const projectSalesmen = (project: Project) =>
        [
            project.lead.salesman_one?.salesman_name,
            project.lead.salesman_two?.salesman_name,
        ]
            .filter(Boolean)
            .join(' & ') || 'Unassigned';

    const selectedSale =
        selected?.sales.find((sale) => sale.id === selectedSaleId) ?? null;
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
    const selectedAccountingTransaction =
        selected?.accounting_transactions.find(
            (transaction) => transaction.id === selectedAccountingId,
        ) ?? null;
    const visibleAccountingTransactions =
        selected?.accounting_transactions.filter(
            (transaction) => transaction.type === accountingMode,
        ) ?? [];

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
            amount: '',
            notes: '',
            file: null,
        });
        invoiceForm.clearErrors();
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
            contractor_id: String(invoice.contractor.con_id),
            amount: invoice.amount,
            notes: invoice.notes ?? '',
            file: null,
        });
        invoiceForm.clearErrors();
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

        if (!file) {
            setInvoiceFilePreview(null);

            return;
        }

        setInvoiceFilePreview({
            url: URL.createObjectURL(file),
            mime: file.type,
        });
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

    const updateInvoiceStatus = (
        invoice: ProjectInvoice,
        status: ProjectInvoice['status'],
    ) => {
        if (!selected) {
            return;
        }

        router.patch(
            `/management/projects/${selected.id}/invoices/${invoice.id}/status`,
            { status },
            { preserveScroll: true },
        );
    };

    const deleteInvoice = async (invoice: ProjectInvoice) => {
        if (!selected) {
            return;
        }

        const confirmed = await confirm({
            title: 'Delete vendor invoice?',
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
            type: accountingMode,
            category:
                accountingMode === 'receivable'
                    ? 'Customer Payment'
                    : 'Vendor Payment',
            transaction_date: crmDateKey(),
            payment_method: 'check',
            reference_number: 'CH#',
            counterparty:
                accountingMode === 'receivable'
                    ? selected.lead.customer_name
                    : '',
            contractor_id: '',
            requested_by: currentRequester ?? '',
            amount: '',
            status: 'pending',
            notes: '',
            file: null,
            project_invoice_id: '',
            scheduled_payment_ids: [],
        });
        accountingForm.clearErrors();
        setAccountingFilePreview(null);
        setAccountingModal({ mode: 'create', transaction: null });
    };

    const openEditAccountingTransaction = (
        transaction: AccountingTransaction,
    ) => {
        accountingForm.setData({
            type: transaction.type,
            category: transaction.category,
            transaction_date: transaction.transaction_date.slice(0, 10),
            payment_method: transaction.payment_method,
            reference_number: paymentReference(
                transaction.payment_method,
                transaction.reference_number,
            ),
            counterparty:
                transaction.type === 'receivable'
                    ? (selected?.lead.customer_name ?? '')
                    : (transaction.contractor?.contractor ?? ''),
            contractor_id: String(transaction.contractor?.con_id ?? ''),
            requested_by: transaction.requested_by ?? currentRequester ?? '',
            amount: transaction.amount,
            status: transaction.status,
            notes: transaction.notes ?? '',
            file: null,
            project_invoice_id: String(transaction.invoice?.id ?? ''),
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

    const openReferralSale = () => {
        saleForm.setData({
            amount: '',
            sale_date: crmDateKey(),
            product_id: '',
        });
        saleForm.clearErrors();
        setSaleModal({ mode: 'create', sale: null });
    };

    const openEditSale = (sale: ProjectSale) => {
        saleForm.setData({
            amount: sale.amount,
            sale_date: sale.sale_date.slice(0, 10),
            product_id: String(sale.product?.prod_id ?? ''),
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
            saleForm.post(`/management/projects/${selected.id}/sales`, options);
        } else if (saleModal.sale) {
            saleForm.put(
                `/management/projects/${selected.id}/sales/${saleModal.sale.id}`,
                options,
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
            <main className="projects-page">
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
                                    <strong>{projectStatusCounts[value]}</strong>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="projects-header-actions">
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

                <section
                    className={`project-context-bar ${selected ? 'has-project' : ''}`}
                    aria-live="polite"
                    aria-label="Currently selected project"
                >
                    <div>
                        <small>Working on project</small>
                        <strong>
                            {selected?.lead.customer_name ?? 'Select a project'}
                        </strong>
                        <span>
                            Salesman:{' '}
                            {selected ? projectSalesmen(selected) : '—'}
                        </span>
                    </div>
                    <div>
                        <small>Project #</small>
                        <strong>
                            {selected ? projectNumber(selected) : '—'}
                        </strong>
                        <span>
                            Sale:{' '}
                            {selected
                                ? currencyFormatter.format(
                                      projectSaleTotal(selected),
                                  )
                                : '—'}
                        </span>
                    </div>
                    <div>
                        <small>Customer</small>
                        <strong>
                            {selected?.lead.customer_name ??
                                'No project selected'}
                        </strong>
                        <span>
                            Balance:{' '}
                            {selected
                                ? currencyFormatter.format(
                                      projectSaleTotal(selected),
                                  )
                                : '—'}
                        </span>
                    </div>
                    <div>
                        <small>Address</small>
                        <strong
                            title={
                                selected
                                    ? `${selected.lead.address}, ${selected.lead.city}, ${selected.lead.state} ${selected.lead.zip_code}`
                                    : undefined
                            }
                        >
                            {selected
                                ? `${selected.lead.address}, ${selected.lead.city}, ${selected.lead.state} ${selected.lead.zip_code}`
                                : '—'}
                        </strong>
                        <span>
                            Customer primary:{' '}
                            {formatPhoneNumber(selected?.lead.primary_number)}
                        </span>
                    </div>
                    <div>
                        <small>Customer email</small>
                        <strong>{selected?.lead.email || 'No email'}</strong>
                        <span>
                            Customer mobile:{' '}
                            {formatPhoneNumber(selected?.lead.mobile_number)}
                        </span>
                    </div>
                </section>

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
                            ['DOC', 'Documents'],
                        ].map(([shortLabel, label]) => {
                            const isAvailable =
                                shortLabel === 'PRJ' ||
                                ((shortLabel === 'DTL' ||
                                    shortLabel === 'SP' ||
                                    shortLabel === 'INV' ||
                                    shortLabel === 'ACT' ||
                                    shortLabel === 'DOC') &&
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
                                        if (
                                            shortLabel === 'PRJ' ||
                                            shortLabel === 'DTL' ||
                                            shortLabel === 'SP' ||
                                            shortLabel === 'INV' ||
                                            shortLabel === 'ACT' ||
                                            shortLabel === 'DOC'
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
                                <strong>
                                    {projectDocuments.length}{' '}
                                    {projectDocuments.length === 1
                                        ? 'document'
                                        : 'documents'}
                                </strong>
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
                                    <div className="project-accounting-modes">
                                        {(
                                            ['receivable', 'payable'] as const
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
                                                    : 'Payables'}
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
                                        {accountingMode === 'payable' ? (
                                            <tr>
                                                <th>Req. 2 Pay @</th>
                                                <th>CMP</th>
                                                <th>Proj. #</th>
                                                <th>Pay To</th>
                                                <th>Pay For (Invoice)</th>
                                                <th>Req. By</th>
                                                <th>Status</th>
                                                <th>$ Amount To Pay</th>
                                                <th>Check #</th>
                                                <th>Notes</th>
                                                <th>File</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th>Date</th>
                                                <th>Reference #</th>
                                                <th>Received From</th>
                                                <th>Notes</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                                <th>Category</th>
                                                <th>File</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {visibleAccountingTransactions.map(
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
                                                        <td>
                                                            {dateFormatter.format(
                                                                new Date(
                                                                    transaction.transaction_date,
                                                                ),
                                                            )}
                                                        </td>
                                                        {accountingMode ===
                                                        'payable' ? (
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
                                                                    {transaction
                                                                        .contractor
                                                                        ?.contractor ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    {transaction
                                                                        .invoice
                                                                        ?.invoice_number ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    {transaction.requested_by ||
                                                                        '—'}
                                                                </td>
                                                                <td>
                                                                    <span className="project-accounting-status">
                                                                        {
                                                                            invoiceStatusLabels[
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
                                                                    {
                                                                        transaction.reference_number
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
                                                                    <strong>
                                                                        {
                                                                            transaction.reference_number
                                                                        }
                                                                    </strong>
                                                                </td>
                                                                <td>
                                                                    {transaction.counterparty ||
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
                                                                        invoiceStatusLabels[
                                                                            transaction
                                                                                .status
                                                                        ]
                                                                    }
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
                                                        accountingMode ===
                                                        'payable'
                                                            ? 11
                                                            : 8
                                                    }
                                                    className="project-accounting-empty"
                                                >
                                                    <Landmark />
                                                    <strong>
                                                        No {accountingMode}s
                                                    </strong>
                                                    <span>
                                                        Click New to record the
                                                        first {accountingMode}.
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
                                    <small>Accounting balance</small>
                                    <strong>
                                        {currencyFormatter.format(
                                            selected.accounting_transactions.reduce(
                                                (sum, item) =>
                                                    sum +
                                                    (item.type === 'receivable'
                                                        ? Number(item.amount)
                                                        : -Number(item.amount)),
                                                0,
                                            ),
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
                                        <small>Vendor invoices</small>
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
                                                    <th>Date</th>
                                                    <th>Invoice #</th>
                                                    <th>Charged by</th>
                                                    <th>Amount</th>
                                                    <th>Balance</th>
                                                    <th>Notes</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selected.invoices.map(
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
                                                                <strong>
                                                                    {
                                                                        invoice.invoice_number
                                                                    }
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                {
                                                                    invoice
                                                                        .contractor
                                                                        .contractor
                                                                }
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
                                                                <select
                                                                    className={`project-invoice-status is-${invoice.status}`}
                                                                    value={
                                                                        invoice.status
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        updateInvoiceStatus(
                                                                            invoice,
                                                                            event
                                                                                .target
                                                                                .value as ProjectInvoice['status'],
                                                                        )
                                                                    }
                                                                    aria-label={`Status for invoice ${invoice.invoice_number}`}
                                                                >
                                                                    {Object.entries(
                                                                        invoiceStatusLabels,
                                                                    ).map(
                                                                        ([
                                                                            value,
                                                                            label,
                                                                        ]) => (
                                                                            <option
                                                                                key={
                                                                                    value
                                                                                }
                                                                                value={
                                                                                    value
                                                                                }
                                                                            >
                                                                                {
                                                                                    label
                                                                                }
                                                                            </option>
                                                                        ),
                                                                    )}
                                                                </select>
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
                                                        <th>Date</th>
                                                        <th>Reference #</th>
                                                        <th>Pay to</th>
                                                        <th>Requested by</th>
                                                        <th>Status</th>
                                                        <th>Amount</th>
                                                        <th>Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedInvoicePayables.map(
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
                                                                        selectedInvoice
                                                                            ?.contractor
                                                                            .contractor ||
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
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProjects.map((project) => (
                                            <tr
                                                key={project.id}
                                                className={
                                                    selectedId === project.id
                                                        ? 'is-selected'
                                                        : ''
                                                }
                                                onClick={() =>
                                                    selectProject(project)
                                                }
                                            >
                                                {projectOnlySelectionMode && (
                                                    <td
                                                        className="projects-project-only"
                                                        onClick={(event) =>
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
                                                    {dateFormatter.format(
                                                        new Date(
                                                            project.created_at,
                                                        ),
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="projects-status">
                                                        {project.status ||
                                                            'new'}
                                                    </span>
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
                                                        {project.lead.company
                                                            ?.prefix ?? '—'}
                                                    </strong>
                                                </td>
                                                <td className="projects-number">
                                                    {projectNumber(project)}
                                                </td>
                                                <td>{project.lead.city}</td>
                                                <td>
                                                    {formatPhoneNumber(
                                                        project.lead
                                                            .primary_number,
                                                    )}
                                                </td>
                                                <td>
                                                    {project.lead.agent
                                                        ?.agent_name ?? '—'}
                                                </td>
                                                <td>
                                                    {[
                                                        project.lead
                                                            .salesman_one
                                                            ?.salesman_name,
                                                        project.lead
                                                            .salesman_two
                                                            ?.salesman_name,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' & ')}
                                                </td>
                                                <td className="projects-amount">
                                                    {currencyFormatter.format(
                                                        projectSaleTotal(
                                                            project,
                                                        ),
                                                    )}
                                                </td>
                                                <td>
                                                    {project.lead.product
                                                        ?.product_name ?? '—'}
                                                </td>
                                                <td>—</td>
                                                <td
                                                    className="projects-notes"
                                                    title={latestNote(project)}
                                                >
                                                    {latestNote(project)}
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredProjects.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={14}
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
                                        onClick={() => setActiveTab('PRJ')}
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
                                                        onChange={(event) =>
                                                            projectDetailsForm.setData(
                                                                'status',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
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
                                        <div className="project-sale-toolbar">
                                            <button
                                                type="button"
                                                className="project-add-sale"
                                                onClick={openReferralSale}
                                            >
                                                <Plus /> New
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    selectedSale &&
                                                    openEditSale(selectedSale)
                                                }
                                                disabled={!selectedSale}
                                            >
                                                <Pencil /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                className="is-delete"
                                                onClick={() =>
                                                    selectedSale &&
                                                    deleteReferralSale(
                                                        selectedSale,
                                                    )
                                                }
                                                disabled={
                                                    !selectedSale ||
                                                    selectedSale.type ===
                                                        'original'
                                                }
                                                title={
                                                    selectedSale?.type ===
                                                    'original'
                                                        ? 'The original sale cannot be deleted'
                                                        : 'Delete selected referral sale'
                                                }
                                            >
                                                <Trash2 /> Delete
                                            </button>
                                        </div>
                                    </header>
                                    <div className="project-sale-total">
                                        <span>
                                            <small>Total project sale</small>
                                            <strong>
                                                {currencyFormatter.format(
                                                    projectSaleTotal(selected),
                                                )}
                                            </strong>
                                        </span>
                                        <CircleDollarSign />
                                    </div>
                                    <div className="project-sales-table-wrap">
                                        <table className="project-sales-table">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Sale</th>
                                                    <th>Date</th>
                                                    <th>Product</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selected.sales.map((sale) => (
                                                    <tr
                                                        key={sale.id}
                                                        className={
                                                            selectedSaleId ===
                                                            sale.id
                                                                ? 'is-selected'
                                                                : ''
                                                        }
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
                                                                {sale.type}
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
                                                            {sale.product
                                                                ?.product_name ||
                                                                '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="project-sale-hint">
                                        The original sale can be edited but not
                                        deleted. Referral sales can be added,
                                        edited, or deleted.
                                    </p>
                                </article>

                                <article className="project-detail-card project-detail-card--team">
                                    <header>
                                        <span>
                                            <Users />
                                        </span>
                                        <div>
                                            <h3>Assigned team</h3>
                                            <p>Lead and sales ownership</p>
                                        </div>
                                    </header>
                                    <div className="project-team-list">
                                        <div>
                                            <small>Main agent</small>
                                            <strong>
                                                {selected.lead.agent
                                                    ?.agent_name ||
                                                    'Unassigned'}
                                            </strong>
                                        </div>
                                        <div>
                                            <small>Second agent</small>
                                            <strong>
                                                {selected.lead.second_agent
                                                    ?.agent_name ||
                                                    'Unassigned'}
                                            </strong>
                                        </div>
                                        <div>
                                            <small>Salesman 1</small>
                                            <span className="project-call-row">
                                                <strong>
                                                    {selected.lead.salesman_one
                                                        ?.salesman_name ||
                                                        'Unassigned'}
                                                </strong>
                                                {selected.lead.salesman_one?.phone?.trim() && (
                                                    <RingCentralCallButton
                                                        phone={
                                                            selected.lead
                                                                .salesman_one
                                                                .phone
                                                        }
                                                        phoneSlot="primary"
                                                        className="project-call-button"
                                                        title={`Call ${selected.lead.salesman_one.salesman_name} with RingCentral`}
                                                    >
                                                        <PhoneCall />
                                                        <span>Call</span>
                                                    </RingCentralCallButton>
                                                )}
                                            </span>
                                        </div>
                                        <div>
                                            <small>Salesman 2</small>
                                            <span className="project-call-row">
                                                <strong>
                                                    {selected.lead.salesman_two
                                                        ?.salesman_name ||
                                                        'Unassigned'}
                                                </strong>
                                                {selected.lead.salesman_two?.phone?.trim() && (
                                                    <RingCentralCallButton
                                                        phone={
                                                            selected.lead
                                                                .salesman_two
                                                                .phone
                                                        }
                                                        phoneSlot="primary"
                                                        className="project-call-button"
                                                        title={`Call ${selected.lead.salesman_two.salesman_name} with RingCentral`}
                                                    >
                                                        <PhoneCall />
                                                        <span>Call</span>
                                                    </RingCentralCallButton>
                                                )}
                                            </span>
                                        </div>
                                    </div>
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
                                                                {note.body}
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
                                        onChange={(event) =>
                                            projectCreateForm.setData(
                                                'status',
                                                event.target.value,
                                            )
                                        }
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
                                        placeholder="Leave blank to assign automatically"
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
                                        and product for this project.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="project-sale-form">
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
                                    </label>
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
                        <DialogContent className="project-accounting-modal">
                            <form onSubmit={submitAccountingTransaction}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {accountingModal.mode === 'create'
                                            ? `New ${accountingForm.data.type}`
                                            : `Edit ${accountingForm.data.type}`}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Record a project{' '}
                                        {accountingForm.data.type}. Linking a{' '}
                                        {accountingForm.data.type ===
                                        'receivable'
                                            ? 'scheduled payment'
                                            : 'vendor invoice'}{' '}
                                        is optional.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="project-accounting-form-top">
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
                                            {accountingForm.data.type ===
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
                                        <span>Reference #</span>
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
                                        {accountingForm.errors
                                            .reference_number && (
                                            <small>
                                                {
                                                    accountingForm.errors
                                                        .reference_number
                                                }
                                            </small>
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
                                            onChange={(event) =>
                                                accountingForm.setData(
                                                    'status',
                                                    event.target
                                                        .value as AccountingTransaction['status'],
                                                )
                                            }
                                        >
                                            {Object.entries(
                                                invoiceStatusLabels,
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

                                <div className="project-accounting-form-body">
                                    {accountingForm.data.type ===
                                    'receivable' ? (
                                        <section>
                                            <header>
                                                <div>
                                                    <h3>Scheduled payments</h3>
                                                    <p>
                                                        Optional—select any
                                                        schedules included in
                                                        this receivable.
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
                                                                key={payment.id}
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
                                                        No scheduled payments
                                                        exist. You can still
                                                        save this receivable.
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    ) : (
                                        <section>
                                            <header>
                                                <div>
                                                    <h3>Vendor invoice</h3>
                                                    <p>
                                                        Optionally connect this
                                                        payable to an invoice.
                                                    </p>
                                                </div>
                                            </header>
                                            <div className="project-accounting-payable-fields">
                                                <label>
                                                    <span>Company (CMP)</span>
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={
                                                            selected.lead
                                                                .company
                                                                ?.prefix ?? '—'
                                                        }
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
                                                    <span>Pay to</span>
                                                    <select
                                                        value={
                                                            accountingForm.data
                                                                .contractor_id
                                                        }
                                                        onChange={(event) => {
                                                            const contractor =
                                                                contractors.find(
                                                                    (item) =>
                                                                        item.con_id ===
                                                                        Number(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                );
                                                            accountingForm.setData(
                                                                (data) => ({
                                                                    ...data,
                                                                    contractor_id:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    counterparty:
                                                                        contractor?.contractor ??
                                                                        '',
                                                                    project_invoice_id:
                                                                        '',
                                                                }),
                                                            );
                                                        }}
                                                    >
                                                        <option value="">
                                                            Select contractor
                                                        </option>
                                                        {contractorsWithProjectInvoices.length >
                                                            0 && (
                                                            <optgroup label="With invoices in this project">
                                                                {contractorsWithProjectInvoices.map(
                                                                    (
                                                                        contractor,
                                                                    ) => (
                                                                        <option
                                                                            key={
                                                                                contractor.con_id
                                                                            }
                                                                            value={
                                                                                contractor.con_id
                                                                            }
                                                                        >
                                                                            {
                                                                                contractor.contractor
                                                                            }
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </optgroup>
                                                        )}
                                                        {otherContractors.length >
                                                            0 && (
                                                            <optgroup label="Other contractors">
                                                                {otherContractors.map(
                                                                    (
                                                                        contractor,
                                                                    ) => (
                                                                        <option
                                                                            key={
                                                                                contractor.con_id
                                                                            }
                                                                            value={
                                                                                contractor.con_id
                                                                            }
                                                                        >
                                                                            {
                                                                                contractor.contractor
                                                                            }
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                </label>
                                                <label>
                                                    <span>Requested by</span>
                                                    <select
                                                        value={
                                                            accountingForm.data
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
                                                                    {requester}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </label>
                                            </div>
                                            <div className="project-accounting-invoice-picker">
                                                <strong>Invoice details</strong>
                                                {!accountingForm.data
                                                    .contractor_id ? (
                                                    <div className="project-accounting-invoice-picker__empty">
                                                        Select a contractor to
                                                        show their invoices for
                                                        this project.
                                                    </div>
                                                ) : payableInvoices.length ===
                                                  0 ? (
                                                    <div className="project-accounting-invoice-picker__empty">
                                                        This contractor has no
                                                        invoices in the selected
                                                        project.
                                                    </div>
                                                ) : (
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>
                                                                    Invoice #
                                                                </th>
                                                                <th>Date</th>
                                                                <th>Amount</th>
                                                                <th>Balance</th>
                                                                <th>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {payableInvoices.map(
                                                                (invoice) => {
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
                                    )}

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
                                                    : 'Paid to'}
                                            </span>
                                            <input
                                                type="text"
                                                value={
                                                    accountingForm.data
                                                        .counterparty
                                                }
                                                readOnly
                                                aria-readonly="true"
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
                                                    : 'Automatically set from the selected contractor.'}
                                            </small>
                                            <span>Attachment</span>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                onChange={(event) => {
                                                    const file =
                                                        event.target
                                                            .files?.[0] ?? null;

                                                    if (
                                                        accountingFilePreview?.isLocal
                                                    ) {
                                                        URL.revokeObjectURL(
                                                            accountingFilePreview.url,
                                                        );
                                                    }

                                                    accountingForm.setData(
                                                        'file',
                                                        file,
                                                    );
                                                    setAccountingFilePreview(
                                                        file
                                                            ? {
                                                                  url: URL.createObjectURL(
                                                                      file,
                                                                  ),
                                                                  mime: file.type,
                                                                  isLocal: true,
                                                              }
                                                            : null,
                                                    );
                                                }}
                                            />
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
                                            : `Save ${accountingForm.data.type}`}
                                    </button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    )}
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
                                            ? 'Add vendor invoice'
                                            : 'Edit vendor invoice'}
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
                                            <select
                                                value={
                                                    invoiceForm.data
                                                        .contractor_id
                                                }
                                                onChange={(event) =>
                                                    invoiceForm.setData(
                                                        'contractor_id',
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select contractor
                                                </option>
                                                {contractors.map(
                                                    (contractor) => (
                                                        <option
                                                            key={
                                                                contractor.con_id
                                                            }
                                                            value={
                                                                contractor.con_id
                                                            }
                                                        >
                                                            {
                                                                contractor.contractor
                                                            }
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            {invoiceForm.errors
                                                .contractor_id && (
                                                <small>
                                                    {
                                                        invoiceForm.errors
                                                            .contractor_id
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
                                        <label className="project-invoice-file-picker">
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
