import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function KeepInTouch(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "Keep in Touch",
        description:
          "Nurture future opportunities with scheduled follow-ups until they are ready.",
        status: "kit",
        listTitle: "Keep in Touch leads",
        dateLabel: "Scheduled calls",
        dateField: "appointment_at",
      }}
    />
  );
}
