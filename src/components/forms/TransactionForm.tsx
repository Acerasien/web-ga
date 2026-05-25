'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Calculator,
  ArrowRight,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';
import { createTransaction } from '@/lib/actions/transactions';
import { formatRupiah } from '@/lib/formatters';
import type { AuthUser, TransactionFormData, FieldsConfig, CategoryField } from '@/types';
import type { CategoryWithSub } from '@/lib/actions/categories';
import type { Branch, PaymentMethod } from '@prisma/client';
import styles from '@/app/(dashboard)/transaksi/input/input.module.css';
import modalStyles from '@/components/modals/modal.module.css';

import TransactionSuccessAlert from './TransactionFormParts/TransactionSuccessAlert';
import ReceiptUploadDropzone from './TransactionFormParts/ReceiptUploadDropzone';
import DynamicCustomFields from './TransactionFormParts/DynamicCustomFields';

interface TransactionFormProps {
  user: AuthUser;
  categories: CategoryWithSub[];
  branches: Branch[];
}

export default function TransactionForm({ user, categories, branches }: TransactionFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Primary form fields states
  const [categoryId, setCategoryId] = useState<string>('');
  const [subCategoryId, setSubCategoryId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [description, setDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('Pcs');
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [priceDisplay, setPriceDisplay] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [vendor, setVendor] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [beritaAcara, setBeritaAcara] = useState<string>('');

  // Dynamic custom fields states
  const [customFields, setCustomFields] = useState<Record<string, string | number>>({});

  // Receipt uploader states
  const [uploading, setUploading] = useState<boolean>(false);
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFileSize, setUploadFileSize] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form submission alerts
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Computed Values
  const totalAmount = quantity * pricePerUnit;

  // Resolve currently selected category and subcategories
  const selectedCategory = categories.find(c => c.id === Number(categoryId));
  const subCategories = selectedCategory?.subCategories || [];

  // Parse fieldsConfig securely (Poka-Yoke)
  const fieldsConfig = selectedCategory?.fieldsConfig
    ? (selectedCategory.fieldsConfig as unknown as FieldsConfig)
    : null;
  const dynamicFields: CategoryField[] = fieldsConfig?.fields || [];

  const handleCategoryChange = (val: string) => {
    setCategoryId(val);
    setSubCategoryId('');
    setCustomFields({}); // Clear previous custom fields values
    setFormError(null);
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
        setUploadError(result.error || 'Gagal mengunggah kuitansi.');
      }
    } catch (error) {
      console.error('File upload fetch error:', error);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    setValidationError(null);

    // Primary validation
    if (!categoryId) {
      setValidationError('Pilih kategori transaksi terlebih dahulu.');
      return;
    }
    if (!description.trim()) {
      setValidationError('Masukkan deskripsi atau kebutuhan transaksi.');
      return;
    }
    if (quantity <= 0) {
      setValidationError('Kuantitas jumlah barang/jasa harus lebih besar dari 0.');
      return;
    }
    if (pricePerUnit < 0) {
      setValidationError('Harga satuan tidak boleh bernilai negatif.');
      return;
    }
    if (user.role === 'SUPERADMIN' && !branchId) {
      setValidationError('Tentukan cabang penanggung jawab untuk pengeluaran ini.');
      return;
    }

    // Dynamic field validation: check if required fields are provided
    for (const field of dynamicFields) {
      if (field.required && (customFields[field.key] === undefined || customFields[field.key] === '')) {
        setValidationError(`Kolom informasi tambahan '${field.label}' wajib diisi.`);
        return;
      }
    }

    // All validations pass -> open Double Confirm Modal Review
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    setShowConfirmModal(false);
    setFormError(null);
    setFormSuccess(false);

    startTransition(async () => {
      try {
        const payload: TransactionFormData & { branchId?: number } = {
          categoryId: Number(categoryId),
          subCategoryId: subCategoryId ? Number(subCategoryId) : undefined,
          transactionDate,
          description: description.trim(),
          quantity,
          unit: unit.trim(),
          pricePerUnit,
          paymentMethod: paymentMethod as PaymentMethod,
          vendor: vendor.trim() || undefined,
          receiptPath: receiptPath || undefined,
          notes: notes.trim() || undefined,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
          beritaAcara: beritaAcara.trim() || undefined,
        };

        if (user.role === 'SUPERADMIN') {
          payload.branchId = Number(branchId);
        }

        const result = await createTransaction(payload);

        if (result.success) {
          setFormSuccess(true);
          handleReset();
        } else {
          setFormError(result.error || 'Gagal menyimpan transaksi.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err) {
        console.error('Submit transaction error:', err);
        setFormError('Terjadi kesalahan koneksi server.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleReset = () => {
    setDescription('');
    setQuantity(1);
    setUnit('Pcs');
    setPricePerUnit(0);
    setPriceDisplay('');
    setVendor('');
    setNotes('');
    setCustomFields({});
    setSubCategoryId('');
    setBeritaAcara('');
    handleRemoveReceipt();
  };

  return (
    <div className={styles.container}>
      <header className={styles.titleBlock}>
        <h2>Catat Transaksi</h2>
        <p className="text-muted">Mencatat pengeluaran operasional General Affairs untuk audit cabang.</p>
      </header>

      {/* Success alert with option to reset or view list (Enterprise UX) */}
      {formSuccess ? (
        <TransactionSuccessAlert onReset={() => setFormSuccess(false)} />
      ) : (
        <form onSubmit={handlePreSubmit} className={styles.formCard} noValidate>
          {formError && (
            <div className={styles.alert} role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{formError}</span>
            </div>
          )}

          <h3 className={styles.sectionTitle}>Informasi Utama</h3>
          <div className={styles.formGrid}>
            {/* Branch Selector (SUPERADMIN only) */}
            {user.role === 'SUPERADMIN' && (
              <div className={styles.formGroup}>
                <label htmlFor="branchId" className={`${styles.label} ${styles.labelRequired}`}>
                  Cabang Penanggung Jawab
                </label>
                <select
                  id="branchId"
                  className={styles.input}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={isPending}
                  required
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Nomor Berita Acara (Optional Input) */}
            <div className={styles.formGroup}>
              <label htmlFor="beritaAcara" className={styles.label}>
                Nomor Berita Acara (Opsional)
              </label>
              <input
                id="beritaAcara"
                type="text"
                className={styles.input}
                placeholder="Contoh: 0001/BA-GA/HO/V/2026"
                value={beritaAcara}
                onChange={(e) => setBeritaAcara(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Date Field */}
            <div className={styles.formGroup}>
              <label htmlFor="transactionDate" className={`${styles.label} ${styles.labelRequired}`}>
                Tanggal Transaksi
              </label>
              <input
                id="transactionDate"
                type="date"
                className={styles.input}
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            {/* Parent Category Field */}
            <div className={styles.formGroup}>
              <label htmlFor="categoryId" className={`${styles.label} ${styles.labelRequired}`}>
                Kategori
              </label>
              <select
                id="categoryId"
                className={styles.input}
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={isPending}
                required
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Cascading Sub-Category Field */}
            <div className={styles.formGroup}>
              <label htmlFor="subCategoryId" className={styles.label}>
                Sub-Kategori
              </label>
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
                {subCategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Description Field */}
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="description" className={`${styles.label} ${styles.labelRequired}`}>
                Deskripsi / Kebutuhan
              </label>
              <input
                id="description"
                type="text"
                className={styles.input}
                placeholder="Contoh: Pembelian tinta printer Epson L3110"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
          </div>

          {/* Dynamic Custom Fields Grid */}
          <DynamicCustomFields
            dynamicFields={dynamicFields}
            customFields={customFields}
            categoryName={selectedCategory?.name}
            isPending={isPending}
            onChange={(key, value) => setCustomFields(prev => ({ ...prev, [key]: value }))}
          />

          <h3 className={styles.sectionTitle}>Rincian Biaya & Pembayaran</h3>
          <div className={styles.formGrid}>
            {/* Quantity Field */}
            <div className={styles.formGroup}>
              <label htmlFor="quantity" className={`${styles.label} ${styles.labelRequired}`}>
                Jumlah (Kuantitas)
              </label>
              <input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                className={styles.input}
                value={quantity === 0 ? '' : quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={isPending}
                required
              />
            </div>

            {/* Unit Field */}
            <div className={styles.formGroup}>
              <label htmlFor="unit" className={`${styles.label} ${styles.labelRequired}`}>
                Satuan Ukur
              </label>
              <input
                id="unit"
                type="text"
                className={styles.input}
                placeholder="Contoh: Liter, Pcs, Rim, Kotak"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            {/* Price Per Unit Field */}
            <div className={styles.formGroup}>
              <label htmlFor="pricePerUnit" className={`${styles.label} ${styles.labelRequired}`}>
                Harga Satuan (Rupiah)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pricePerUnit"
                  type="text"
                  inputMode="numeric"
                  className={styles.input}
                  style={{ paddingLeft: 'var(--space-10)' }}
                  // placeholder="Contoh: 150.000"
                  value={priceDisplay}
                  onChange={(e) => {
                    const valueStr = e.target.value;
                    const rawDigits = valueStr.replace(/[^0-9]/g, '');
                    const numericValue = rawDigits ? Number(rawDigits) : 0;

                    setPricePerUnit(numericValue);

                    const formatted = rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                    setPriceDisplay(formatted);
                  }}
                  disabled={isPending}
                  required
                />
                <span style={{
                  position: 'absolute',
                  left: 'var(--space-4)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)'
                }}>Rp</span>
              </div>
            </div>

            {/* Payment Method Field */}
            <div className={styles.formGroup}>
              <label htmlFor="paymentMethod" className={`${styles.label} ${styles.labelRequired}`}>
                Metode Pembayaran
              </label>
              <select
                id="paymentMethod"
                className={styles.input}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={isPending}
                required
              >
                <option value="CASH">Tunai (Cash)</option>
                <option value="TRANSFER">Transfer Bank</option>
                <option value="PETTY_CASH">Kas Kecil (Petty Cash)</option>
              </select>
            </div>

            {/* Vendor / Supplier Field */}
            <div className={styles.formGroup}>
              <label htmlFor="vendor" className={styles.label}>
                Vendor / Supplier / Toko
              </label>
              <input
                id="vendor"
                type="text"
                className={styles.input}
                placeholder="Nama toko atau penerima pembayaran"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Notes Field */}
            <div className={styles.formGroup}>
              <label htmlFor="notes" className={styles.label}>
                Catatan Tambahan
              </label>
              <input
                id="notes"
                type="text"
                className={styles.input}
                placeholder="Catatan tambahan mengenai transaksi"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Real-time calculated total multiplier banner */}
          <div className={styles.totalCard}>
            <div className={styles.totalLabelBlock}>
              <span className={styles.totalLabel}>Estimasi Total Pengeluaran</span>
              <span className={styles.totalSub}>Hasil kali otomatis Kuantitas &times; Harga Satuan</span>
            </div>
            <div className={styles.totalValue} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Calculator size={20} style={{ opacity: 0.6 }} />
              <span>{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Bukti Pembayaran (Kuitansi / Nota)</h3>
          <ReceiptUploadDropzone
            receiptPath={receiptPath}
            uploadFileName={uploadFileName}
            uploadFileSize={uploadFileSize}
            uploadError={uploadError}
            uploading={uploading}
            isPending={isPending}
            onUpload={handleUpload}
            onRemove={handleRemoveReceipt}
          />

          {/* Form Actions Footer */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleReset}
              disabled={isPending || uploading}
            >
              Kosongkan Form
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isPending || uploading}
            >
              {isPending ? (
                <>
                  <div className={styles.spinner} />
                  <span>Menyimpan Transaksi...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={18} />
                  <span>Catat Transaksi</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Premium Double Confirmation Modal Overlay */}
      {showConfirmModal && (
        <div 
          className={modalStyles.backdrop} 
          onClick={() => setShowConfirmModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className={modalStyles.modal} 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '520px' }}
          >
            {/* Header */}
            <header className={modalStyles.header}>
              <h3>Konfirmasi Catat Transaksi</h3>
              <button 
                onClick={() => setShowConfirmModal(false)} 
                className={modalStyles.closeBtn}
                aria-label="Tutup Konfirmasi"
              >
                <X size={20} />
              </button>
            </header>

            {/* Body */}
            <div className={modalStyles.body} style={{ gap: 'var(--space-5)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                <Calculator size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--color-text)', marginBottom: '2px' }}>Review Data Pengeluaran:</strong>
                  <span>Pastikan semua rincian di bawah ini sudah benar sebelum menyimpannya ke database GA.</span>
                </div>
              </div>

              <div className={modalStyles.sectionTitle}>Rincian Transaksi</div>
              
              <div className={modalStyles.grid} style={{ rowGap: 'var(--space-3)' }}>
                <div className={modalStyles.item}>
                  <span className={modalStyles.label}>Kategori</span>
                  <span className={modalStyles.value}>
                    {selectedCategory?.name || '-'}
                  </span>
                </div>
                
                <div className={modalStyles.item}>
                  <span className={modalStyles.label}>Sub-Kategori</span>
                  <span className={modalStyles.value}>
                    {subCategories.find(s => s.id === Number(subCategoryId))?.name || '-'}
                  </span>
                </div>

                <div className={modalStyles.item}>
                  <span className={modalStyles.label}>Tanggal Transaksi</span>
                  <span className={modalStyles.value}>
                    {transactionDate}
                  </span>
                </div>

                <div className={modalStyles.item}>
                  <span className={modalStyles.label}>Metode Pembayaran</span>
                  <span className={modalStyles.value} style={{ fontWeight: 700 }}>
                    {paymentMethod === 'PETTY_CASH' 
                      ? 'Kas Kecil (Petty Cash)' 
                      : paymentMethod === 'TRANSFER' 
                        ? 'Transfer Bank' 
                        : 'Tunai (Cash)'}
                  </span>
                </div>

                <div className={modalStyles.item}>
                  <span className={modalStyles.label}>Rincian Kuantitas</span>
                  <span className={modalStyles.value}>
                    {quantity} {unit}
                  </span>
                </div>

                <div className={modalStyles.item}>
                  <span className={modalStyles.label}>Harga Satuan</span>
                  <span className={modalStyles.value}>
                    {formatRupiah(pricePerUnit)}
                  </span>
                </div>

                <div className={modalStyles.item} style={{ gridColumn: 'span 2' }}>
                  <span className={modalStyles.label}>Nomor Berita Acara</span>
                  <span className={modalStyles.value}>
                    {beritaAcara.trim() || '-'}
                  </span>
                </div>

                <div className={modalStyles.item} style={{ gridColumn: 'span 2' }}>
                  <span className={modalStyles.label}>Total Pengeluaran</span>
                  <span className={modalStyles.valueHighlight} style={{ color: 'var(--color-primary)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
                    {formatRupiah(quantity * pricePerUnit)}
                  </span>
                </div>

                <div className={modalStyles.item} style={{ gridColumn: 'span 2' }}>
                  <span className={modalStyles.label}>Deskripsi Kebutuhan</span>
                  <span className={modalStyles.value} style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 500 }}>
                    {description}
                  </span>
                </div>

                {vendor && (
                  <div className={modalStyles.item} style={{ gridColumn: 'span 2' }}>
                    <span className={modalStyles.label}>Vendor / Supplier</span>
                    <span className={modalStyles.value}>{vendor}</span>
                  </div>
                )}
                
                <div className={modalStyles.item} style={{ gridColumn: 'span 2' }}>
                  <span className={modalStyles.label}>Cabang Penanggung Jawab</span>
                  <span className={modalStyles.value} style={{ color: 'var(--color-primary)' }}>
                    {branches.find(b => b.id === Number(branchId))?.name || user.branchName || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <footer style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', backgroundColor: 'var(--color-bg)' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowConfirmModal(false)}
              >
                Kembali & Edit
              </button>
              <button 
                type="button" 
                className="btn btn-primary btn-sm" 
                onClick={executeSubmit}
                style={{ minWidth: '140px' }}
              >
                Ya, Catat Sekarang
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Premium Validation Warning Popup Modal */}
      {validationError && (
        <div 
          className={modalStyles.backdrop} 
          onClick={() => setValidationError(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className={modalStyles.modal} 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '400px', borderRadius: 'var(--radius-xl)' }}
          >
            {/* Header */}
            <header className={modalStyles.header} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <h3 style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertTriangle size={20} />
                <span>Form Belum Lengkap</span>
              </h3>
              <button 
                onClick={() => setValidationError(null)} 
                className={modalStyles.closeBtn}
                aria-label="Tutup Peringatan"
              >
                <X size={20} />
              </button>
            </header>

            {/* Body */}
            <div className={modalStyles.body} style={{ padding: 'var(--space-6) var(--space-6) var(--space-2)', textAlign: 'center', gap: 'var(--space-4)' }}>
              <div style={{ margin: '0 auto var(--space-2)', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-danger)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={32} />
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.6, fontWeight: 500 }}>
                {validationError}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Mohon lengkapi bagian ini sebelum menyimpan transaksi pengeluaran.
              </p>
            </div>

            {/* Footer */}
            <footer style={{ padding: 'var(--space-4) var(--space-6)', borderTop: 'none', display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setValidationError(null)}
                style={{ width: '100%', backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              >
                Perbaiki Data
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
