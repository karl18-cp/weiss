export const zillowSearchUrl = (parts: Array<string | null | undefined>) => {
    const slug = parts
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `https://www.zillow.com/homes/${slug}_rb/`;
};
