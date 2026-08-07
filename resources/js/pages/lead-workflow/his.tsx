import LeadsShop, { type LeadsShopProps } from "./leads-shop";

export default function HIS(props: LeadsShopProps) {
  return (
    <LeadsShop
      {...props}
      queue={{
        title: "HIS",
        description:
          "Review HIS leads, update their progress, and keep the next follow-up organized.",
        status: "his",
        listTitle: "Waiting for HIS",
        dateLabel: "HIS months",
        dateField: "appointment_at",
        dateGranularity: "month",
      }}
    />
  );
}
