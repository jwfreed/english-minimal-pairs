// motion.ts — Soundwise Glow-up motion tokens.
// Keyframes and easings transcribed 1:1 from the design mock's sw* animations,
// consumed as Reanimated CSS animations (same mechanism as the ambient glow).
import {
  cubicBezier,
  type CSSAnimationKeyframes,
  type CSSAnimationProperties,
  type CSSStyle,
  type CSSTransitionProperties,
} from 'react-native-reanimated';

// Reanimated consumes these CSS props at runtime, but React Native's style
// typings also declare the animation keys as plain strings and win the
// intersection in style arrays — so easing objects need this one cast.
function asStyle(props: CSSAnimationProperties | CSSTransitionProperties): CSSStyle {
  return props as CSSStyle;
}

/** Decelerating entrance/fill ease — cubic-bezier(.22,1,.36,1). */
export const enterEase = cubicBezier(0.22, 1, 0.36, 1);

/** Overshooting spring ease for pops — cubic-bezier(.34,1.56,.64,1). */
export const springEase = cubicBezier(0.34, 1.56, 0.64, 1);

/** swBannerIn — feedback panel and rows slide + fade up (14px rise). */
export const bannerIn: CSSAnimationKeyframes = {
  '0%': { opacity: 0, transform: [{ translateY: 14 }] },
  '100%': { opacity: 1, transform: [{ translateY: 0 }] },
};

/** swBadgePop — the ✓/✕ badge springs in from nothing with an overshoot. */
export const badgePop: CSSAnimationKeyframes = {
  '0%': { transform: [{ scale: 0 }] },
  '60%': { transform: [{ scale: 1.18 }] },
  '100%': { transform: [{ scale: 1 }] },
};

/** swPop — a level segment pops as it fills on a correct answer. */
export const levelPop: CSSAnimationKeyframes = {
  '0%': { transform: [{ scale: 1 }] },
  '45%': { transform: [{ scale: 1.55 }] },
  '100%': { transform: [{ scale: 1 }] },
};

/** swDot — the session timer live dot breathes while practice is active. */
export const liveDotPulse: CSSAnimationKeyframes = {
  '0%': { opacity: 1, transform: [{ scale: 1 }] },
  '50%': { opacity: 0.5, transform: [{ scale: 1.55 }] },
  '100%': { opacity: 1, transform: [{ scale: 1 }] },
};

/** Correct-answer reward that emphasizes the goal bar without changing its ratio. */
export const goalBarPulse: CSSAnimationKeyframes = {
  '0%': { transform: [{ scaleY: 1 }] },
  '45%': { transform: [{ scaleY: 1.75 }] },
  '100%': { transform: [{ scaleY: 1 }] },
};

/**
 * Per-row stagger for the feedback cascade: row N starts 50ms after row N-1
 * (mock: .sw-fbrow nth-child delays in .05s steps).
 */
export const FEEDBACK_ROW_STAGGER_MS = 50;

/** Feedback panel entry — swBannerIn .4s. */
export const panelEntryAnimation = asStyle({
  animationName: bannerIn,
  animationDuration: '400ms',
  animationTimingFunction: enterEase,
  animationFillMode: 'both',
});

/** ✓/✕ badge pop — swBadgePop .5s on the spring ease. */
export const badgePopAnimation = asStyle({
  animationName: badgePop,
  animationDuration: '500ms',
  animationTimingFunction: springEase,
});

/** One feedback row of the cascade — swBannerIn .45s, staggered by row. */
export function feedbackRowAnimation(row: number): CSSStyle {
  return asStyle({
    animationName: bannerIn,
    animationDuration: '450ms',
    animationDelay: `${row * FEEDBACK_ROW_STAGGER_MS}ms`,
    animationTimingFunction: enterEase,
    animationFillMode: 'both',
  });
}

/** Level segment fill pop — swPop .55s on the spring ease. */
export const levelPopAnimation = asStyle({
  animationName: levelPop,
  animationDuration: '550ms',
  animationTimingFunction: springEase,
});

/** Session timer live dot — swDot 2.4s, breathing forever. */
export const liveDotAnimation = asStyle({
  animationName: liveDotPulse,
  animationDuration: '2.4s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
});

/** Goal bar reward — a brief vertical pulse that preserves the fill ratio. */
export const goalBarPulseAnimation = asStyle({
  animationName: goalBarPulse,
  animationDuration: '450ms',
  animationTimingFunction: springEase,
});

/** Goal bar width change — .7s decelerating fill (mock .sw-progress). */
export const barFillTransition = asStyle({
  transitionProperty: 'width',
  transitionDuration: '700ms',
  transitionTimingFunction: enterEase,
});
