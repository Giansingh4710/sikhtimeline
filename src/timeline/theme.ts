export const colors = {
  background: '#0F1115',
  surface: '#1A1D24',
  surfaceRaised: '#242833',
  text: '#F2F3F5',
  textDim: '#9AA0AC',
  axis: '#3A3F4B',
  gridLine: '#232733',
  accent: '#E8A33D',
};

// One era color per Guru (+ Granth Sahib)
export const guruColors: Record<string, string> = {
  'guru-nanak': '#E8A33D',
  'guru-angad': '#D96C4F',
  'guru-amardas': '#C94F7C',
  'guru-ramdas': '#9B59B6',
  'guru-arjan': '#5C6BC0',
  'guru-hargobind': '#4098D7',
  'guru-harrai': '#26A69A',
  'guru-harkrishan': '#66BB6A',
  'guru-teghbahadur': '#9CCC65',
  'guru-gobindsingh': '#F06292',
  'guru-granth-sahib': '#FFD54F',
};

export const neutralBar = '#5A6170'; // people with no guru association

export function colorFor(guruId?: string): string {
  return (guruId && guruColors[guruId]) || neutralBar;
}
