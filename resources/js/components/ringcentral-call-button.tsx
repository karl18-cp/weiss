import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSystemModal } from '@/components/system-modal-provider';

type RingCentralCallButtonProps = {
    phone: string;
    phoneSlot:
        | 'primary'
        | 'secondary'
        | 'mobile'
        | 'salesman_1'
        | 'salesman_2';
    leadId?: number;
    children: ReactNode;
    className?: string;
    title?: string;
};

type PreparedCall = {
    dial_mode: 'browser_widget';
    phone?: string;
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
    const { notify } = useSystemModal();
    const callWithRingCentral = (dialPhone = phone) => {
        if (typeof window.RCAdapter?.clickToCall === 'function') {
            window.RCAdapter.clickToCall(dialPhone, true);

            return true;
        }

        const frame = document.querySelector<HTMLIFrameElement>(
            '#rc-widget-adapter-frame',
        );

        if (frame?.contentWindow) {
            frame.contentWindow.postMessage(
                {
                    type: 'rc-adapter-new-call',
                    phoneNumber: dialPhone,
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
        let dialPhone = phone;
        try {
            const call = await prepareCall();
            dialPhone = call.phone ?? phone;
        } catch (error) {
            notify({
                title: 'Call could not be started',
                message:
                    error instanceof Error
                        ? error.message
                        : 'The call could not be started. Please check your connection and try again.',
                tone: 'error',
            });

            return;
        } finally {
            setOpening(false);
        }

        if (!callWithRingCentral(dialPhone)) {
            setOpening(true);
            window.setTimeout(() => {
                setOpening(false);

                if (!callWithRingCentral(dialPhone)) {
                    notify({
                        title: 'RingCentral is still loading',
                        message:
                            'The RingCentral browser phone is still loading. Please try again in a moment.',
                        tone: 'warning',
                    });
                }
            }, 1200);
        }
    };

    return (
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
    );
}
