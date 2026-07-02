'use client';

import styles from './PageError.module.css';

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>!</div>
      <h2 className={styles.title}>Something went wrong</h2>
      <p className={styles.message}>{error.message || 'An unexpected error occurred.'}</p>
      <button className={styles.button} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
