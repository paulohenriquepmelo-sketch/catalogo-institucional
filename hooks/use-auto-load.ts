import { useEffect, useRef, useState } from 'react';

// Calls `onMore` while the returned sentinel is near the visible area of its
// scroll container (the page, or a dialog list marked data-autoload-root).
// The sentinel is tracked as state because dialogs mount it only after they
// open; `shown` re-creates the observer after each batch, so a sentinel that
// is still visible keeps loading until the list fills the screen.
export function useAutoLoad(
  onMore: () => void,
  enabled: boolean,
  shown: number,
) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const more = useRef(onMore);
  useEffect(() => {
    more.current = onMore;
  });
  useEffect(() => {
    if (!enabled || !sentinel || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) more.current();
      },
      {
        root: sentinel.closest('[data-autoload-root]'),
        rootMargin: '600px 0px',
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, sentinel, shown]);
  return setSentinel;
}
