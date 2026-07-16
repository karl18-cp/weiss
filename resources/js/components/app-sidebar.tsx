import { Link, router, usePage } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    BadgeCheck,
    CalendarDays,
    ClipboardCheck,
    Clock3,
    LayoutDashboard,
    LogOut,
    MapPin,
    MessageCircle,
    PanelsTopLeft,
    PhoneCall,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Settings,
    Store,
    Table2,
    UserRoundPlus,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import '@/../css/app-sidebar.css';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard, logout } from '@/routes';
import { edit as profile } from '@/routes/profile';
import type { LucideIcon } from 'lucide-react';
import type { Auth } from '@/types';

type SidebarItem = {
    title: string;
    icon: LucideIcon;
    href: NonNullable<InertiaLinkProps['href']>;
    permission?: string;
};

const workflowItems: SidebarItem[] = [
    { title: 'Dashboard', icon: LayoutDashboard, href: dashboard() },
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
    },
    {
        title: 'Confirm Leads',
        icon: BadgeCheck,
        href: '/lead-workflow/confirm-leads',
        permission: 'confirm_leads',
    },
    {
        title: 'Dispatch Leads',
        icon: Send,
        href: '/lead-workflow/dispatch-leads',
        permission: 'dispatch_leads',
    },
    {
        title: 'Reschedule',
        icon: RefreshCw,
        href: '/lead-workflow/reschedule',
        permission: 'reschedule',
    },
    {
        title: 'Rehash',
        icon: RotateCcw,
        href: '/lead-workflow/rehash',
        permission: 'rehash',
    },
    {
        title: '555',
        icon: PhoneCall,
        href: '/lead-workflow/555',
        permission: '555',
    },
    { title: 'LA', icon: MapPin, href: '/lead-workflow/la', permission: 'la' },
    {
        title: 'HIS',
        icon: Clock3,
        href: '/lead-workflow/his',
        permission: 'his',
    },
    {
        title: 'Keep in Touch',
        icon: MessageCircle,
        href: '/lead-workflow/keep-in-touch',
        permission: 'keep_in_touch',
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
        title: 'Tele Hours',
        icon: Clock3,
        href: '/lead-workflow/tele-hours',
        permission: 'tele_hours',
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
}: {
    label: string;
    items: SidebarItem[];
}) {
    const { currentUrl, isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="crm-sidebar__group">
            <SidebarGroupLabel className="crm-sidebar__label">
                {label}
            </SidebarGroupLabel>
            <SidebarMenu className="crm-sidebar__menu">
                {items.map((item) => {
                    const content = (
                        <>
                            <item.icon />
                            <span>{item.title}</span>
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
                                <Link href={item.href}>{content}</Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [search, setSearch] = useState('');
    const query = search.trim().toLowerCase();

    const filterItems = (items: SidebarItem[]) => {
        const accessible = items.filter(
            (item) =>
                auth.user.role !== 'manager' ||
                !item.permission ||
                auth.permissions?.[item.permission] === 'view' ||
                auth.permissions?.[item.permission] === 'edit',
        );
        return query
            ? accessible.filter((item) =>
                  item.title.toLowerCase().includes(query),
              )
            : accessible;
    };

    const filteredWorkflow = useMemo(
        () => filterItems(workflowItems),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [query, auth.permissions, auth.user.role],
    );
    const filteredManagement = useMemo(
        () => filterItems(managementItems),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [query, auth.permissions, auth.user.role],
    );

    const handleLogout = () => router.flushAll();

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

            <div className="crm-sidebar__search">
                <Search aria-hidden="true" />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search accessible leads"
                    aria-label="Search sidebar"
                />
            </div>

            <SidebarContent className="crm-sidebar__content">
                {filteredWorkflow.length > 0 && (
                    <NavigationSection
                        label="Lead Workflow"
                        items={filteredWorkflow}
                    />
                )}

                {filteredManagement.length > 0 && (
                    <NavigationSection
                        label="Management"
                        items={filteredManagement}
                    />
                )}

                {!query && (
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
                                    <Link href={profile()} prefetch>
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
                )}
            </SidebarContent>
        </Sidebar>
    );
}
