import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function Rehash(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: 'Rehash Leads',
                description: 'Manage leads in the rehash workflow.',
                status: 'rehash',
                listTitle: 'Rehash leads',
                dateLabel: 'Scheduled calls',
                dateField: 'appointment_at',
                statusFilters: [
                    ['rehash', 'Rehash'],
                    ['rehash_ng', 'NG'],
                    ['rehash_toss', 'TOSS'],
                    ['rehash_cb', 'Call Back'],
                ],
            }}
        />
    );
}
