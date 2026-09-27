import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import {
  createPlaintextStagingCoordinator,
  createPlaintextStagingStartupRecovery,
  createImageManipulatorPlaintextCoordinator,
  isCanonicalImageManipulatorJpegName,
  type PlaintextStagingHandle,
  type PlaintextStagingPurpose,
  type PlaintextStagingState,
} from './plaintextStagingCore';

const coordinator = createPlaintextStagingCoordinator({
  cacheDirectory: FileSystem.cacheDirectory,
  createOperationId: randomUUID,
  now: Date.now,
  storage: AsyncStorage,
  fileSystem: FileSystem,
});

const IMAGE_MANIPULATOR_CACHE_NAME = 'ImageManipulator';

function childUri(directory: string, name: string): string {
  return `${directory.replace(/\/+$/u, '')}/${name}`;
}

async function scavengeImageManipulatorJpegs(): Promise<number> {
  if (!FileSystem.cacheDirectory) return 0;
  const directory = childUri(FileSystem.cacheDirectory, IMAGE_MANIPULATOR_CACHE_NAME);
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) return 0;
  if (!info.isDirectory) throw new Error('PLAINTEXT_IMAGE_MANIPULATOR_CACHE_INVALID');
  const names = (await FileSystem.readDirectoryAsync(directory))
    .filter(isCanonicalImageManipulatorJpegName)
    .sort();
  await Promise.all(
    names.map((name) => FileSystem.deleteAsync(childUri(directory, name), { idempotent: true })),
  );
  return names.length;
}

const imageManipulatorPlaintext = createImageManipulatorPlaintextCoordinator(
  scavengeImageManipulatorJpegs,
);

const startup = createPlaintextStagingStartupRecovery(async () => {
  const generated = await imageManipulatorPlaintext.scavenge();
  return generated + (await coordinator.scavenge());
});

export function runPlaintextImageManipulatorOperation<T>(operation: () => Promise<T>): Promise<T> {
  return startPlaintextStagingRecovery().then(() => imageManipulatorPlaintext.run(operation));
}

export function startPlaintextStagingRecovery(): Promise<number> {
  return startup.start();
}

export function retryPlaintextStagingRecovery(): Promise<number> {
  return startup
    .retry()
    .then(() =>
      imageManipulatorPlaintext
        .scavenge()
        .then(async (generated) => generated + (await coordinator.scavenge())),
    );
}

export function reservePlaintextStaging(
  purpose: PlaintextStagingPurpose,
): Promise<PlaintextStagingHandle> {
  return startPlaintextStagingRecovery().then(() => coordinator.reserve(purpose));
}

export function markPlaintextStagingState(
  handle: PlaintextStagingHandle,
  state: PlaintextStagingState,
): Promise<void> {
  return coordinator.markState(handle, state);
}

export function cleanupPlaintextStaging(handle: PlaintextStagingHandle): Promise<void> {
  return coordinator.cleanup(handle);
}

export function cleanupPlaintextStagingUri(uri: string): Promise<void> {
  return coordinator.cleanupUri(uri);
}

export function scavengePlaintextStaging(): Promise<number> {
  return coordinator.scavenge();
}

export type { PlaintextStagingHandle, PlaintextStagingPurpose, PlaintextStagingState };
export { isCanonicalImageManipulatorJpegName } from './plaintextStagingCore';
export {
  ImageManipulatorPlaintextCleanupError,
  isImageManipulatorPlaintextCleanupError,
} from './plaintextStagingCore';
