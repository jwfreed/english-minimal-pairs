export const CONTRAST_MASTERY_ROLLOUT_STATES = Object.freeze([
  'disabled',
  'shadow',
  'internal-test',
  'limited',
  'enabled',
] as const);

export type ContrastMasteryRolloutState =
  (typeof CONTRAST_MASTERY_ROLLOUT_STATES)[number];

/**
 * Phase 3.7 remains a local build-time release decision because the app has no
 * remote configuration convention. Shadow is read-only; every later stage
 * uses the same stable-first/legacy-compatible behavior with a progressively
 * broader release audience.
 */
export const CONTRAST_MASTERY_ROLLOUT_STATE: ContrastMasteryRolloutState =
  'disabled';

export function isContrastMasteryShadowEnabled(
  state: ContrastMasteryRolloutState
): boolean {
  return state === 'shadow';
}

export function isContrastMasteryAuthoritative(
  state: ContrastMasteryRolloutState
): boolean {
  return (
    state === 'internal-test' ||
    state === 'limited' ||
    state === 'enabled'
  );
}

export const FEATURE_FLAGS = Object.freeze({
  contrastMasteryRollout: CONTRAST_MASTERY_ROLLOUT_STATE,
  /**
   * Compatibility alias for Phase 3.5 checks. It is derived from the rollout
   * state so the old boolean cannot drift from the authoritative build gate.
   */
  contrastMasteryStore: isContrastMasteryAuthoritative(
    CONTRAST_MASTERY_ROLLOUT_STATE
  ),
});
