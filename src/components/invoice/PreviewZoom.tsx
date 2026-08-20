"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const GUTTER = 16; // breathing room either side of the sheet at fit zoom

/**
 * Zoomable / pannable wrapper for the invoice sheet.
 *
 * The sheet is a fixed 595px-wide A4 box. It used to be shrunk with a bare
 * `scale-*` class, but `transform: scale()` does not change layout size — the
 * box still reserved 595x842px while painting at 55% from its top-left corner.
 * On a narrow screen the parent then centred a box wider than the viewport, so
 * the left edge overflowed out of reach and a tall empty gap sat underneath.
 *
 * Here the scale lives on an inner element while an outer sizer reserves the
 * *scaled* dimensions, so layout and paint agree. Centring, scrolling and
 * zooming then all behave normally.
 */
export function PreviewZoom({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [fitZoom, setFitZoom] = useState(1);
  const touchedRef = useRef(false); // user overrode the automatic fit

  // Measure the sheet at its natural size. offsetWidth/Height ignore transforms,
  // which is exactly what we need here.
  const measure = useCallback(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;

    const w = content.offsetWidth;
    const h = content.offsetHeight;
    if (!w || !h) return;

    setNatural((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

    const available = viewport.clientWidth - GUTTER * 2;
    const fit = Math.min(1, Math.max(MIN_ZOOM, available / w));
    setFitZoom(fit);
    if (!touchedRef.current) setZoom(fit);
  }, []);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [measure]);

  const applyZoom = useCallback((next: number) => {
    touchedRef.current = true;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
  }, []);

  const resetFit = useCallback(() => {
    touchedRef.current = false;
    setZoom(fitZoom);
  }, [fitZoom]);

  // Ctrl/⌘ + wheel zooms, like every other document viewer. A plain wheel keeps
  // scrolling the pane.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoom, applyZoom]);

  // Two-finger pinch. Panning is left to native scrolling, which handles
  // momentum and scrollbars for free.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let startDist = 0;
    let startZoom = 1;

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      startDist = dist(e.touches);
      startZoom = zoom;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      applyZoom(startZoom * (dist(e.touches) / startDist));
    };
    const onEnd = () => {
      startDist = 0;
    };

    viewport.addEventListener("touchstart", onStart, { passive: true });
    viewport.addEventListener("touchmove", onMove, { passive: false });
    viewport.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      viewport.removeEventListener("touchstart", onStart);
      viewport.removeEventListener("touchmove", onMove);
      viewport.removeEventListener("touchend", onEnd);
    };
  }, [zoom, applyZoom]);

  const atFit = Math.abs(zoom - fitZoom) < 0.005;

  return (
    <div className="relative h-full w-full">
      <div
        ref={viewportRef}
        data-testid="preview-viewport"
        className="h-full w-full overflow-auto overscroll-contain flex"
        // `safe center` centres while content fits and falls back to
        // start-alignment once it overflows, so the left edge stays reachable.
        style={{ justifyContent: "safe center", alignItems: "safe center", touchAction: "pan-x pan-y" }}
      >
        <div
          data-testid="preview-sizer"
          className="shrink-0"
          style={{
            width: natural.w ? natural.w * zoom : undefined,
            height: natural.h ? natural.h * zoom : undefined,
            margin: GUTTER,
          }}
        >
          <div
            ref={contentRef}
            data-testid="preview-sheet"
            className="w-max origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            {children}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 rounded-full border border-ink-150 bg-white/95 px-1 py-1 shadow-lg backdrop-blur">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => applyZoom(zoom - 0.1)}
          disabled={zoom <= MIN_ZOOM}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Fit to width"
          onClick={resetFit}
          className={`grid h-7 min-w-[3.25rem] place-items-center rounded-full px-2 text-[11px] font-bold tabular-nums transition-colors ${
            atFit ? "text-ink-400 hover:bg-ink-50" : "bg-brand-50 text-brand-600 hover:bg-brand-100"
          }`}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => applyZoom(zoom + 0.1)}
          disabled={zoom >= MAX_ZOOM}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
        {!atFit && (
          <button
            type="button"
            aria-label="Reset zoom"
            onClick={resetFit}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
