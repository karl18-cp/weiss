import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function Reschedule(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: 'Reschedule',
                description: 'Manage leads waiting for a new schedule.',
                status: 'reschedule',
                listTitle: 'Waiting for reschedule',
                dateLabel: 'Scheduled calls',
                dateField: 'appointment_at',
            }}
        />
    );
}
