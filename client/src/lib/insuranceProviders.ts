// Insurance advert banners shown to UK freelancers in the InsuranceOffersDialog.
// Each is a clickable image linking out to the partner's offer page.
// Images live in client/public/insurance/ and are served from the site root.

export interface InsuranceAdvert {
  id: string;
  /** Path under client/public (served from the site root). */
  imageUrl: string;
  alt: string;
  /** Outbound link to the partner offer page (opens in a new tab). */
  url: string;
}

export const INSURANCE_ADVERTS: InsuranceAdvert[] = [
  {
    id: "short-term-public-liability",
    imageUrl: "/insurance/mode-short-term-public-liability.png",
    alt: "Mode Insurance — exclusive 10% discount on Short Term Public Liability for EventLink members. Use code Elink10.",
    url: "https://modeinsurance.co.uk/short-term-public-liability/?utm_source=eventlink&utm_medium=ad&utm_campaign=short-term",
  },
  {
    id: "equipment-insurance",
    imageUrl: "/insurance/mode-equipment-insurance.png",
    alt: "Mode Insurance — exclusive 10% discount on Equipment Insurance for EventLink members. Use code Elink10.",
    url: "https://modeinsurance.co.uk/equipment-insurance/?utm_source=eventlink&utm_medium=ad&utm_campaign=equipment",
  },
];
