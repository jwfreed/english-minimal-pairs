import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import type { ContrastId } from '@/src/domain/identity';

/**
 * Resolves the identity a progression entry is keyed by.
 *
 * `Pair.group` alone is not an identity. Group names are reused across
 * languages — `iVsI` appears in eleven categories — so keying progression by
 * group lets a streak earned in one language count toward a promotion in
 * another. The stable `ContrastId` is language-scoped and does not.
 *
 * Identity is resolved only through the exact historical mapping. It is never
 * derived by formatting a category label, because labels have changed over the
 * life of the application and remain mutable.
 *
 * Unmapped coordinates are rejected. Progression state must never create a
 * second, label-derived identity namespace beside `ContrastId`.
 */
export function resolveProgressionKey(
  categoryLabel: string,
  legacyGroup: string
): ContrastId {
  const contrastId = historicalIdentityMapping.resolveContrast(
    categoryLabel,
    legacyGroup
  );
  if (contrastId === undefined) {
    throw new Error(
      `Unable to resolve progression ContrastId for category "${categoryLabel}" and group "${legacyGroup}"`
    );
  }

  return contrastId;
}
