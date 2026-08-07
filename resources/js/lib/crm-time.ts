export const CRM_TIME_ZONE = 'America/Los_Angeles';

export const crmDateKey = (value: Date | string = new Date()): string => {
    const date = value instanceof Date ? value : new Date(value);

    return new Intl.DateTimeFormat('en-CA', {
        timeZone: CRM_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
};

export const crmDateTimeFormatter = (
    options: Intl.DateTimeFormatOptions = {},
    locale = 'en-US',
) =>
    new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: CRM_TIME_ZONE,
    });
