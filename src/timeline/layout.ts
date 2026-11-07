import data from '../data/timeline.json';
import type { Category, Person, TimelineData, TimelineEvent } from '../data/types';

export const YEAR_MIN = 1400;
export const YEAR_MAX = 1780;
export const START_YEAR = 1455; // year the timeline is scrolled to on open

// Horizontal timeline: time flows left -> right.
export const AXIS_H = 34; // pinned year axis at top
export const EVENT_ROW_H = 26; // height of one event row (marker + label line)
export const EVENTS_TOP_PAD = 8; // gap between the axis and the first event row
export const EVENTS_BOTTOM_PAD = 10;
// The events band grows with its packed rows, up to this fraction of the
// viewport; beyond that it scrolls vertically. Height is computed in the view.
export const EVENTS_MAX_FRACTION = 0.45;
export const GURU_LANE_H = 44;
export const LANE_H = 30;
export const LANE_GAP = 6;
export const BASE_PX_PER_YEAR = 6;

export const timeline = data as TimelineData;

export type PlacedBar = {
  person: Person;
  y: number; // px (content space, below the pinned bands)
  h: number; // px
  startYear: number;
  endYear: number; // death, or YEAR_MAX when ongoing
};

export type PlacedEvent = {
  event: TimelineEvent;
  year: number;
  endYear?: number;
};

export type Layout = {
  bars: PlacedBar[];
  events: PlacedEvent[]; // chronological; row assignment happens zoom-aware in the view
  contentHeight: number; // total height of the lane area (excludes pinned bands)
};

// Greedy row packing for markers+labels at a given zoom. Each item occupies
// [x, x + width]; an event goes on the first row whose last item clears it,
// growing the row count as needed so nothing ever overlaps.
// PRECONDITION: `items` must be sorted by ascending `x` (first-fit relies on
// it). Callers pass chronological events, whose x is monotonic in year.
export function packEventRows(
  items: { x: number; width: number }[],
): { rows: number[]; rowCount: number } {
  const rowEndX: number[] = [];
  const rows = items.map((it) => {
    let row = rowEndX.findIndex((end) => end <= it.x);
    if (row === -1) {
      row = rowEndX.length;
      rowEndX.push(it.x + it.width);
    } else {
      rowEndX[row] = it.x + it.width;
    }
    return row;
  });
  return { rows, rowCount: rowEndX.length };
}

export type Filters = { gurus: boolean; family: boolean; gursikhs: boolean; events: boolean };

const GURU_ORDER = [
  'guru-nanak', 'guru-angad', 'guru-amardas', 'guru-ramdas', 'guru-arjan',
  'guru-hargobind', 'guru-harrai', 'guru-harkrishan', 'guru-teghbahadur',
  'guru-gobindsingh', 'guru-granth-sahib',
];

const peopleById = new Map(timeline.people.map((p) => [p.id, p]));

// Greedy interval packing: people whose lifespans don't overlap share a lane (row).
function pack(people: Person[], y0: number, laneH: number): { bars: PlacedBar[]; height: number } {
  const laneEnds: number[] = []; // last occupied end-year per lane
  const bars: PlacedBar[] = [];
  const sorted = [...people].sort((a, b) => a.birth - b.birth);
  for (const p of sorted) {
    const end = p.death ?? YEAR_MAX;
    let lane = laneEnds.findIndex((e) => e + 3 <= p.birth);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    bars.push({
      person: p,
      y: y0 + lane * (laneH + LANE_GAP),
      h: laneH,
      startYear: p.birth,
      endYear: end,
    });
  }
  return { bars, height: laneEnds.length * (laneH + LANE_GAP) };
}

export function computeLayout(filters: Filters): Layout {
  const bars: PlacedBar[] = [];
  let y = LANE_GAP;

  if (filters.gurus) {
    const gurus = GURU_ORDER
      .map((id) => peopleById.get(id))
      .filter((p): p is Person => !!p);
    for (const p of gurus) {
      bars.push({
        person: p,
        y,
        h: GURU_LANE_H,
        startYear: p.birth,
        endYear: p.death ?? YEAR_MAX,
      });
      y += GURU_LANE_H + LANE_GAP;
    }
    y += 12;
  }

  const packCategory = (cat: Category) => {
    const group = timeline.people.filter((p) => p.category === cat);
    const { bars: placed, height } = pack(group, y, LANE_H);
    bars.push(...placed);
    y += height + 12;
  };
  if (filters.family) packCategory('family');
  if (filters.gursikhs) packCategory('gursikh');

  const events: PlacedEvent[] = filters.events
    ? [...timeline.events]
        .sort((a, b) => a.year - b.year)
        .map((e) => ({ event: e, year: e.year, endYear: e.endYear }))
    : [];

  return { bars, events, contentHeight: y };
}

export function yearToPx(year: number, pxPerYear: number): number {
  return (year - YEAR_MIN) * pxPerYear;
}

// Adaptive tick step for the year axis.
export function tickStep(pxPerYear: number): number {
  if (pxPerYear < 3) return 50;
  if (pxPerYear < 7) return 20;
  if (pxPerYear < 16) return 10;
  return 5;
}
