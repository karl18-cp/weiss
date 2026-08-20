import { Link } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import '@/../css/lead-data.css';

const dataTabs = [
    { label: 'Proposals', href: null },
    { label: 'Contracts', href: null },
    { label: 'Tele Report', href: '/lead-workflow/data/tele-hours' },
] as const;

type DataSection =
    | 'Tele Leads'
    | 'Tele Report'
    | 'Projects';

type DriveStatus = {
    configured: boolean;
    connected: boolean;
    status: 'connected' | 'error' | 'not_configured';
    folder?: { name: string };
    message: string;
    checkedAt: string;
};

function DriveIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#0f9d58" d="M8.1 3h4.2l4.2 7.3-2.1 3.6z" />
            <path fill="#f4b400" d="M12.3 3h4.2l6.3 10.9h-4.2z" />
            <path fill="#4285f4" d="M6 13.9h12.6L16.5 18H3.7z" />
            <path fill="#0f9d58" d="M8.1 3 2 13.9 4.2 18l6.1-10.9z" />
        </svg>
    );
}

export default function DataSectionTabs({
    active,
    onSearch,
}: {
    active: DataSection;
    onSearch?: () => void;
}) {
    const [driveOpen, setDriveOpen] = useState(false);
    const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
    const [checkingDrive, setCheckingDrive] = useState(false);

    const checkDrive = async () => {
        setDriveOpen(true);
        setCheckingDrive(true);

        try {
            const response = await fetch('/integrations/google-drive/status', {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            setDriveStatus((await response.json()) as DriveStatus);
        } catch {
            setDriveStatus({
                configured: true,
                connected: false,
                status: 'error',
                message:
                    'The CRM could not complete the Google Drive connection check.',
                checkedAt: new Date().toISOString(),
            });
        } finally {
            setCheckingDrive(false);
        }
    };

    return (
        <>
            <nav className="lead-data-tabs" aria-label="Data sections">
                {active === 'Tele Leads' ? (
                    <span className="lead-data-tab is-active">Tele Leads</span>
                ) : (
                    <Link href="/lead-workflow/data" className="lead-data-tab">
                        Tele Leads
                    </Link>
                )}
                {dataTabs.map((tab) =>
                    active === tab.label ? (
                        <span
                            key={tab.label}
                            className="lead-data-tab is-active"
                        >
                            {tab.label}
                        </span>
                    ) : tab.href ? (
                        <Link
                            key={tab.label}
                            href={tab.href}
                            className="lead-data-tab"
                        >
                            {tab.label}
                        </Link>
                    ) : (
                        <button
                            type="button"
                            key={tab.label}
                            className="lead-data-tab"
                            title={`${tab.label} coming soon`}
                        >
                            {tab.label}
                        </button>
                    ),
                )}
                {active === 'Projects' ? (
                    <span className="lead-data-tab is-active">Projects</span>
                ) : (
                    <Link href="/management/projects" className="lead-data-tab">
                        Projects
                    </Link>
                )}
                {onSearch ? (
                    <button
                        type="button"
                        className="lead-data-tab lead-data-tab--search"
                        onClick={onSearch}
                    >
                        <Search />
                        Search
                    </button>
                ) : (
                    <Link
                        href="/lead-workflow/data"
                        className="lead-data-tab lead-data-tab--search"
                    >
                        <Search />
                        Search
                    </Link>
                )}
                <button
                    type="button"
                    className="lead-data-drive"
                    aria-label="Check Google Drive sync status"
                    title="Check Google Drive sync status"
                    onClick={checkDrive}
                >
                    <DriveIcon />
                    <span>Drive status</span>
                    <i
                        className={driveStatus?.connected ? 'is-connected' : ''}
                        aria-hidden="true"
                    />
                </button>
            </nav>
            {driveOpen && (
                <div
                    className="drive-status-backdrop"
                    role="presentation"
                    onMouseDown={() => setDriveOpen(false)}
                >
                    <section
                        className="drive-status-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="drive-status-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="drive-status-close"
                            aria-label="Close Google Drive status"
                            onClick={() => setDriveOpen(false)}
                        >
                            <X />
                        </button>
                        <div className="drive-status-heading">
                            <DriveIcon />
                            <div>
                                <h2 id="drive-status-title">
                                    Google Drive sync
                                </h2>
                                <p>
                                    Live connection status for project file
                                    uploads.
                                </p>
                            </div>
                        </div>
                        {checkingDrive ? (
                            <div className="drive-status-result is-checking">
                                <RefreshCw className="is-spinning" />
                                <div>
                                    <strong>Checking connection…</strong>
                                    <span>
                                        Contacting Google Drive securely.
                                    </span>
                                </div>
                            </div>
                        ) : driveStatus ? (
                            <div
                                className={`drive-status-result ${driveStatus.connected ? 'is-success' : 'is-error'}`}
                            >
                                {driveStatus.connected ? (
                                    <CheckCircle2 />
                                ) : (
                                    <AlertCircle />
                                )}
                                <div>
                                    <strong>
                                        {driveStatus.connected
                                            ? 'Connected and ready'
                                            : 'Sync unavailable'}
                                    </strong>
                                    <span>{driveStatus.message}</span>
                                </div>
                            </div>
                        ) : null}
                        {driveStatus?.connected && (
                            <dl className="drive-status-details">
                                <div>
                                    <dt>Destination folder</dt>
                                    <dd>
                                        {driveStatus.folder?.name ??
                                            'Open projects'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Last checked</dt>
                                    <dd>
                                        {new Date(
                                            driveStatus.checkedAt,
                                        ).toLocaleString()}
                                    </dd>
                                </div>
                            </dl>
                        )}
                        <button
                            type="button"
                            className="drive-status-check"
                            onClick={checkDrive}
                            disabled={checkingDrive}
                        >
                            <RefreshCw
                                className={checkingDrive ? 'is-spinning' : ''}
                            />
                            {checkingDrive
                                ? 'Checking…'
                                : 'Test connection again'}
                        </button>
                    </section>
                </div>
            )}
        </>
    );
}
