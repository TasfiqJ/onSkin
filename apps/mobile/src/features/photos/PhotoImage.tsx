import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { View, type StyleProp } from 'react-native';

import { Text } from '@/components/ui';
import { getAccountGeneration } from '@/lib/auth/accountGeneration';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { colors } from '@/theme/tokens';

import { isEncryptedPhotoUri } from './encryptedStorage';
import {
  isSensitiveImageDiskCacheMigrationComplete,
  prepareSensitiveImageDiskCacheMigration,
} from './sensitiveImageDiskCache';
import { requestSensitiveImage } from './sensitiveImageCoordinator';
import {
  isSensitiveImageRequestCancelled,
  type SensitiveImageRequestPriority,
} from './sensitiveImageCoordinatorCore';
import {
  isSensitiveImageLifecycleActive,
  purgeSensitiveImageMemory,
  subscribeToSensitiveImageLifecycle,
} from './sensitiveImageMemory';
import {
  SENSITIVE_IMAGE_CACHE_POLICY,
  SENSITIVE_IMAGE_TRANSITION_MS,
} from './sensitiveImagePolicy';

type PhotoImageProps = {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  fallbackTone?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
  active?: boolean;
  photoId?: string;
  rendition?: 'thumbnail' | 'display';
  requestPriority?: SensitiveImageRequestPriority;
};

type PhotoStorageRendition = 'thumbnail:v1' | 'legacy-full:v1';
type ActivePhotoImageProps = Omit<PhotoImageProps, 'active'> & {
  ownerGeneration: number | null;
  storageRendition: PhotoStorageRendition;
};

function photoStorageRendition(uri: string | null | undefined): PhotoStorageRendition {
  return uri?.endsWith('-thumbnail.onskinphoto') ? 'thumbnail:v1' : 'legacy-full:v1';
}

function photoOwnerGeneration(photoId: string | undefined): number | null {
  if (!photoId) return null;
  try {
    return getAccountGeneration();
  } catch {
    return null;
  }
}

