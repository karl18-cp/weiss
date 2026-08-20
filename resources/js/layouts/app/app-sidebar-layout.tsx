import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import SalesmanPwaControls from '@/components/salesman-pwa-controls';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePage } from '@inertiajs/react';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    hideSidebar = false,
}: AppLayoutProps & { hideSidebar?: boolean }) {
    const page = usePage<{
        auth: { user: { role: string } };
        pwa: { pushPublicKey: string | null };
    }>();
    const { auth, pwa } = page.props;
    const receivesSalesmanAlerts = ['admin', 'manager'].includes(auth.user.role);
    const path = page.url.split('?')[0];
    const pageTheme = (() => {
        if (path === '/dashboard') return 'dashboard';
        if (path === '/team-dashboard') return 'team-dashboard';
        if (path.includes('/lead-card')) return 'lead-card';
        if (path.includes('/leads-shop')) return 'leads-shop';
        if (path.includes('/confirm')) return 'confirm';
        if (path.includes('/dispatch')) return 'dispatch';
        if (path.includes('/sag')) return 'sag';
        if (path.includes('/reschedule')) return 'reschedule';
        if (path.includes('/rehash')) return 'rehash';
        if (path.includes('/555') || path.includes('/five-five-five')) return 'five-five-five';
        if (path.includes('/his')) return 'his';
        if (path.includes('/keep-in-touch')) return 'keep-in-touch';
        if (path.includes('/booking-board')) return 'booking-board';
        if (path.includes('/tele-hours') || path.includes('/tele-report')) return 'tele-hours';
        if (path.includes('/manager-activity') || path.includes('/manager-history')) return 'manager-activity';
        if (path.includes('/management/tasks')) return 'tasks';
        if (path.includes('/agent-schedules')) return 'agent-schedules';
        if (path.includes('/quality-control')) return 'quality-control';
        if (path.includes('/management/projects') || path.includes('/accounting/')) return 'projects';
        if (path.includes('/contacts-users') || path.includes('/management/')) return 'directory';
        if (path.includes('/data')) return 'data';
        return 'default';
    })();

    return (
        <AppShell variant="sidebar">
            {!hideSidebar && <AppSidebar />}
            <AppContent
                variant="sidebar"
                data-page-theme={pageTheme}
                className="crm-app-content h-dvh overflow-x-hidden overflow-y-auto md:h-svh md:overflow-hidden"
            >
                <SidebarTrigger
                    className="mobile-sidebar-trigger md:hidden"
                    aria-label="Open navigation menu"
                    title="Open navigation menu"
                />
                {children}
                {receivesSalesmanAlerts && (
                    <SalesmanPwaControls
                        publicKey={pwa.pushPublicKey}
                        allowInstall={false}
                    />
                )}
            </AppContent>
        </AppShell>
    );
}
