"use client";

import { useEffect, useRef, useState } from "react";
import { RowsPhotoAlbum } from "react-photo-album";
import Lightbox from "yet-another-react-lightbox";
import type { WeddingPhoto } from "@/lib/photos";
import type { ComponentPropsWithoutRef } from "react";

type PhotoGalleryProps = {
  photos: WeddingPhoto[];
};

const transparentPixel =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

type LazyGalleryImageProps = ComponentPropsWithoutRef<"img"> & {
  src: string | Blob;
};

function LazyGalleryImage({
  alt,
  className,
  onLoad,
  src,
  ...props
}: LazyGalleryImageProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const imageSrc = String(src);
  const [canLoad, setCanLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentSrc = canLoad ? imageSrc : transparentPixel;

  useEffect(() => {
    const element = wrapperRef.current;

    if (!element || canLoad) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setCanLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setCanLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "520px 0px" },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [canLoad]);

  return (
    <span
      ref={wrapperRef}
      className="wedding-photo-lazy-frame"
      aria-hidden={!canLoad}
    >
      <span
        className="wedding-photo-placeholder"
        aria-hidden="true"
        data-loaded={isLoaded}
      />
      {/* react-photo-album renders plain images; this custom renderer delays the real src until the tile is near the viewport. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        alt={alt ?? ""}
        src={currentSrc}
        className={className}
        data-loaded={isLoaded}
        onLoad={(event) => {
          if (canLoad) {
            setIsLoaded(true);
          }
          onLoad?.(event);
        }}
      />
    </span>
  );
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [index, setIndex] = useState(-1);

  return (
    <>
      <RowsPhotoAlbum
        photos={photos}
        targetRowHeight={(containerWidth) => (containerWidth < 640 ? 190 : 270)}
        rowConstraints={(containerWidth) => ({
          minPhotos: containerWidth < 640 ? 1 : 2,
          maxPhotos: containerWidth < 640 ? 2 : 4,
          singleRowMaxHeight: containerWidth < 640 ? 240 : 360,
        })}
        spacing={(containerWidth) => (containerWidth < 640 ? 10 : 14)}
        padding={0}
        defaultContainerWidth={960}
        sizes={{
          size: "calc(100vw - 2.5rem)",
          sizes: [
            { viewport: "(min-width: 640px)", size: "calc(100vw - 8rem)" },
            { viewport: "(min-width: 1024px)", size: "56rem" },
          ],
        }}
        onClick={({ index: photoIndex }) => setIndex(photoIndex)}
        render={{
          image: (props) => <LazyGalleryImage {...props} />,
        }}
        componentsProps={{
          button: ({ photo }) => ({
            "aria-label": photo.alt,
            className: "wedding-photo-button",
            type: "button",
          }),
          image: {
            className: "wedding-photo-image",
            loading: "lazy",
            decoding: "async",
          },
        }}
      />
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={index}
        slides={photos}
        carousel={{ finite: photos.length <= 1, imageFit: "contain" }}
        controller={{ closeOnBackdropClick: true }}
        className="wedding-photo-lightbox"
      />
    </>
  );
}
