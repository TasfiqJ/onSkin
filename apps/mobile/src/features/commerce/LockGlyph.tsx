import { View } from 'react-native';

// A monochrome padlock built from geometric Views (the no-react-native-svg
// convention) — replaces full-colour emoji so the icon inherits the surrounding clay/
// muted colour and reads as a calm line-icon (docs/10 design fidelity). Used wherever
// the mock shows a privacy/lock line-icon (the where-to-buy locked row, the consent
// gate, the transparency footer).
export function LockGlyph({ size = 14, color }: { size?: number; color: string }) {
  const shackleW = Math.round(size * 0.58);
  const shackleH = Math.round(size * 0.5);
  const bodyH = Math.round(size * 0.62);
  return (
    <View style={{ alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: shackleW,
          height: shackleH,
          borderWidth: Math.max(1.4, size * 0.11),
          borderColor: color,
          borderTopLeftRadius: shackleW,
          borderTopRightRadius: shackleW,
          borderBottomWidth: 0,
          marginBottom: -1,
        }}
      />
      <View style={{ width: size, height: bodyH, borderRadius: Math.max(2, size * 0.16), backgroundColor: color }} />
    </View>
  );
}
