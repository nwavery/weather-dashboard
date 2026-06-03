import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocations } from './hooks/useLocations.js';
import { useClock } from './hooks/useClock.js';
import { WeatherCard } from './components/WeatherCard.jsx';
import { FullscreenButton } from './components/FullscreenButton.jsx';

// Smart-TV / streaming-stick browsers (Fire TV Silk, Tizen, webOS, Google TV…)
// get a `tv` class (overscan-safe insets, compaction) + fit-to-screen scaling.
const TV_UA = /\bSilk\b|AFT[A-Z]|Fire ?TV|SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|GoogleTV|CrKey/i;
const IS_TV = typeof navigator !== 'undefined' && TV_UA.test(navigator.userAgent || '');

export default function App() {
  const { locations, status, updateLocation } = useLocations();
  const now = useClock();
  const containerRef = useRef(null);

  useEffect(() => {
    if (IS_TV) document.documentElement.classList.add('tv');
  }, []);

  // TVs are wide but short, and the cards are tall — so scale the whole
  // dashboard down to fit the viewport height. Self-correcting: re-runs as the
  // weather data loads (height grows) and on resize, so nothing gets cut off.
  useLayoutEffect(() => {
    if (!IS_TV) return;
    const el = containerRef.current;
    if (!el) return;
    const root = document.documentElement;
    root.classList.add('tv-fit');

    const fit = () => {
      const cs = getComputedStyle(document.body);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = el.offsetWidth;
      const h = el.offsetHeight; // layout size — unaffected by the transform
      if (!w || !h) return;
      const scale = Math.min(1, (window.innerWidth - padX) / w, (window.innerHeight - padY) / h);
      el.style.transformOrigin = 'top center';
      el.style.transform = `scale(${scale})`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    const timers = [setTimeout(fit, 400), setTimeout(fit, 1200)];

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      timers.forEach(clearTimeout);
      el.style.transform = '';
      root.classList.remove('tv-fit');
    };
  }, []);

  return (
    <>
      <FullscreenButton />
      <div className="container" ref={containerRef}>
        <div className="cards-container">
          {locations.map((loc) => (
            <WeatherCard
              key={loc.key}
              location={loc}
              now={now}
              status={loc.key === 'current' ? status : ''}
              onRename={(name) => updateLocation(loc.key, name)}
            />
          ))}
        </div>
        <footer className="app-footer">
          Weather &amp; air quality via Open-Meteo · Pollen via Google Pollen API · Icons via OpenWeatherMap
        </footer>
      </div>
    </>
  );
}
