import { useEffect, useState } from 'react';

function inFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * Full-screen toggle — handy on TVs / kiosk displays where the browser chrome
 * eats a big chunk of the screen. Uses the standard Fullscreen API with the
 * webkit-prefixed fallback that Amazon Silk / older WebKit browsers need.
 */
export function FullscreenButton() {
  const [fs, setFs] = useState(inFullscreen());

  useEffect(() => {
    const onChange = () => setFs(inFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggle = async () => {
    try {
      if (!inFullscreen()) {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) await req.call(el);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      }
    } catch {
      /* Some embedded TV browsers block fullscreen; ignore and no-op. */
    }
  };

  return (
    <button
      type="button"
      className="fullscreen-btn"
      onClick={toggle}
      aria-label={fs ? 'Exit full screen' : 'Full screen'}
      title={fs ? 'Exit full screen' : 'Full screen'}
    >
      {fs ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      )}
    </button>
  );
}
