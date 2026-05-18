import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { HelpCircle } from 'lucide-react';

// Clickable info icon. Toggles a popover with help content.
//
// The popover uses `position: fixed` and computes its viewport coordinates
// from the icon's bounding rect. This is immune to ancestor `overflow: hidden`
// / `overflow-x: auto` clipping (which broke the previous absolute-positioned
// version inside .table-wrap and the kpi-strip).
//
// Horizontal: anchored to the icon's right edge, clamped to viewport.
// Vertical: below the icon by default; flips above if it would overflow.
// Dismissed on outside-click, Escape, or scroll.

export default function InfoButton({ title, body, variant = 'on-light', size = 13 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left }
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Reset position whenever closed so the next open re-measures cleanly.
  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  // Measure and clamp once the popover is in the DOM.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    const iconRect = btnRef.current.getBoundingClientRect();
    const popRect = popRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 6;

    // Default: align popover's right edge with icon's right edge, sit below.
    let left = iconRect.right - popRect.width;
    let top = iconRect.bottom + gap;

    // Clamp horizontally.
    if (left < margin) left = margin;
    if (left + popRect.width > vw - margin) left = vw - margin - popRect.width;

    // Flip vertically if overflowing bottom.
    if (top + popRect.height > vh - margin) {
      const flipped = iconRect.top - popRect.height - gap;
      if (flipped >= margin) top = flipped;
      else top = Math.max(margin, vh - margin - popRect.height);
    }

    setPos({ top, left });
  }, [open, title]);

  // Outside-click / Escape / scroll close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    // Scroll on any scrollable container — capture phase catches them all.
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`info-btn info-btn--${variant}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Help: ${title || 'info'}`}
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <div
          ref={popRef}
          className="info-pop"
          style={{
            position: 'fixed',
            top: pos ? `${pos.top}px` : '-9999px',
            left: pos ? `${pos.left}px` : '-9999px',
            visibility: pos ? 'visible' : 'hidden',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {title && <div className="info-pop-title">{title}</div>}
          <div className="info-pop-body">{body}</div>
        </div>
      )}
    </>
  );
}
