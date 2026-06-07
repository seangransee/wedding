"use client";

import Image from "next/image";
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
const thumbnailSizes = "(max-width: 640px) calc(100vw - 2.5rem), (max-width: 1024px) 45vw, 320px";
const lightboxPreloadRadius = 4;

type LazyGalleryImageProps = ComponentPropsWithoutRef<"img"> & {
  photoHeight: number;
  photoWidth: number;
  src: string | Blob;
};

function LazyGalleryImage({
  alt,
  className,
  photoHeight,
  photoWidth,
  onLoad,
  src,
  ...props
}: LazyGalleryImageProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const imageSrc = String(src);
  const [canLoad, setCanLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

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
      {canLoad ? (
        <Image
          alt={alt ?? ""}
          className={className}
          data-loaded={isLoaded}
          decoding={props.decoding}
          height={photoHeight}
          loading="lazy"
          quality={68}
          sizes={thumbnailSizes}
          src={imageSrc}
          title={props.title}
          width={photoWidth}
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
        />
      ) : (
        // This transparent image preserves the react-photo-album aspect-ratio box without requesting the full photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt ?? ""}
          className={className}
          data-loaded={false}
          decoding={props.decoding}
          height={photoHeight}
          loading="lazy"
          sizes={props.sizes}
          src={transparentPixel}
          title={props.title}
          width={photoWidth}
        />
      )}
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
          image: (props, { photo }) => (
            <LazyGalleryImage
              {...props}
              photoHeight={photo.height}
              photoWidth={photo.width}
            />
          ),
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
        carousel={{
          finite: photos.length <= 1,
          imageFit: "contain",
          preload: lightboxPreloadRadius,
        }}
        controller={{ closeOnBackdropClick: true }}
        className="wedding-photo-lightbox"
      />
    </>
  );
}
