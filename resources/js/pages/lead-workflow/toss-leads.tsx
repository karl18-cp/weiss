import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function TossLeads(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "TOSS Leads",
        description:
          "Review leads removed from the active workflow and restore or permanently delete sample records when appropriate.",
        status: "toss",
        listTitle: "TOSS leads",
        dateLabel: "Moved dates",
        dateField: "created_at",
      }}
    />
  );
}
