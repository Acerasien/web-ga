'use client';

import { useState, useRef, useTransition } from 'react';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { createOngoingPayment } from '@/lib/actions/ongoing';
import type { AuthUser } from '@/types';
import type { Category, Branch } from '@prisma/client';
import styles from './modal.module.css';

interface OngoingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  user: AuthUser;
  categories: Category[];
  branches: Branch[];
}

export default function OngoingRequestModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  user,
  categories,
  branches,
}: OngoingRequestModalProps) {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [branchId, setBranchId] = useState<string>(
    user.role === 'ADMIN' && user.branchId ? String(user.branchId) : ''
  );
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState<string>('Pcs');
  const [amountNeeded, setAmountNeeded] = useState<string>('');
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [requestDate, setRequestDate] = useState<string>(() => {
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

  // Submit response states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  // Handles receipt / PDF upload to secure disk
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset upload errors
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedBranchId = user.role === 'ADMIN' ? user.branchId! : Number(branchId);
    const parsedCategoryId = Number(categoryId);
    const parsedAmount = parseFloat(amountNeeded.replace(/[^0-9]/g, ''));
    const parsedQty = quantity ? parseFloat(quantity) : undefined;

    if (!parsedBranchId) {
      setError('Mohon tentukan cabang.');
      return;
    }
    if (!parsedCategoryId) {
      setError('Mohon tentukan kategori.');
      return;
    }
    if (!description.trim()) {
      setError('Mohon masukkan deskripsi singkat.');
      return;
    }
    if (parsedQty !== undefined && (isNaN(parsedQty) || parsedQty <= 0)) {
      setError('Kuantitas harus berupa angka positif.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Mohon masukkan jumlah uang yang dibutuhkan dengan benar.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await createOngoingPayment({
          branchId: parsedBranchId,
          categoryId: parsedCategoryId,
          description: description.trim(),
          amountNeeded: parsedAmount,
          quantity: parsedQty,
          unit: unit.trim() || undefined,
          initialReceiptPath: receiptPath || undefined,
          requestDate,
        });

        if (res.success) {
          setSuccess(true);
          onSubmitSuccess();
          setTimeout(() => {
            handleReset();
            onClose();
          }, 1500);
        } else {
          setError(res.error || 'Terjadi kesalahan saat menyimpan data.');
        }
      } catch (err) {
        console.error(err);
        setError('Kesalahan sistem. Gagal menghubungi server.');
      }
    });
  };

  const handleReset = () => {
    setCategoryId('');
    if (user.role !== 'ADMIN') setBranchId('');
    setDescription('');
    setQuantity('1');
    setUnit('Pcs');
    setAmountNeeded('');
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
    setRequestDate(`${year}-${month}-${day}`);
  };

  // Safe format input for rupiah
  const handleAmountChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    if (!numeric) {
      setAmountNeeded('');
      return;
    }
    setAmountNeeded(Number(numeric).toLocaleString('id-ID'));
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <header className={styles.header}>
          <h3>Buat Request Pembayaran</h3>
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
                    Request Berhasil Disimpan
                  </h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Permintaan pembayaran sedang dicatat dengan status <strong>Belum Dibayar</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'var(--color-danger-light)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Branch Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Cabang <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      disabled={user.role === 'ADMIN'}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: user.role === 'ADMIN' ? 'var(--color-bg)' : 'var(--color-surface)', color: 'var(--color-text)' }}
                    >
                      <option value="">-- Pilih Cabang --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Request Date Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Tanggal Pengajuan <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
                    />
                  </div>

                  {/* Category Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Kategori Pengeluaran <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Deskripsi Keperluan <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Panjar pembelian cat tembok renovasi depan"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                    />
                  </div>

                  {/* Quantity and Unit Input Group */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Quantity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Jumlah (Kuantitas) (Opsional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Contoh: 1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                      />
                    </div>
                    {/* Unit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Satuan Ukur (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pcs, Liter, Rim"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                      />
                    </div>
                  </div>

                  {/* Amount Needed Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Estimasi Dana Dibutuhkan (Rp) <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '14px', top: '10px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Rp</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={amountNeeded}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px 10px 38px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {/* Upload Quotation Box */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Nota Awal / Invoice Penawaran / PDF (Opsional)
                    </label>

                    {receiptPath ? (
                      <div className={styles.previewFrame} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                            <FileText size={24} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                              {fileName || 'Dokumen_Request'}
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
                style={{ backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isPending ? 'Menyimpan...' : 'Simpan Request'}
              </button>
            </footer>
          )}
        </form>
      </div>
    </div>
  );
}
