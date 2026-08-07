import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import SalesmanPwaControls from '@/components/salesman-pwa-controls';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePage } from '@inertiajs/react';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
}: AppLayoutProps) {
    const { auth, pwa } = usePage<{
        auth: { user: { role: string } };
        pwa: { pushPublicKey: string | null };
    }>().props;
    const receivesSalesmanAlerts = ['admin', 'manager'].includes(auth.user.role);

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
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
