// Native builds embed all eight faces through the expo-font config plugin, so
// the font decision is synchronous and no JavaScript asset load gates mounting.
export function useFontDecision(): boolean {
  return true;
}
