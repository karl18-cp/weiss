import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    FolderKanban,
    LayoutDashboard,
    Menu,
    PhoneCall,
    Sparkles,
    UsersRound,
    X,
} from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { dashboard, login } from '@/routes';
import '../../css/welcome.css';

const workflow = [
    { number: '01', icon: PhoneCall, title: 'Capture every opportunity', text: 'Bring calls, leads, appointments, and follow-ups into one focused workspace.' },
    { number: '02', icon: ClipboardCheck, title: 'Move work forward', text: 'Give every lead a clear owner, next action, and visible place in your pipeline.' },
    { number: '03', icon: FolderKanban, title: 'Run projects with context', text: 'Carry the complete customer story from first conversation through production.' },
    { number: '04', icon: BarChart3, title: 'Know what is working', text: 'See the activity, performance, and financial signals that drive better decisions.' },
];

export default function Welcome() {
    const { auth } = usePage().props;
    const [menuOpen, setMenuOpen] = useState(false);

    const moveScene = (event: MouseEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        event.currentTarget.style.setProperty('--scene-x', `${x * 7}deg`);
        event.currentTarget.style.setProperty('--scene-y', `${y * -6}deg`);
    };

    const appHref = auth.user ? dashboard() : login();

    return (
        <div className="weiss-landing">
            <Head title="WEISS | Contractor Command Center">
                <meta name="description" content="WEISS brings contractor leads, appointments, projects, and performance into one connected command center." />
            </Head>

            <header className="landing-nav">
                <a className="brand" href="#top" aria-label="WEISS home">
                    <span className="brand-mark"><span>W</span></span>
                    <span className="brand-word">WEISS<small>Contractor command center</small></span>
                </a>
                <nav className={menuOpen ? 'nav-links is-open' : 'nav-links'} aria-label="Main navigation">
                    <a href="#workflow" onClick={() => setMenuOpen(false)}>Workflow</a>
                    <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
                    <a href="#results" onClick={() => setMenuOpen(false)}>Results</a>
                    <Link className="nav-login mobile-only" href={appHref}>Enter CRM <ArrowRight size={16} /></Link>
                </nav>
                <Link className="nav-login desktop-login" href={appHref}>{auth.user ? 'Open dashboard' : 'Enter CRM'} <ArrowRight size={16} /></Link>
                <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button>
            </header>

            <main id="top">
                <section className="hero-section">
                    <div className="hero-grid" aria-hidden="true" />
                    <div className="hero-copy">
                        <div className="eyebrow"><Sparkles size={14} /> Built for the way contractors work</div>
                        <h1>Run leads.<br />Build projects.<br /><span>Grow with clarity.</span></h1>
                        <p>WEISS connects your front office, field operations, and financial workflow in one intelligent command center—so your team always knows what happens next.</p>
                        <div className="hero-actions">
                            <Link className="primary-cta" href={appHref}>{auth.user ? 'Open your dashboard' : 'Enter the CRM'} <ArrowRight size={18} /></Link>
                            <a className="secondary-cta" href="#workflow">Explore the workflow <ChevronRight size={17} /></a>
                        </div>
                        <div className="hero-proof">
                            <span><CheckCircle2 /> One connected customer record</span>
                            <span><CheckCircle2 /> Built around real operations</span>
                        </div>
                    </div>

                    <div className="scene-wrap" onMouseMove={moveScene} onMouseLeave={(e) => { e.currentTarget.style.setProperty('--scene-x', '0deg'); e.currentTarget.style.setProperty('--scene-y', '0deg'); }}>
                        <div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" />
                        <div className="dashboard-scene">
                            <div className="scene-topbar"><div className="scene-brand"><span>W</span> WEISS</div><div className="scene-search" /><div className="scene-user">CP</div></div>
                            <div className="scene-body">
                                <aside><i /><i /><i /><i /><i /></aside>
                                <div className="scene-main">
                                    <div className="scene-heading"><div><small>COMMAND CENTER</small><strong>Good morning, Chris.</strong></div><button>+ New lead</button></div>
                                    <div className="metric-row">
                                        <div><small>ACTIVE LEADS</small><strong>248</strong><em>+12.4%</em></div>
                                        <div><small>APPOINTMENTS</small><strong>36</strong><em>This week</em></div>
                                        <div><small>PROJECT VALUE</small><strong>$1.28M</strong><em>In pipeline</em></div>
                                    </div>
                                    <div className="scene-panels">
                                        <div className="pipeline-panel"><small>LEAD PIPELINE</small><div className="bars"><i /><i /><i /><i /><i /><i /><i /></div><div className="bar-line" /></div>
                                        <div className="activity-panel"><small>RECENT ACTIVITY</small><p><b>AM</b><span>Appointment confirmed<em>2m ago</em></span></p><p><b>JP</b><span>Project moved to production<em>18m ago</em></span></p><p><b>SL</b><span>New lead assigned<em>31m ago</em></span></p></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="float-card float-lead"><span className="pulse-dot" /><div><small>NEW OPPORTUNITY</small><strong>Foundation inspection</strong><em>Los Angeles, CA</em></div></div>
                        <div className="float-card float-progress"><small>MONTHLY TARGET</small><strong>84%</strong><span><i /></span></div>
                    </div>
                </section>

                <section className="signal-strip" aria-label="Platform highlights">
                    <p>ONE OPERATING SYSTEM FOR</p><span>Lead management</span><i /><span>Scheduling</span><i /><span>Production</span><i /><span>Accounting</span><i /><span>Team performance</span>
                </section>

                <section className="workflow-section" id="workflow">
                    <div className="section-heading"><div><span className="section-kicker">THE WEISS WORKFLOW</span><h2>From first call to final payment,<br /><em>nothing gets lost.</em></h2></div><p>Replace scattered tools and disconnected handoffs with one clear operating rhythm for your entire team.</p></div>
                    <div className="workflow-grid">{workflow.map(({ number, icon: Icon, title, text }) => <article key={number}><div className="workflow-icon"><Icon /></div><span>{number}</span><h3>{title}</h3><p>{text}</p><div className="card-arrow"><ArrowRight /></div></article>)}</div>
                </section>

                <section className="platform-section" id="platform">
                    <div className="platform-intro"><span className="section-kicker">YOUR DAILY COMMAND CENTER</span><h2>Every signal your business needs. <em>One place to act.</em></h2><p>WEISS turns daily activity into a live picture of your operation—without forcing your team to stitch it together.</p></div>
                    <div className="bento-grid">
                        <article className="bento bento-large"><div className="bento-copy"><LayoutDashboard /><span>LIVE PIPELINE</span><h3>See the whole operation without chasing updates.</h3><p>Follow every lead and project through a visual workflow your team can trust.</p></div><div className="mini-board"><div><small>NEW LEADS</small><b>12</b><p /><p /><p /></div><div><small>CONFIRMED</small><b>8</b><p /><p /></div><div><small>PRODUCTION</small><b>5</b><p /><p /><p /></div></div></article>
                        <article className="bento bento-tall"><UsersRound /><span>ONE CUSTOMER STORY</span><h3>Context that follows the work.</h3><p>Calls, notes, appointments, documents, and project details stay connected from beginning to end.</p><div className="contact-stack"><i>KC</i><i>AM</i><i>JR</i><i>+24</i></div></article>
                        <article className="bento bento-small"><BarChart3 /><span>REAL-TIME SIGNALS</span><h3>Decisions backed by what is happening now.</h3><div className="spark-bars"><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
                        <article className="bento bento-wide"><div><ClipboardCheck /><span>BUILT-IN ACCOUNTABILITY</span><h3>Clear ownership. Clear next steps.</h3></div><ul><li><CheckCircle2 /> Lead assigned to Carla</li><li><CheckCircle2 /> Appointment confirmed</li><li><CheckCircle2 /> Estimate follow-up due today</li></ul></article>
                    </div>
                </section>

                <section className="results-section" id="results">
                    <div><span className="section-kicker">DESIGNED TO COMPOUND</span><h2>Less chasing.<br />More building.</h2><p>Your team moves faster when the next step is visible, the context is complete, and the system reflects how the work actually gets done.</p></div>
                    <div className="result-list"><p><strong>01</strong><span><b>Faster handoffs</b>Everyone works from the same customer and project record.</span></p><p><strong>02</strong><span><b>Stronger follow-through</b>Owners, tasks, and deadlines stay visible.</span></p><p><strong>03</strong><span><b>Better business control</b>Leaders see bottlenecks before they become expensive.</span></p></div>
                </section>

                <section className="final-cta"><div className="cta-glow" /><span className="section-kicker">YOUR NEXT PROJECT STARTS HERE</span><h2>Put your whole operation<br /><em>in motion.</em></h2><p>Enter the WEISS command center and turn every lead, handoff, and project into forward progress.</p><Link href={appHref}>{auth.user ? 'Open dashboard' : 'Enter the CRM'} <ArrowRight /></Link></section>
            </main>

            <footer><a className="brand" href="#top"><span className="brand-mark"><span>W</span></span><span className="brand-word">WEISS<small>Contractor command center</small></span></a><p>Built to move contractor businesses forward.</p><span>© {new Date().getFullYear()} WEISS</span></footer>
        </div>
    );
}
