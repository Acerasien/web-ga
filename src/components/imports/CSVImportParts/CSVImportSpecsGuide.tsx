import { FileSpreadsheet } from 'lucide-react';
import styles from '@/app/(dashboard)/transaksi/import/import.module.css';

interface CSVImportSpecsGuideProps {
  onDownloadTemplate: () => void;
}

export default function CSVImportSpecsGuide({ onDownloadTemplate }: CSVImportSpecsGuideProps) {
  return (
    <div className={styles.specsBox} style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <FileSpreadsheet size={24} className={styles.specsIcon} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span className={styles.specsTitle}>Spesifikasi Header & Format Kolom Excel / CSV:</span>
        <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
          Pastikan baris pertama file Anda berisi nama kolom berikut (tidak harus berurutan):
        </span>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginTop: '6px', marginBottom: '6px' }}>
          {['Tanggal', 'Kategori', 'Sub-Kategori', 'Deskripsi', 'Kuantitas', 'Satuan', 'Harga Satuan', 'Pembayaran', 'Vendor', 'Catatan'].map(col => (
            <span key={col} style={{ 
              fontSize: '10px', 
              fontFamily: 'var(--font-mono)', 
              padding: '2px 8px', 
              backgroundColor: 'var(--color-bg)', 
              border: '1px solid var(--color-border)', 
              borderRadius: '12px', 
              color: 'var(--color-text-light)', 
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}>
              {col}
            </span>
          ))}
        </div>

        <ul style={{ margin: 'var(--space-2) 0 0 0', paddingLeft: 'var(--space-4)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><strong>Tanggal</strong> mendukung format <code style={{ fontWeight: 600 }}>YYYY-MM-DD</code> atau standard Excel Indonesia <code style={{ fontWeight: 600 }}>DD/MM/YYYY</code>.</li>
          <li><strong>Pembayaran</strong> menerima salah satu nilai berikut: <code style={{ fontWeight: 600 }}>CASH</code>, <code style={{ fontWeight: 600 }}>TRANSFER</code>, atau <code style={{ fontWeight: 600 }}>PETTY_CASH</code>.</li>
          <li><strong>Kategori Mismatch (Poka-Yoke)</strong>: Jika nama kategori tidak dikenali di database, transaksi otomatis dipetakan ke kategori <code style={{ fontWeight: 600 }}>"Lain-lain"</code>.</li>
          <li><strong>Relational Rollback (Atomic Safeguard)</strong>: Jika terdapat kesalahan format pada baris mana pun, seluruh impor akan digagalkan dan dibatalkan (rollback) untuk menjaga integritas database.</li>
        </ul>

        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid rgba(59, 130, 246, 0.1)', paddingTop: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="btn btn-secondary btn-sm"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 'var(--space-2)',
              borderColor: 'var(--color-primary)',
              color: 'var(--color-primary)',
              backgroundColor: 'transparent',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 12px',
              height: '30px',
              cursor: 'pointer'
            }}
            title="Unduh file template Excel (.xlsx) sebagai acuan pengisian data"
          >
            <FileSpreadsheet size={14} />
            <span>Unduh Template Excel (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
