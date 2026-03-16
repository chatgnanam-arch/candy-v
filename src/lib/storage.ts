import type { PersistedProfile } from '../game/types';

const STORAGE_KEY = 'sugar-drop-saga-profile';

export function getDefaultProfile(): PersistedProfile {
  return {
    bestScore: 0,
    tutorialDismissed: false,
    soundEnabled: true,
    reducedMotion: prefersReducedMotion(),
  };
}

export function loadProfile(): PersistedProfile {
  if (typeof window === 'undefined') {
    return getDefaultProfile();
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultProfile();
    }

    return {
      ...getDefaultProfile(),
      ...(JSON.parse(stored) as Partial<PersistedProfile>),
    };
  } catch {
    return getDefaultProfile();
  }
}

export function saveProfile(profile: PersistedProfile): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
