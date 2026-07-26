import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function Reschedule(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "Reschedule",
        description:
          "Follow up with customers who need a new appointment date or time.",
        status: "reschedule",
        listTitle: "Waiting for reschedule",
        dateLabel: "Scheduled calls",
        dateField: "appointment_at",
      }}
    />
  );
}
