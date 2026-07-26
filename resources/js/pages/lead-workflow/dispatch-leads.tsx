import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function DispatchLeads(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "Dispatch Leads",
        description:
          "Assign the salesman and send the confirmed appointment details.",
        status: "dispatched",
        listTitle: "Waiting for dispatch",
        dateLabel: "Appointment dates",
        dateField: "appointment_at",
      }}
    />
  );
}
