import { useState } from 'react';
import type { ReactNode } from 'react';

type RingCentralCallButtonProps = {
    phone: string;
    children: ReactNode;
    className?: string;
    title?: string;
};

export function RingCentralCallButton({
    phone,
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

    const startCall = () => {
        if (opening) {
            return;
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
