import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DetailSheet from './src/components/DetailSheet';
import Header from './src/components/Header';
import SearchOverlay from './src/components/SearchOverlay';
import { LanguageProvider } from './src/state/LanguageContext';
import Timeline, { type Selection } from './src/timeline/Timeline';
import type { Filters } from './src/timeline/layout';
import { colors } from './src/timeline/theme';

// 'guru' and 'granth' both render under the gurus filter.
const filterKeyFor = (sel: Selection): keyof Filters =>
  sel.event
    ? 'events'
    : sel.person.category === 'family'
      ? 'family'
      : sel.person.category === 'gursikh'
        ? 'gursikhs'
        : 'gurus';

export default function App() {
  const [filters, setFilters] = useState<Filters>({
    gurus: true,
    family: true,
    gursikhs: true,
    events: true,
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<{ sel: Selection } | null>(null);

  // Search pick: enable the item's filter if hidden, select (halo + detail
  // sheet), and center the timeline on it.
  const handlePick = (sel: Selection) => {
    const key = filterKeyFor(sel);
    if (!filters[key]) setFilters({ ...filters, [key]: true });
    setSelection(sel);
    setScrollTarget({ sel }); // fresh object so repeat picks re-center
    setSearchOpen(false);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LanguageProvider>
          <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
            <StatusBar style="light" hidden />
            <Header
              filters={filters}
              onChange={setFilters}
              onSearchPress={() => setSearchOpen(true)}
            />
            <Timeline
              filters={filters}
              selection={selection}
              onSelect={setSelection}
              scrollTarget={scrollTarget}
            />
            <DetailSheet selection={selection} onClose={() => setSelection(null)} />
            <SearchOverlay
              visible={searchOpen}
              onClose={() => setSearchOpen(false)}
              onPick={handlePick}
            />
          </SafeAreaView>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
