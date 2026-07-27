import { Link, router, usePage } from '@inertiajs/react';
import { CalendarDays, LogOut, UsersRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import IdleSessionGuard from '@/components/idle-session-guard';
import SalesmanPwaControls from '@/components/salesman-pwa-controls';
import { logout } from '@/routes';
import type { Auth } from '@/types';
import '@/../css/salesman-portal.css';

const links = [
    {
        label: 'My Bookings',
        href: '/salesman/booking-board',
        icon: CalendarDays,
    },
    { label: 'My Leads', href: '/salesman/leads', icon: UsersRound },
];

export default function SalesmanLayout({ children }: PropsWithChildren) {
    const { url, props } = usePage<{
        auth: Auth;
        pwa: { pushPublicKey: string | null };
    }>();
    const username = props.auth.user.username ?? props.auth.user.email;

    return (
        <div className="salesman-portal">
            <IdleSessionGuard />
            <header className="salesman-portal__header">
                <Link href="/salesman/booking-board" className="salesman-portal__brand">
                    <img src="/images/weiss-logo.png" alt="WEISS" />
                    <span>
                        <strong>Weiss Sales</strong>
                        <small>{username}</small>
                    </span>
                </Link>
                <button
                    type="button"
                    onClick={() => {
                        router.flushAll();
                        router.post(logout().url);
                    }}
                    aria-label="Log out"
                >
                    <LogOut />
                </button>
            </header>

            <main className="salesman-portal__content">{children}</main>
            <SalesmanPwaControls publicKey={props.pwa.pushPublicKey} />

            <nav className="salesman-portal__nav" aria-label="Salesman navigation">
                {links.map(({ label, href, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={url.startsWith(href) ? 'is-active' : ''}
                    >
                        <Icon />
                        <span>{label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
}
