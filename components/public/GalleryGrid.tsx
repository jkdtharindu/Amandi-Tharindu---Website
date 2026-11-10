'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';

export type GalleryGridPhoto = {
  id: string;
  photoUrl: string;
  caption: string;
  focusX?: number;
  focusY?: number;
};

export default function GalleryGrid({ photos }: { photos: GalleryGridPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const count = photos.length;

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i + 1) % count)),
    [count]
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i - 1 + count) % count)),
    [count]
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, next, prev]);

  const current = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <div className="panel-cards gallery-grid">
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            className="gallery-card"
            onClick={() => setOpenIndex(index)}
            aria-label={`Open photo ${index + 1} of ${count}${photo.caption ? `: ${photo.caption}` : ''}`}
          >
            <Image
              src={photo.photoUrl}
              alt={photo.caption || 'Gallery photo'}
              width={600}
              height={220}
              sizes={
                count >= 4
                  ? '(max-width: 480px) 100vw, (max-width: 700px) 50vw, (max-width: 1100px) 34vw, 270px'
                  : '100vw'
              }
              style={{ objectPosition: `${photo.focusX ?? 50}% ${photo.focusY ?? 50}%` }}
            />
            {photo.caption && <span className="gallery-caption">{photo.caption}</span>}
          </button>
        ))}
      </div>

      {/* Rendered straight into <body>: the section it sits in uses glass
          (backdrop-filter) and overflow clipping, which would otherwise trap
          a position:fixed viewer inside the section and hide its buttons. */}
      {current && typeof document !== 'undefined' && createPortal(
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={close}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(dx) > 50 && count > 1) {
              if (dx < 0) next();
              else prev();
            }
          }}
        >
          <button
            type="button"
            className="lightbox-btn lightbox-close"
            onClick={close}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {count > 1 && (
            <button
              type="button"
              className="lightbox-btn lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous photo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}

          <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-image">
              <Image
                key={current.id}
                src={current.photoUrl}
                alt={current.caption || 'Gallery photo'}
                fill
                sizes="100vw"
                priority
                style={{ objectFit: 'contain' }}
              />
            </div>
            {(current.caption || count > 1) && (
              <figcaption className="lightbox-caption">
                {current.caption && <span>{current.caption}</span>}
                {count > 1 && (
                  <span className="lightbox-count">
                    {(openIndex ?? 0) + 1} / {count}
                  </span>
                )}
              </figcaption>
            )}
          </figure>

          {count > 1 && (
            <button
              type="button"
              className="lightbox-btn lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label="Next photo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
