import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { tagLabel } from '@/features/intelligence/presentation';
import { tagsForIngredient } from '@/features/intelligence/tags';
import { useIntake } from '@/features/shelf/IntakeContext';
import { haptics } from '@/theme/haptics';

// Scan the ingredient list (design screen 02, docs/04 §4.3). On-device OCR of the
// printed INCI → tokenise → match the catalog → a CONFIRMABLE parse that flags
// low-confidence tokens (INCI OCR is error-prone, so never block on it). The live
// camera + ML Kit text recognition is blocked (B-CATALOG-SEED + native camera);
// this parses a captured sample through the real client tag dictionary so the
// confirm/correct surface is genuine, then hands the actives to the manual form
// (name/brand from the user, actives from the parse).
const SAMPLE_INCI =
  'AQUA / WATER, GLYCERIN, NIACINAMIDE, CETEARYL ALCOHOL, CERAMIDE NP, RETINOL, TOCOPHEROL, SODIUM HYALURONATE, PANTHENOL, PHENOXYETHANOL';

type Parsed = { token: string; tag: string };

function parseActives(inci: string): Parsed[] {
  const out: Parsed[] = [];
  for (const raw of inci.split(',')) {
    const token = raw.trim();
    const tags = tagsForIngredient(token);
    if (tags.length && tags[0]) {
      // Title-case the token for display, keep its functional tag.
      const display = token
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      out.push({ token: display, tag: tagLabel(tags[0].tag) });
    }
  }
  return out;
}

export default function OcrScreen() {
  const { update } = useIntake();
  const actives = parseActives(SAMPLE_INCI);

  const onContinue = () => {
    haptics.select();
    // Carry the recognised active names into the draft; the manual form collects
    // name/brand/category and the opened-date step finalises (docs/04 §4.3).
    update({ ingredients: actives.map((a) => a.token), addedVia: 'ocr' });
    router.replace('/shelf/manual');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <Text variant="bodySm" tone="muted" onPress={() => router.back()}>
          Back
        </Text>
        <Text variant="body" className="font-sans-semibold">
          Read the label
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4">
        {/* Captured INCI image placeholder with the two amber OCR highlight bands. */}
        <View className="mt-4 h-[150px] overflow-hidden rounded-[18px] bg-night-elevated p-4">
          <Text className="font-mono text-[9.5px] leading-[17px]" tone="inverseMuted">
            {SAMPLE_INCI} ...
          </Text>
          <View
            className="absolute left-[14px] right-[14px] top-[42px] h-[14px] rounded-[3px]"
            style={{
              backgroundColor: 'rgba(217,161,131,0.25)',
              borderWidth: 1,
              borderColor: 'rgba(217,161,131,0.5)',
            }}
          />
          <View
            className="absolute left-[14px] top-[80px] h-[14px] w-[120px] rounded-[3px]"
            style={{
              backgroundColor: 'rgba(217,161,131,0.25)',
              borderWidth: 1,
              borderColor: 'rgba(217,161,131,0.5)',
            }}
          />
        </View>

        <Text variant="bodySm" tone="muted" className="mt-3">
          We found these actives. Tap to fix anything. OCR isn&apos;t perfect, so check before
          saving.
        </Text>

        <Text variant="eyebrow" tone="clay" className="mt-4">
          Parsed actives
        </Text>
        <View className="mt-2.5 gap-2">
          {actives.map((a) => (
            <View
              key={a.token}
              className="flex-row items-center gap-3 rounded-[14px] border border-hairline bg-paper-raised p-3.5">
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-clay">
                <Text className="text-[10px] text-paper">✓</Text>
              </View>
              <Text variant="bodySm" className="flex-1 font-sans-semibold">
                {a.token}
              </Text>
              <Text variant="label" tone="muted">
                {a.tag}
              </Text>
            </View>
          ))}
          {/* A deliberately low-confidence OCR token. Flagged (dashed), never silently kept. */}
          <View
            className="flex-row items-center gap-3 rounded-[14px] border border-dashed bg-greige-chip p-3.5"
            style={{ borderColor: 'rgba(32,27,21,0.18)' }}>
            <View className="h-[18px] w-[18px] rounded-full border-[1.5px] border-muted-light" />
            <Text variant="bodySm" tone="muted" className="flex-1 font-sans-semibold">
              &quot;TOCOPHENOL&quot;. Not sure
            </Text>
            <Text variant="bodySm" tone="clay" className="font-sans-semibold">
              Fix
            </Text>
          </View>
        </View>
      </ScrollView>

      <Button label="Looks right. Continue" onPress={onContinue} />
    </Screen>
  );
}
