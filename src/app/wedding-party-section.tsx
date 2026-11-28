import { InlineMarkdown, readWeddingParty } from "./markdown-content";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

// Andrew, Mark, and Alec's invitations see the groomsmen-only photos.
const GROOMSMEN_INVITATION_SLUGS = new Set([
  "andrew-and-liz",
  "potato",
  "daddy",
]);

export function WeddingPartySection({ guestSlug }: { guestSlug?: string }) {
  const { heading, members } = readWeddingParty("wedding-party.md");
  const isGroomsman = guestSlug
    ? GROOMSMEN_INVITATION_SLUGS.has(guestSlug)
    : false;

  return (
    <section
      id="wedding-party"
      aria-labelledby="wedding-party-heading"
      className="relative z-10 mx-auto mt-12 max-w-5xl scroll-mt-40 sm:mt-16 sm:scroll-mt-28 lg:mt-20"
    >
      <div className="guest-panel-surface rounded-lg border border-[#ffd6e4]/60 p-5 text-[#ffd6e4] sm:p-8 lg:p-10">
        <header className="border-b border-[#ffd6e4]/45 pb-5 text-center sm:pb-6">
          <h2
            id="wedding-party-heading"
            className="text-4xl font-semibold leading-tight sm:text-6xl"
          >
            {heading || "Wedding Party"}
          </h2>
        </header>
        <ul className="wedding-party-list">
          {members.map((member) => {
            const photo =
              (isGroomsman && member.groomsmenPhoto) || member.photo;

            return (
              <li key={member.name} className="wedding-party-member">
                {photo ? (
                  // Plain <img>: like the gallery, these stay off Vercel Image Optimization.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="wedding-party-photo"
                    src={photo}
                    alt={member.name}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="wedding-party-photo wedding-party-photo-placeholder"
                    aria-hidden="true"
                  >
                    <span style={{ fontFamily: "var(--font-brand-script)" }}>
                      {initials(member.name)}
                    </span>
                  </div>
                )}
                {member.title ? (
                  <p className="wedding-party-title">{member.title}</p>
                ) : null}
                <h3 className="wedding-party-name">{member.name}</h3>
                {member.bio.map((paragraph) => (
                  <p key={paragraph} className="wedding-party-bio">
                    <InlineMarkdown text={paragraph} />
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
