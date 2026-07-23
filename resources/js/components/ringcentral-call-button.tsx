import { useState } from 'react';
import type { ReactNode } from 'react';

type RingCentralCallButtonProps = {
    phone: string;
    leadId?: number;
    children: ReactNode;
    className?: string;
    title?: string;
};

export function RingCentralCallButton({
    phone,
    leadId,
    children,
    className,
    title = 'Call with RingCentral',
}: RingCentralCallButtonProps) {
    const [opening, setOpening] = useState(false);

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

    const trackCall = async () => {
        if (!leadId) return true;

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
                body: JSON.stringify({ phone }),
            },
        );

        if (response.ok) {
            window.dispatchEvent(
                new CustomEvent('weiss:ringcentral-call-tracked', {
                    detail: { leadId },
                }),
            );
        }

        return response.ok;
    };

    const startCall = async () => {
        if (opening) {
            return;
        }

        setOpening(true);
        try {
            if (!(await trackCall())) {
                window.alert(
                    'The call could not be linked to this lead. Please try again.',
                );
                return;
            }
        } catch {
            window.alert(
                'The call could not be linked to this lead. Please check your connection and try again.',
            );
            return;
        } finally {
            setOpening(false);
        }

        if (!callWithRingCentral()) {
            setOpening(true);

            window.setTimeout(() => {
                setOpening(false);

                if (callWithRingCentral()) {
                    return;
                }

                window.alert(
                    'The RingCentral browser phone is still loading. Please try again in a moment.',
                );
            }, 1200);

            return;
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
