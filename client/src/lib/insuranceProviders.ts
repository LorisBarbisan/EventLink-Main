// Insurance partners offered to UK freelancers. First version: a hardcoded
// list rendered as banners in the InsuranceOffersDialog. Replace the
// placeholder URLs/discounts with real partner details as deals are agreed.
//
// NOTE: these are placeholder partners for the initial UI. Confirm each
// partnership and its affiliate/referral URL before promoting real offers.

export interface InsuranceProvider {
  id: string;
  name: string;
  /** One-line description of the cover offered. */
  tagline: string;
  /** The member-discount headline, e.g. "15% off for EventLink members". */
  discount: string;
  /** Outbound link to the provider's offer page. */
  url: string;
  /** Tailwind classes for the banner accent (left border + badge). */
  accentClassName: string;
}

export const INSURANCE_PROVIDERS: InsuranceProvider[] = [
  {
    id: "hiscox",
    name: "Hiscox",
    tagline: "Public liability & professional indemnity for event freelancers.",
    discount: "15% off your first year for EventLink members",
    url: "https://www.hiscox.co.uk/",
    accentClassName: "border-l-blue-500",
  },
  {
    id: "simply-business",
    name: "Simply Business",
    tagline: "Compare tailored public liability cover in minutes.",
    discount: "Exclusive EventLink member rates",
    url: "https://www.simplybusiness.co.uk/",
    accentClassName: "border-l-emerald-500",
  },
  {
    id: "zego",
    name: "Zego",
    tagline: "Flexible pay-as-you-go cover for gig and event work.",
    discount: "10% off flexible cover for EventLink members",
    url: "https://www.zego.com/",
    accentClassName: "border-l-purple-500",
  },
  {
    id: "insureourevent",
    name: "Insurance4Events",
    tagline: "Single-event and annual equipment cover for crew.",
    discount: "Members save on equipment & event cover",
    url: "https://www.insurance4events.co.uk/",
    accentClassName: "border-l-amber-500",
  },
];
