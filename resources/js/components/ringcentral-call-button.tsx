import { Phone, PhoneCall, PhoneOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import '../../css/ringcentral-dialer.css';

type RingCentralCallButtonProps = {
    phone: string;
    phoneSlot: 'primary' | 'secondary' | 'mobile';
    leadId?: number;
    children: ReactNode;
    className?: string;
    title?: string;
};

type PreparedCall = {
    dial_mode: 'secure_ringout';
    call_id?: string;
    display_phone?: string;
    message?: string;
    call_status?: string;
    caller_status?: string;
    callee_status?: string;
};

type CallPanel = {
    callId?: string;
    displayPhone: string;
    message: string;
    status: string;
    tone: 'active' | 'success' | 'error';
};

const finalStatuses = new Set([
    'Success',
    'Finished',
    'NoAnswer',
    'Busy',
    'Rejected',
    'GenericError',
]);

const statusTone = (status: string): CallPanel['tone'] => {
    if (['Success', 'Finished'].includes(status)) return 'success';
    if (
        ['NoAnswer', 'Busy', 'Rejected', 'GenericError', 'Failed'].includes(
            status,
        )
    ) {
        return 'error';
    }

    return 'active';
};

export function RingCentralCallButton({
    phoneSlot,
    leadId,
    children,
    className,
    title = 'Call with Weiss Secure Dialer',
}: RingCentralCallButtonProps) {
    const [opening, setOpening] = useState(false);
    const [callPanel, setCallPanel] = useState<CallPanel | null>(null);

    const prepareCall = async (): Promise<PreparedCall> => {
        if (!leadId) {
            throw new Error('This call must be connected to a saved lead.');
        }

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

    useEffect(() => {
        if (!callPanel?.callId || finalStatuses.has(callPanel.status)) return;

        const poll = window.setInterval(async () => {
            try {
                const response = await fetch(
                    `/integrations/ringcentral/calls/${encodeURIComponent(callPanel.callId!)}`,
                    {
                        credentials: 'same-origin',
                        headers: { Accept: 'application/json' },
                    },
                );
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) return;

                const status = payload.call_status ?? 'In progress';
                setCallPanel((current) =>
                    current
                        ? {
                              ...current,
                              status,
                              tone: statusTone(status),
                          }
                        : null,
                );

                if (finalStatuses.has(status)) window.clearInterval(poll);
            } catch {
                // A later poll will retry after a transient network failure.
            }
        }, 2500);

        return () => window.clearInterval(poll);
    }, [callPanel?.callId, callPanel?.status]);

    const startCall = async () => {
        if (opening) return;

        setOpening(true);
        try {
            const call = await prepareCall();
            const status = call.call_status ?? 'In progress';
            setCallPanel({
                callId: call.call_id,
                displayPhone: call.display_phone ?? '*******',
                message:
                    call.message ??
                    'Answer your configured phone to connect.',
                status,
                tone: statusTone(status),
            });
        } catch (error) {
            setCallPanel({
                displayPhone: 'Call not connected',
                message:
                    error instanceof Error
                        ? error.message
                        : 'The call could not be started. Please try again.',
                status: 'Failed',
                tone: 'error',
            });
        } finally {
            setOpening(false);
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
                title={opening ? 'Connecting call…' : title}
            >
                {children}
            </button>

            {callPanel && (
                <aside className="rc-dialer" role="status" aria-live="polite">
                    <header>
                        <div className="rc-dialer__brand">
                            <PhoneCall aria-hidden="true" />
                            Weiss Secure Dialer
                        </div>
                        <button
                            type="button"
                            onClick={() => setCallPanel(null)}
                            aria-label="Close call panel"
                        >
                            <X aria-hidden="true" />
                        </button>
                    </header>

                    <div
                        className={`rc-dialer__status rc-dialer__status--${callPanel.tone}`}
                    >
                        <span className="rc-dialer__status-icon">
                            {callPanel.tone === 'error' ? (
                                <PhoneOff aria-hidden="true" />
                            ) : (
                                <Phone aria-hidden="true" />
                            )}
                        </span>
                        <div>
                            <strong>{callPanel.displayPhone}</strong>
                            <p>{callPanel.message}</p>
                        </div>
                    </div>

                    <footer>
                        <span>RingCentral connection</span>
                        <strong>{callPanel.status}</strong>
                    </footer>
                </aside>
            )}
        </>
    );
}
