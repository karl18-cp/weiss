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
                className="h-svh overflow-hidden"
            >
                <SidebarTrigger className="fixed top-3 left-3 z-50 bg-white shadow-sm md:hidden" />
                {children}
            </AppContent>
        </AppShell>
    );
}
