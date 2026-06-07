import type { WeddingPhoto } from "@/lib/photos";
import { PhotoGallery } from "./photo-gallery";

type PhotosSectionProps = {
  photos: WeddingPhoto[];
};

export function PhotosSection({ photos }: PhotosSectionProps) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <section
      id="photos"
      className="relative z-10 mx-auto mt-12 max-w-5xl scroll-mt-28 sm:mt-16 lg:mt-20"
    >
      <article className="guest-panel-surface grid gap-6 rounded-lg border border-[#ffd6e4]/60 p-5 text-[#ffd6e4] sm:gap-7 sm:p-8 lg:p-10">
        <header className="grid gap-3 border-b border-[#ffd6e4]/45 pb-5 text-center sm:pb-6">
          <h2 className="text-4xl font-semibold leading-tight text-[#ffd6e4] sm:text-5xl">
            Photos
          </h2>
        </header>
        <PhotoGallery photos={photos} />
      </article>
    </section>
  );
}
