import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import {
  createPlaintextStagingCoordinator,
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

export function reservePlaintextStaging(
  purpose: PlaintextStagingPurpose,
): Promise<PlaintextStagingHandle> {
  return coordinator.reserve(purpose);
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
