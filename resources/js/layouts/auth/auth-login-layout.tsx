import { Link } from '@inertiajs/react';
import { X } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import '@/../css/auth-login.css';
import WeissBrand from '@/components/auth/weiss-brand';
import { home } from '@/routes';

export default function AuthLoginLayout({ children }: PropsWithChildren) {
    return (
        <main className="auth-login-page">
            <section className="auth-login-card">
                <header className="auth-login-header">
                    <div className="auth-login-header__bar">
                        <WeissBrand />

                        <Link
                            href={home()}
                            className="auth-login-close"
                            aria-label="Close login"
                        >
                            <X className="size-6 sm:size-8" strokeWidth={3} />
                        </Link>
                    </div>

                    <h1 className="auth-login-title">Welcome to WEISS</h1>
                    <p className="auth-login-description">
                        Login to your contractor CRM workspace.
                    </p>
                </header>

                <div className="auth-login-content">{children}</div>
            </section>
        </main>
    );
}
