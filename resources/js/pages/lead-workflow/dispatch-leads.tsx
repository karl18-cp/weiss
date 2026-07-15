import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function DispatchLeads(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: 'Dispatch Leads',
                description: 'Manage confirmed leads ready for dispatch.',
                status: 'dispatched',
                listTitle: 'Waiting for dispatch',
                dateLabel: 'Appointment dates',
                dateField: 'appointment_at',
            }}
        />
    );
}
