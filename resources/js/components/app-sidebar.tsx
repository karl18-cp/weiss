import { Link, router, usePage } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    BadgeCheck,
    CalendarDays,
    ClipboardCheck,
    Clock3,
    History,
    LayoutDashboard,
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
    leadsShopHasNewLead = false,
    onLeadsShopViewed,
    onNavigate,
}: {
    label: string;
    items: SidebarItem[];
    counts?: Record<string, number>;
    leadsShopHasNewLead?: boolean;
    onLeadsShopViewed?: () => void;
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
                    const isLeadsShopAlert =
                        item.countKey === 'leads_shop' && leadsShopHasNewLead;
                    const content = (
                        <>
                            <item.icon />
                            <span>{item.title}</span>
                            {item.countKey && (
                                <span
                                    className={`crm-sidebar__count${isLeadsShopAlert ? ' crm-sidebar__count--new-lead' : ''}`}
                                    aria-label={
                                        isLeadsShopAlert
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
                                className="crm-sidebar__item"
                                tooltip={item.title}
                            >
                                <Link
                                    href={item.href}
                                    onClick={() => {
                                        if (item.countKey === 'leads_shop') {
                                            onLeadsShopViewed?.();
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
    const [latestLeadsShopMarker, setLatestLeadsShopMarker] = useState<{
        id: number;
        created_at: string;
    } | null>(null);
    const [leadsShopHasNewLead, setLeadsShopHasNewLead] = useState(false);
    const leadsShopSeenKey = `weiss:leads-shop:last-seen:${auth.user.acc_id ?? auth.user.id ?? 'user'}`;

    const saveLatestLeadsShopMarker = () => {
        if (!latestLeadsShopMarker) return;

        localStorage.setItem(
            leadsShopSeenKey,
            JSON.stringify(latestLeadsShopMarker),
        );
        setLeadsShopHasNewLead(false);
    };

    useEffect(() => {
        let active = true;

        const checkForNewLead = async () => {
            try {
                const response = await fetch(
                    '/lead-workflow/leads-shop/latest-marker',
                    {
                        headers: { Accept: 'application/json' },
                        credentials: 'same-origin',
                    },
                );
                if (!response.ok) return;

                const payload = (await response.json()) as {
                    latest: { id: number; created_at: string } | null;
                };
                if (!active || !payload.latest) return;

                setLatestLeadsShopMarker(payload.latest);
                const stored = localStorage.getItem(leadsShopSeenKey);
                if (!stored) {
                    localStorage.setItem(
                        leadsShopSeenKey,
                        JSON.stringify(payload.latest),
                    );
                    return;
                }

                const seen = JSON.parse(stored) as {
                    id?: number;
                    created_at?: string;
                };
                const isNewer =
                    payload.latest.created_at > (seen.created_at ?? '') ||
                    (payload.latest.created_at === seen.created_at &&
                        payload.latest.id > (seen.id ?? 0));
                setLeadsShopHasNewLead(isNewer);
            } catch {
                // Sidebar alerts should never interrupt normal CRM navigation.
            }
        };

        void checkForNewLead();
        const interval = window.setInterval(checkForNewLead, 30000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [leadsShopSeenKey]);
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
                        leadsShopHasNewLead={leadsShopHasNewLead}
                        onLeadsShopViewed={saveLatestLeadsShopMarker}
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
