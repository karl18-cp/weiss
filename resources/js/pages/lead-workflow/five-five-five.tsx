import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function FiveFiveFive(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: '555 Leads',
                description: 'Manage leads waiting in the 555 queue.',
                status: '555',
                listTitle: 'Waiting for 555',
                dateLabel: 'Appointment dates',
                dateField: 'appointment_at',
            }}
        />
    );
}
