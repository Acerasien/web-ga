import Link from 'next/link';
import { CheckCircle, History, LayoutDashboard, AlertTriangle } from 'lucide-react';
import type { CSVImportResult } from '@/lib/actions/imports';
import styles from '@/app/(dashboard)/transaksi/import/import.module.css';

interface SuccessProps {
  result: CSVImportResult;
}

export function CSVImportSuccessView({ result }: SuccessProps) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
        <CheckCircle size={36} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
        Impor Data Sukses!
      </h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', maxWidth: '480px', margin: '0 auto var(--space-8)' }}>
        Sebanyak <strong>{result.importedCount}</strong> baris transaksi pengeluaran GA berhasil divalidasi dan diunggah secara aman ke database.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Link href="/transaksi/riwayat" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <History size={18} />
          <span>Lihat Riwayat</span>
        </Link>
        <Link href="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <LayoutDashboard size={18} />
          <span>Ke Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

interface FailProps {
  result: CSVImportResult;
  onCancel: () => void;
}

export function CSVImportFailView({ result, onCancel }: FailProps) {
  return (
    <div className={styles.errorCard}>
      <div className={styles.errorBanner}>
        <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 className={styles.errorTitle}>Impor Data Ditolak (Database Rollback Aktif)</h4>
          <p className={styles.errorSub}>
            Ditemukan <strong>{result.errors.length}</strong> kesalahan format data. Seluruh pengunggahan dibatalkan demi menjaga integritas keuangan sistem.
          </p>
        </div>
      </div>

      <div className={styles.errorScroll}>
        {result.errors.map((err, idx) => (
          <div key={idx} className={styles.errorLine}>
            &bull; {err}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="btn btn-primary" onClick={onCancel}>
          Perbaiki & Coba Lagi
        </button>
      </div>
    </div>
  );
}
