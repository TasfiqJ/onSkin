import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { View, type StyleProp } from 'react-native';

import { Text } from '@/components/ui';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { colors } from '@/theme/tokens';

import { decryptPhotoToDataUri, isEncryptedPhotoUri } from './encryptedStorage';
import {
  purgeSensitiveImageMemory,
  subscribeToSensitiveImageLifecycle,
} from './sensitiveImageMemory';
import {
  SENSITIVE_IMAGE_CACHE_POLICY,
  SENSITIVE_IMAGE_TRANSITION_MS,
} from './sensitiveImagePolicy';

export function PhotoImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackTone = colors.greigeDeep,
  accessible,
  accessibilityLabel,
}: {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  fallbackTone?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
}) {
  const { appUnlocked, enabled, photoTimelineUnlocked } = useAppLock();
  const canDisplaySensitivePhoto = appUnlocked && (!enabled || photoTimelineUnlocked);
  const encrypted = isEncryptedPhotoUri(uri);
  const [lifecycleRevision, setLifecycleRevision] = useState(0);
  const [resolved, setResolved] = useState<{
    source: string;
    uri: string | null;
    failed: boolean;
  } | null>(null);

  useEffect(
    () =>
      subscribeToSensitiveImageLifecycle((event) => {
        if (event === 'purge') {
          setResolved(null);
          return;
        }
        setLifecycleRevision((revision) => revision + 1);
      }),
    [],
  );

  useEffect(() => {
    if (canDisplaySensitivePhoto) return;
    void purgeSensitiveImageMemory();
  }, [canDisplaySensitivePhoto]);

  useEffect(() => {
    let alive = true;
    if (!uri || !encrypted || !canDisplaySensitivePhoto) return;
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
  }, [canDisplaySensitivePhoto, encrypted, lifecycleRevision, uri]);

  const resolvedForUri = resolved && resolved.source === uri ? resolved : null;
  const displayUri = canDisplaySensitivePhoto
    ? uri && !encrypted
      ? uri
      : (resolvedForUri?.uri ?? null)
    : null;
  const failed = encrypted && Boolean(resolvedForUri?.failed);

  if (displayUri) {
    return (
      <Image
        source={{ uri: displayUri }}
        style={style}
        contentFit={contentFit}
        cachePolicy={SENSITIVE_IMAGE_CACHE_POLICY}
        transition={SENSITIVE_IMAGE_TRANSITION_MS}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      style={[
        { flex: 1, backgroundColor: fallbackTone, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Text variant="label" style={{ color: 'rgba(32,27,21,0.28)' }}>
        {failed ? 'photo locked' : 'your photo'}
      </Text>
    </View>
  );
}
