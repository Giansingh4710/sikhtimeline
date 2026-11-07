import {
  Canvas,
  Circle,
  Fill,
  Group,
  Paragraph,
  Rect,
  RoundedRect,
  Skia,
  useFonts,
  type SkParagraph,
} from '@shopify/react-native-skia';
import {
  NotoSans_400Regular,
  NotoSans_700Bold,
} from '@expo-google-fonts/noto-sans';
import {
  NotoSansGurmukhi_400Regular,
  NotoSansGurmukhi_700Bold,
} from '@expo-google-fonts/noto-sans-gurmukhi';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  clamp,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { isGuruLike, type Selection } from '../data/types';
import { useLanguage } from '../state/LanguageContext';
import {
  AXIS_H,
  BASE_PX_PER_YEAR,
  EVENTS_BOTTOM_PAD,
  EVENTS_MAX_FRACTION,
  EVENTS_TOP_PAD,
  EVENT_ROW_H,
  START_YEAR,
  YEAR_MAX,
  YEAR_MIN,
  computeLayout,
  packEventRows,
  tickStep,
  yearToPx,
  type Filters,
} from './layout';
import { colorFor, colors } from './theme';

export type { Selection } from '../data/types';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 12;
const FAMILIES = ['NotoSans', 'NotoSansGurmukhi'];
const EVENT_FONT = 10.5;
const MARKER_R = 4;
const LABEL_X_OFFSET = 10; // gap from marker center to label text
const LABEL_MAX_W = 150; // cap very long labels (they ellipsize)
const LABEL_GAP = 14; // min horizontal gap between two labels on the same row
const EVENT_TAP_SLOP = 22; // px around a marker that still counts as a hit
const GURU_FONT = 12.5;
const OTHER_FONT = 11;

type FontMgr = NonNullable<ReturnType<typeof useFonts>>;

type Props = {
  filters: Filters;
  selection: Selection | null;
  onSelect: (sel: Selection) => void;
  // Fresh object per request so repeat picks of the same item re-center.
  scrollTarget: { sel: Selection } | null;
};

function makeParagraph(
  fontMgr: FontMgr,
  text: string,
  fontSize: number,
  color: string,
  bold = false,
): SkParagraph {
  const builder = Skia.ParagraphBuilder.Make({ maxLines: 1, ellipsis: '…' }, fontMgr);
  builder
    .pushStyle({
      color: Skia.Color(color),
      fontFamilies: FAMILIES,
      fontSize,
      fontStyle: { weight: bold ? 700 : 400 },
    })
    .addText(text);
  return builder.build();
}

// Build a keyed Map of paragraphs, guarding the not-yet-loaded font manager once.
function useParagraphMap<T>(
  fontMgr: FontMgr | null,
  items: T[],
  build: (item: T, mgr: FontMgr) => [string, SkParagraph],
  deps: React.DependencyList,
): Map<string, SkParagraph> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (!fontMgr) return new Map<string, SkParagraph>();
    return new Map(items.map((item) => build(item, fontMgr)));
  }, [fontMgr, ...deps]);
}

