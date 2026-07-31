import {
  projectPairProgressToContrasts,
  type ContrastPairProgressProjection,
} from '@/src/domain/contrast/pairProgressProjection';
import { getProgress } from '@/src/storage/progressStorage';

/**
 * Read-only production boundary for Contrast-level pair progress.
 *
 * @pairProgress_v2 remains authoritative: getProgress performs the existing
 * read and normalization, then the pure projector derives the stable view.
 *
 * Known diagnostic limitation: the existing parser normalizes a non-array
 * attempt container to an empty history. After this boundary, its raw
 * `invalid-attempt-container` reason cannot be recovered. This loses diagnostic
 * detail only; it does not change effective progress because no valid attempt
 * array was present.
 */
export async function getContrastProgress(): Promise<ContrastPairProgressProjection> {
  const progress = await getProgress();
  return projectPairProgressToContrasts(progress);
}
