import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Selection } from '../data/types';
import { useLanguage } from '../state/LanguageContext';
import { timeline } from '../timeline/layout';
import { colorFor, colors } from '../timeline/theme';

type Item = {
  id: string;
  en: string;
  pa: string;
  year: number;
  guruId?: string;
  sel: Selection;
};

// Static corpus (86 people + 43 events) — built once, sorted by year.
const INDEX: Item[] = [
  ...timeline.people.map((p) => ({
    id: p.id,
    en: p.name.en,
    pa: p.name.pa,
    year: p.birth,
    guruId: p.guruId,
    sel: { person: p } as Selection,
  })),
  ...timeline.events.map((e) => ({
    id: e.id,
    en: e.title.en,
    pa: e.title.pa,
    year: e.year,
    guruId: e.guruId,
    sel: { event: e } as Selection,
  })),
].sort((a, b) => a.year - b.year);

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (sel: Selection) => void;
};

export default function SearchOverlay({ visible, onClose, onPick }: Props) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return INDEX; // empty query = browsable index
    const lower = q.toLowerCase();
    // Gurmukhi has no case, so raw substring match is correct for pa.
    return INDEX.filter((i) => i.en.toLowerCase().includes(lower) || i.pa.includes(q));
  }, [q]);

  if (!visible) return null;

  const pick = (item: Item) => {
    setQuery('');
    onPick(item.sel);
  };
  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { paddingTop: Math.max(insets.top, 10) },
      ]}
    >
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          placeholder={lang === 'pa' ? 'ਖੋਜੋ…' : 'Search…'}
          placeholderTextColor={colors.textDim}
        />
        <Pressable style={styles.close} onPress={close} hitSlop={10}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => pick(item)}>
            <View style={[styles.dot, { backgroundColor: colorFor(item.guruId) }]} />
            <View style={styles.rowText}>
              <Text style={styles.primary} numberOfLines={1}>
                {lang === 'pa' ? item.pa : item.en}
              </Text>
              <Text style={styles.secondary} numberOfLines={1}>
                {item.year} · {lang === 'pa' ? item.en : item.pa}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {lang === 'pa' ? 'ਕੁਝ ਨਹੀਂ ਮਿਲਿਆ' : 'No results'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 16,
  },
  close: { padding: 4 },
  closeText: { color: colors.textDim, fontSize: 18, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1 },
  primary: { color: colors.text, fontSize: 16, fontWeight: '600' },
  secondary: { color: colors.textDim, fontSize: 13, marginTop: 1 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 32, fontSize: 15 },
});
