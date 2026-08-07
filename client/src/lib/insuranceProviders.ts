// Insurance partners offered to UK freelancers. First version: a hardcoded
// list rendered as banners/tiles in the InsuranceOffersDialog.
//
// NOTE: partners, cover types, prices, discounts, and URLs below are
// PLACEHOLDER examples for the UI. Confirm each partnership and its real
// figures + affiliate/referral URL before promoting real offers.

export interface InsuranceProvider {
  id: string;
  name: string;
  /** Type of cover offered, e.g. "Public liability insurance". */
  coverType: string;
  /** Concrete price anchor, e.g. "From £37/year" or "From £5/month". */
  priceLine: string;
  /** The member-discount headline, e.g. "10% off for EventLink members". */
  discount: string;
  /** Outbound link to the provider's offer page. */
  url: string;
  /**
   * Optional logo image URL. When absent the tile shows an initials
   * fallback — drop a real logo path here once assets are supplied.
   */
  logoUrl?: string;
  /** Tailwind class for the tile's top accent bar. */
  accentClassName: string;
}

export const INSURANCE_PROVIDERS: InsuranceProvider[] = [
  {
    id: "hiscox",
    name: "Hiscox",
    coverType: "Public liability & professional indemnity",
    priceLine: "From £5/month",
    discount: "15% off your first year for members",
    url: "https://www.hiscox.co.uk/",
    accentClassName: "border-t-blue-500",
  },
  {
    id: "simply-business",
    name: "Simply Business",
    coverType: "Public liability insurance",
    priceLine: "Compare quotes free",
    discount: "Exclusive EventLink member rates",
    url: "https://www.simplybusiness.co.uk/",
    accentClassName: "border-t-emerald-500",
  },
  {
    id: "zego",
    name: "Zego",
    coverType: "Pay-as-you-go event cover",
    priceLine: "From £2/day",
    discount: "10% off flexible cover for members",
    url: "https://www.zego.com/",
    accentClassName: "border-t-purple-500",
  },
  {
    id: "insurance4events",
    name: "Insurance4Events",
    coverType: "Equipment & single-event cover",
    priceLine: "From £37/year",
    discount: "Members save on equipment cover",
    url: "https://www.insurance4events.co.uk/",
    accentClassName: "border-t-amber-500",
  },
];
