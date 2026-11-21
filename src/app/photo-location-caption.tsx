import { photoCountryFlag, photoCountryName } from "@/lib/photo-locations";

type PhotoLocationCaptionProps = {
  countryCode: string;
  locationText: string;
  className?: string;
};

export function PhotoLocationCaption({
  countryCode,
  locationText,
  className = "",
}: PhotoLocationCaptionProps) {
  const flag = photoCountryFlag(countryCode);
  const countryName = photoCountryName(countryCode);
  const caption = locationText || countryName;

  if (!caption) return null;

  return (
    <span className={`wedding-photo-caption ${className}`}>
      {flag ? (
        <span className="wedding-photo-flag" role="img" aria-label={`${countryName} flag`}>
          {flag}
        </span>
      ) : null}
      <span className="wedding-photo-location">{caption}</span>
    </span>
  );
}
