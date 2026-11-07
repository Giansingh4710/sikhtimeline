import React, { useEffect } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Person, Selection } from '../data/types';
import { useLanguage } from '../state/LanguageContext';
import { timeline } from '../timeline/layout';
import { colorFor, colors } from '../timeline/theme';
import type { Lang } from '../state/LanguageContext';

const PANEL_W = 320;

type Props = { selection: Selection | null; onClose: () => void };

const yearRange = (from: number, to?: number | null): string =>
  to != null ? `${from} – ${to}` : `${from}`;

const FEMININE_RELATIONS = ['ਧੀ', 'ਭੈਣ', 'ਦਾਦੀ', 'ਮਾਤਾ', 'ਮਹਿਲ'];

// "Daughter" -> "Daughter of Sri Guru Angad Dev Ji" (pa: "<guru> ਦੀ ਧੀ"),
// unless the data marks the stored relation as already complete.
function relationText(person: Person, lang: Lang): string | null {
  if (!person.relation) return null;
  const rel = person.relation[lang];
  const guru = person.guruId ? timeline.people.find((p) => p.id === person.guruId) : undefined;
  if (!guru || guru.id === person.id || person.relationIsComplete) return rel;
  if (lang === 'pa') {
    const feminine = FEMININE_RELATIONS.some((f) => rel.startsWith(f));
    return `${guru.name.pa} ${feminine ? 'ਦੀ' : 'ਦੇ'} ${rel}`;
  }
  return `${rel} of ${guru.name.en}`;
}

export default function DetailSheet({ selection, onClose }: Props) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;
  // Portrait: bottom sheet sliding up. Landscape: right panel sliding in.
  const OFF = isPortrait ? height * 0.6 + insets.bottom : PANEL_W;
  const offset = useSharedValue(1000); // offscreen in either orientation
  // Keep the last selection rendered while the panel slides out.
  const [shown, setShown] = React.useState<Selection | null>(selection);

  useEffect(() => {
    if (selection) {
      setShown(selection);
      offset.value = withTiming(0, { duration: 220 });
    } else {
      offset.value = withTiming(OFF, { duration: 200 }, (done) => {
        if (done) runOnJS(setShown)(null);
      });
    }
  }, [selection, offset, OFF]);

  const panelStyle = useAnimatedStyle(
    () =>
      isPortrait
        ? { transform: [{ translateY: offset.value }] }
        : { transform: [{ translateX: offset.value }] },
    [isPortrait],
  );

  if (!shown) return null;

  const { person, event } = shown;
  const accent = colorFor(person?.guruId ?? event?.guruId);
  const title = person ? person.name[lang] : event.title[lang];
  const years = person
    ? yearRange(person.birth, person.death)
    : yearRange(event.year, event.endYear);
  const wiki = person?.wiki ?? event?.wiki;

  return (
    <Animated.View
      style={[
        isPortrait ? styles.panelBottom : styles.panel,
        panelStyle,
        isPortrait
          ? { paddingBottom: Math.max(insets.bottom, 16) }
          : {
              width: PANEL_W + insets.right,
              paddingRight: Math.max(insets.right, 18) + 2,
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 16),
            },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.card, isPortrait && { maxHeight: height * 0.55 }]}
        pointerEvents="auto"
      >
        <View style={styles.headerRow}>
          <View style={[styles.accentBar, { backgroundColor: accent }]} />
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.years}>{years}</Text>
        {person?.relation && <Text style={styles.relation}>{relationText(person, lang)}</Text>}
        {person?.details && (
          <ScrollView style={styles.details} bounces={false}>
            {person.details.map((row, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{row.label[lang]}</Text>
                <Text style={styles.value}>{row.value[lang]}</Text>
              </View>
            ))}
          </ScrollView>
        )}
        {wiki && (
          <Pressable style={styles.wikiBtn} onPress={() => Linking.openURL(wiki)}>
            <Text style={styles.wikiText}>{lang === 'pa' ? 'ਵਿਕੀਪੀਡੀਆ ↗' : 'Wikipedia ↗'}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Pinned to the right edge, no backdrop — timeline stays visible. The card
  // sizes to its content (short for an event, taller for a Guru), top-aligned.
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 12,
    justifyContent: 'flex-start',
  },
  panelBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
  },
  card: {
    maxHeight: '100%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.axis,
    // Soft shadow so it reads as floating above the canvas.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: -4, height: 0 },
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accentBar: { width: 40, height: 4, borderRadius: 2 },
  close: { padding: 2 },
  closeText: { color: colors.textDim, fontSize: 18, fontWeight: '600' },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  years: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 4 },
  relation: { color: colors.textDim, fontSize: 14, marginTop: 3 },
  details: { marginTop: 12 },
  row: { marginBottom: 10 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 15, marginTop: 2, lineHeight: 21 },
  wikiBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  wikiText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
