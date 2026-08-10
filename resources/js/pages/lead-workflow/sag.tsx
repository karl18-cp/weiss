import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function Sag(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "SAG",
        description: "Review leads whose projects are completed or cancelled.",
        status: "project",
        listTitle: "Completed & cancelled projects",
        dateLabel: "Appointment dates",
        dateField: "appointment_at",
        sortDirection: "asc",
      }}
    />
  );
}
