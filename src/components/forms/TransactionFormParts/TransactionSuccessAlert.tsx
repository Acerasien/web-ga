import { CheckCircle2, PlusCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import styles from '@/app/(dashboard)/transaksi/input/input.module.css';

interface TransactionSuccessAlertProps {
  onReset: () => void;
}

export default function TransactionSuccessAlert({ onReset }: TransactionSuccessAlertProps) {
  return (
    <div className={`${styles.formCard} ${styles.alertSuccess}`} style={{ textAlign: 'center', display: 'block' }}>
      <CheckCircle2 size={48} style={{ margin: '0 auto var(--space-4)', color: 'var(--color-success)' }} />
      <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
        Transaksi Berhasil Dicatat!
      </h3>
      <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
        Data pengeluaran telah terekam aman ke dalam database aktivitas General Affairs.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
        <button type="button" onClick={onReset} className={styles.submitBtn}>
          <PlusCircle size={18} />
          <span>Catat Transaksi Baru</span>
        </button>
        <Link href="/transaksi/riwayat" className={styles.cancelBtn}>
          <span>Lihat Riwayat Transaksi</span>
          <ArrowRight size={18} style={{ marginLeft: 'var(--space-2)' }} />
        </Link>
      </div>
    </div>
  );
}
