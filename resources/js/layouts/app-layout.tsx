import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import IdleSessionGuard from '@/components/idle-session-guard';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    children,
    hideSidebar = false,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
    hideSidebar?: boolean;
}) {
    return (
        <>
            <IdleSessionGuard />
            <AppLayoutTemplate breadcrumbs={breadcrumbs} hideSidebar={hideSidebar}>
                {children}
            </AppLayoutTemplate>
        </>
    );
}
