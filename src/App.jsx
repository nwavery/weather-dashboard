import { useEffect } from 'react';
import { useLocations } from './hooks/useLocations.js';
import { useClock } from './hooks/useClock.js';
import { WeatherCard } from './components/WeatherCard.jsx';
import { FullscreenButton } from './components/FullscreenButton.jsx';

// Smart-TV / streaming-stick browsers (Fire TV Silk, Tizen, webOS, Google TV…)
// get a `tv` class: overscan-safe insets + a few compaction tweaks (see CSS).
const TV_UA = /\bSilk\b|AFT[A-Z]|Fire ?TV|SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|GoogleTV|CrKey/i;

export default function App() {
  const { locations, status, updateLocation } = useLocations();
  const now = useClock();

  useEffect(() => {
    if (TV_UA.test(navigator.userAgent || '')) {
      document.documentElement.classList.add('tv');
    }
  }, []);

  return (
    <>
      <FullscreenButton />
      <div className="container">
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
