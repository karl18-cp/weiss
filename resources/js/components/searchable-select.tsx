import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@/../css/searchable-select.css';

export type SearchableSelectOption = {
    value: string;
    label: string;
    keywords?: string;
};

export function SearchableSelect({
    value,
    options,
    onChange,
    placeholder = 'Select an option',
    searchPlaceholder = 'Search options…',
    disabled = false,
}: {
    value: string;
    options: SearchableSelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
}) {
    const root = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = options.find((option) => option.value === value);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) =>
            `${option.label} ${option.keywords ?? ''}`.toLowerCase().includes(needle),
        );
    }, [options, query]);

    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    useEffect(() => {
        if (open) requestAnimationFrame(() => input.current?.focus());
        else setQuery('');
    }, [open]);

    return (
        <div className="searchable-select" ref={root}>
            <button type="button" className="searchable-select__trigger" disabled={disabled} onClick={() => setOpen((current) => !current)}>
                <span className={selected ? '' : 'is-placeholder'}>{selected?.label ?? placeholder}</span>
                <ChevronDown />
            </button>
            {open && !disabled && (
                <div className="searchable-select__menu">
                    <label className="searchable-select__search">
                        <Search />
                        <input ref={input} value={query} placeholder={searchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
                        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X /></button>}
                    </label>
                    <div className="searchable-select__options">
                        {filtered.map((option) => (
                            <button key={option.value || '__empty'} type="button" className={option.value === value ? 'is-selected' : ''} onClick={() => { onChange(option.value); setOpen(false); }}>
                                <span>{option.label}</span>{option.value === value && <Check />}
                            </button>
                        ))}
                        {filtered.length === 0 && <p>No matching options</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
