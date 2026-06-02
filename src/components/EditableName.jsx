import { useState } from 'react';

// Click ✏️ to rename a card; the new name is geocoded by the parent (onRename).
export function EditableName({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      <button className="edit-location-btn" title="Save" onClick={save} disabled={busy}>
        {busy ? '⏳' : '💾'}
      </button>
      {error ? <span className="edit-error">{error}</span> : null}
    </span>
  );
}
