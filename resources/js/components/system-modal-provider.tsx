import { router } from '@inertiajs/react';
import {
    CheckCircle2,
    CircleAlert,
    CircleX,
    Info,
    TriangleAlert,
} from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import '@/../css/system-modal.css';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { FlashToast } from '@/types/ui';

type ModalTone = FlashToast['type'] | 'danger';

type ConfirmationOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ModalTone;
};

type NotificationOptions = {
    title?: string;
    message: string;
    buttonLabel?: string;
    tone?: ModalTone;
};

type ModalState = {
    mode: 'confirm' | 'notification';
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    tone: ModalTone;
};

type SystemModalContextValue = {
    confirm: (options: ConfirmationOptions) => Promise<boolean>;
    notify: (options: NotificationOptions) => void;
};

const SystemModalContext = createContext<SystemModalContextValue | null>(null);

const defaultTitles: Record<ModalTone, string> = {
    success: 'Success',
    info: 'Information',
    warning: 'Attention required',
    error: 'Something went wrong',
    danger: 'Confirm action',
};

const toneIcons = {
    success: CheckCircle2,
    info: Info,
    warning: TriangleAlert,
    error: CircleX,
    danger: CircleAlert,
};

export function SystemModalProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [modal, setModal] = useState<ModalState | null>(null);
    const resolver = useRef<((confirmed: boolean) => void) | null>(null);

    const finish = useCallback((confirmed: boolean) => {
        resolver.current?.(confirmed);
        resolver.current = null;
        setModal(null);
    }, []);

    const confirm = useCallback((options: ConfirmationOptions) => {
        return new Promise<boolean>((resolve) => {
            resolver.current?.(false);
            resolver.current = resolve;
            setModal({
                mode: 'confirm',
                title: options.title,
                message: options.message,
                confirmLabel: options.confirmLabel ?? 'Confirm',
                cancelLabel: options.cancelLabel ?? 'Cancel',
                tone: options.tone ?? 'warning',
            });
        });
    }, []);

    const notify = useCallback((options: NotificationOptions) => {
        resolver.current?.(false);
        resolver.current = null;
        const tone = options.tone ?? 'info';
        setModal({
            mode: 'notification',
            title: options.title ?? defaultTitles[tone],
            message: options.message,
            confirmLabel: options.buttonLabel ?? 'OK',
            tone,
        });
    }, []);

    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (data) {
                notify({ message: data.message, tone: data.type });
            }
        });
    }, [notify]);

    const ToneIcon = modal ? toneIcons[modal.tone] : Info;

    return (
        <SystemModalContext.Provider value={{ confirm, notify }}>
            {children}
            <Dialog
                open={modal !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        finish(false);
                    }
                }}
            >
                {modal && (
                    <DialogContent className="system-modal">
                        <DialogHeader className="system-modal__header">
                            <span
                                className={`system-modal__icon system-modal__icon--${modal.tone}`}
                            >
                                <ToneIcon />
                            </span>
                            <div>
                                <DialogTitle>{modal.title}</DialogTitle>
                                <DialogDescription>
                                    {modal.message}
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                        <DialogFooter className="system-modal__footer">
                            {modal.mode === 'confirm' && (
                                <button
                                    type="button"
                                    className="system-modal__cancel"
                                    onClick={() => finish(false)}
                                >
                                    {modal.cancelLabel}
                                </button>
                            )}
                            <button
                                type="button"
                                className={`system-modal__confirm system-modal__confirm--${modal.tone}`}
                                onClick={() => finish(true)}
                            >
                                {modal.confirmLabel}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </SystemModalContext.Provider>
    );
}

export function useSystemModal(): SystemModalContextValue {
    const context = useContext(SystemModalContext);

    if (!context) {
        throw new Error(
            'useSystemModal must be used within SystemModalProvider.',
        );
    }

    return context;
}
