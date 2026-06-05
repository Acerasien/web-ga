'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  PlusCircle
} from 'lucide-react';
import { createOngoingPayment } from '@/lib/actions/ongoing';
import type { AuthUser } from '@/types';
import type { Branch } from '@prisma/client';
import type { CategoryWithSub } from '@/lib/actions/categories';
import styles from '@/app/(dashboard)/transaksi/input/input.module.css';

interface OngoingInputClientProps {
  user: AuthUser;
  categories: CategoryWithSub[];
  branches: Branch[];
}

export default function OngoingInputClient({ user, categories, branches }: OngoingInputClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [branchId, setBranchId] = useState<string>(
    user.role === 'ADMIN' && user.branchId ? String(user.branchId) : ''
  );
  const [categoryId, setCategoryId] = useState<string>('');
  const [subCategoryId, setSubCategoryId] = useState<string>('');

  const selectedCategory = categories.find(c => c.id === Number(categoryId));
  const subCategories = selectedCategory?.subCategories || [];

  const handleCategoryChange = (val: string) => {
    setCategoryId(val);
    setSubCategoryId('');
    setFormError(null);
  };
  const [description, setDescription] = useState<string>('');
  const [amountNeeded, setAmountNeeded] = useState<string>('');
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [requestDate, setRequestDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [frequency, setFrequency] = useState<string>('');

  // File upload states
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFileSize, setUploadFileSize] = useState<string>('');

  // Submit response states
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // File Handlers
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading || isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setFormError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/transactions/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setReceiptPath(result.receiptPath);
        setUploadFileName(file.name);
        setUploadFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
      } else {
        setUploadError(result.error || 'Gagal mengunggah dokumen.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError('Koneksi gagal. Periksa jaringan Anda.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptPath('');
    setUploadFileName('');
    setUploadFileSize('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    setValidationError(null);

    const parsedBranchId = user.role === 'ADMIN' ? user.branchId! : Number(branchId);
    const parsedCategoryId = Number(categoryId);
    const parsedSubCategoryId = subCategoryId ? Number(subCategoryId) : undefined;
    const parsedAmount = parseFloat(amountNeeded.replace(/[^0-9]/g, ''));

    if (!parsedBranchId) {
      setValidationError('Mohon tentukan cabang penanggung jawab.');
      return;
    }
    if (!parsedCategoryId) {
      setValidationError('Mohon tentukan kategori pengeluaran.');
      return;
    }
    if (!description.trim()) {
      setValidationError('Mohon masukkan deskripsi singkat.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Mohon masukkan jumlah uang yang dibutuhkan dengan benar.');
      return;
    }

    // Direct submit
    executeSubmit(parsedBranchId, parsedCategoryId, parsedSubCategoryId, parsedAmount);
  };

  const executeSubmit = (parsedBranchId: number, parsedCategoryId: number, parsedSubCategoryId: number | undefined, parsedAmount: number) => {
    startTransition(async () => {
      try {
        const res = await createOngoingPayment({
          branchId: parsedBranchId,
          categoryId: parsedCategoryId,
          subCategoryId: parsedSubCategoryId,
          description: description.trim(),
          amountNeeded: parsedAmount,
          initialReceiptPath: receiptPath || undefined,
          requestDate,
          frequency: frequency || undefined,
        });

        if (res.success) {
          setFormSuccess(true);
          handleReset();
        } else {
          setFormError(res.error || 'Terjadi kesalahan saat menyimpan data.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err) {
        console.error(err);
        setFormError('Kesalahan sistem. Gagal menghubungi server.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleReset = () => {
    setCategoryId('');
    setSubCategoryId('');
    if (user.role !== 'ADMIN') setBranchId('');
    setDescription('');
    setAmountNeeded('');
    setFrequency('');
    handleRemoveReceipt();
  };

  return (
    <div className={styles.container}>
      <header className={styles.titleBlock}>
        <h2>Catat Request Pembayaran (Ongoing)</h2>
        <p className="text-muted">Buat permintaan dana panjar baru untuk dikelola dan direalisasikan nanti.</p>
      </header>

      {formSuccess ? (
        <div className={`${styles.formCard} ${styles.alertSuccess}`} style={{ textAlign: 'center', display: 'block' }}>
          <CheckCircle2 size={48} style={{ margin: '0 auto var(--space-4)', color: 'var(--color-success)' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Request Pembayaran Berhasil Disimpan!
          </h3>
          <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
            Permintaan pembayaran sedang dicatat dengan status <strong>Belum Dibayar</strong>.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
            <button onClick={() => setFormSuccess(false)} className={styles.submitBtn}>
              <PlusCircle size={18} />
              <span>Buat Request Baru</span>
            </button>
            <Link href="/ongoing/list" className={styles.cancelBtn}>
              <span>Lihat Pembayaran Berjalan</span>
              <ArrowRight size={18} style={{ marginLeft: 'var(--space-2)' }} />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePreSubmit} className={styles.formCard} noValidate>
          {(formError || validationError) && (
            <div className={styles.alert} role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{validationError || formError}</span>
            </div>
          )}

          <h3 className={styles.sectionTitle}>Detail Permintaan</h3>
          <div className={styles.formGrid}>
            {user.role === 'SUPERADMIN' && (
              <div className={styles.formGroup}>
                <label htmlFor="branchId" className={`${styles.label} ${styles.labelRequired}`}>Cabang Penanggung Jawab</label>
                <select
                  id="branchId"
                  className={styles.input}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={isPending}
                  required
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="requestDate" className={`${styles.label} ${styles.labelRequired}`}>Tanggal Pengajuan</label>
              <input
                id="requestDate"
                type="date"
                className={styles.input}
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="categoryId" className={`${styles.label} ${styles.labelRequired}`}>Kategori Pengeluaran</label>
              <select
                id="categoryId"
                className={styles.input}
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={isPending}
                required
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="subCategoryId" className={styles.label}>Sub-Kategori</label>
              <select
                id="subCategoryId"
                className={styles.input}
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                disabled={isPending || !categoryId || subCategories.length === 0}
              >
                <option value="">
                  {!categoryId
                    ? '-- Pilih Kategori Terlebih Dahulu --'
                    : subCategories.length === 0
                      ? '-- Tidak ada sub-kategori --'
                      : '-- Pilih Sub-Kategori --'}
                </option>
                {subCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="frequency" className={styles.label}>Frekuensi (Opsional)</label>
              <select
                id="frequency"
                className={styles.input}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                disabled={isPending}
              >
                <option value="">One-Time (Sekali Bayar)</option>
                <option value="Mingguan">Mingguan</option>
                <option value="Bulanan">Bulanan</option>
                <option value="Tahunan">Tahunan</option>
              </select>
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="description" className={`${styles.label} ${styles.labelRequired}`}>Deskripsi Keperluan</label>
              <input
                id="description"
                type="text"
                className={styles.input}
                placeholder="Contoh: Panjar pembelian cat tembok renovasi depan"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="amountNeeded" className={`${styles.label} ${styles.labelRequired}`}>Estimasi Dana Dibutuhkan (Rupiah)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '10px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Rp</span>
                <input
                  id="amountNeeded"
                  type="text"
                  inputMode="numeric"
                  className={styles.input}
                  style={{ paddingLeft: '40px', fontWeight: 600 }}
                  placeholder="0"
                  value={amountNeeded}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Dokumen / Nota Awal (Opsional)</h3>
          <div style={{ marginBottom: 'var(--space-8)' }}>
            {receiptPath ? (
              <div className={styles.previewFrame}>
                {uploadFileName.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <FileText size={32} />
                  </div>
                ) : (
                  <img src={receiptPath} alt="Bukti kuitansi" className={styles.previewThumb} />
                )}
                <div className={styles.previewMeta}>
                  <span className={styles.previewName}>{uploadFileName}</span>
                  <span className={styles.previewSize}>{uploadFileSize}</span>
                </div>
                <button type="button" className={styles.deleteBtn} onClick={handleRemoveReceipt} disabled={isPending} aria-label="Hapus berkas">
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div
                className={`${styles.uploaderContainer} ${uploading || isPending ? styles.uploadDisabled : ''}`}
                onDragOver={handleDragOver}
                onDrop={handleFileDrop}
                onClick={() => !uploading && !isPending && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".png, .jpg, .jpeg, .pdf"
                  onChange={handleFileSelect}
                  disabled={uploading || isPending}
                />
                {uploading ? (
                  <>
                    <div className={styles.spinner} style={{ borderTopColor: 'var(--color-primary)', width: '28px', height: '28px' }} />
                    <span className={styles.uploaderText}>Mengunggah berkas...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={36} className={styles.uploaderIcon} />
                    <span className={styles.uploaderText}>
                      Tarik & lepas berkas di sini, atau <span className={styles.uploaderLink}>Pilih Berkas</span>
                    </span>
                    <span className={styles.uploaderText} style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                      Mendukung PNG, JPG, JPEG, atau PDF (Maks. 5MB)
                    </span>
                  </>
                )}
              </div>
            )}
            {uploadError && <div style={{ marginTop: 'var(--space-2)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{uploadError}</div>}
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={styles.cancelBtn} onClick={handleReset} disabled={isPending || uploading}>Kosongkan Form</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending || uploading}>
              {isPending ? (
                <>
                  <div className={styles.spinner} />
                  <span>Menyimpan Request...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={18} />
                  <span>Simpan Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
