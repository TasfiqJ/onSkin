import { File, FileMode, type FileHandle } from 'expo-file-system';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';

import {
  writePrettyJsonIncrementally,
  type IncrementalJsonWriteResult,
} from './incrementalJsonWriter';
import type { MobileDataExportBundle } from './localDeviceExport';

export const MOBILE_DATA_EXPORT_FILE_CREATE_FAILED = 'MOBILE_DATA_EXPORT_FILE_CREATE_FAILED';
export const MOBILE_DATA_EXPORT_FILE_OPEN_FAILED = 'MOBILE_DATA_EXPORT_FILE_OPEN_FAILED';
export const MOBILE_DATA_EXPORT_FILE_WRITE_FAILED = 'MOBILE_DATA_EXPORT_FILE_WRITE_FAILED';
export const MOBILE_DATA_EXPORT_FILE_CLOSE_FAILED = 'MOBILE_DATA_EXPORT_FILE_CLOSE_FAILED';

function exportFileError(code: string): Error {
  return new Error(code);
}

function yieldToHost(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function closeExportFile(handle: FileHandle): Error | null {
  try {
    handle.close();
    return null;
  } catch {
    return exportFileError(MOBILE_DATA_EXPORT_FILE_CLOSE_FAILED);
  }
}

/**
 * Creates a new owned staging file and writes one JSON bundle through a single
 * native handle. The caller keeps the journal in `reserved` until this returns.
 */
export async function writeMobileDataExportFile(
  uri: string,
  bundle: MobileDataExportBundle,
  lease: Pick<AccountGenerationLease, 'assertCurrent'>,
): Promise<IncrementalJsonWriteResult> {
  lease.assertCurrent();
  let file: File;
  try {
    file = new File(uri);
    file.create({ intermediates: false, overwrite: false });
  } catch {
    throw exportFileError(MOBILE_DATA_EXPORT_FILE_CREATE_FAILED);
  }
  lease.assertCurrent();

  let handle: FileHandle;
  try {
    handle = file.open(FileMode.WriteOnly);
  } catch {
    throw exportFileError(MOBILE_DATA_EXPORT_FILE_OPEN_FAILED);
  }

  let result: IncrementalJsonWriteResult | null = null;
  let primaryError: unknown = null;
  try {
    lease.assertCurrent();
    result = await writePrettyJsonIncrementally(bundle, {
      assertCurrent: lease.assertCurrent,
      writeBytes: (bytes) => {
        try {
          handle.writeBytes(bytes);
        } catch {
          throw exportFileError(MOBILE_DATA_EXPORT_FILE_WRITE_FAILED);
        }
      },
      yieldControl: yieldToHost,
    });
    lease.assertCurrent();
  } catch (error) {
    primaryError = error;
  }

  const closeError = closeExportFile(handle);
  if (primaryError !== null) throw primaryError;
  if (closeError) throw closeError;
  lease.assertCurrent();
  return result!;
}
