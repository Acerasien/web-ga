'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2, Loader2, Save } from 'lucide-react';
import { updateOngoingPayment } from '@/lib/actions/ongoing';
import type { AuthUser } from '@/types';
import type { Branch, Location } from '@prisma/client';
import type { CategoryWithSub } from '@/lib/actions/categories';
import type { OngoingPaymentWithRelations } from '@/lib/actions/ongoing';
import styles from './modal.module.css';

interface OngoingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess: () => void;
  user: AuthUser;
  categories: CategoryWithSub[];
  branches: Branch[];
  payment: OngoingPaymentWithRelations;
}

export default function OngoingEditModal({
  isOpen,
  onClose,
  onUpdateSuccess,
  user,
  categories,
  branches,
  payment,
}: OngoingEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form states initialized with existing payment details
  const [branchId, setBranchId] = useState<string>(String(payment.branchId));
  const [categoryId, setCategoryId] = useState<string>(String(payment.categoryId));
  const [subCategoryId, setSubCategoryId] = useState<string>(
    payment.subCategoryId ? String(payment.subCategoryId) : ''
  );
  const [location, setLocation] = useState<string>(payment.location || '');
  const [description, setDescription] = useState<string>(payment.description);
  const [amountNeeded, setAmountNeeded] = useState<string>(
    Math.round(payment.amountNeeded).toLocaleString('id-ID')
  );
  const [notes, setNotes] = useState<string>(payment.notes || '');
  const [receiptPath, setReceiptPath] = useState<string>(payment.initialReceiptPath || '');
  const [requestDate, setRequestDate] = useState<string>(() => {
    const d = new Date(payment.requestDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [frequency, setFrequency] = useState<string>(payment.frequency || '');

  // File upload states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>(
    payment.initialReceiptPath ? payment.initialReceiptPath.split('/').pop() || 'Dokumen' : ''
  );
  const [fileSize, setFileSize] = useState<string>('');

  // Submit response states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const subCategories = selectedCategory?.subCategories || [];

  const handleCategoryChange = (val: string) => {
    setCategoryId(val);
    setSubCategoryId('');
    setError(null);
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

  // Handles receipt / PDF upload to secure disk
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedBranchId = user.role === 'ADMIN' ? user.branchId! : Number(branchId);
    const parsedCategoryId = Number(categoryId);
    const parsedSubCategoryId = subCategoryId ? Number(subCategoryId) : undefined;
    const parsedAmount = parseFloat(amountNeeded.replace(/[^0-9]/g, ''));

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
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Mohon masukkan jumlah uang yang dibutuhkan dengan benar.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateOngoingPayment(payment.id, {
          branchId: parsedBranchId,
          categoryId: parsedCategoryId,
          subCategoryId: parsedSubCategoryId,
          description: description.trim(),
          amountNeeded: parsedAmount,
          initialReceiptPath: receiptPath || undefined,
          requestDate,
          frequency: frequency || undefined,
          location: location ? (location as Location) : undefined,
          notes: notes.trim() || undefined,
        });

        if (res.success) {
          setSuccess(true);
          onUpdateSuccess();
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setError(res.error || 'Terjadi kesalahan saat menyimpan data.');
        }
      } catch (err) {
        console.error(err);
        setError('Kesalahan sistem. Gagal menghubungi server.');
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <header className={styles.header}>
          <h3>Ubah Request Pembayaran</h3>
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
                    Request Berhasil Diperbarui
                  </h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Perubahan pada pembayaran berjalan telah disimpan dengan sukses.
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
                  {/* Row 1: Branch and Request Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Cabang <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        disabled={user.role === 'ADMIN'}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: user.role === 'ADMIN' ? 'var(--color-bg)' : 'var(--color-surface)', color: 'var(--color-text)', cursor: user.role === 'ADMIN' ? 'not-allowed' : 'pointer' }}
                      >
                        <option value="">-- Pilih Cabang --</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>

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
                  </div>

                  {/* Row 2: Category and Subcategory */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Kategori Pengeluaran <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <select
                        value={categoryId}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Sub-Kategori
                      </label>
                      <select
                        value={subCategoryId}
                        onChange={(e) => setSubCategoryId(e.target.value)}
                        disabled={!isMounted || !categoryId || subCategories.length === 0}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: (!categoryId || subCategories.length === 0) ? 'var(--color-bg)' : 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
                      >
                        <option value="">
                          {!categoryId
                            ? '-- Pilih Kategori Terlebih Dahulu --'
                            : subCategories.length === 0
                            ? '-- Tidak ada sub-kategori --'
                            : '-- Pilih Sub-Kategori --'}
                        </option>
                        {subCategories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Frequency and Location */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Frekuensi
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
                      >
                        <option value="">One-Time (Sekali Bayar)</option>
                        <option value="Mingguan">Mingguan</option>
                        <option value="Bulanan">Bulanan</option>
                        <option value="Tahunan">Tahunan</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Lokasi
                      </label>
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
                      >
                        <option value="">-- Pilih Lokasi --</option>
                        <option value="SITE">Site</option>
                        <option value="MESS">Mess</option>
                        <option value="OFFICE">Office</option>
                      </select>
                    </div>
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

                  {/* Notes Area */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Catatan Tambahan
                    </label>
                    <textarea
                      placeholder="Catatan tambahan mengenai penyesuaian atau koreksi request"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', resize: 'vertical' }}
                    />
                  </div>

                  {/* Upload Quotation Box */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Nota Awal / Invoice Penawaran / PDF (Opsional)
                    </label>

                    {receiptPath ? (
                      <div className={styles.receiptFrame} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-bg)', minHeight: 'unset' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                            <FileText size={20} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }} title={fileName}>
                              {fileName}
                            </span>
                            {fileSize && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{fileSize}</span>}
                          </div>
                        </div>
                        <button type="button" onClick={handleRemoveFile} className={styles.deleteBtn} style={{ padding: '4px 10px', minHeight: 'unset', fontSize: 'var(--text-xs)', color: 'white' }}>
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={triggerFileInput}
                        className={styles.uploaderContainer}
                        style={{ padding: '15px', minHeight: '100px', gap: '4px' }}
                      >
                        <UploadCloud size={28} className={styles.uploaderIcon} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {isUploading ? 'Sedang mengunggah...' : 'Klik untuk mengunggah Lampiran Baru (JPG, PNG, PDF)'}
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
                {isPending ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </footer>
          )}
        </form>
      </div>
    </div>
  );
}
