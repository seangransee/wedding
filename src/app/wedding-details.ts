const WEDDING_WEBSITE_URL = "https://sexiwedding.com";

type WeddingCalendarUrlOptions = {
  websiteUrl?: string;
  descriptionIntro?: string;
};

export function getWeddingCalendarUrl({
  websiteUrl = WEDDING_WEBSITE_URL,
  descriptionIntro = "Sean + Lexi = Sexi",
}: WeddingCalendarUrlOptions = {}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Sean & Lexi's Wedding",
    dates: "20261212/20261213",
    location:
      "The Blackstone, Autograph Collection, 636 South Michigan Avenue, Chicago, IL 60605, USA",
    details: `${descriptionIntro}\n\n${websiteUrl}`,
  });

  params.append("sprop", `website:${websiteUrl}`);

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export const WEDDING_DETAILS = {
  brand: "Sean + Lexi = Sexi",
  dateLabel: "December 12, 2026",
  venueName: "The Blackstone Hotel",
  locationLabel: "Chicago, IL",
  mapUrl: "https://maps.app.goo.gl/UKgUKENz1W4efCC7A",
  websiteUrl: WEDDING_WEBSITE_URL,
  calendarUrl: getWeddingCalendarUrl(),
};
