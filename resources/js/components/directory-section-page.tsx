import { Head } from '@inertiajs/react';
import { Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import '@/../css/directory-section-page.css';
import DirectoryNavigation, {
    type DirectoryType,
} from '@/components/directory-navigation';

type Props = {
    active: DirectoryType;
    title: string;
    description: string;
};

export default function DirectorySectionPage({
    active,
    title,
    description,
}: Props) {
    const [search, setSearch] = useState('');

    return (
        <>
            <Head title={title} />
            <main className="directory-section-page">
                <header className="directory-section-header">
                    <span>Contacts &amp; Users</span>
                    <h1>{title}</h1>
                    <p>{description}</p>
                </header>

                <section className="directory-section-count">
                    <div>
                        <Users />
                    </div>
                    <span>
                        <strong>0</strong>
                        <small>Total {title.toLowerCase()}</small>
                    </span>
                </section>

                <div className="directory-section-workspace">
                    <DirectoryNavigation active={active}>
                        <div className="directory-section-heading">
                            <h2>{title} directory</h2>
                            <p>Select a record to edit</p>
                        </div>
                        <label className="directory-section-search">
                            <Search />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder={`Search ${title.toLowerCase()}`}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Clear search"
                                >
                                    <X />
                                </button>
                            )}
                        </label>
                        <div className="directory-section-list directory-navigation__scroll-list">
                            <Users />
                            <strong>No records yet</strong>
                            <span>
                                This section is ready for its fields and
                                database table.
                            </span>
                        </div>
                    </DirectoryNavigation>

                    <section className="directory-section-content">
                        <h2>{title}</h2>
                        <p>The {title.toLowerCase()} form will appear here.</p>
                    </section>
                </div>
            </main>
        </>
    );
}
