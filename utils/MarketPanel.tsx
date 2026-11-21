import {useRef, useState, type ComponentPropsWithoutRef, type PointerEvent} from 'react';
import {createPortal} from 'react-dom';

function marketItem(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-market-description]') : null;
}

/** One tooltip for both scrolling columns, outside their clipping containers. */
export function MarketPanel({children, ...panelProps}: ComponentPropsWithoutRef<'div'>) {
  const pointer = useRef<{x: number; y: number} | null>(null);
  const [tooltip, setTooltip] = useState<{item: HTMLElement; bounds: DOMRect} | null>(null);
  const item = tooltip?.item;
  const bounds = tooltip?.bounds;
  const width = Math.min(288, window.innerWidth - 16);
  const above = bounds ? bounds.bottom + 115 > window.innerHeight : false;

  const updateTooltip = (panel: HTMLDivElement, target: EventTarget | null) => {
    const next = marketItem(target);
    if (!next || !panel.contains(next)) {
      setTooltip(null);
      return;
    }
    const rect = next.getBoundingClientRect();
    setTooltip((current) =>
      current?.item === next && current.bounds.x === rect.x && current.bounds.y === rect.y
        && current.bounds.width === rect.width && current.bounds.height === rect.height
        ? current
        : {item: next, bounds: rect},
    );
  };

  const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    pointer.current = {x: event.clientX, y: event.clientY};
    updateTooltip(event.currentTarget, event.target);
  };

  return (
    <div
      {...panelProps}
      onPointerOver={trackPointer}
      onPointerMove={trackPointer}
      onPointerLeave={(event) => {
        pointer.current = null;
        updateTooltip(event.currentTarget, document.activeElement);
      }}
      onScrollCapture={(event) => {
        const point = pointer.current;
        updateTooltip(event.currentTarget, point ? document.elementFromPoint(point.x, point.y) : document.activeElement);
      }}
      onFocus={(event) => updateTooltip(event.currentTarget, event.target)}
      onBlur={(event) => updateTooltip(event.currentTarget, event.relatedTarget)}
    >
      {children}
      {item && bounds && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            zIndex: 1000,
            pointerEvents: 'none',
            top: above ? bounds.top - 6 : bounds.bottom + 6,
            left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
            width,
            transform: above ? 'translateY(-100%)' : undefined,
            boxSizing: 'border-box',
            padding: '8px 10px',
            background: '#141b2d',
            color: '#f6eed8',
            border: '1px solid #4cc9f0',
            borderRadius: 8,
            boxShadow: '0 3px 12px #0a0e1a',
            font: "12px/1.4 Inter, sans-serif",
          }}
        >
          <strong style={{display: 'block', color: '#4cc9f0'}}>{item.dataset.marketItem}</strong>
          {item.dataset.marketDescription}
        </div>,
        document.body,
      )}
    </div>
  );
}
