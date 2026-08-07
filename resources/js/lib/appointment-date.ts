const CRM_TIMEZONE = 'America/Los_Angeles';

type AppointmentParts = {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
};

const hasExplicitTimezone = (value: string): boolean =>
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const appointmentParts = (value: string): AppointmentParts | null => {
    const match = value.match(
        /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/,
    );

    if (!match) return null;

    // Eloquent serializes datetime casts as UTC instants. Appointment values,
    // however, are California business wall times. Convert only serialized
    // values that carry an explicit zone; plain CallTools/CRM values must be
    // kept exactly as entered.
    if (hasExplicitTimezone(value)) {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            const parts = Object.fromEntries(
                new Intl.DateTimeFormat('en-US', {
                    timeZone: CRM_TIMEZONE,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hourCycle: 'h23',
                })
                    .formatToParts(date)
                    .filter((part) => part.type !== 'literal')
                    .map((part) => [part.type, part.value]),
            );

            return parts as AppointmentParts;
        }
    }

    return {
        year: match[1],
        month: match[2],
        day: match[3],
        hour: match[4],
        minute: match[5],
        second: match[6] ?? '00',
    };
};

/**
 * Appointment timestamps are California business wall times, not values that
 * should change with the viewer's browser timezone.
 */
export const appointmentDate = (value: string): Date => {
    const parts = appointmentParts(value);

    if (!parts) return new Date(value);

    return new Date(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
    );
};

export const appointmentDateKey = (value: string): string => {
    const parts = appointmentParts(value);

    if (parts) return `${parts.year}-${parts.month}-${parts.day}`;

    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const appointmentInputValue = (value: string): string => {
    const parts = appointmentParts(value);
    return parts
        ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
        : '';
};

export const formatAppointmentDate = (value: string): string =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(appointmentDate(value));
