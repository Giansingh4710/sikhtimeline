export type Bilingual = { pa: string; en: string };

export type Category = 'guru' | 'family' | 'gursikh' | 'granth';

// Gurus and the Granth get wider lanes, larger bold labels.
export const isGuruLike = (category: Category): boolean =>
  category === 'guru' || category === 'granth';

export type DetailRow = { label: Bilingual; value: Bilingual };

export type Person = {
  id: string;
  name: Bilingual;
  birth: number;
  death: number | null; // null = ongoing (Sri Guru Granth Sahib Ji)
  category: Category;
  relation?: Bilingual; // Father, Mother, Wife, Son...
  relationIsComplete?: boolean; // relation already names the person it refers to
  guruId?: string; // which Guru's group (grouping + era color)
  details?: DetailRow[];
  wiki?: string;
};

export type TimelineEvent = {
  id: string;
  year: number;
  endYear?: number;
  title: Bilingual;
  guruId?: string;
  wiki?: string;
};

export type TimelineData = {
  people: Person[];
  events: TimelineEvent[];
};

// A tapped item: exactly one of person / event.
export type Selection =
  | { person: Person; event?: undefined }
  | { event: TimelineEvent; person?: undefined };
