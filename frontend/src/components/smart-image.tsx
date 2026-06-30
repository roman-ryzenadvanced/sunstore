"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface SmartImageProps {
  src?: string;
  alt: string;
  /** Tailwind / CSS class for the wrapper. */
  className?: string;
  /** Aspect ratio hint for the wrapper, e.g. "1 / 1". */
  aspectRatio?: string;
  /** Sizes attribute for next/image. */
  sizes?: string;
  /** Mark as priority (above-the-fold). */
  priority?: boolean;
  /** Fallback background color or gradient when no src / error. */
  fallback?: React.ReactNode;
}

/**
 * Drop-in replacement for `style={{ backgroundImage: url(...) }}` patterns.
 * Uses next/image for optimization, lazy-loads, and falls back to a
 * branded placeholder when the URL is missing or fails to load.
 */
export function SmartImage({
  src,
  alt,
  className,
  aspectRatio = "1 / 1",
  sizes = "(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw",
  priority = false,
  fallback
}: SmartImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setErrored(false);
    setLoaded(false);
  }, [src]);

  const showImage = src && !errored;
  const isInlineDataImage = Boolean(src?.startsWith("data:image/"));

  return (
    <div
      className={`smart-image ${className ?? ""}`}
      style={{ aspectRatio }}
      data-loaded={loaded}
    >
      {showImage ? isInlineDataImage ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className="smart-image__native"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{ objectFit: "cover" }}
          unoptimized={isInlineDataImage}
        />
      ) : (
        <div className="smart-image__fallback" aria-hidden="true">
          {fallback ?? <DefaultFallback />}
        </div>
      )}
      {!loaded && showImage ? (
        <div className="smart-image__shimmer" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function DefaultFallback() {
  return (
    <div className="smart-image__default">
      <span className="smart-image__mark" aria-hidden="true">
        ◐
      </span>
      <span className="smart-image__label">Sun.store</span>
    </div>
  );
}
