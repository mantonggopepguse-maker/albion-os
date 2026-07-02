import styles from './loading.module.css';

export default function DashboardLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner}>
        <div className={styles.logo}>A</div>
      </div>
      <p className={styles.text}>Loading AlbionOS...</p>
    </div>
  );
}
