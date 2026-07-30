declare const identityBrand: unique symbol;

type StableId<Kind extends 'contrast' | 'pair'> = string & {
  readonly [identityBrand]: Kind;
};

/**
 * Stable identity for a phonological contrast.
 *
 * Assign independently from display labels and the legacy Pair.group value.
 */
export type ContrastId = StableId<'contrast'>;

/**
 * Stable identity for a training pair.
 *
 * Assign independently from word content and legacy progress keys.
 */
export type PairId = StableId<'pair'>;

function defineIdentity<TId extends ContrastId | PairId>(
  value: string,
  kind: 'contrast' | 'pair'
): TId {
  if (value.trim().length === 0) {
    throw new Error(`${kind} ID must be a non-empty string`);
  }

  // Identity values are opaque: validate them, but never normalize them.
  return value as TId;
}

export function defineContrastId(value: string): ContrastId {
  return defineIdentity<ContrastId>(value, 'contrast');
}

export function definePairId(value: string): PairId {
  return defineIdentity<PairId>(value, 'pair');
}

function assertUniqueIds(
  ids: readonly string[],
  kind: 'contrast' | 'pair'
): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${kind} ID: "${id}"`);
    }
    seen.add(id);
  }
}

export function assertUniqueContrastIds(ids: readonly ContrastId[]): void {
  assertUniqueIds(ids, 'contrast');
}

export function assertUniquePairIds(ids: readonly PairId[]): void {
  assertUniqueIds(ids, 'pair');
}
