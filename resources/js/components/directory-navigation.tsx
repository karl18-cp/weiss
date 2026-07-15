import { Link } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import '@/../css/directory-navigation.css';

const directoryTypes = [
    'Salesman',
    'Agent',
    'Contractor',
    'Managers',
    'All',
    'Companies',
    'Products',
] as const;

export type DirectoryType = (typeof directoryTypes)[number];

const links: Partial<Record<DirectoryType, string>> = {
    Salesman: '/management/salesmen',
    Agent: '/management/agents',
    Contractor: '/management/contractors',
    Managers: '/management/managers',
    All: '/management/directory',
    Companies: '/management/contacts-users',
    Products: '/management/products',
};

export default function DirectoryNavigation({
    active,
    children,
}: PropsWithChildren<{ active: DirectoryType }>) {
    return (
        <aside className="directory-navigation">
            <div className="directory-status" aria-label="Directory status">
                <button
                    type="button"
                    className="directory-status__button directory-status__button--active"
                >
                    Active
                </button>
                <button type="button" className="directory-status__button">
                    Archive
                </button>
            </div>

            <div className="directory-navigation__content">{children}</div>

            <nav
                className="directory-types"
                aria-label="Contact and user types"
            >
                {directoryTypes.map((type) => {
                    const className =
                        type === active
                            ? 'directory-type directory-type--active'
                            : 'directory-type';
                    const href = links[type];

                    return href ? (
                        <Link key={type} href={href} className={className}>
                            {type}
                        </Link>
                    ) : (
                        <button type="button" key={type} className={className}>
                            {type}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
