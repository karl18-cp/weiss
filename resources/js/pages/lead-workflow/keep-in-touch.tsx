import LeadsShop, { type LeadsShopProps } from './leads-shop';

export default function KeepInTouch(props: LeadsShopProps) {
    return (
        <LeadsShop
            {...props}
            queue={{
                title: 'Keep in Touch',
                description: 'Manage ongoing lead follow-ups.',
                status: 'kit',
                listTitle: 'Keep in Touch leads',
                dateLabel: 'Scheduled calls',
                dateField: 'appointment_at',
                statusFilters: [
                    ['kit', 'KIT'],
                    ['kit_ng', 'NG'],
                    ['kit_toss', 'TOSS'],
                    ['kit_cb', 'Call Back'],
                ],
            }}
        />
    );
}
