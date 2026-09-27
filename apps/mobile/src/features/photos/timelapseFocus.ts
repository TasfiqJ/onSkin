import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';

export function focusTimelapseElementAfterLayout(getElement: () => View | null): () => void {
  const frame = requestAnimationFrame(() => {
    const node = findNodeHandle(getElement());
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  });
  return () => cancelAnimationFrame(frame);
}
