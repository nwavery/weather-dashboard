import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { loadUnits, saveUnits } from '../lib/units.js';

// App-wide unit system, defaulted from the browser locale and remembered across
// visits. `toggleUnits` flips between metric and imperial.
const UnitsContext = createContext({ units: 'imperial', toggleUnits: () => {} });

export function UnitsProvider({ children }) {
  const [units, setUnits] = useState(loadUnits);

  useEffect(() => {
    saveUnits(units);
  }, [units]);

  const toggleUnits = useCallback(() => {
    setUnits((u) => (u === 'metric' ? 'imperial' : 'metric'));
  }, []);

  return <UnitsContext.Provider value={{ units, toggleUnits }}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  return useContext(UnitsContext);
}
