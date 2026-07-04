import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { View, type StyleProp } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { decryptPhotoToDataUri, isEncryptedPhotoUri } from './encryptedStorage';

export function PhotoImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackTone = colors.greigeDeep,
}: {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  fallbackTone?: string;
}) {
  const encrypted = isEncryptedPhotoUri(uri);
  const [resolved, setResolved] = useState<{ source: string; uri: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    if (!uri || !encrypted) return;
    void decryptPhotoToDataUri(uri)
      .then((next) => {
        if (alive) setResolved({ source: uri, uri: next, failed: false });
      })
      .catch(() => {
        if (alive) setResolved({ source: uri, uri: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [encrypted, uri]);

  const resolvedForUri = resolved && resolved.source === uri ? resolved : null;
  const displayUri = uri && !encrypted ? uri : resolvedForUri?.uri ?? null;
  const failed = encrypted && Boolean(resolvedForUri?.failed);

  if (displayUri) {
    return <Image source={{ uri: displayUri }} style={style} contentFit={contentFit} transition={120} />;
  }

  return (
    <View style={[{ flex: 1, backgroundColor: fallbackTone, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text variant="label" style={{ color: 'rgba(32,27,21,0.28)' }}>
        {failed ? 'photo locked' : 'your photo'}
      </Text>
    </View>
  );
}
