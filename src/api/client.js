async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    // Some endpoints attach extra structured fields beyond the message
    // (e.g. existingPlayerId on a 409) — keep those available to callers
    // that want to act on them, not just display the text.
    error.data = data;
    throw error;
  }

  return data;
}

export function apiGet(path) {
  return apiFetch(path);
}

export function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPatch(path, body) {
  return apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiDelete(path, body) {
  return apiFetch(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
