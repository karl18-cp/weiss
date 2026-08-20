import { Link, router, usePage } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    BadgeCheck,
    CalendarDays,
    CalendarClock,
    ClipboardCheck,
    Clock3,
    History,
    LayoutDashboard,
    ListTodo,
    LogOut,
    MessageCircle,
    PanelsTopLeft,
    PhoneCall,
    RefreshCw,
    RotateCcw,
    Send,
    Settings,
    Store,
    Table2,
    UserRoundPlus,
    Users,
    Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '@/../css/app-sidebar.css';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard, logout } from '@/routes';
import { edit as profile } from '@/routes/profile';
import type { LucideIcon } from 'lucide-react';
import type { Auth } from '@/types';
import LeadGlobalSearch from '@/components/lead-global-search';

type SidebarItem = {
    title: string;
    icon: LucideIcon;
    href: NonNullable<InertiaLinkProps['href']>;
    permission?: string;
    countKey?: string;
    roles?: string[];
};

const workflowItems: SidebarItem[] = [
    {
        title: 'Dashboard',
        icon: LayoutDashboard,
        href: dashboard(),
        permission: 'dashboard',
    },
    {
        title: 'Team Dashboard',
        icon: Trophy,
        href: '/team-dashboard',
        permission: 'team_dashboard',
    },
    {
        title: 'Lead Card',
        icon: UserRoundPlus,
        href: '/lead-workflow/lead-card',
        permission: 'lead_card',
    },
    {
        title: 'Leads Shop',
        icon: Store,
        href: '/lead-workflow/leads-shop',
        permission: 'leads_shop',
        countKey: 'leads_shop',
    },
    {
        title: 'Confirm Leads',
        icon: BadgeCheck,
        href: '/lead-workflow/confirm-leads',
        permission: 'confirm_leads',
        countKey: 'confirm_leads',
    },
    {
        title: 'Dispatch Leads',
        icon: Send,
        href: '/lead-workflow/dispatch-leads',
        permission: 'dispatch_leads',
        countKey: 'dispatch_leads',
    },
    {
        title: 'SAG',
        icon: ClipboardCheck,
        href: '/lead-workflow/sag',
        permission: 'sag',
        countKey: 'sag',
    },
    {
        title: 'Reschedule',
        icon: RefreshCw,
        href: '/lead-workflow/reschedule',
        permission: 'reschedule',
        countKey: 'reschedule',
    },
    {
        title: 'Rehash',
        icon: RotateCcw,
        href: '/lead-workflow/rehash',
        permission: 'rehash',
        countKey: 'rehash',
    },
    {
        title: '555',
        icon: PhoneCall,
        href: '/lead-workflow/555',
        permission: '555',
        countKey: '555',
    },
    {
        title: 'HIS',
        icon: Clock3,
        href: '/lead-workflow/his',
        permission: 'his',
        countKey: 'his',
    },
    {
        title: 'Keep in Touch',
        icon: MessageCircle,
        href: '/lead-workflow/keep-in-touch',
        permission: 'keep_in_touch',
        countKey: 'keep_in_touch',
    },
    {
        title: 'Data',
        icon: Table2,
        href: '/lead-workflow/data',
        permission: 'data',
    },
    {
        title: 'Booking Board',
        icon: CalendarDays,
        href: '/lead-workflow/booking-board',
        permission: 'booking_board',
    },
    {
        title: 'Tele Report',
        icon: Clock3,
        href: '/lead-workflow/tele-hours',
        permission: 'tele_hours',
    },
    {
        title: 'Manager Activity',
        icon: History,
        href: '/lead-workflow/call-logs',
        roles: ['admin', 'manager'],
    },
];

const managementItems: SidebarItem[] = [
    {
        title: 'Tasks', icon: ListTodo, href: '/management/tasks', permission: 'tasks', roles: ['admin', 'manager'],
    },
    {
        title: 'Agent Schedules', icon: CalendarClock, href: '/management/agent-schedules', permission: 'agent_schedules',
    },
    {
        title: 'Quality Control',
        icon: ClipboardCheck,
        href: '/management/quality-control',
        permission: 'quality_control',
    },
    {
        title: 'Projects',
        icon: PanelsTopLeft,
        href: '/management/projects',
        permission: 'projects',
    },
    {
        title: 'Contacts & Users',
        icon: Users,
        href: '/management/contacts-users',
        permission: 'contacts_users',
    },
];

