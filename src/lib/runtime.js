// Shared runtime environment detection (kiosk frames, smart TVs, installed PWA).

// Smart-TV / streaming-stick browsers (Fire TV Silk, Tizen, webOS, Google TV…)
const TV_UA = /\bSilk\b|AFT[A-Z]|Fire ?TV|SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|GoogleTV|CrKey/i;

export const IS_KIOSK =
  typeof window !== 'undefined' &&
  ['1', 'true'].includes(new URLSearchParams(window.location.search).get('kiosk') || '');

export const IS_TV =
  IS_KIOSK || (typeof navigator !== 'undefined' && TV_UA.test(navigator.userAgent || ''));

// Launched from a home-screen install (PWA): fullscreen/standalone display mode
// is owned by the launcher, so it survives page reloads.
export function isInstalledApp() {
  try {
    return (
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

// Contexts where fullscreen is environmental (kiosk flag, TV shell, installed
// app) rather than page-requested — safe to auto-reload without stranding the
// user outside fullscreen.
export function isKioskContext() {
  return IS_TV || isInstalledApp();
}
