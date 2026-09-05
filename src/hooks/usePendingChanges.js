import { useState } from 'react';

// Generic "stage locally, confirm in one batch" accumulator shared by every
// page that used to fire an API call on every single checkbox/dropdown
// click (see the batch-confirm plan). Doesn't know anything about
// "confirmed"/"available"/"goals" semantics — each page composes its own
// pending-over-server read (e.g. `pending.get(key)?.checked ?? p.confirmed`)
// and its own confirm() that builds a batch payload from `pending.values()`
// and calls the relevant bulk endpoint.
export function usePendingChanges() {
  const [pending, setPending] = useState(new Map());

  const stage = (key, change) =>
    setPending((prev) => {
      const next = new Map(prev);
      next.set(key, change);
      return next;
    });

  const unstage = (key) =>
    setPending((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

  const clear = () => setPending(new Map());
  const get = (key) => pending.get(key);

  return { pending, count: pending.size, stage, unstage, clear, get };
}
