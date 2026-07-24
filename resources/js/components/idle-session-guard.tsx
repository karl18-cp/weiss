import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { logout } from '@/routes';

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'weiss:last-activity';

export default function IdleSessionGuard() {
    useEffect(() => {
        let loggingOut = false;
        let lastRecorded = 0;

        const recordActivity = () => {
            const now = Date.now();
            if (now - lastRecorded < 1000) return;
            lastRecorded = now;
            window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        };

        const logOut = () => {
            if (loggingOut) return;
            loggingOut = true;
            window.localStorage.removeItem(LAST_ACTIVITY_KEY);
            router.post(
                logout().url,
                {},
                {
                    preserveState: false,
                    onFinish: () => {
                        router.flushAll();
                        window.location.replace('/login');
                    },
                },
            );
        };

        const checkIdleTime = () => {
            const lastActivity = Number(
                window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now(),
            );
            if (Date.now() - lastActivity >= IDLE_LIMIT_MS) logOut();
        };

        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) window.location.reload();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') checkIdleTime();
        };
        const activityEvents: (keyof WindowEventMap)[] = [
            'mousedown',
            'mousemove',
            'keydown',
            'scroll',
            'touchstart',
        ];

        recordActivity();
        activityEvents.forEach((event) =>
            window.addEventListener(event, recordActivity, { passive: true }),
        );
        window.addEventListener('pageshow', onPageShow);
        document.addEventListener('visibilitychange', onVisibilityChange);
        const timer = window.setInterval(checkIdleTime, 5000);

        return () => {
            window.clearInterval(timer);
            activityEvents.forEach((event) =>
                window.removeEventListener(event, recordActivity),
            );
            window.removeEventListener('pageshow', onPageShow);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    return null;
}
