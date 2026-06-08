import React, { useState } from 'react';
import { X, FileText, CheckCircle2 } from 'lucide-react';
import styles from './modal.module.css';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (includeDetails: boolean) => void;
  isGenerating: boolean;
}

export default function PDFExportModal({ isOpen, onClose, onGenerate, isGenerating }: PDFExportModalProps) {
  const [includeDetails, setIncludeDetails] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} style={{ maxWidth: '480px' }}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: '8px', color: '#DC2626' }}>
              <FileText size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Ekspor Laporan PDF</h3>
          </div>
          <button 
            type="button"
            className={styles.closeBtn} 
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body} style={{ paddingBottom: '0' }}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            Laporan Anda siap untuk diekspor. Pilih informasi tambahan yang ingin Anda sertakan di dalam dokumen PDF.
          </p>

          <div style={{ backgroundColor: 'var(--color-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>Standar Laporan (Otomatis disertakan)</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text)', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Ringkasan Metrik (Total, Jumlah, Rata-rata)</li>
              <li>Visualisasi Tren & Proporsi Kategori</li>
              <li>Tabel Komposisi & Distribusi Per Cabang</li>
            </ul>
          </div>

          <label 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '12px', 
              padding: '16px', 
              border: includeDetails ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', 
              borderRadius: '12px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              backgroundColor: includeDetails ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
              transition: 'all 0.2s ease-in-out',
              marginTop: '16px'
            }}
          >
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
              disabled={isGenerating}
              style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: isGenerating ? 'not-allowed' : 'pointer' }}
            />
            <div>
              <div style={{ fontWeight: 600, color: includeDetails ? 'var(--color-primary)' : 'var(--color-text)', fontSize: '15px', marginBottom: '4px' }}>
                Sertakan Rincian Transaksi
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
                Menambahkan tabel rincian transaksi per item di halaman berikutnya. Peringatan: Dokumen mungkin berisi banyak halaman tambahan.
              </div>
            </div>
          </label>
        </div>

        <div className={styles.footer} style={{ marginTop: '24px' }}>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Batal
          </button>
          <button 
            type="button" 
            onClick={() => onGenerate(includeDetails)}
            disabled={isGenerating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#DC2626',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)'
            }}
          >
            {isGenerating ? (
              <>Mengumpulkan Data...</>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Unduh PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
