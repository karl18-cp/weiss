import { Link, router, usePage } from '@inertiajs/react';
import { CalendarDays, CalendarClock, CircleDollarSign, FileText, LocateFixed, LogOut, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
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
    { label: 'My Follow Ups', href: '/salesman/follow-ups', icon: CalendarClock },
    { label: 'My Sold', href: '/salesman/sold', icon: CircleDollarSign },
    {
        label: 'Lead Information',
        href: '/salesman/lead-information',
        icon: FileText,
    },
];

const SALESMAN_IDLE_REFRESH_MS = 15 * 60 * 1000;
const SALESMAN_KEEP_ALIVE_MS = 2 * 60 * 1000;

export default function SalesmanLayout({ children }: PropsWithChildren) {
    const { url, props } = usePage<{
        auth: Auth;
        pwa: { pushPublicKey: string | null };
    }>();
    const username = props.auth.user.username ?? props.auth.user.email;
    const [sharingLocation, setSharingLocation] = useState(
        () => window.localStorage.getItem('salesman-live-location') === 'on',
    );
    const [locationMessage, setLocationMessage] = useState('');
    const watchId = useRef<number | null>(null);

    useEffect(() => {
        let lastActivityAt = Date.now();
        let refreshing = false;

        const keepSessionAlive = async () => {
            try {
                return await fetch('/salesman/session/keep-alive', {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                });
            } catch {
                return null;
            }
        };

        const recordActivity = () => {
            lastActivityAt = Date.now();
        };

        const refreshWhenIdle = async () => {
            if (refreshing || Date.now() - lastActivityAt < SALESMAN_IDLE_REFRESH_MS) return;
            refreshing = true;
            const response = await keepSessionAlive();
            if (response?.ok) {
                window.location.reload();
                return;
            }
            refreshing = false;
        };

        const activityEvents: (keyof WindowEventMap)[] = [
            'mousedown',
            'mousemove',
            'keydown',
            'scroll',
            'touchstart',
        ];
        activityEvents.forEach((event) =>
            window.addEventListener(event, recordActivity, { passive: true }),
        );

        void keepSessionAlive();
        const keepAliveTimer = window.setInterval(() => {
            void keepSessionAlive();
        }, SALESMAN_KEEP_ALIVE_MS);
        const idleTimer = window.setInterval(refreshWhenIdle, 5000);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') void refreshWhenIdle();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(keepAliveTimer);
            window.clearInterval(idleTimer);
            activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (!sharingLocation || !navigator.geolocation) return;

        const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        let lastSentAt = 0;
        watchId.current = navigator.geolocation.watchPosition(
            async ({ coords }) => {
                if (Date.now() - lastSentAt < 30000) return;
                lastSentAt = Date.now();
                try {
                    const response = await fetch('/salesman/location', {
                        method: 'PUT',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                        body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
                    });
                    if (!response.ok) throw new Error('Location update failed');
                    setLocationMessage('Live location shared');
                } catch {
                    setLocationMessage('Unable to update location');
                }
            },
            (error) => setLocationMessage(error.code === 1 ? 'Location permission denied' : 'Location unavailable'),
            { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
        );

        return () => {
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        };
    }, [sharingLocation]);

    const toggleLocation = () => {
        const enabled = !sharingLocation;
        window.localStorage.setItem('salesman-live-location', enabled ? 'on' : 'off');
        setSharingLocation(enabled);
        setLocationMessage(enabled ? 'Requesting location…' : 'Location sharing paused');
    };

    return (
        <div className="salesman-portal">
            <header className="salesman-portal__header">
                <Link
                    href="/salesman/booking-board"
                    className="salesman-portal__brand"
                >
                    <img src="/images/weiss-logo.png" alt="WEISS" />
                    <span>
                        <strong>Weiss Sales</strong>
                        <small>{username}</small>
                    </span>
                </Link>
                <button
                    className={`salesman-location-toggle ${sharingLocation ? 'is-sharing' : ''}`}
                    type="button"
                    onClick={toggleLocation}
                    title={locationMessage || (sharingLocation ? 'Live location is on' : 'Share live location')}
                >
                    <LocateFixed />
                    <span>{sharingLocation ? 'Location on' : 'Share location'}</span>
                </button>
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

            <nav
                className="salesman-portal__nav"
                aria-label="Salesman navigation"
            >
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
