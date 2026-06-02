import { useLocations } from './hooks/useLocations.js';
import { useClock } from './hooks/useClock.js';
import { WeatherCard } from './components/WeatherCard.jsx';

export default function App() {
  const { locations, status, updateLocation } = useLocations();
  const now = useClock();

  return (
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
  );
}
