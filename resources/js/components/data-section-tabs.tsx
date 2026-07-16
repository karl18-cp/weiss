import { Link } from '@inertiajs/react';
import { Search } from 'lucide-react';

const dataTabs = [
    { label: 'Vendor Invoices', href: '/lead-workflow/data/vendor-invoices' },
    { label: 'Proposals', href: null },
    { label: 'Contracts', href: null },
    { label: 'Payables', href: '/lead-workflow/data/payables' },
    { label: 'Receivables', href: '/lead-workflow/data/receivables' },
] as const;

type DataSection =
    'Tele Leads' | 'Vendor Invoices' | 'Payables' | 'Receivables' | 'Projects';

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
    return (
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
                    <span key={tab.label} className="lead-data-tab is-active">
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
                aria-label="Google Drive"
                title="Google Drive integration coming soon"
            >
                <DriveIcon />
            </button>
        </nav>
    );
}
