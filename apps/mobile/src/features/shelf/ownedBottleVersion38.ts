import {
  contentHash38, createFormulaVersion38, invalidFormula38, observationForFormula38,
  safeText38, validateFormulaVersion38, validateObservation38, validTimestamp38,
  type FormulaObservation38, type FormulaVersion38,
} from './formulaVersion38';

export const OWNED_BOTTLE38_MAX_VERSIONS = 64;
export type ProductIdentitySource38 = Readonly<{
  id: string; name: string; brand: string | null; barcode: string | null; category: string | null;
  addedVia: string; catalogSource: string | null; catalogMatchQuality: string | null;
  ingredientParseStatus: string | null; createdAt: string; updatedAt: string;
}>;

export type ProductIdentity38 = Readonly<{
  schemaVersion: 1; ownerUserId: string; ownedUnitId: string; actor: 'owner';
  source: 'shelf_record'; name: string; brand: string | null; barcode: string | null; category: string | null;
  addedVia: string; catalogSource: string | null; catalogMatchQuality: string | null;
  ingredientParseStatus: string | null; recordedAt: string; id: string; contentHash: string;
}>;

export type OwnedProductVersion38 = Readonly<{
  schemaVersion: 1; ownerUserId: string; ownedUnitId: string; previousVersionId: string | null;
  actor: 'owner'; basis: 'label_in_hand' | 'unavailable'; observedOn: string | null; recordedAt: string;
  productIdentity: ProductIdentity38; formulaVersion: FormulaVersion38; id: string; contentHash: string;
}>;

export type OwnedBottleHistory38 = Readonly<{
  productId: string; ownerUserId: string; revision: number; currentVersionId: string;
  versions: readonly OwnedProductVersion38[];
}>;

export type OwnedBottleHistorySnapshot38 = Readonly<{
  productId: string; ownedUnitId: string; productUpdatedAt: string; productIdentityHash: string;
  revision: number; currentVersionId: string | null; currentVersion: OwnedProductVersion38 | null;
  versions: readonly OwnedProductVersion38[]; localOnly: true;
}>;

export type ConfirmOwnedBottleVersionInput38 = FormulaObservation38 & Readonly<{
  productId: string; expectedUpdatedAt: string; expectedProductIdentityHash: string;
  expectedRevision: number; expectedCurrentVersionId: string | null;
}>;

export function createProductIdentity38(product: ProductIdentitySource38, ownerUserId: string, recordedAt: string): ProductIdentity38 {
  if (!safeText38(product.id, 128) || !safeText38(ownerUserId, 128) || !safeText38(product.name, 200) ||
      (product.brand !== null && !safeText38(product.brand, 120)) ||
      (product.barcode !== null && !safeText38(product.barcode, 128)) ||
      (product.category !== null && !safeText38(product.category, 160)) ||
      !safeText38(product.addedVia, 40) ||
      [product.catalogSource, product.catalogMatchQuality, product.ingredientParseStatus].some((value) => value !== null && !safeText38(value, 160)) ||
      !validTimestamp38(recordedAt)) invalidFormula38();
  const body = {
    schemaVersion: 1 as const, ownerUserId, ownedUnitId: product.id, actor: 'owner' as const,
    source: 'shelf_record' as const, name: product.name, brand: product.brand, barcode: product.barcode,
    category: product.category, addedVia: product.addedVia, catalogSource: product.catalogSource,
    catalogMatchQuality: product.catalogMatchQuality, ingredientParseStatus: product.ingredientParseStatus, recordedAt,
  };
  const contentHash = contentHash38(body);
  return Object.freeze({ ...body, id: `identity38:${contentHash}`, contentHash });
}

export function createOwnedProductVersion38(
  product: ProductIdentitySource38, ownerUserId: string, observation: FormulaObservation38,
  previous: OwnedProductVersion38 | null, recordedAt: string,
): OwnedProductVersion38 {
  validateObservation38(observation);
  if (previous && (previous.ownedUnitId !== product.id || previous.ownerUserId !== ownerUserId || previous.recordedAt > recordedAt)) invalidFormula38();
  const body = {
    schemaVersion: 1 as const, ownerUserId, ownedUnitId: product.id, previousVersionId: previous?.id ?? null,
    actor: 'owner' as const,
    basis: observation.confirmation === 'confirm_label' ? 'label_in_hand' as const : 'unavailable' as const,
    observedOn: observation.observedOn, recordedAt,
    productIdentity: createProductIdentity38(product, ownerUserId, recordedAt),
    formulaVersion: createFormulaVersion38(observation, ownerUserId, product.id, previous?.formulaVersion.id ?? null, recordedAt),
  };
  const contentHash = contentHash38(body);
  return Object.freeze({ ...body, id: `owned38:${contentHash}`, contentHash });
}

export function sameObservation38(version: OwnedProductVersion38, product: ProductIdentitySource38, observation: FormulaObservation38): boolean {
  const identity = createProductIdentity38(product, version.ownerUserId, version.recordedAt);
  return identity.contentHash === version.productIdentity.contentHash &&
    JSON.stringify(observationForFormula38(version.formulaVersion)) === JSON.stringify({
      confirmation: observation.confirmation, labelText: observation.labelText, market: observation.market,
      variant: observation.variant, observedOn: observation.observedOn,
    });
}

export function validateOwnedBottleHistory38(value: OwnedBottleHistory38): void {
  if (!value || !Array.isArray(value.versions) || value.versions.length < 1 || value.versions.length > OWNED_BOTTLE38_MAX_VERSIONS ||
      value.revision !== value.versions.length || !safeText38(value.productId, 128) || !safeText38(value.ownerUserId, 128) ||
      Object.keys(value).join(',') !== 'productId,ownerUserId,revision,currentVersionId,versions') invalidFormula38();
  let previous: OwnedProductVersion38 | null = null;
  const ids = new Set<string>();
  for (const version of value.versions) {
    if (!version || version.ownedUnitId !== value.productId || version.ownerUserId !== value.ownerUserId) invalidFormula38();
    validateFormulaVersion38(version.formulaVersion);
    const identity = version.productIdentity;
    if (!identity) invalidFormula38();
    const expected = createOwnedProductVersion38({ ...identity, id: version.ownedUnitId, createdAt: version.recordedAt, updatedAt: version.recordedAt }, value.ownerUserId, observationForFormula38(version.formulaVersion), previous, version.recordedAt);
    if (JSON.stringify(version) !== JSON.stringify(expected) || ids.has(version.id)) invalidFormula38();
    ids.add(version.id);
    previous = version;
  }
  if (value.currentVersionId !== previous?.id) invalidFormula38();
  for (const version of value.versions) {
    Object.freeze(version.productIdentity);
    Object.freeze(version.formulaVersion);
    Object.freeze(version);
  }
  Object.freeze(value.versions);
  Object.freeze(value);
}

export function historySnapshot38(product: ProductIdentitySource38, history?: OwnedBottleHistory38): OwnedBottleHistorySnapshot38 {
  return Object.freeze({
    productId: product.id, ownedUnitId: product.id, productUpdatedAt: product.updatedAt,
    productIdentityHash: contentHash38(product), revision: history?.revision ?? 0,
    currentVersionId: history?.currentVersionId ?? null,
    currentVersion: history?.versions.at(-1) ?? null,
    versions: history?.versions ?? Object.freeze([]), localOnly: true as const,
  });
}
