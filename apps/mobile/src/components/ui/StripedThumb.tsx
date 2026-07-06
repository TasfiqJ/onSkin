import { Platform, View, type ViewStyle } from 'react-native';

// Diagonal-hatch product placeholder. The "Smart Shelf" design renders every
// thumbnail (and the empty-state bottles) as a 45deg striped square until real
// on-device imagery exists (docs/04 §5.2/§7, B-CATALOG-SEED + camera). Native RN
// has no repeating-linear-gradient and the house rule forbids react-native-svg,
// so the native hatch is composed from skewed stripe Views clipped to a rounded
// container. Web uses a clipped CSS gradient so transformed decoration never
// contributes overflow. Two warm greige tones; `light` uses the lighter
// archive/empty palette.
type Props = {
  size?: number;
  width?: number;
  height?: number;
  radius?: number;
  faded?: boolean;
  light?: boolean;
};

export function StripedThumb({
  size = 50,
  width,
  height,
  radius = 14,
  faded = false,
  light = false,
}: Props) {
  const w = width ?? size;
  const h = height ?? size;
  const base = light ? '#E7E0D5' : '#EFE9DF';
  const stripe = light ? '#EEE8DE' : '#F5F0E8';
  const band = 9; // stripe width; spacing is 2x band
  const webHatch: ViewStyle | null =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `repeating-linear-gradient(135deg, ${stripe} 0px, ${stripe} ${band}px, transparent ${band}px, transparent ${
            band * 2
          }px)`,
        } as ViewStyle)
      : null;
  const span = Math.max(w, h);
  const count = Math.ceil((span * 2) / (band * 2)) + 2;
  const wrap: ViewStyle = {
    width: w,
    height: h,
    borderRadius: radius,
    backgroundColor: base,
    overflow: 'hidden',
    opacity: faded ? 0.7 : 1,
  };
  return (
    <View style={[wrap, webHatch]}>
      {Platform.OS !== 'web'
        ? Array.from({ length: count }).map((_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: -span,
                bottom: -span,
                left: i * band * 2 - span,
                width: band,
                backgroundColor: stripe,
                transform: [{ rotate: '45deg' }],
              }}
            />
          ))
        : null}
    </View>
  );
}
