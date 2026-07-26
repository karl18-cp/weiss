import { useState } from 'react';
import type { ReactNode } from 'react';

type RingCentralCallButtonProps = {
    phone: string;
    phoneSlot: 'primary' | 'secondary' | 'mobile';
    leadId?: number;
    children: ReactNode;
    className?: string;
    title?: string;
};

type PreparedCall = {
    dial_mode: 'browser_widget' | 'secure_ringout';
    masked_phone?: string;
    message?: string;
    call_status?: string;
};

export function RingCentralCallButton({
    phone,
    phoneSlot,
    leadId,
    children,
    className,
    title = 'Call with RingCentral',
}: RingCentralCallButtonProps) {
    const [opening, setOpening] = useState(false);
    const [secureCall, setSecureCall] = useState<{
        maskedPhone: string;
        message: string;
        status: string;
    } | null>(null);

    const callWithRingCentral = () => {
        if (typeof window.RCAdapter?.clickToCall === 'function') {
            window.RCAdapter.clickToCall(phone, true);

            return true;
        }

        const frame = document.querySelector<HTMLIFrameElement>(
            '#rc-widget-adapter-frame',
        );

        if (frame?.contentWindow) {
            frame.contentWindow.postMessage(
                {
                    type: 'rc-adapter-new-call',
                    phoneNumber: phone,
                    toCall: true,
                },
                '*',
            );

            return true;
        }

        return false;
    };

    const prepareCall = async (): Promise<PreparedCall> => {
        if (!leadId) return { dial_mode: 'browser_widget' };

        const token = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');
        const response = await fetch(
            `/lead-workflow/leads-shop/${leadId}/ringcentral-calls`,
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({ phone_slot: phoneSlot }),
            },
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                payload.message ?? 'The call could not be started.',
            );
        }

        window.dispatchEvent(
            new CustomEvent('weiss:ringcentral-call-tracked', {
                detail: { leadId },
            }),
        );

        return payload;
    };

    const startCall = async () => {
        if (opening) return;

        setOpening(true);
        try {
            const call = await prepareCall();

            if (call.dial_mode === 'secure_ringout') {
                setSecureCall({
                    maskedPhone: call.masked_phone ?? '*******',
                    message:
                        call.message ??
                        'Answer your configured phone to connect.',
                    status: call.call_status ?? 'In progress',
                });

                return;
            }
        } catch (error) {
            window.alert(
                error instanceof Error
                    ? error.message
                    : 'The call could not be started. Please check your connection and try again.',
            );

            return;
        } finally {
            setOpening(false);
        }

        if (!callWithRingCentral()) {
            setOpening(true);
            window.setTimeout(() => {
                setOpening(false);

                if (!callWithRingCentral()) {
                    window.alert(
                        'The RingCentral browser phone is still loading. Please try again in a moment.',
                    );
                }
            }, 1200);
        }
    };

    return (
        <>
            <button
                type="button"
                className={className}
                onClick={startCall}
                disabled={opening}
                aria-label={title}
                title={opening ? 'Opening RingCentral…' : title}
            >
                {children}
            </button>

            {secureCall && (
                <div
                    className="fixed right-4 bottom-4 z-[100] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                    role="status"
                    aria-live="polite"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold tracking-wider text-blue-600 uppercase">
                                Secure RingCentral call
                            </p>
                            <p className="mt-1 text-lg font-bold text-slate-900">
                                {secureCall.maskedPhone}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSecureCall(null)}
                            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
                            aria-label="Close call panel"
                        >
                            ×
                        </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                        {secureCall.message}
                    </p>
                    <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                        Status: {secureCall.status}
                    </div>
                </div>
            )}
        </>
    );
}
