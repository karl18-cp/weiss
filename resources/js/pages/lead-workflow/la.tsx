import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function LA(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: 'LA',
                description: 'Manage leads waiting in the LA queue.',
                status: 'la',
                listTitle: 'Waiting for LA',
                dateLabel: 'Appointment dates',
                dateField: 'appointment_at',
            }}
        />
    );
}
