import { Bell, Download } from 'lucide-react';
import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const csrfToken = () =>
    document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content') ?? '';

const decodeKey = (value: string) => {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const raw = atob((value + padding).replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
};

const isRunningAsInstalledApp = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(
        (navigator as Navigator & { standalone?: boolean }).standalone,
    );

export default function SalesmanPwaControls({
    publicKey,
}: {
    publicKey: string | null;
}) {
    const [installPrompt, setInstallPrompt] =
        useState<InstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isRunningAsInstalledApp);
    const [subscribed, setSubscribed] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            setSubscribed(false);
            return;
        }

        navigator.serviceWorker
            .register('/sw.js')
            .then(async (registration) => {
                setSubscribed(
                    Boolean(await registration.pushManager.getSubscription()),
                );
            })
            .catch(() => setSubscribed(false));

        const capturePrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as InstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', capturePrompt);

        return () =>
            window.removeEventListener('beforeinstallprompt', capturePrompt);
    }, []);

    const install = async () => {
        if (installPrompt) {
            await installPrompt.prompt();
            const choice = await installPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                setInstalled(true);
            }
            setInstallPrompt(null);
            return;
        }

        setMessage(
            /iphone|ipad|ipod/i.test(navigator.userAgent)
                ? 'On iPhone: tap Share, then Add to Home Screen.'
                : 'Open your browser menu and choose Install app or Add to Home screen.',
        );
    };

    const enableNotifications = async () => {
        if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setMessage('Push notifications are not supported in this browser.');
            return;
        }

        setBusy(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setMessage('Notifications were not allowed.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const subscription =
                (await registration.pushManager.getSubscription()) ??
                (await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: decodeKey(publicKey),
                }));

            const response = await fetch('/salesman/push-subscriptions', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify(subscription.toJSON()),
            });
            if (!response.ok) {
                throw new Error(
                    `The phone could not be registered (${response.status}).`,
                );
            }

            const testResponse = await fetch('/salesman/push-subscriptions/test', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
            });
            if (!testResponse.ok) {
                throw new Error(
                    `The test notification could not be sent (${testResponse.status}).`,
                );
            }

            setSubscribed(true);
            setMessage('Notifications enabled on this phone.');
        } catch (error) {
            setSubscribed(false);
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'This phone could not enable notifications.',
            );
        } finally {
            setBusy(false);
        }
    };

    if (subscribed === null || (installed && subscribed)) {
        return null;
    }

    return (
        <div className="salesman-pwa">
            {!installed && (
                <button type="button" onClick={install}>
                    <Download />
                    Install app
                </button>
            )}
            {!subscribed && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={enableNotifications}
                >
                    <Bell />
                    Enable alerts
                </button>
            )}
            {message && <p>{message}</p>}
            {!subscribed && !message && (
                <p className="salesman-pwa__warning">
                    {installed
                        ? 'Phone alerts are off. Tap Enable alerts.'
                        : 'Phone alerts are off. Install the app, then tap Enable alerts.'}
                </p>
            )}
        </div>
    );
}
