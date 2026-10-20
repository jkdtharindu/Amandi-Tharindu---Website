import Image from "next/image";
import type { CSSProperties } from "react";
import { fadeMask } from "@/src/theme/couplePhoto.js";

export type CouplePhotoPerson = { zoom: number; x: number; y: number };

/**
 * One bride/groom portrait, framed, zoomed, positioned and edge-faded
 * (Action 86). Used by the home page and by the admin live preview so both
 * always look the same.
 */
export default function CouplePhoto({
  src,
  alt,
  size,
  fade,
  person,
}: {
  src: string;
  alt: string;
  size: number;
  fade: number;
  person: CouplePhotoPerson;
}) {
  const mask = fadeMask(fade);
  const frameStyle = {
    width: size,
    ...(mask
      ? {
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }
      : {}),
  } as CSSProperties;

  return (
    <div className="couple-photo-frame" style={frameStyle}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${size}px`}
        style={{
          objectFit: "cover",
          objectPosition: `${person.x}% ${person.y}%`,
          transform: `scale(${person.zoom / 100})`,
          transformOrigin: `${person.x}% ${person.y}%`,
        }}
      />
    </div>
  );
}
