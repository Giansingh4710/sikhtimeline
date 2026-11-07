import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLanguage } from '../state/LanguageContext';
import type { Filters } from '../timeline/layout';
import { colors } from '../timeline/theme';

const CHIPS: { key: keyof Filters; pa: string; en: string }[] = [
  { key: 'gurus', pa: 'ਗੁਰੂ ਸਾਹਿਬਾਨ', en: 'Gurus' },
  { key: 'family', pa: 'ਪਰਿਵਾਰ', en: 'Family' },
  { key: 'gursikhs', pa: 'ਗੁਰਸਿੱਖ', en: 'Gursikhs' },
  { key: 'events', pa: 'ਘਟਨਾਵਾਂ', en: 'Events' },
];

type Props = { filters: Filters; onChange: (f: Filters) => void };

export default function FilterChips({ filters, onChange }: Props) {
  const { lang } = useLanguage();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {CHIPS.map((c) => {
        const active = filters[c.key];
        return (
          <Pressable
            key={c.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange({ ...filters, [c.key]: !active })}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{c[lang]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, backgroundColor: colors.background },
  row: { gap: 6, paddingHorizontal: 2, alignItems: 'center' },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.axis,
  },
  chipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.text },
});
