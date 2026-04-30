import { useState } from "react";

interface Props {
  src: string;
  alt?: string;
}

export function ImageViewer({ src, alt = "Question image" }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="exam-image-wrapper">
        <img
          src={src}
          alt={alt}
          className="exam-image"
          onClick={() => setExpanded(true)}
          title="Click to enlarge"
        />
        <button className="exam-image__expand-btn" onClick={() => setExpanded(true)} aria-label="Enlarge image">
          ⤢
        </button>
      </div>

      {expanded && (
        <div className="exam-lightbox" onClick={() => setExpanded(false)} role="dialog" aria-modal="true">
          <button className="exam-lightbox__close" onClick={() => setExpanded(false)} aria-label="Close">
            ✕
          </button>
          <img src={src} alt={alt} className="exam-lightbox__img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