export default function Timeline({ filters, selection, onSelect, scrollTarget }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const { lang } = useLanguage();

  // Highlight follows the parent's selection so closing the sheet clears it.
  const selectedId = selection?.person?.id ?? selection?.event?.id ?? null;

  const fontMgr = useFonts({
    NotoSans: [NotoSans_400Regular, NotoSans_700Bold],
    NotoSansGurmukhi: [NotoSansGurmukhi_400Regular, NotoSansGurmukhi_700Bold],
  });

  const layout = useMemo(() => computeLayout(filters), [filters]);
  const pxx = BASE_PX_PER_YEAR * zoom; // horizontal px per year
  const contentW = yearToPx(YEAR_MAX, pxx);

  // Build each event label once (per data/lang/font) and read its measured width
  // from the same paragraph, so packing and rendering share one set of objects.
  const eventLabels = useMemo(() => {
    const paras = new Map<string, SkParagraph>();
    const widths = new Map<string, number>();
    if (!fontMgr) return { paras, widths };
    for (const e of layout.events) {
      const para = makeParagraph(fontMgr, e.event.title[lang], EVENT_FONT, colors.text);
      para.layout(LABEL_MAX_W);
      paras.set(e.event.id, para);
      widths.set(e.event.id, Math.min(LABEL_MAX_W, Math.ceil(para.getLongestLine())));
    }
    return { paras, widths };
  }, [layout.events, lang, fontMgr]);

  // Zoom-aware row packing: pack markers, labels, and duration lines so
  // nothing overlaps at the current zoom. Labels are always shown once packed.
  const eventPack = useMemo(() => {
    const items = layout.events.map((e) => ({
      x: yearToPx(e.year, pxx),
      width: Math.max(
        LABEL_X_OFFSET + (eventLabels.widths.get(e.event.id) ?? LABEL_MAX_W),
        ((e.endYear ?? e.year) - e.year) * pxx,
      ) + LABEL_GAP,
    }));
    const { rows, rowCount } = packEventRows(items);
    const rowById = new Map(layout.events.map((e, i) => [e.event.id, rows[i]]));
    return { rowById, rowCount };
  }, [layout.events, pxx, eventLabels]);

  // Band grows with its rows but never past a fraction of the viewport; taller
  // than that and it scrolls vertically (evContentH > eventsH).
  const evContentH = filters.events
    ? EVENTS_TOP_PAD + eventPack.rowCount * EVENT_ROW_H + EVENTS_BOTTOM_PAD
    : 0;
  const eventsH = filters.events
    ? Math.min(evContentH, Math.round(size.h * EVENTS_MAX_FRACTION))
    : 0;
  const laneTop = AXIS_H + eventsH; // content (lanes) start below the pinned bands

  const tx = useSharedValue(-yearToPx(START_YEAR, BASE_PX_PER_YEAR));
  const ty = useSharedValue(0);
  const evScrollY = useSharedValue(0); // vertical scroll inside the events band
  const pinchScale = useSharedValue(1);
  const focalX = useSharedValue(0);
  // Pan bounds live in shared values so gesture/decay worklets always read the
  // current zoom's bounds instead of values captured at render time.
  const minTxSV = useSharedValue(0);
  const minTySV = useSharedValue(0);

  // Refs so JS-thread callbacks (tap, pinch commit) always see current values.
  const stateRef = useRef({ zoom, layout, size, filters, eventsH, rowById: eventPack.rowById });
  stateRef.current = { zoom, layout, size, filters, eventsH, rowById: eventPack.rowById };

  const minTx = Math.min(0, size.w - contentW);
  const minTy = Math.min(0, size.h - laneTop - layout.contentHeight - 20);
  const minEvScrollY = Math.min(0, eventsH - evContentH); // negative when band scrolls
  const minEvScrollSV = useSharedValue(0);
  const laneTopSV = useSharedValue(laneTop);

  // Re-clamp after rotation / zoom / filter changes shrink the pannable area, and
  // keep gesture-thread bounds in sync. Writing tx/ty cancels any in-flight decay.
  useEffect(() => {
    minTxSV.value = minTx;
    minTySV.value = minTy;
    minEvScrollSV.value = minEvScrollY;
    laneTopSV.value = laneTop;
    tx.value = clamp(tx.value, minTx, 0);
    ty.value = clamp(ty.value, minTy, 0);
    evScrollY.value = clamp(evScrollY.value, minEvScrollY, 0);
  }, [minTx, minTy, minEvScrollY, laneTop, minTxSV, minTySV, minEvScrollSV, laneTopSV, tx, ty, evScrollY]);

  // Center the timeline on a searched/picked item. Runs post-render, so all
  // layout values in the closure are already fresh for the current filters/zoom.
  // Deps are [scrollTarget] only: rotation/zoom must not re-center on the last hit.
  useEffect(() => {
    if (!scrollTarget || size.w === 0) return;
    const { sel } = scrollTarget;
    if (sel.event) {
      tx.value = clamp(size.w / 2 - yearToPx(sel.event.year, pxx), minTx, 0);
      const row = eventPack.rowById.get(sel.event.id) ?? 0;
      evScrollY.value = clamp(
        eventsH / 2 - (EVENTS_TOP_PAD + row * EVENT_ROW_H),
        minEvScrollY,
        0,
      );
    } else {
      const bar = layout.bars.find((b) => b.person.id === sel.person.id);
      if (!bar) return;
      tx.value = clamp(
        size.w / 2 - yearToPx((bar.startYear + bar.endYear) / 2, pxx),
        minTx,
        0,
      );
      ty.value = clamp((size.h - laneTop) / 2 - (bar.y + bar.h / 2), minTy, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget]);

  const commitZoom = (scale: number, focal: number) => {
    const { zoom: z, size: sz } = stateRef.current;
    const next = clamp(z * scale, MIN_ZOOM, MAX_ZOOM);
    const s = next / z;
    const lo = Math.min(0, sz.w - yearToPx(YEAR_MAX, BASE_PX_PER_YEAR * next));
    minTxSV.value = lo; // bounds current immediately, before the re-render lands
    tx.value = clamp(tx.value + focal * (1 - s), lo, 0);
    pinchScale.value = 1;
    setZoom(next);
  };

  const handleTap = (x: number, y: number) => {
    const { zoom: z, layout: lay, filters: f, eventsH: bandH, rowById } = stateRef.current;
    const p = BASE_PX_PER_YEAR * z;
    const year = (x - tx.value) / p + YEAR_MIN;
    // Events band: hit-test the actual marker position (x from year, y from its
    // packed row + current band scroll), picking the closest within the slop.
    if (f.events && y >= AXIS_H && y < AXIS_H + bandH) {
      const bandY = y - AXIS_H - evScrollY.value; // into band content space
      let best: (typeof lay.events)[number] | undefined;
      let bestDist = EVENT_TAP_SLOP;
      for (const ev of lay.events) {
        const mx = yearToPx(ev.year, p) + tx.value;
        const my = EVENTS_TOP_PAD + (rowById.get(ev.event.id) ?? 0) * EVENT_ROW_H + MARKER_R;
        // Require the tap to land within the event's own row band vertically, so
        // taps in the band's empty space below the last row select nothing.
        if (Math.abs(bandY - my) > EVENT_ROW_H / 2) continue;
        const d = Math.hypot(x - mx, bandY - my);
        if (d < bestDist) { bestDist = d; best = ev; }
      }
      if (best) onSelect({ event: best.event });
      return;
    }
    if (y < laneTop) return;
    const cy = y - ty.value - laneTop;
    const hit = lay.bars.find(
      (b) => cy >= b.y && cy <= b.y + b.h && year >= b.startYear && year <= b.endYear,
    );
    if (hit) onSelect({ person: hit.person });
  };

  // Vertical drags starting inside the events band scroll the band; elsewhere
  // they pan the lanes. Horizontal panning (time) always applies.
  const inEventsBand = useSharedValue(false);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      inEventsBand.value = e.y >= AXIS_H && e.y < laneTopSV.value;
    })
    .onChange((e) => {
      tx.value = clamp(tx.value + e.changeX, minTxSV.value, 0);
      if (inEventsBand.value) {
        evScrollY.value = clamp(evScrollY.value + e.changeY, minEvScrollSV.value, 0);
      } else {
        ty.value = clamp(ty.value + e.changeY, minTySV.value, 0);
      }
    })
    .onEnd((e) => {
      tx.value = withDecay({ velocity: e.velocityX, clamp: [minTxSV.value, 0] });
      if (inEventsBand.value) {
        evScrollY.value = withDecay({ velocity: e.velocityY, clamp: [minEvScrollSV.value, 0] });
      } else {
        ty.value = withDecay({ velocity: e.velocityY, clamp: [minTySV.value, 0] });
      }
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX - tx.value;
    })
    .onUpdate((e) => {
      pinchScale.value = e.scale;
    })
    .onEnd((e) => {
      runOnJS(commitZoom)(e.scale, focalX.value);
    });

  const tap = Gesture.Tap().onEnd((e) => {
    runOnJS(handleTap)(e.x, e.y);
  });

  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), tap);

  // Single source of truth for the focal-pinch horizontal shift.
  const xShift = useDerivedValue(
    () => tx.value + focalX.value * (1 - pinchScale.value),
  );
  // X transform shared by the axis, grid, and events band (pans/zooms in time only).
  const xTransform = useDerivedValue(() => [
    { translateX: xShift.value },
    { scaleX: pinchScale.value },
  ]);
  // Lane content additionally pans vertically.
  const contentTransform = useDerivedValue(() => [
    { translateX: xShift.value },
    { translateY: ty.value },
    { scaleX: pinchScale.value },
  ]);

  // Tick years only change when the step crosses a breakpoint, not on every zoom.
  const step = tickStep(pxx);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let y = Math.ceil(YEAR_MIN / step) * step; y <= YEAR_MAX; y += step) out.push(y);
    return out;
  }, [step]);

  const tickParagraphs = useMemo(() => {
    if (!fontMgr) return new Map<number, SkParagraph>();
    return new Map(ticks.map((y) => [y, makeParagraph(fontMgr, String(y), 11, colors.textDim)]));
  }, [ticks, fontMgr]);

  const barParagraphs = useParagraphMap(
    fontMgr,
    layout.bars,
    (b, mgr) => {
      const guru = isGuruLike(b.person.category);
      return [
        b.person.id,
        makeParagraph(mgr, b.person.name[lang], guru ? GURU_FONT : OTHER_FONT, colors.text, guru),
      ];
    },
    [layout, lang],
  );

  // Vertical scroll transform for the events band content.
  const eventsBandTransform = useDerivedValue(() => [
    { translateX: xShift.value },
    { translateY: evScrollY.value },
    { scaleX: pinchScale.value },
  ]);
  const eventsClip = useMemo(
    () => ({ x: 0, y: AXIS_H, width: size.w, height: eventsH }),
    [size.w, eventsH],
  );

  const clipRect = useMemo(
    () => ({ x: 0, y: laneTop, width: size.w, height: Math.max(0, size.h - laneTop) }),
    [laneTop, size],
  );

  return (
    <View
      style={styles.container}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size.w > 0 && fontMgr && (
        <GestureDetector gesture={gesture}>
          <Canvas style={{ width: size.w, height: size.h }}>
            <Fill color={colors.background} />

            {/* Vertical grid lines (time-transformed, full height) */}
            <Group transform={xTransform}>
              {ticks.map((year) => (
                <Rect
                  key={year}
                  x={yearToPx(year, pxx)}
                  y={AXIS_H}
                  width={1}
                  height={size.h}
                  color={colors.gridLine}
                />
              ))}
            </Group>

            {/* Lifespan bars (horizontal rows) */}
            <Group clip={clipRect}>
              <Group transform={contentTransform}>
                {layout.bars.map((b) => {
                  const x = yearToPx(b.startYear, pxx);
                  const w = (b.endYear - b.startYear) * pxx;
                  const y = laneTop + b.y;
                  const para = barParagraphs.get(b.person.id);
                  // Vertically center the single label line (~1.36x line-height).
                  const lineH = (isGuruLike(b.person.category) ? GURU_FONT : OTHER_FONT) * 1.36;
                  const sel = b.person.id === selectedId;
                  return (
                    <Group key={b.person.id}>
                      {sel && (
                        <RoundedRect
                          x={x - 2}
                          y={y - 2}
                          width={w + 4}
                          height={b.h + 4}
                          r={9}
                          color={colors.text}
                        />
                      )}
                      <RoundedRect
                        x={x}
                        y={y}
                        width={w}
                        height={b.h}
                        r={7}
                        color={colorFor(b.person.guruId)}
                        opacity={b.person.category === 'family' && !sel ? 0.55 : 0.92}
                      />
                      {para && w > 46 && (
                        <Paragraph
                          paragraph={para}
                          x={x + 8}
                          y={y + (b.h - lineH) / 2}
                          width={w - 14}
                        />
                      )}
                    </Group>
                  );
                })}
              </Group>
            </Group>

            {/* Events band (pinned under the axis; scrolls vertically if tall) */}
            {filters.events && eventsH > 0 && (
              <>
                <Rect x={0} y={AXIS_H} width={size.w} height={eventsH} color={colors.background} opacity={0.55} />
                <Rect x={0} y={AXIS_H + eventsH - 1} width={size.w} height={1} color={colors.axis} />
                <Group clip={eventsClip}>
                  <Group transform={eventsBandTransform}>
                    {layout.events.map((e) => {
                      const x = yearToPx(e.year, pxx);
                      const row = eventPack.rowById.get(e.event.id) ?? 0;
                      const cy = AXIS_H + EVENTS_TOP_PAD + row * EVENT_ROW_H + MARKER_R;
                      const c = colorFor(e.event.guruId);
                      const para = eventLabels.paras.get(e.event.id);
                      const labelW = eventLabels.widths.get(e.event.id) ?? LABEL_MAX_W;
                      const sel = e.event.id === selectedId;
                      return (
                        <Group key={e.event.id}>
                          {e.endYear && (
                            <Rect
                              x={x}
                              y={cy - 1.5}
                              width={(e.endYear - e.year) * pxx}
                              height={3}
                              color={c}
                              opacity={0.7}
                            />
                          )}
                          {sel && <Circle cx={x} cy={cy} r={MARKER_R + 3} color={colors.text} />}
                          <Circle cx={x} cy={cy} r={MARKER_R} color={c} />
                          {para && (
                            <Paragraph
                              paragraph={para}
                              x={x + LABEL_X_OFFSET}
                              y={cy - EVENT_FONT}
                              width={labelW + 2}
                            />
                          )}
                        </Group>
                      );
                    })}
                  </Group>
                </Group>
              </>
            )}

            {/* Year axis (pinned top) */}
            <Rect x={0} y={0} width={size.w} height={AXIS_H} color={colors.background} />
            <Rect x={0} y={AXIS_H - 1} width={size.w} height={1} color={colors.axis} />
            <Group transform={xTransform}>
              {ticks.map((year) => {
                const x = yearToPx(year, pxx);
                const para = tickParagraphs.get(year);
                return (
                  <Group key={year}>
                    <Rect x={x} y={AXIS_H - 7} width={1.5} height={7} color={colors.textDim} />
                    {para && <Paragraph paragraph={para} x={x + 4} y={8} width={44} />}
                  </Group>
                );
              })}
            </Group>
          </Canvas>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
