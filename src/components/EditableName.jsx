import { useState } from 'react';
import { FICTIONAL_NAMES } from '../lib/fictionalCities.js';

// Click ✏️ to rename a card; the new name is geocoded by the parent (onRename).
export function EditableName({ name, onRename, onLocate, rotating, onToggleRotate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  async function locate() {
    if (locating) return;
    setLocating(true);
    try {
      await onLocate();
    } finally {
      setLocating(false);
    }
  }

  function start() {
    setValue(name);
    setError('');
    setEditing(true);
  }

  async function save() {
    const v = value.trim();
    if (!v || v === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError('');
    const res = await onRename(v);
    setBusy(false);
    if (res?.ok) {
      setEditing(false);
    } else {
      setError(`Couldn't find "${v}".`);
    }
  }

  if (!editing) {
    return (
      <span className="location-name-wrap">
        <span className="location-name">{name}</span>
        <button className="edit-location-btn" title="Edit location" onClick={start}>
          ✏️
        </button>
        {onLocate ? (
          <button
            className="edit-location-btn locate-btn"
            title="Back to my current location"
            onClick={locate}
            disabled={locating}
          >
            {locating ? '⏳' : '📍'}
          </button>
        ) : null}
        {onToggleRotate ? (
          <button
            className={`edit-location-btn rotate-location-btn${rotating ? ' active' : ''}`}
            title={rotating ? 'Stop rotating fictional cities' : 'Rotate through fictional cities (every 10 min)'}
            aria-pressed={!!rotating}
            onClick={onToggleRotate}
          >
            🔁
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="location-name-wrap">
      <input
        className="location-input"
        value={value}
        autoFocus
        disabled={busy}
        list="fictional-cities"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
      />
      <datalist id="fictional-cities">
        <option value="Current Location" />
        {FICTIONAL_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <button className="edit-location-btn" title="Save" onClick={save} disabled={busy}>
        {busy ? '⏳' : '💾'}
      </button>
      {error ? <span className="edit-error">{error}</span> : null}
    </span>
  );
}
