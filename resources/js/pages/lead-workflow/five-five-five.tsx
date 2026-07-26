import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function FiveFiveFive(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "555 Leads",
        description:
          "Work the 555 follow-up queue and record every contact attempt.",
        status: "555",
        listTitle: "Waiting for 555",
        dateLabel: "Appointment dates",
        dateField: "appointment_at",
      }}
    />
  );
}
