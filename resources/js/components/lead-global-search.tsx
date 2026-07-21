import { router } from '@inertiajs/react';
import { MapPin, Phone, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import '@/../css/lead-global-search.css';

type Result = { id: number; customer: string; phone: string | null; address: string; product: string | null; company: string | null; location: string; url: string };

export default function LeadGlobalSearch({ placeholder = 'Search customers, phone numbers, or addresses', className = '' }: { placeholder?: string; className?: string }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const requestId = useRef(0);

    useEffect(() => {
        const value = query.trim();
        if (value.length < 2) { setResults([]); setLoading(false); return; }
        const current = ++requestId.current;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(`/lead-search?q=${encodeURIComponent(value)}`, { headers: { Accept: 'application/json' } });
                const payload = response.ok ? await response.json() : { data: [] };
                if (current === requestId.current) { setResults(payload.data ?? []); setOpen(true); }
            } finally { if (current === requestId.current) setLoading(false); }
        }, 250);
        return () => window.clearTimeout(timer);
    }, [query]);

    const visit = (result: Result) => { setOpen(false); router.visit(result.url); };

    return <div className={`lead-global-search ${className}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <div className="lead-global-search__input"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => query.trim().length >= 2 && setOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) { event.preventDefault(); visit(results[0]); } if (event.key === 'Escape') setOpen(false); }} placeholder={placeholder} aria-label="Search leads" autoComplete="off" />{loading && <span className="lead-global-search__loading" />}</div>
        {open && <div className="lead-global-search__results">{results.map((result) => <button key={result.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => visit(result)}><span className="lead-global-search__avatar">{result.customer.charAt(0).toUpperCase()}</span><span className="lead-global-search__details"><strong>{result.customer}</strong><small>{result.phone && <span><Phone />{result.phone}</span>}{result.address && <span><MapPin />{result.address}</span>}</small>{(result.product || result.company) && <em>{[result.product, result.company].filter(Boolean).join(' · ')}</em>}</span><span className="lead-global-search__location">{result.location}</span></button>)}{!loading && results.length === 0 && <p>No accessible leads found.</p>}</div>}
    </div>;
}
