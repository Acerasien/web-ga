'use client';

import { useState, useRef, useTransition } from 'react';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2, AlertTriangle, Store } from 'lucide-react';
import { realizeOngoingPayment } from '@/lib/actions/ongoing';
import { formatRupiah } from '@/lib/formatters';
import type { PaymentMethod } from '@prisma/client';
import styles from './modal.module.css';

interface OngoingRealizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRealizeSuccess: () => void;
  paymentId: number;
  estimatedAmount: number;
  description: string;
  defaultVendor?: string;
}

export default function OngoingRealizeModal({
  isOpen,
  onClose,
  onRealizeSuccess,
  paymentId,
  estimatedAmount,
  description,
  defaultVendor,
}: OngoingRealizeModalProps) {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [isMoneyEnough, setIsMoneyEnough] = useState<boolean>(true);
  const [actualAmount, setActualAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [vendor, setVendor] = useState<string>(defaultVendor || '');
  const [notes, setNotes] = useState<string>('');
  const [beritaAcara, setBeritaAcara] = useState<string>('');
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // File upload states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');

  // Response states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/transactions/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.success && result.receiptPath) {
        setReceiptPath(result.receiptPath);
      } else {
        setUploadError(result.error || 'Gagal mengunggah berkas.');
        setReceiptPath('');
      }
    } catch (err) {
      console.error(err);
      setUploadError('Kesalahan jaringan. Gagal mengunggah berkas.');
      setReceiptPath('');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setReceiptPath('');
    setFileName('');
    setFileSize('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAmountChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    if (!numeric) {
      setActualAmount('');
      return;
    }
    setActualAmount(Number(numeric).toLocaleString('id-ID'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedActual = parseFloat(actualAmount.replace(/[^0-9]/g, ''));

    if (isNaN(parsedActual) || parsedActual <= 0) {
      setError('Mohon masukkan total uang realisasi dengan benar.');
      return;
    }
    if (!receiptPath) {
      setError('Bukti realisasi akhir (Foto/PDF) wajib dilampirkan.');
      return;
    }
    if (!notes.trim()) {
      setError('Catatan tambahan wajib diisi.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await realizeOngoingPayment(paymentId, {
          isMoneyEnough,
          actualAmount: parsedActual,
          finalReceiptPath: receiptPath,
          paymentMethod,
          vendor: vendor.trim() || undefined,
          notes: notes.trim() || undefined,
          transactionDate,
          beritaAcara: beritaAcara.trim() || undefined,
        });

        if (res.success) {
          setSuccess(true);
          onRealizeSuccess();
          setTimeout(() => {
            handleReset();
            onClose();
          }, 1500);
        } else {
          setError(res.error || 'Terjadi kesalahan saat merealisasikan pembayaran.');
        }
      } catch (err) {
        console.error(err);
        setError('Kesalahan sistem. Gagal menghubungi server.');
      }
    });
  };

  const handleReset = () => {
    setIsMoneyEnough(true);
    setActualAmount('');
    setPaymentMethod('CASH');
    setVendor('');
    setNotes('');
    setBeritaAcara('');
    setReceiptPath('');
    setFileName('');
    setFileSize('');
    setError(null);
    setSuccess(false);
    setUploadError(null);
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setTransactionDate(`${year}-${month}-${day}`);
  };

  const parsedActualAmount = parseFloat(actualAmount.replace(/[^0-9]/g, '')) || 0;
  const difference = estimatedAmount - parsedActualAmount;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <header className={styles.header}>
          <h3>Realisasi Pembayaran</h3>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Tutup modal">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className={styles.body}>
            {success ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) 0', textAlign: 'center', gap: 'var(--space-4)' }}>
                <CheckCircle2 size={56} style={{ color: 'var(--color-success)' }} />
                <div>
                  <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
                    Realisasi Berhasil Dicatat!
                  </h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Pembayaran dipindahkan ke Riwayat Ongoing dan tercatat di riwayat transaksi utama.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Meta Request Info */}
                <div style={{ padding: '12px 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keperluan</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{description}</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '6px', fontSize: 'var(--text-xs)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Estimasi Awal:</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatRupiah(estimatedAmount)}</span>
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'var(--color-danger-light)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Realization Date Input */}
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.labelRequired}`}>
                      Tanggal Realisasi Belanja
                    </label>
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      required
                      className={styles.input}
                    />
                  </div>

                  {/* Nomor Berita Acara Input */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Nomor Berita Acara (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 0001/BA-GA/HO/V/2026"
                      value={beritaAcara}
                      onChange={(e) => setBeritaAcara(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  {/* Budget Sufficiency Toggle */}
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.labelRequired}`}>
                      Apakah uang estimasi awal cukup?
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setIsMoneyEnough(true)}
                        style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid', borderColor: isMoneyEnough ? 'var(--color-success)' : 'var(--color-border)', backgroundColor: isMoneyEnough ? 'rgba(34, 197, 94, 0.08)' : 'var(--color-surface)', color: isMoneyEnough ? 'var(--color-success)' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        Cukup / Berlebih
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMoneyEnough(false)}
                        style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid', borderColor: !isMoneyEnough ? 'var(--color-danger)' : 'var(--color-border)', backgroundColor: !isMoneyEnough ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-surface)', color: !isMoneyEnough ? 'var(--color-danger)' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        Kurang (Butuh Tambahan)
                      </button>
                    </div>
                  </div>

                  {/* Realized Spent Cost */}
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.labelRequired}`}>
                      Total Uang Realisasi yang Dibelanjakan
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Rp</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={actualAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className={styles.input}
                        style={{ paddingLeft: '34px', fontWeight: 600 }}
                      />
                    </div>
                    {/* Variance indicator banner */}
                    {parsedActualAmount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '2px', color: difference >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        <AlertTriangle size={12} />
                        <span>
                          {difference >= 0
                            ? `Terdapat sisa uang sebesar ${formatRupiah(difference)} yang dikembalikan ke kas.`
                            : `Kekurangan dana sebesar ${formatRupiah(Math.abs(difference))} yang perlu dibayarkan.`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.labelRequired}`}>
                      Metode Realisasi
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className={styles.input}
                    >
                      <option value="CASH">CASH (Tunai)</option>
                      <option value="TRANSFER">TRANSFER (Non-Tunai)</option>
                      <option value="PETTY_CASH">PETTY CASH (Kas Kecil)</option>
                    </select>
                  </div>

                  {/* Vendor Input */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Vendor / Nama Toko (Opsional)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Contoh: Toko Cat Sumber Harapan"
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        className={styles.input}
                        style={{ paddingLeft: '38px' }}
                      />
                      <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'none',
                        color: 'var(--color-text-muted)'
                      }}>
                        <Store size={16} />
                      </span>
                    </div>
                  </div>

                  {/* Notes / Remarks Input */}
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.labelRequired}`}>
                      Catatan Tambahan
                    </label>
                    <textarea
                      placeholder="Contoh: Cat tembok 2 pail warna abu-abu muda, nota terlampir."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      required
                      rows={2}
                      className={`${styles.input} ${styles.textarea}`}
                      style={{ resize: 'none' }}
                    />
                  </div>

                  {/* Upload Receipt */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Bukti Realisasi Akhir / Kuitansi Belanja <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>

                    {receiptPath ? (
                      <div className={styles.previewFrame} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                            <FileText size={24} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                              {fileName || 'Kuitansi_Akhir'}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{fileSize || 'Ukuran tidak diketahui'}</span>
                          </div>
                        </div>
                        <button type="button" onClick={handleRemoveFile} className={styles.deleteBtn} style={{ color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', padding: '6px', fontSize: 'var(--text-sm)' }}>
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={triggerFileInput}
                        style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', cursor: isUploading ? 'not-allowed' : 'pointer', backgroundColor: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                      >
                        <UploadCloud size={32} style={{ color: 'var(--color-text-light)' }} />
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                          {isUploading ? 'Sedang mengunggah...' : 'Klik untuk mengunggah Lampiran (JPG, PNG, PDF)'}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          style={{ display: 'none' }}
                        />
                      </div>
                    )}

                    {uploadError && (
                      <span style={{ color: 'var(--color-danger)', fontSize: '10px', fontWeight: 600 }}>
                        {uploadError}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {!success && (
            <footer className={styles.footer}>
              <button type="button" onClick={onClose} disabled={isPending} className="btn btn-secondary" style={{ marginRight: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: 'pointer' }}>
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending || isUploading}
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--color-success)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isPending ? 'Memproses...' : 'Selesaikan Realisasi'}
              </button>
            </footer>
          )}
        </form>
      </div>
    </div>
  );
}
