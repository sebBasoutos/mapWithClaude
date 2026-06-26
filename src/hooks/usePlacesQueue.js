import { useRef, useCallback } from 'react';

const DELAY_MS = 250;

// Serializes Places API calls so we don't hammer the quota.
export function usePlacesQueue() {
  const queue = useRef([]);
  const running = useRef(false);

  const processNext = useCallback(() => {
    if (queue.current.length === 0) {
      running.current = false;
      return;
    }
    running.current = true;
    const task = queue.current.shift();
    task().finally(() => {
      setTimeout(processNext, DELAY_MS);
    });
  }, []);

  const enqueue = useCallback(
    (task) => {
      queue.current.push(task);
      if (!running.current) processNext();
    },
    [processNext],
  );

  return { enqueue };
}
