import { Bell, BellOff, Download } from 'lucide-react';
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

export default function SalesmanPwaControls({
    publicKey,
}: {
    publicKey: string | null;
}) {
    const [installPrompt, setInstallPrompt] =
        useState<InstallPromptEvent | null>(null);
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.register('/sw.js').then(async (registration) => {
            setSubscribed(Boolean(await registration.pushManager.getSubscription()));
        });

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
            await installPrompt.userChoice;
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

            await fetch('/salesman/push-subscriptions', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify(subscription.toJSON()),
            });
            await fetch('/salesman/push-subscriptions/test', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
            });

            setSubscribed(true);
            setMessage('Notifications enabled on this phone.');
        } finally {
            setBusy(false);
        }
    };

    const disableNotifications = async () => {
        setBusy(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await fetch('/salesman/push-subscriptions', {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken(),
                    },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
                await subscription.unsubscribe();
            }
            setSubscribed(false);
            setMessage('Notifications disabled on this phone.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="salesman-pwa">
            <button type="button" onClick={install}>
                <Download />
                Install app
            </button>
            <button
                type="button"
                disabled={busy}
                onClick={subscribed ? disableNotifications : enableNotifications}
            >
                {subscribed ? <BellOff /> : <Bell />}
                {subscribed ? 'Disable alerts' : 'Enable alerts'}
            </button>
            {message && <p>{message}</p>}
        </div>
    );
}
