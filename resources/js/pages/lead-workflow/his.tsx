import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function HIS(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: 'HIS',
                description: 'Manage leads waiting in the HIS queue.',
                status: 'his',
                listTitle: 'Waiting for HIS',
                dateLabel: 'Appointment dates',
                dateField: 'appointment_at',
            }}
        />
    );
}
