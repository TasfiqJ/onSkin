import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import type { AddedVia, ExpirySource, PaoSource, ProductStatus } from '@onskin/types';

// Local-first shelf store (docs/04 §8: the shelf must work in a bathroom with no
// signal. View, manual-add, and queued lookups all offline). AsyncStorage is the
// source of truth for v1 (single-user, last-write-wins is safe, DECISIONS D-029);
// intake also fires a best-effort Supabase mirror (B-SUPABASE) so it's ready to
// reconcile via the persisted mutation queue (D-007) once the project exists.
const KEY = 'onskin.shelf.v1';

export type ShelfProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  /** Free-text / parsed INCI tokens. The engine tags off these + the name. */
  ingredients: string[];
  openedAt: string | null; // ISO local date; null when unopened or unknown
  isOpened: boolean; // false = unopened, no PAO clock (docs/04 §4.5)
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null; // printed expiry (ISO), if known
  expirySource: ExpirySource;
  status: ProductStatus;
  finishedAt: string | null;
  addedVia: AddedVia;
  /** Repurchase history powering the archive + replenishment (docs/04 §5.7). */
  repurchaseCount: number;
  thumbnailPath: string | null; // LOCAL device path by default (docs/04 §7)
  createdAt: string;
  updatedAt: string;
};

export type NewShelfProduct = {
  name: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  ingredients?: string[];
  openedAt?: string | null;
  isOpened?: boolean;
  paoMonths?: number | null;
  paoSource?: PaoSource;
  expiryDate?: string | null;
  expirySource?: ExpirySource;
  addedVia: AddedVia;
};

function nowISO(): string {
  return new Date().toISOString();
}

export async function loadShelf(): Promise<ShelfProduct[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShelfProduct[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persist(items: ShelfProduct[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function addProduct(input: NewShelfProduct): Promise<ShelfProduct> {
  const items = await loadShelf();
  const ts = nowISO();
  const product: ShelfProduct = {
    id: randomUUID(),
    name: input.name,
    brand: input.brand ?? null,
    category: input.category ?? null,
    barcode: input.barcode ?? null,
    ingredients: input.ingredients ?? [],
    openedAt: input.openedAt ?? null,
    isOpened: input.isOpened ?? true,
    paoMonths: input.paoMonths ?? null,
    paoSource: input.paoSource ?? 'unknown',
    expiryDate: input.expiryDate ?? null,
    expirySource: input.expirySource ?? 'unknown',
    status: 'active',
    finishedAt: null,
    addedVia: input.addedVia,
    repurchaseCount: 1,
    thumbnailPath: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await persist([product, ...items]);
  return product;
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>,
): Promise<void> {
  const items = await loadShelf();
  await persist(items.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p)));
}

export async function removeProduct(id: string): Promise<void> {
  const items = await loadShelf();
  await persist(items.filter((p) => p.id !== id));
}

/**
 * Replenish: archive the current unit and add a fresh one of the same product,
 * resetting the opened-date clock and carrying the repurchase count forward
 * (docs/04 §6 "re-add the same one").
 */
export async function reAddProduct(id: string): Promise<ShelfProduct | null> {
  const items = await loadShelf();
  const prev = items.find((p) => p.id === id);
  if (!prev) return null;
  const ts = nowISO();
  const archived: ShelfProduct = { ...prev, status: 'finished', finishedAt: ts.slice(0, 10), updatedAt: ts };
  const fresh: ShelfProduct = {
    ...prev,
    id: randomUUID(),
    openedAt: ts.slice(0, 10),
    isOpened: true,
    status: 'active',
    finishedAt: null,
    repurchaseCount: prev.repurchaseCount + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  await persist([fresh, ...items.map((p) => (p.id === id ? archived : p))]);
  return fresh;
}

/** Test/seed reset. */
export async function clearShelf(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
