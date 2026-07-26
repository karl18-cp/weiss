import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function ConfirmLeads(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "Confirm Leads",
        description:
          "Verify the customer, project, and appointment details before dispatch.",
        status: "confirmed",
        listTitle: "Waiting for confirmation",
        dateLabel: "Appointment dates",
        dateField: "appointment_at",
      }}
    />
  );
}
