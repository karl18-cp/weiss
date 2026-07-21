const appointmentParts = (value: string) =>
    value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);

/**
 * Appointment timestamps are business wall times, not UTC instants. Laravel's
 * JSON serialization adds a UTC suffix, so parse their components explicitly
 * to prevent the browser from adding the viewer's timezone offset.
 */
export const appointmentDate = (value: string): Date => {
    const parts = appointmentParts(value);

    if (!parts) return new Date(value);

    return new Date(
        Number(parts[1]),
        Number(parts[2]) - 1,
        Number(parts[3]),
        Number(parts[4]),
        Number(parts[5]),
        Number(parts[6] ?? 0),
    );
};

export const appointmentDateKey = (value: string): string => {
    const parts = appointmentParts(value);

    if (parts) return `${parts[1]}-${parts[2]}-${parts[3]}`;

    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const appointmentInputValue = (value: string): string => {
    const parts = appointmentParts(value);
    return parts ? `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}` : '';
};

export const formatAppointmentDate = (value: string): string =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(appointmentDate(value));
