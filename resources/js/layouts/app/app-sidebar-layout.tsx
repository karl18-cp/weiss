import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
}: AppLayoutProps) {
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
            </AppContent>
        </AppShell>
    );
}
