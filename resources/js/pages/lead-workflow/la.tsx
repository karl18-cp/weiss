import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function LA(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "LA",
        description:
          "Review LA leads, document the latest outcome, and schedule the next action.",
        status: "la",
        listTitle: "Waiting for LA",
        dateLabel: "LA dates",
        dateField: "appointment_at",
      }}
    />
  );
}
