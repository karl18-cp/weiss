export function formatPhoneNumber(value?: string | null): string {
    if (!value) return '—';

    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (trimmed.includes('*')) return trimmed;

    const digits = trimmed.replace(/\D/g, '');
    const national = digits.length === 11 && digits.startsWith('1')
        ? digits.slice(1)
        : digits;

    if (national.length !== 10) return trimmed;

    return `+1(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}