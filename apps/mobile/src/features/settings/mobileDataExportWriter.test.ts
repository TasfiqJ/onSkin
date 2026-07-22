import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MobileDataExportBundle } from './localDeviceExport';
import {
  MOBILE_DATA_EXPORT_FILE_CLOSE_FAILED,
  MOBILE_DATA_EXPORT_FILE_CREATE_FAILED,
  MOBILE_DATA_EXPORT_FILE_OPEN_FAILED,
  MOBILE_DATA_EXPORT_FILE_WRITE_FAILED,
  writeMobileDataExportFile,
} from './mobileDataExportWriter';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  construct: vi.fn(),
  create: vi.fn(),
  open: vi.fn(),
  writeBytes: vi.fn(),
  chunks: [] as Uint8Array[],
}));

vi.mock('expo-file-system', () => ({
  File: class MockFile {
    constructor(uri: string) {
      mocks.construct(uri);
    }

    create(options: { intermediates: boolean; overwrite: boolean }) {
      return mocks.create(options);
    }

    open(mode: string) {
      mocks.open(mode);
      return {
        close: mocks.close,
        writeBytes: mocks.writeBytes,
      };
    }
  },
  FileMode: { WriteOnly: 'w' },
}));

function bundle(serverAccountData: unknown = { export_schema_version: 2, user_id: 'user-1' }) {
  return {
    mobile_export_schema_version: 1,
    exported_at: '2026-07-21T12:00:00.000Z',
    server_account_data_status: 'included',
    server_account_data: serverAccountData,
    local_device_data: {
      schema_version: 1,
      collected_at: '2026-07-21T11:59:00.000Z',
      storage_scope: 'encrypted_private_storage_on_this_device',
      sections: {
        account_and_privacy: {},
        profile_and_preferences: {},
        shelf_and_routine: {},
        activity_and_app_state: {},
        subscription: {},
        progress: {},
      },
      exclusions: [],
    },
    local_media_note: 'Progress photo files and thumbnails are not included.',
  } satisfies MobileDataExportBundle;
}

function writtenText(): string {
  const byteLength = mocks.chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const combined = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of mocks.chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

describe('mobile data export file writer', () => {
  beforeEach(() => {
    mocks.close.mockReset();
    mocks.construct.mockReset();
    mocks.create.mockReset();
    mocks.open.mockReset();
    mocks.writeBytes.mockReset();
    mocks.chunks.length = 0;
    mocks.writeBytes.mockImplementation((bytes: Uint8Array) => {
      mocks.chunks.push(bytes.slice());
    });
  });

  it('creates one new file, streams exact JSON, and closes before returning', async () => {
    const value = bundle();
    const assertCurrent = vi.fn();

    const result = await writeMobileDataExportFile('file://owned/export.json', value, {
      assertCurrent,
    });

    expect(result).toEqual({
      chunksWritten: mocks.chunks.length,
      bytesWritten: new TextEncoder().encode(JSON.stringify(value, null, 2)).byteLength,
    });

    expect(mocks.construct).toHaveBeenCalledWith('file://owned/export.json');
    expect(mocks.create).toHaveBeenCalledWith({ intermediates: false, overwrite: false });
    expect(mocks.open).toHaveBeenCalledWith('w');
    expect(writtenText()).toBe(JSON.stringify(value, null, 2));
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.writeBytes.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.close.mock.invocationCallOrder[0]!,
    );
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
      assertCurrent.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('fails creation without opening or writing', async () => {
    mocks.create.mockImplementationOnce(() => {
      throw new Error('native path includes private value');
    });

    await expect(
      writeMobileDataExportFile('file://owned/private-value.json', bundle(), {
        assertCurrent: () => undefined,
      }),
    ).rejects.toThrow(MOBILE_DATA_EXPORT_FILE_CREATE_FAILED);

    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.writeBytes).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('fails opening without writing or attempting to close an absent handle', async () => {
    mocks.open.mockImplementationOnce(() => {
      throw new Error('native open failed');
    });

    await expect(
      writeMobileDataExportFile('file://owned/export.json', bundle(), {
        assertCurrent: () => undefined,
      }),
    ).rejects.toThrow(MOBILE_DATA_EXPORT_FILE_OPEN_FAILED);

    expect(mocks.writeBytes).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('closes exactly once after a bounded mid-write failure', async () => {
    mocks.writeBytes.mockImplementationOnce(() => {
      throw new Error('native write contains path');
    });

    await expect(
      writeMobileDataExportFile('file://owned/private-value.json', bundle(), {
        assertCurrent: () => undefined,
      }),
    ).rejects.toThrow(MOBILE_DATA_EXPORT_FILE_WRITE_FAILED);

    expect(mocks.writeBytes).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('treats close failure as an incomplete file', async () => {
    mocks.close.mockImplementationOnce(() => {
      throw new Error('native close failed');
    });

    await expect(
      writeMobileDataExportFile('file://owned/export.json', bundle(), {
        assertCurrent: () => undefined,
      }),
    ).rejects.toThrow(MOBILE_DATA_EXPORT_FILE_CLOSE_FAILED);

    expect(mocks.writeBytes).toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('preserves account invalidation over a concurrent close failure', async () => {
    let current = true;
    const assertCurrent = vi.fn(() => {
      if (!current) throw new Error('ACCOUNT_GENERATION_CHANGED');
    });
    mocks.writeBytes.mockImplementationOnce((bytes: Uint8Array) => {
      mocks.chunks.push(bytes.slice());
      current = false;
    });
    mocks.close.mockImplementationOnce(() => {
      throw new Error('native close includes private path');
    });

    await expect(
      writeMobileDataExportFile('file://owned/private-value.json', bundle(), { assertCurrent }),
    ).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');

    expect(mocks.writeBytes).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('returns only content-free native failure codes', async () => {
    mocks.construct.mockImplementationOnce(() => {
      throw new Error('file://owned/private-value.json secret-note');
    });

    const error = await writeMobileDataExportFile('file://owned/private-value.json', bundle(), {
      assertCurrent: () => undefined,
    }).catch((caught: unknown) => caught);

    expect(error).toEqual(new Error(MOBILE_DATA_EXPORT_FILE_CREATE_FAILED));
    expect(String(error)).not.toContain('private-value');
    expect(String(error)).not.toContain('secret-note');
  });
});
