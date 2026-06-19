import { useUnits } from '../context/UnitsContext.jsx';

/**
 * Global units switch (°C/km·h/24h ⇄ °F/mph/12h), sitting beside the
 * full-screen button. Defaults to the browser locale and is remembered across
 * visits; flipping it converts every reading instantly (no refetch).
 */
export function UnitsToggle() {
  const { units, toggleUnits } = useUnits();
  const metric = units === 'metric';
  return (
    <button
      type="button"
      className="units-btn"
      onClick={toggleUnits}
      aria-label={metric ? 'Switch to Fahrenheit and miles per hour' : 'Switch to Celsius and kilometres per hour'}
      title={metric ? 'Units: metric — switch to °F / mph' : 'Units: imperial — switch to °C / km/h'}
    >
      <span className={metric ? 'units-on' : 'units-off'}>°C</span>
      <span className="units-sep">/</span>
      <span className={metric ? 'units-off' : 'units-on'}>°F</span>
    </button>
  );
}
