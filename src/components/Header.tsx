import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLanguage } from '../state/LanguageContext';
import { colors } from '../timeline/theme';
import FilterChips from './FilterChips';
import type { Filters } from '../timeline/layout';

type Props = { filters: Filters; onChange: (f: Filters) => void; onSearchPress: () => void };

// Landscape: single compact row — title | chips | search | language toggle.
// Portrait: two rows — title + buttons on top, full-width chips below.
export default function Header({ filters, onChange, onSearchPress }: Props) {
  const { lang, toggle } = useLanguage();
  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;

  const title = (
    <Text style={styles.title} numberOfLines={1}>
      {lang === 'pa' ? 'ਸਾਡੇ ਗੁਰੂ ਸਾਹਿਬਾਨ' : 'Sikh Timeline'}
    </Text>
  );
  const buttons = (
    <>
      <Pressable style={styles.toggle} onPress={onSearchPress} hitSlop={8}>
        <Text style={styles.toggleText}>🔍</Text>
      </Pressable>
      <Pressable style={styles.toggle} onPress={toggle} hitSlop={8}>
        <Text style={styles.toggleText}>{lang === 'pa' ? 'EN' : 'ਪੰ'}</Text>
      </Pressable>
    </>
  );

  if (isPortrait) {
    return (
      <View style={styles.column}>
        <View style={styles.row}>
          <View style={styles.grow}>{title}</View>
          {buttons}
        </View>
        <View style={styles.chipsRow}>
          <FilterChips filters={filters} onChange={onChange} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {title}
      <View style={styles.grow}>
        <FilterChips filters={filters} onChange={onChange} />
      </View>
      {buttons}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { backgroundColor: colors.background },
  chipsRow: { paddingHorizontal: 12, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 0 },
  grow: { flex: 1 },
  toggle: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  toggleText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
