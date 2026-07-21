import { Link } from '@inertiajs/react';
import { BarChart3, CheckCircle2, FolderKanban, ShieldCheck, X } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import '@/../css/auth-login.css';
import WeissBrand from '@/components/auth/weiss-brand';
import { home } from '@/routes';

export default function AuthLoginLayout({ children }: PropsWithChildren) {
    return (
        <main className="auth-login-page">
            <div className="auth-login-ambient auth-login-ambient--one" />
            <div className="auth-login-ambient auth-login-ambient--two" />
            <section className="auth-login-card">
                <aside className="auth-login-showcase">
                    <div className="auth-showcase-grid" />
                    <div className="auth-showcase-top">
                        <WeissBrand />
                        <span>CONTRACTOR COMMAND CENTER</span>
                    </div>
                    <div className="auth-showcase-copy">
                        <span className="auth-showcase-kicker">ONE CONNECTED OPERATION</span>
                        <h2>Everything your team needs to <em>move work forward.</em></h2>
                        <p>Leads, appointments, production, and performance—organized around the way your business actually runs.</p>
                    </div>
                    <div className="auth-showcase-dashboard" aria-hidden="true">
                        <div className="auth-dash-head"><span><i>W</i> WEISS</span><b>LIVE</b></div>
                        <div className="auth-dash-metrics"><p><small>ACTIVE LEADS</small><strong>248</strong><em>+12.4%</em></p><p><small>APPOINTMENTS</small><strong>36</strong><em>This week</em></p><p><small>PROJECT VALUE</small><strong>$1.28M</strong><em>Pipeline</em></p></div>
                        <div className="auth-dash-body"><div><small>WORKFLOW</small><span><i /><i /><i /><i /><i /></span></div><ul><li><CheckCircle2 /> Lead assigned</li><li><CheckCircle2 /> Appointment confirmed</li><li><CheckCircle2 /> Project moved forward</li></ul></div>
                    </div>
                    <div className="auth-showcase-points"><span><FolderKanban /> Connected workflows</span><span><BarChart3 /> Live business signals</span></div>
                </aside>

                <section className="auth-login-panel">
                    <header className="auth-login-header">
                        <div className="auth-login-header__bar">
                            <div className="auth-mobile-brand"><WeissBrand /></div>
                            <Link href={home()} className="auth-login-close" aria-label="Close login"><X className="size-5" strokeWidth={2.4} /></Link>
                        </div>
                        <span className="auth-login-eyebrow">SECURE WORKSPACE ACCESS</span>
                        <h1 className="auth-login-title">Welcome back</h1>
                        <p className="auth-login-description">Sign in to continue to your WEISS workspace.</p>
                    </header>
                    <div className="auth-login-content">{children}</div>
                    <footer className="auth-login-footer"><ShieldCheck /> Protected workspace · Authorized users only</footer>
                </section>
            </section>
        </main>
    );
}
