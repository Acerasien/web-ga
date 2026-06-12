import { FileSpreadsheet, List } from 'lucide-react';
import styles from '@/app/(dashboard)/transaksi/import/import.module.css';
import type { CategoryWithSub } from '@/lib/actions/categories';

interface CSVImportSpecsGuideProps {
  onDownloadTemplate: () => void;
  onDownloadCategories: () => void;
  categories: CategoryWithSub[];
}

export default function CSVImportSpecsGuide({ 
  onDownloadTemplate, 
  onDownloadCategories,
  categories
}: CSVImportSpecsGuideProps) {
  return (
    <div className={styles.specsBox} style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <FileSpreadsheet size={24} className={styles.specsIcon} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span className={styles.specsTitle}>Spesifikasi Header & Format Kolom Excel / CSV:</span>
        <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
          Pastikan baris pertama file Anda berisi nama kolom berikut (tidak harus berurutan):
        </span>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginTop: '6px', marginBottom: '6px' }}>
          {['Tanggal', 'Kategori', 'Sub-Kategori', 'Deskripsi', 'Kuantitas', 'Satuan', 'Harga Satuan', 'Pembayaran', 'Lokasi', 'Vendor', 'Catatan', 'Berita Acara', 'Nomor Invoice'].map(col => (
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
          <li><strong>Lokasi (Opsional)</strong> menerima salah satu nilai berikut: <code style={{ fontWeight: 600 }}>SITE</code>, <code style={{ fontWeight: 600 }}>MESS</code>, atau <code style={{ fontWeight: 600 }}>OFFICE</code> (opsional, biarkan kosong jika tidak ditentukan).</li>
          <li><strong>Kategori Mismatch (Poka-Yoke)</strong>: Jika nama kategori tidak dikenali di database, transaksi otomatis dipetakan ke kategori <code style={{ fontWeight: 600 }}>"Lain-lain"</code>.</li>
          <li><strong>Relational Rollback (Atomic Safeguard)</strong>: Jika terdapat kesalahan format pada baris mana pun, seluruh impor akan digagalkan dan dibatalkan (rollback) untuk menjaga integritas database.</li>
        </ul>

        {/* Inline Expandable Category Lookup */}
        <details style={{ 
          marginTop: 'var(--space-3)', 
          border: '1px dashed rgba(59, 130, 246, 0.2)', 
          borderRadius: 'var(--radius-md)', 
          padding: 'var(--space-2) var(--space-3)', 
          backgroundColor: 'rgba(59, 130, 246, 0.01)' 
        }}>
          <summary style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            color: 'var(--color-primary)', 
            cursor: 'pointer', 
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)'
          }}>
            <List size={12} />
            <span>Tampilkan Daftar Kategori & Sub-Kategori Aktif (Lookup Cepat)</span>
          </summary>
          
          <div style={{ 
            marginTop: 'var(--space-2)', 
            maxHeight: '160px', 
            overflowY: 'auto', 
            fontSize: '11px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px',
            paddingRight: 'var(--space-1)' 
          }}>
            {categories && categories.length > 0 ? (
              categories.map(cat => (
                <div key={cat.id} style={{ 
                  borderBottom: '1px solid rgba(0,0,0,0.04)', 
                  paddingBottom: '4px', 
                  marginBottom: '2px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--color-text)' }}>{cat.name}</strong>
                  </div>
                  {cat.subCategories && cat.subCategories.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', paddingLeft: 'var(--space-2)' }}>
                      {cat.subCategories.map(sub => (
                        <span key={sub.id} style={{ 
                          fontSize: '10px', 
                          backgroundColor: 'var(--color-surface)', 
                          border: '1px solid var(--color-border)', 
                          borderRadius: '4px', 
                          padding: '1px 6px', 
                          color: 'var(--color-text)' 
                        }}>
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-light)', fontStyle: 'italic', paddingLeft: 'var(--space-2)', display: 'block', marginTop: '2px' }}>
                      Tidak ada sub-kategori
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>Tidak ada data kategori terdaftar.</span>
            )}
          </div>
        </details>

        <div style={{ 
          marginTop: 'var(--space-4)', 
          borderTop: '1px solid rgba(59, 130, 246, 0.1)', 
          paddingTop: 'var(--space-3)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)'
        }}>
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

          <button
            type="button"
            onClick={onDownloadCategories}
            className="btn btn-secondary btn-sm"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 'var(--space-2)',
              borderColor: 'var(--color-success)',
              color: 'var(--color-success)',
              backgroundColor: 'transparent',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 12px',
              height: '30px',
              cursor: 'pointer'
            }}
            title="Unduh daftar kategori dan sub-kategori sebagai acuan pengisian data"
          >
            <FileSpreadsheet size={14} />
            <span>Daftar Kategori (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
