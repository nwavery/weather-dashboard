// Pollen comes from our own backend (/api/pollen), which holds the Google key.
// The browser never sees the key. Returns { tree, grass, weed, regionCode },
// each pollen type being { value, category, inSeason } or null.
export async function fetchPollen(location) {
  const res = await fetch(`/api/pollen?lat=${location.latitude}&lng=${location.longitude}`);
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) code = body.error;
    } catch {
      /* ignore */
    }
    const err = new Error(code);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