function NavigationSection({
    label,
    items,
    counts = {},
    workflowAlerts = {},
    urgentCounts = {},
    onWorkflowViewed,
    onNavigate,
}: {
    label: string;
    items: SidebarItem[];
    counts?: Record<string, number>;
    workflowAlerts?: Record<string, boolean>;
    urgentCounts?: Record<string, number>;
    onWorkflowViewed?: (key: string) => void;
    onNavigate?: () => void;
}) {
    const { currentUrl, isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="crm-sidebar__group">
            <SidebarGroupLabel className="crm-sidebar__label">
                {label}
            </SidebarGroupLabel>
            <SidebarMenu className="crm-sidebar__menu">
                {items.map((item) => {
                    const hasNewLead = Boolean(
                        item.countKey && workflowAlerts[item.countKey],
                    );
                    const urgentCount = item.countKey
                        ? (urgentCounts[item.countKey] ?? 0)
                        : 0;
                    const urgency =
                        urgentCount > 0
                            ? item.countKey === 'dispatch_leads'
                                ? 'critical'
                                : 'urgent'
                            : null;
                    const content = (
                        <>
                            <item.icon />
                            <span>{item.title}</span>
                            {item.countKey && (
                                <span
                                    className={`crm-sidebar__count${urgency ? ` crm-sidebar__count--${urgency}` : hasNewLead ? ' crm-sidebar__count--new-lead' : ''}`}
                                    aria-label={
                                        urgency
                                            ? `${urgentCount} urgent ${item.title.toLowerCase()}`
                                            : hasNewLead
                                              ? 'New unviewed lead'
                                              : undefined
                                    }
                                >
                                    {(
                                        counts[item.countKey] ?? 0
                                    ).toLocaleString()}
                                </span>
                            )}
                        </>
                    );

                    return (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={
                                    isCurrentUrl(item.href) ||
                                    (item.title === 'Contacts & Users' &&
                                        currentUrl === '/management/products')
                                }
                                className={`crm-sidebar__item crm-sidebar__item--${item.permission ?? item.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}
                                tooltip={item.title}
                            >
                                <Link
                                    href={item.href}
                                    onClick={() => {
                                        if (item.countKey) {
                                            onWorkflowViewed?.(item.countKey);
                                        }
                                        onNavigate?.();
                                    }}
                                >
                                    {content}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

export function AppSidebar() {
    const { isMobile, setOpenMobile } = useSidebar();
    const { auth, workflowCounts } = usePage<{
        auth: Auth;
        workflowCounts: Record<string, number>;
    }>().props;
    type WorkflowMarker = {
        id: number;
        created_at: string;
    };
    const [latestWorkflowMarkers, setLatestWorkflowMarkers] = useState<
        Record<string, WorkflowMarker | null>
    >({});
    const [workflowAlerts, setWorkflowAlerts] = useState<Record<string, boolean>>({});
    const [urgentCounts, setUrgentCounts] = useState<Record<string, number>>({});
    const workflowSeenKey = `weiss:workflow:last-seen:${auth.user.acc_id ?? auth.user.id ?? 'user'}`;

    const saveLatestWorkflowMarker = (key: string) => {
        const marker = latestWorkflowMarkers[key];
        if (!marker) return;

        const seen = JSON.parse(localStorage.getItem(workflowSeenKey) ?? '{}') as Record<string, WorkflowMarker>;
        seen[key] = marker;
        localStorage.setItem(workflowSeenKey, JSON.stringify(seen));
        setWorkflowAlerts((current) => ({ ...current, [key]: false }));
    };

    useEffect(() => {
        let active = true;

        const checkWorkflowAlerts = async () => {
            try {
                const response = await fetch(
                    '/lead-workflow/sidebar-alerts',
                    {
                        headers: { Accept: 'application/json' },
                        credentials: 'same-origin',
                    },
                );
                if (!response.ok) return;

                const payload = (await response.json()) as {
                    markers: Record<string, WorkflowMarker | null>;
                    urgent: Record<string, number>;
                };
                if (!active) return;

                setLatestWorkflowMarkers(payload.markers);
                setUrgentCounts(payload.urgent);
                const stored = localStorage.getItem(workflowSeenKey);
                const seen = JSON.parse(stored ?? '{}') as Record<string, WorkflowMarker>;

                if (!stored) {
                    localStorage.setItem(workflowSeenKey, JSON.stringify(payload.markers));
                    return;
                }

                setWorkflowAlerts(
                    Object.fromEntries(
                        Object.entries(payload.markers).map(([key, marker]) => {
                            const previous = seen[key];
                            const isNewer = Boolean(
                                marker &&
                                    (!previous ||
                                        marker.created_at > previous.created_at ||
                                        (marker.created_at === previous.created_at && marker.id > previous.id)),
                            );
                            return [key, isNewer];
                        }),
                    ),
                );
            } catch {
                // Sidebar alerts should never interrupt normal CRM navigation.
            }
        };

        void checkWorkflowAlerts();
        const interval = window.setInterval(checkWorkflowAlerts, 30000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [workflowSeenKey]);
    const filterItems = (items: SidebarItem[]) => {
        const accessible = items.filter(
            (item) =>
                (!item.roles || item.roles.includes(auth.user.role ?? '')) &&
                (!['manager', 'agent', 'salesman'].includes(
                    auth.user.role ?? '',
                ) ||
                    !item.permission ||
                    auth.permissions?.[item.permission] === 'view' ||
                    auth.permissions?.[item.permission] === 'edit'),
        );
        return accessible;
    };

    const filteredWorkflow = useMemo(
        () => filterItems(workflowItems),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [auth.permissions, auth.user.role],
    );
    const filteredManagement = useMemo(
        () => filterItems(managementItems),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [auth.permissions, auth.user.role],
    );

    const handleLogout = () => router.flushAll();
    const closeMobileNavigation = () => {
        if (isMobile) setOpenMobile(false);
    };

    return (
        <Sidebar collapsible="icon" className="crm-sidebar">
            <div className="crm-sidebar__toggle">
                <SidebarTrigger
                    aria-label="Open or close sidebar"
                    title="Open or close sidebar"
                />
            </div>
            <header className="crm-sidebar__identity">
                <img
                    src="/images/weiss-logo.png"
                    alt="WEISS"
                    className="crm-sidebar__logo"
                />
                <div className="crm-sidebar__identity-copy">
                    <div className="crm-sidebar__brand">Weiss CRM</div>
                    <div className="crm-sidebar__username">
                        {auth.user.username ?? auth.user.email}
                    </div>
                </div>
            </header>

            <LeadGlobalSearch
                className="crm-sidebar__search"
                placeholder="Search accessible leads"
            />

            <SidebarContent className="crm-sidebar__content">
                {filteredWorkflow.length > 0 && (
                    <NavigationSection
                        label="Lead Workflow"
                        items={filteredWorkflow}
                        counts={workflowCounts}
                        workflowAlerts={workflowAlerts}
                        urgentCounts={urgentCounts}
                        onWorkflowViewed={saveLatestWorkflowMarker}
                        onNavigate={closeMobileNavigation}
                    />
                )}

                {filteredManagement.length > 0 && (
                    <NavigationSection
                        label="Management"
                        items={filteredManagement}
                        onNavigate={closeMobileNavigation}
                    />
                )}

                {
                    <SidebarGroup className="crm-sidebar__group crm-sidebar__account">
                        <SidebarGroupLabel className="crm-sidebar__label">
                            Account
                        </SidebarGroupLabel>
                        <SidebarMenu className="crm-sidebar__menu">
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    className="crm-sidebar__item"
                                    tooltip="Settings"
                                >
                                    <Link
                                        href={profile()}
                                        prefetch
                                        onClick={closeMobileNavigation}
                                    >
                                        <Settings />
                                        <span>Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    className="crm-sidebar__item crm-sidebar__logout"
                                    tooltip="Logout"
                                >
                                    <Link
                                        href={logout()}
                                        as="button"
                                        onClick={handleLogout}
                                        data-test="logout-button"
                                    >
                                        <LogOut />
                                        <span>Logout</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                }
            </SidebarContent>
        </Sidebar>
    );
}
