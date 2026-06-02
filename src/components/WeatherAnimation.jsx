import { useMemo } from 'react';

// Decorative rain/snow/cloud particles. Regenerated only when the type changes.
export function WeatherAnimation({ type }) {
  const particles = useMemo(() => {
    if (type === 'rain') {
      return Array.from({ length: 20 }, () => ({
        left: `${Math.random() * 100}%`,
        animationDuration: `${0.8 + Math.random() * 0.4}s`,
        animationDelay: `${Math.random() * 2}s`
      }));
    }
    if (type === 'snow') {
      return Array.from({ length: 30 }, () => ({
        left: `${Math.random() * 100}%`,
        animationDuration: `${2 + Math.random() * 3}s`,
        animationDelay: `${Math.random() * 2}s`
      }));
    }
    if (type === 'cloudy') {
      return Array.from({ length: 3 }, (_, i) => ({
        top: `${20 + i * 30}%`,
        animationDelay: `${i * -5}s`
      }));
    }
    return [];
  }, [type]);

  if (!type) return null;
  const particleClass = type === 'rain' ? 'rain-drop' : type === 'snow' ? 'snow-flake' : 'cloud';

  return (
    <div className={`${type}-animation`} aria-hidden="true">
      {particles.map((style, i) => (
        <div className={particleClass} key={i} style={style} />
      ))}
    </div>
  );
}
