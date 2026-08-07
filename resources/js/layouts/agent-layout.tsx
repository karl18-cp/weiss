import { Link, router, usePage } from '@inertiajs/react';
import { Clock3, LogOut } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { logout } from '@/routes';
import type { Auth } from '@/types';
import '@/../css/agent-portal.css';

export default function AgentLayout({ children }: PropsWithChildren) {
    const { props } = usePage<{ auth: Auth }>();
    const username = props.auth.user.username ?? props.auth.user.email;

    return (
        <div className="agent-portal">
            <header className="agent-portal__header">
                <Link href="/agent/dashboard" className="agent-portal__brand">
                    <img src="/images/weiss-logo.png" alt="WEISS" />
                    <span>
                        <strong>Weiss Agent</strong>
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
            <main className="agent-portal__content">{children}</main>
            <nav className="agent-portal__nav" aria-label="Agent navigation">
                <Link href="/agent/dashboard" className="is-active">
                    <Clock3 />
                    <span>Time Clock</span>
                </Link>
            </nav>
        </div>
    );
}
