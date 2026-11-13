export type Market = {
  code: string;
  name: string;
  currency: string;
  timezone: string;
  status: "ACTIVE" | "PLANNED";
};

/** Mirrors GET /v1/markets. Zimbabwe launches first; the rest are config-led. */
export const markets: Market[] = [
  { code: "ZW", name: "Zimbabwe", currency: "USD", timezone: "Africa/Harare", status: "ACTIVE" },
  { code: "BW", name: "Botswana", currency: "BWP", timezone: "Africa/Gaborone", status: "PLANNED" },
  { code: "ZA", name: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg", status: "PLANNED" },
  { code: "AE", name: "UAE / Dubai", currency: "AED", timezone: "Asia/Dubai", status: "PLANNED" },
];

export const activeMarket = markets[0];
