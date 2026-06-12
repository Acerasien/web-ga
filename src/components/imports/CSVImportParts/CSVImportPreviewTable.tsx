import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { formatRupiah, formatPaymentMethod } from '@/lib/formatters';
import styles from '@/app/(dashboard)/transaksi/import/import.module.css';

interface PreviewSummary {
  totalRows: number;
  totalAmount: number;
  hasErrors: boolean;
}

interface CSVImportPreviewTableProps {
  previewSummary: PreviewSummary;
  previewRows: any[];
}

export default function CSVImportPreviewTable({ previewSummary, previewRows }: CSVImportPreviewTableProps) {
  return (
    <div className={styles.previewWrapper}>
      <header className={styles.previewHeader}>
        <h4 className={styles.previewTitle}>Pratinjau Data Transaksi</h4>
        <p className={styles.previewSub}>
          Silakan tinjau data transaksi di bawah sebelum mengonfirmasi pengunggahan ke database.
        </p>
      </header>

      {/* Summary Cards Grid */}
      <div className={styles.previewGrid}>
        <div className={styles.previewStatCard}>
          <span className={styles.previewStatLabel}>Total Transaksi</span>
          <span className={styles.previewStatValue}>{previewSummary.totalRows} Baris</span>
        </div>
        <div className={styles.previewStatCard}>
          <span className={styles.previewStatLabel}>Estimasi Total Biaya</span>
          <span className={styles.previewStatValue} style={{ color: 'var(--color-primary)' }}>
            {formatRupiah(previewSummary.totalAmount)}
          </span>
        </div>
        <div className={styles.previewStatCard}>
          <span className={styles.previewStatLabel}>Status Validasi</span>
          <span className={styles.previewStatValue}>
            {previewSummary.hasErrors ? (
              <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '10px' }}>
                <AlertCircle size={10} />
                Terdapat Error
              </span>
            ) : (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '10px' }}>
                <CheckCircle size={10} />
                Format Sesuai
              </span>
            )}
          </span>
        </div>
      </div>

      {previewSummary.hasErrors && (
        <div className={styles.errorBanner} style={{ margin: 0, padding: 'var(--space-3) var(--space-4)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4 }}>
            <strong>Format File Bermasalah:</strong> Beberapa baris di bawah memiliki kesalahan format. Tombol unggah dinonaktifkan sementara. Perbaiki file template Anda dan unggah kembali.
          </div>
        </div>
      )}

      {/* Dynamic Preview Grid Table */}
      {previewRows.length > 0 ? (
        <div>
          <div className={styles.previewTableScroll}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi Kebutuhan</th>
                  <th>Qty & Satuan</th>
                  <th>Harga Satuan</th>
                  <th>Subtotal</th>
                  <th>Pembayaran</th>
                  <th>Lokasi</th>
                  <th>Vendor Mapped</th>
                  <th>No. BA</th>
                  <th>No. Invoice</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {/* Limit view to first 10 rows as per user feedback */}
                {previewRows.slice(0, 10).map((row, idx) => {
                  const isRowInvalid = row.errors.length > 0;
                  return (
                    <tr key={idx} className={isRowInvalid ? styles.errorRow : ''}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>#{row.rowNum}</td>
                      <td className={!row.date ? styles.errorCell : ''} title={row.errors.find((e: string) => e.includes('Tanggal')) || ''}>
                        {row.date || '-'}
                      </td>
                      <td>{row.category} {row.subCategory ? `(${row.subCategory})` : ''}</td>
                      <td className={!row.description ? styles.errorCell : ''} title={row.errors.find((e: string) => e.includes('Deskripsi')) || ''}>
                        {row.description || '-'}
                      </td>
                      <td className={row.errors.some((e: string) => e.includes('Kuantitas')) ? styles.errorCell : ''}>
                        {row.quantity} {row.unit}
                      </td>
                      <td className={row.errors.some((e: string) => e.includes('Harga')) ? styles.errorCell : ''}>
                        {formatRupiah(row.pricePerUnit)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatRupiah(row.subtotal)}</td>
                      <td>{formatPaymentMethod(row.paymentMethod)}</td>
                      <td>
                        {row.location ? (
                          <span className={`badge ${row.location === 'SITE' ? 'badge-info' : row.location === 'MESS' ? 'badge-warning' : 'badge-success'}`} style={{ textTransform: 'capitalize' }}>
                            {row.location.toLowerCase()}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{row.vendor || '-'}</td>
                      <td>{row.beritaAcara || '-'}</td>
                      <td className={row.errors.some((e: string) => e.includes('Invoice')) ? styles.errorCell : ''} title={row.errors.find((e: string) => e.includes('Invoice')) || ''}>
                        {row.invoiceNumber || '-'}
                      </td>
                      <td>
                        {isRowInvalid ? (
                          <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '10px' }} title={row.errors.join(', ')}>
                            ⚠️ {row.errors[0]}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success)', fontSize: '10px', fontWeight: 600 }}>Siap</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {previewRows.length > 10 && (
            <p className={styles.footnote}>
              * Menampilkan 10 dari <strong>{previewRows.length}</strong> total baris transaksi terdeteksi.
            </p>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-4)', border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
            Kolom template tidak lengkap atau tidak dapat dibaca. Pastikan header sesuai spesifikasi.
          </span>
        </div>
      )}
    </div>
  );
}