function PhotoFallback({
  style,
  fallbackTone = colors.greigeDeep,
  accessible,
  accessibilityLabel,
  failed = false,
}: Pick<PhotoImageProps, 'style' | 'fallbackTone' | 'accessible' | 'accessibilityLabel'> & {
  failed?: boolean;
}) {
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

/** Owns every data URI. The outer component unmounts this subtree whenever a
 * cell leaves viewability or a privacy gate closes, releasing React state and
 * the native image view rather than merely hiding retained plaintext. */
function ActivePhotoImage({
  uri,
  style,
  contentFit = 'cover',
  fallbackTone = colors.greigeDeep,
  accessible,
  accessibilityLabel,
  photoId,
  rendition = 'display',
  requestPriority = 'interactive',
  ownerGeneration,
  storageRendition,
}: ActivePhotoImageProps) {
  const encrypted = isEncryptedPhotoUri(uri);
  const recyclingKey =
    ownerGeneration === null || !photoId
      ? null
      : `${ownerGeneration}:${photoId}:${storageRendition}:${rendition}`;
  const [lifecycleRevision, setLifecycleRevision] = useState(0);
  const [lifecycleActive, setLifecycleActive] = useState(isSensitiveImageLifecycleActive);
  const [diskCacheReady, setDiskCacheReady] = useState(
    isSensitiveImageDiskCacheMigrationComplete,
  );
  const [resolved, setResolved] = useState<{
    source: string;
    uri: string | null;
    failed: boolean;
  } | null>(null);

  useEffect(
    () =>
      subscribeToSensitiveImageLifecycle((event) => {
        if (event === 'purge') {
          setLifecycleActive(false);
          setResolved(null);
          return;
        }
        setLifecycleActive(true);
        setLifecycleRevision((revision) => revision + 1);
      }),
    [],
  );

  useEffect(() => {
    if (diskCacheReady || !encrypted) return;
    let alive = true;
    void prepareSensitiveImageDiskCacheMigration().then((ready) => {
      if (alive && ready) setDiskCacheReady(true);
    });
    return () => {
      alive = false;
    };
  }, [diskCacheReady, encrypted, lifecycleRevision]);

  useEffect(() => {
    let alive = true;
    if (
      !uri ||
      !encrypted ||
      !photoId ||
      ownerGeneration === null ||
      !diskCacheReady ||
      !lifecycleActive ||
      !isSensitiveImageLifecycleActive()
    ) {
      return;
    }
    // Until v2 thumbnails exist, a logical thumbnail and display both resolve
    // the same v1 original. Deduplicate that authority under one opaque key.
    const requestKey = `${photoId}:${storageRendition}`;
    const request = requestSensitiveImage(requestKey, uri, ownerGeneration, requestPriority);
    void request.promise
      .then((next) => {
        if (alive) setResolved({ source: uri, uri: next, failed: false });
      })
      .catch((error: unknown) => {
        if (alive && !isSensitiveImageRequestCancelled(error)) {
          setResolved({ source: uri, uri: null, failed: true });
        }
      });
    return () => {
      alive = false;
      request.cancel();
    };
  }, [
    encrypted,
    diskCacheReady,
    lifecycleActive,
    lifecycleRevision,
    ownerGeneration,
    photoId,
    requestPriority,
    storageRendition,
    uri,
  ]);

  const resolvedForUri = resolved && resolved.source === uri ? resolved : null;
  const failed = encrypted && Boolean(resolvedForUri?.failed);

  // Staging/capture URIs are plaintext even though they are not encrypted yet.
  // Close the native image view for every source at lifecycle privacy bounds,
  // not only for decrypted storage records.
  if (!lifecycleActive) {
    return (
      <PhotoFallback
        style={style}
        fallbackTone={fallbackTone}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  const displayUri = uri && !encrypted ? uri : (resolvedForUri?.uri ?? null);

  if (displayUri) {
    return (
      <Image
        source={{ uri: displayUri }}
        style={style}
        contentFit={contentFit}
        cachePolicy={SENSITIVE_IMAGE_CACHE_POLICY}
        transition={SENSITIVE_IMAGE_TRANSITION_MS}
        recyclingKey={recyclingKey ?? undefined}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <PhotoFallback
      style={style}
      fallbackTone={fallbackTone}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      failed={failed}
    />
  );
}

export function PhotoImage({ active = true, ...props }: PhotoImageProps) {
  const { appUnlocked, enabled, photoTimelineUnlocked } = useAppLock();
  const canDisplaySensitivePhoto = appUnlocked && (!enabled || photoTimelineUnlocked);
  const encrypted = isEncryptedPhotoUri(props.uri);
  const ownerGeneration = photoOwnerGeneration(props.photoId);
  const storageRendition = photoStorageRendition(props.uri);
  const identityUnavailable = encrypted && (!props.photoId || ownerGeneration === null);

  useEffect(() => {
    if (canDisplaySensitivePhoto) return;
    void purgeSensitiveImageMemory();
  }, [canDisplaySensitivePhoto]);

  if (!active || !canDisplaySensitivePhoto || identityUnavailable) {
    return (
      <PhotoFallback
        style={props.style}
        fallbackTone={props.fallbackTone}
        accessible={props.accessible}
        accessibilityLabel={props.accessibilityLabel}
        failed={identityUnavailable}
      />
    );
  }

  const rendition = props.rendition ?? 'display';
  const stateIdentity = `${ownerGeneration ?? 'ephemeral'}:${props.photoId ?? 'capture'}:${storageRendition}:${rendition}:${props.uri ?? 'missing'}`;
  return (
    <ActivePhotoImage
      key={stateIdentity}
      {...props}
      ownerGeneration={ownerGeneration}
      storageRendition={storageRendition}
    />
  );
}
