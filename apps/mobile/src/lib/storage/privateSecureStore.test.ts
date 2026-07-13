import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PRIVATE_SECURE_STORE_OPTIONS,
  deletePrivateSecureStoreItemAsync,
  getPrivateSecureStoreItemAsync,
  isPrivateSecureStoreAvailableAsync,
  setPrivateSecureStoreItemAsync,
} from './privateSecureStore';

const mocks = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  deleteItemAsync: mocks.deleteItemAsync,
  getItemAsync: mocks.getItemAsync,
  isAvailableAsync: mocks.isAvailableAsync,
  setItemAsync: mocks.setItemAsync,
}));

const STORAGE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIRECTORY = resolve(STORAGE_DIRECTORY, '..', '..');
const requireFromTest = createRequire(import.meta.url);
const SECURE_STORE_DIRECTORY = dirname(requireFromTest.resolve('expo-secure-store/package.json'));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

describe('private SecureStore policy', () => {
  beforeEach(() => {
    mocks.deleteItemAsync.mockReset();
    mocks.getItemAsync.mockReset();
    mocks.isAvailableAsync.mockReset();
    mocks.setItemAsync.mockReset();
  });

  it('uses the foreground-only, non-migrating iOS Keychain accessibility class', () => {
    expect(PRIVATE_SECURE_STORE_OPTIONS).toEqual({ keychainAccessible: 7 });
    expect(Object.isFrozen(PRIVATE_SECURE_STORE_OPTIONS)).toBe(true);
    expect(PRIVATE_SECURE_STORE_OPTIONS).not.toHaveProperty('keychainService');
  });

  it('applies one immutable policy to private reads, writes, and deletes', async () => {
    mocks.isAvailableAsync.mockResolvedValue(true);
    mocks.getItemAsync.mockResolvedValue('value');
    mocks.setItemAsync.mockResolvedValue(undefined);
    mocks.deleteItemAsync.mockResolvedValue(undefined);

    await expect(isPrivateSecureStoreAvailableAsync()).resolves.toBe(true);
    await expect(getPrivateSecureStoreItemAsync('private.key')).resolves.toBe('value');
    await expect(setPrivateSecureStoreItemAsync('private.key', 'value')).resolves.toBeUndefined();
    await expect(deletePrivateSecureStoreItemAsync('private.key')).resolves.toBeUndefined();

    expect(mocks.getItemAsync).toHaveBeenCalledWith('private.key', PRIVATE_SECURE_STORE_OPTIONS);
    expect(mocks.setItemAsync).toHaveBeenCalledWith(
      'private.key',
      'value',
      PRIVATE_SECURE_STORE_OPTIONS,
    );
    expect(mocks.deleteItemAsync).toHaveBeenCalledWith('private.key', PRIVATE_SECURE_STORE_OPTIONS);
  });

  it('keeps production SecureStore access behind the policy wrapper', () => {
    const directImports = sourceFiles(SOURCE_DIRECTORY)
      .filter((path) => path !== fileURLToPath(import.meta.url).replace(/\.test\.ts$/, '.ts'))
      .filter((path) => /from ['"]expo-secure-store['"]/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(SOURCE_DIRECTORY.length + 1).replaceAll('\\', '/'));

    expect(directImports).toEqual([]);
  });

  it('pins the reviewed Expo iOS creation-versus-update behavior', () => {
    const swiftSource = readFileSync(
      join(SECURE_STORE_DIRECTORY, 'ios', 'SecureStoreModule.swift'),
      'utf8',
    );
    const updateBody = swiftSource.match(
      /private func update\([\s\S]*?\n  }\n\n  private func searchKeyChain/,
    )?.[0];

    expect(swiftSource).toContain('setItemQuery[kSecAttrAccessible as String] = accessibility');
    expect(swiftSource).toContain('return kSecAttrAccessibleWhenUnlockedThisDeviceOnly');
    expect(updateBody).toContain('kSecValueData as String: valueData');
    expect(updateBody).not.toContain('kSecAttrAccessible');
  });
});
