/// <reference types="nativewind/types" />

// npm resolves NativeWind's published type entry from the repository root.
// During the SDK 57 migration that entry resolves React Native 0.85's peer tree,
// while this workspace deliberately compiles against React Native 0.86.  Repeat
// the public NativeWind interop augmentation from this workspace so `className`
// is attached to the actual React Native 0.86 prop interfaces used by TypeScript.
// This is type-only; NativeWind's Babel runtime transform remains unchanged.
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ScrollViewProps {
    contentContainerClassName?: string;
    indicatorClassName?: string;
  }

  interface TextProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ImagePropsBase {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextInputProps {
    placeholderClassName?: string;
  }

  interface SwitchProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TouchableWithoutFeedbackProps {
    className?: string;
    cssInterop?: boolean;
  }
}
