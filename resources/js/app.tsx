import { createInertiaApp } from '@inertiajs/react';
import { SystemModalProvider } from '@/components/system-modal-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import AuthLoginLayout from '@/layouts/auth/auth-login-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import SalesmanLayout from '@/layouts/salesman-layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name === 'auth/login':
                return AuthLoginLayout;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            case name.startsWith('salesman/'):
                return SalesmanLayout;
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <SystemModalProvider>
                <TooltipProvider delayDuration={0}>{app}</TooltipProvider>
            </SystemModalProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
