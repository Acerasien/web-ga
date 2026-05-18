import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 'var(--space-6)',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 700,
        marginBottom: 'var(--space-3)',
      }}>
        Web GA
      </h1>
      <p style={{
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-lg)',
        marginBottom: 'var(--space-8)',
      }}>
        Sistem Pencatatan Aktivitas General Affairs
      </p>
      <Link
        href="/login"
        className="btn btn-primary btn-lg"
      >
        Masuk ke Sistem
      </Link>
    </div>
  );
}
