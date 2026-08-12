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
        listTitle: "555 workflow",
        dateLabel: "Appointment dates",
        dateField: "appointment_at",
        statusFilters: [
          ["555", "ORA"],
          ["la", "LA"],
          ["ng", "NG"],
          ["toss", "TOSS"],
        ],
      }}
    />
  );
}
