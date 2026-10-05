'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './TopProgressBar.module.css';

/**
 * TopProgressBar — Luxury route transition progress indicator
 *
 * Automatically triggers on internal link clicks and smoothly animates
 * across page transitions, completing with a high-glow fade-out when
 * the new route renders.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const currentPathRef = useRef(pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers helper
  const clearTimers = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  };

  // Route change completion
  useEffect(() => {
    if (currentPathRef.current !== pathname) {
      currentPathRef.current = pathname;

      // Complete the progress bar
      clearTimers();
      setProgress(100);

      completeTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setProgress(0), 300);
      }, 200);
    }

    return () => clearTimers();
  }, [pathname, searchParams]);

  // Intercept internal link clicks to start loading immediately
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Find closest anchor
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      const targetAttr = target.getAttribute('target');

      // Ignore external links, anchor hashes, new tab clicks, and modifier keys
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        targetAttr === '_blank' ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      try {
        const targetUrl = new URL(href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // Only animate if staying on the same origin and navigating to a different page/path
        if (targetUrl.origin === currentUrl.origin) {
          if (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search) {
            clearTimers();
            setIsVisible(true);
            setProgress(25);

            // Gradually trickle progress towards 80%
            intervalRef.current = setInterval(() => {
              setProgress((prev) => {
                if (prev >= 85) return prev;
                const step = (85 - prev) * 0.15;
                return Math.min(85, prev + Math.max(step, 1.5));
              });
            }, 100);
          }
        }
      } catch {
        // Invalid URL, ignore
      }
    };

    document.addEventListener('click', handleLinkClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleLinkClick, { capture: true });
      clearTimers();
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div className={styles.progressBarContainer} aria-hidden="true">
      <div
        className={styles.progressBar}
        style={{
          width: `${progress}%`,
          opacity: isVisible ? 1 : 0,
        }}
      >
        <div className={styles.progressBarGlow} />
      </div>
    </div>
  );
}
