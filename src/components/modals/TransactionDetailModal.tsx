'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { X, FileText, AlertCircle, Calendar, User, MapPin, CreditCard, ExternalLink, Trash2, Loader2, UploadCloud, ChevronDown, ChevronUp } from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import { deleteTransaction, updateTransactionReceipt, updateTransaction, getTransactionById } from '@/lib/actions/transactions';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import type { CategoryWithSub } from '@/lib/actions/categories';
import type { Branch, PaymentMethod, Location } from '@prisma/client';
import type { FieldsConfig, CategoryField, TransactionFormData } from '@/types';
import styles from './modal.module.css';
import inputStyles from '@/app/(dashboard)/transaksi/input/input.module.css';

interface TransactionDetailModalProps {
  transaction: TransactionWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  onDeleteSuccess?: () => void;
  onUploadSuccess?: () => void;
}

export default function TransactionDetailModal({ 
  transaction, 
  isOpen, 
  onClose,
  currentUserRole,
  onDeleteSuccess,
  onUploadSuccess
}: TransactionDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // File upload state management
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localReceiptPath, setLocalReceiptPath] = useState<string | null>(null);
  const [currentTxId, setCurrentTxId] = useState<number | null>(null);

  // Edit Mode States
  const [localTransaction, setLocalTransaction] = useState<TransactionWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [categories, setCategories] = useState<CategoryWithSub[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Form states for edit mode
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editSubCategoryId, setEditSubCategoryId] = useState<string>('');
  const [editTransactionDate, setEditTransactionDate] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editUnit, setEditUnit] = useState<string>('');
  const [editPricePerUnit, setEditPricePerUnit] = useState<number>(0);
  const [editPriceDisplay, setEditPriceDisplay] = useState<string>('');
  const [editDiscountPerUnit, setEditDiscountPerUnit] = useState<number>(0);
  const [editDiscountPerUnitDisplay, setEditDiscountPerUnitDisplay] = useState<string>('');
  const [editDiscountTotal, setEditDiscountTotal] = useState<number>(0);
  const [editDiscountTotalDisplay, setEditDiscountTotalDisplay] = useState<string>('');
  const [editTaxAmount, setEditTaxAmount] = useState<number>(0);
  const [editTaxAmountDisplay, setEditTaxAmountDisplay] = useState<string>('');
  const [editTaxNote, setEditTaxNote] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('CASH');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editVendor, setEditVendor] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editBeritaAcara, setEditBeritaAcara] = useState<string>('');
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, string | number>>({});
  const [editReceiptPath, setEditReceiptPath] = useState<string>('');

  const [editBreakdownOpen, setEditBreakdownOpen] = useState<boolean>(false);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [editComputedTotal, setEditComputedTotal] = useState<number>(0);

  // Sync prop changes to local states
  if (transaction && transaction.id !== currentTxId) {
    setCurrentTxId(transaction.id);
    setLocalReceiptPath(transaction.receiptPath);
    setLocalTransaction(transaction);
    setUploadError(null);
    setUploading(false);
    setIsEditing(false);
    setEditSubmitError(null);
    setEditValidationError(null);
  }

  // Fetch categories and branches dynamically when entering edit mode
  useEffect(() => {
    if (isEditing && categories.length === 0) {
      const loadMetadata = async () => {
        setLoadingMetadata(true);
        try {
          const [catRes, branchRes] = await Promise.all([
            getCategoriesWithSub(),
            getBranches()
          ]);
          if (catRes.success && catRes.data) {
            setCategories(catRes.data);
          }
          if (branchRes.success && branchRes.data) {
            setBranches(branchRes.data);
          }
        } catch (err) {
          console.error('Failed to load edit metadata:', err);
        } finally {
          setLoadingMetadata(false);
        }
      };
      loadMetadata();
    }
  }, [isEditing, categories.length]);

  // Recalculate computed total live in edit mode
  useEffect(() => {
    if (isEditing) {
      let total = editQuantity * editPricePerUnit;
      if (editBreakdownOpen) {
        total -= editDiscountPerUnit * editQuantity;
        total -= editDiscountTotal;
        total += editTaxAmount;
      }
      setEditComputedTotal(Math.max(0, total));
    }
  }, [isEditing, editQuantity, editPricePerUnit, editDiscountPerUnit, editDiscountTotal, editTaxAmount, editBreakdownOpen]);

  if (!isOpen || !transaction) return null;

  const txToDisplay = localTransaction || transaction;

  const initializeEditFields = (tx: TransactionWithRelations) => {
    setEditCategoryId(String(tx.categoryId));
    setEditSubCategoryId(tx.subCategoryId ? String(tx.subCategoryId) : '');

    // Format Date to YYYY-MM-DD
    const txDate = new Date(tx.transactionDate);
    const year = txDate.getFullYear();
    const month = String(txDate.getMonth() + 1).padStart(2, '0');
    const day = String(txDate.getDate()).padStart(2, '0');
    setEditTransactionDate(`${year}-${month}-${day}`);

    setEditDescription(tx.description);
    setEditQuantity(tx.quantity);
    setEditUnit(tx.unit);

    setEditPricePerUnit(tx.pricePerUnit);
    setEditPriceDisplay(tx.pricePerUnit > 0 ? tx.pricePerUnit.toLocaleString('id-ID') : '');

    setEditDiscountPerUnit(tx.discountPerUnit || 0);
    setEditDiscountPerUnitDisplay(tx.discountPerUnit && tx.discountPerUnit > 0 ? tx.discountPerUnit.toLocaleString('id-ID') : '');

    setEditDiscountTotal(tx.discountTotal || 0);
    setEditDiscountTotalDisplay(tx.discountTotal && tx.discountTotal > 0 ? tx.discountTotal.toLocaleString('id-ID') : '');

    setEditTaxAmount(tx.taxAmount || 0);
    setEditTaxAmountDisplay(tx.taxAmount && tx.taxAmount > 0 ? tx.taxAmount.toLocaleString('id-ID') : '');
    setEditTaxNote(tx.taxNote || '');

    setEditPaymentMethod(tx.paymentMethod);
    setEditLocation(tx.location || '');
    setEditVendor(tx.vendor || '');
    setEditNotes(tx.notes || '');
    setEditBeritaAcara(tx.beritaAcara || '');
    setEditBranchId(String(tx.branchId));

    // Load customFields
    const fields = tx.customFields
      ? (tx.customFields as unknown as Record<string, string | number>)
      : {};
    setEditCustomFields(fields);
    setEditReceiptPath(tx.receiptPath || '');

    // Open breakdown if any discount/tax exists
    const hasBreakdown = !!(tx.discountPerUnit || tx.discountTotal || tx.taxAmount);
    setEditBreakdownOpen(hasBreakdown);

    setEditValidationError(null);
    setEditSubmitError(null);
  };

  const startEditing = () => {
    initializeEditFields(txToDisplay);
    setIsEditing(true);
  };

  const handleEditCategoryChange = (val: string) => {
    setEditCategoryId(val);
    setEditSubCategoryId('');
    setEditCustomFields({});
    setEditValidationError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (isEditing) {
        handleEditUpload(file);
      } else {
        handleUpload(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isEditing) {
        handleEditUpload(file);
      } else {
        handleUpload(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEditUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/transactions/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setEditReceiptPath(result.receiptPath);
      } else {
        setUploadError(result.error || 'Gagal mengunggah kuitansi.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError('Koneksi gagal. Periksa jaringan Anda.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/transactions/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const linkResult = await updateTransactionReceipt(txToDisplay.id, result.receiptPath);
        if (linkResult.success) {
          setLocalReceiptPath(result.receiptPath);
          // Sync local transaction view as well
          const updatedTxRes = await getTransactionById(txToDisplay.id);
          if (updatedTxRes.success && updatedTxRes.data) {
            setLocalTransaction(updatedTxRes.data);
          }
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } else {
          setUploadError(linkResult.error || 'Gagal menyimpan bukti kuitansi.');
        }
      } else {
        setUploadError(result.error || 'Gagal mengunggah kuitansi.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError('Koneksi gagal. Periksa jaringan Anda.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEditValidationError(null);
    setEditSubmitError(null);

    // Primary validation
    if (!editCategoryId) {
      setEditValidationError('Pilih kategori transaksi terlebih dahulu.');
      return;
    }
    if (!editDescription.trim()) {
      setEditValidationError('Masukkan deskripsi atau kebutuhan transaksi.');
      return;
    }
    if (editQuantity <= 0) {
      setEditValidationError('Kuantitas jumlah barang/jasa harus lebih besar dari 0.');
      return;
    }
    if (editPricePerUnit < 0) {
      setEditValidationError('Harga satuan tidak boleh bernilai negatif.');
      return;
    }
    if (currentUserRole === 'SUPERADMIN' && !editBranchId) {
      setEditValidationError('Tentukan cabang penanggung jawab untuk pengeluaran ini.');
      return;
    }

    // Dynamic field validation
    for (const field of dynamicFields) {
      if (field.required && (editCustomFields[field.key] === undefined || editCustomFields[field.key] === '')) {
        setEditValidationError(`Kolom informasi tambahan '${field.label}' wajib diisi.`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const payload: TransactionFormData & { branchId?: number } = {
          categoryId: Number(editCategoryId),
          subCategoryId: editSubCategoryId ? Number(editSubCategoryId) : undefined,
          transactionDate: editTransactionDate,
          description: editDescription.trim(),
          quantity: editQuantity,
          unit: editUnit.trim(),
          pricePerUnit: editPricePerUnit,
          discountPerUnit: editBreakdownOpen && editDiscountPerUnit > 0 ? editDiscountPerUnit : undefined,
          discountTotal: editBreakdownOpen && editDiscountTotal > 0 ? editDiscountTotal : undefined,
          taxAmount: editBreakdownOpen && editTaxAmount > 0 ? editTaxAmount : undefined,
          taxNote: editBreakdownOpen && editTaxNote.trim() ? editTaxNote.trim() : undefined,
          paymentMethod: editPaymentMethod as PaymentMethod,
          location: editLocation ? (editLocation as Location) : undefined,
          vendor: editVendor.trim() || undefined,
          notes: editNotes.trim() || undefined,
          customFields: Object.keys(editCustomFields).length > 0 ? editCustomFields : undefined,
          beritaAcara: editBeritaAcara.trim() || undefined,
          receiptPath: editReceiptPath || undefined,
        };

        if (currentUserRole === 'SUPERADMIN') {
          payload.branchId = Number(editBranchId);
        }

        const result = await updateTransaction(txToDisplay.id, payload);

        if (result.success) {
          const updatedTxRes = await getTransactionById(txToDisplay.id);
          if (updatedTxRes.success && updatedTxRes.data) {
            setLocalTransaction(updatedTxRes.data);
            setLocalReceiptPath(updatedTxRes.data.receiptPath);
          }
          setIsEditing(false);
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        } else {
          setEditSubmitError(result.error || 'Gagal menyimpan perubahan transaksi.');
        }
      } catch (err) {
        console.error('Submit edit transaction error:', err);
        setEditSubmitError('Terjadi kesalahan koneksi server.');
      }
    });
  };

  // Format payment method badge styling
  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Tunai';
      case 'TRANSFER': return 'Transfer Bank';
      case 'PETTY_CASH': return 'Kas Kecil (Petty Cash)';
      default: return method;
    }
  };

  // Safe parsing of Postgres JSONB columns
  const customFieldsData = txToDisplay.customFields
    ? (txToDisplay.customFields as unknown as Record<string, string | number>)
    : {};

  const fieldsConfig = txToDisplay.category.fieldsConfig
    ? (txToDisplay.category.fieldsConfig as unknown as FieldsConfig)
    : null;
  const viewDynamicFields: CategoryField[] = fieldsConfig?.fields || [];

  // Filter filled custom fields to display in a clean grid
  const activeCustomFields = viewDynamicFields.filter(
    field => customFieldsData[field.key] !== undefined && customFieldsData[field.key] !== ''
  );

  // Dynamic custom fields definition for edit mode
  const selectedCategory = categories.find(c => c.id === Number(editCategoryId));
  const subCategories = selectedCategory?.subCategories || [];
  const editFieldsConfig = selectedCategory?.fieldsConfig
    ? (selectedCategory.fieldsConfig as unknown as FieldsConfig)
    : null;
  const dynamicFields: CategoryField[] = editFieldsConfig?.fields || [];

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      'Apakah Anda yakin ingin menghapus transaksi ini secara PERMANEN?\n\nTindakan ini akan menghapus catatan pengeluaran dari database selamanya dan tidak dapat dibatalkan.'
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await deleteTransaction(txToDisplay.id);
      if (response.success) {
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
        onClose();
      } else {
        setDeleteError(response.error || 'Gagal menghapus transaksi.');
      }
    } catch (error) {
      console.error('Delete transaction click error:', error);
      setDeleteError('Terjadi kesalahan koneksi saat menghapus transaksi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className={styles.backdrop} 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <header className={styles.header}>
          <h3 id="modal-title">{isEditing ? 'Ubah Rincian Transaksi' : 'Rincian Transaksi'}</h3>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Tutup Detail Transaksi">
            <X size={20} />
          </button>
        </header>
 
        {/* Modal Body */}
        <div className={styles.body}>
          {isEditing ? (
            /* ============================================================
               EDIT FORM VIEW
               ============================================================ */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} noValidate>
              {editValidationError && (
                <div className={inputStyles.alert} role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{editValidationError}</span>
                </div>
              )}
              {editSubmitError && (
                <div className={inputStyles.alert} role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{editSubmitError}</span>
                </div>
              )}

              {loadingMetadata ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8)', gap: 'var(--space-3)' }}>
                  <Loader2 size={32} className={styles.spinner} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Memuat pilihan kategori &amp; cabang...</span>
                </div>
              ) : (
                <>
                  {/* Edit Section 1: Informasi Administrasi */}
                  <div>
                    <h4 className={styles.sectionTitle}>Informasi Administrasi</h4>
                    <div className={inputStyles.formGrid}>
                      {/* Branch Selector (SUPERADMIN only) */}
                      {currentUserRole === 'SUPERADMIN' ? (
                        <div className={inputStyles.formGroup}>
                          <label htmlFor="editBranchId" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                            Cabang Penanggung Jawab
                          </label>
                          <select
                            id="editBranchId"
                            className={inputStyles.input}
                            value={editBranchId}
                            onChange={(e) => setEditBranchId(e.target.value)}
                            disabled={isPending}
                            required
                          >
                            <option value="">-- Pilih Cabang --</option>
                            {branches.map(b => (
                              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className={inputStyles.formGroup}>
                          <label className={inputStyles.label}>Cabang Penanggung Jawab</label>
                          <input
                            type="text"
                            className={inputStyles.input}
                            value={`${txToDisplay.branch.name} (${txToDisplay.branch.code})`}
                            disabled
                          />
                        </div>
                      )}

                      {/* Nomor Berita Acara */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editBeritaAcara" className={inputStyles.label}>
                          Nomor Berita Acara (Opsional)
                        </label>
                        <input
                          id="editBeritaAcara"
                          type="text"
                          className={inputStyles.input}
                          placeholder="Contoh: 0001/BA-GA/HO/V/2026"
                          value={editBeritaAcara}
                          onChange={(e) => setEditBeritaAcara(e.target.value)}
                          disabled={isPending}
                        />
                      </div>

                      {/* Date Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editTransactionDate" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Tanggal Transaksi
                        </label>
                        <input
                          id="editTransactionDate"
                          type="date"
                          className={inputStyles.input}
                          value={editTransactionDate}
                          onChange={(e) => setEditTransactionDate(e.target.value)}
                          disabled={isPending}
                          required
                        />
                      </div>

                      {/* Lokasi Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editLocation" className={inputStyles.label}>
                          Lokasi (Opsional)
                        </label>
                        <select
                          id="editLocation"
                          className={inputStyles.input}
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          disabled={isPending}
                        >
                          <option value="">-- Pilih Lokasi --</option>
                          <option value="SITE">Site</option>
                          <option value="MESS">Mess</option>
                          <option value="OFFICE">Office</option>
                        </select>
                      </div>

                      {/* Payment Method Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editPaymentMethod" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Metode Pembayaran
                        </label>
                        <select
                          id="editPaymentMethod"
                          className={inputStyles.input}
                          value={editPaymentMethod}
                          onChange={(e) => setEditPaymentMethod(e.target.value)}
                          disabled={isPending}
                          required
                        >
                          <option value="CASH">Tunai (Cash)</option>
                          <option value="TRANSFER">Transfer Bank</option>
                          <option value="PETTY_CASH">Kas Kecil (Petty Cash)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Edit Section 2: Informasi Pengeluaran */}
                  <div>
                    <h4 className={styles.sectionTitle}>Deskripsi Pengeluaran</h4>
                    <div className={inputStyles.formGrid}>
                      {/* Category Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editCategoryId" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Kategori
                        </label>
                        <select
                          id="editCategoryId"
                          className={inputStyles.input}
                          value={editCategoryId}
                          onChange={(e) => handleEditCategoryChange(e.target.value)}
                          disabled={isPending}
                          required
                        >
                          <option value="">-- Pilih Kategori --</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sub-Category Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editSubCategoryId" className={inputStyles.label}>
                          Sub-Kategori
                        </label>
                        <select
                          id="editSubCategoryId"
                          className={inputStyles.input}
                          value={editSubCategoryId}
                          onChange={(e) => setEditSubCategoryId(e.target.value)}
                          disabled={isPending || !editCategoryId || subCategories.length === 0}
                        >
                          <option value="">
                            {!editCategoryId
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
                      <div className={`${inputStyles.formGroup} ${inputStyles.fullWidth}`}>
                        <label htmlFor="editDescription" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Deskripsi / Kebutuhan
                        </label>
                        <input
                          id="editDescription"
                          type="text"
                          className={inputStyles.input}
                          placeholder="Contoh: Pembelian alat tulis kantor"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={isPending}
                          required
                        />
                      </div>

                      {/* Vendor Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editVendor" className={inputStyles.label}>
                          Vendor / Supplier / Toko
                        </label>
                        <input
                          id="editVendor"
                          type="text"
                          className={inputStyles.input}
                          placeholder="Nama vendor"
                          value={editVendor}
                          onChange={(e) => setEditVendor(e.target.value)}
                          disabled={isPending}
                        />
                      </div>

                      {/* Notes Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editNotes" className={inputStyles.label}>
                          Catatan Tambahan
                        </label>
                        <input
                          id="editNotes"
                          type="text"
                          className={inputStyles.input}
                          placeholder="Catatan tambahan"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Edit Section 3: Dynamic Custom Fields */}
                  {dynamicFields.length > 0 && (
                    <div className={styles.customFieldsBox}>
                      <h4 className={styles.sectionTitle} style={{ borderBottomColor: 'var(--color-primary-light)' }}>
                        Informasi Spesifik ({selectedCategory?.name})
                      </h4>
                      <div className={inputStyles.formGrid}>
                        {dynamicFields.map((field) => {
                          const val = editCustomFields[field.key] ?? '';
                          return (
                            <div key={field.key} className={inputStyles.formGroup}>
                              <label htmlFor={`edit-custom-${field.key}`} className={`${inputStyles.label} ${field.required ? inputStyles.labelRequired : ''}`}>
                                {field.label}
                              </label>

                              {field.type === 'select' ? (
                                <select
                                  id={`edit-custom-${field.key}`}
                                  className={inputStyles.input}
                                  value={val}
                                  onChange={(e) => setEditCustomFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  disabled={isPending}
                                  required={field.required}
                                >
                                  <option value="">-- Pilih {field.label} --</option>
                                  {field.options?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : field.type === 'textarea' ? (
                                <textarea
                                  id={`edit-custom-${field.key}`}
                                  className={`${inputStyles.input} ${inputStyles.textarea}`}
                                  value={val}
                                  onChange={(e) => setEditCustomFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  disabled={isPending}
                                  required={field.required}
                                  placeholder={`Masukkan ${field.label.toLowerCase()}`}
                                />
                              ) : (
                                <input
                                  id={`edit-custom-${field.key}`}
                                  type={field.type}
                                  className={inputStyles.input}
                                  value={val}
                                  onChange={(e) => {
                                    const inputVal = field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value;
                                    setEditCustomFields(prev => ({ ...prev, [field.key]: inputVal }));
                                  }}
                                  disabled={isPending}
                                  required={field.required}
                                  placeholder={`Masukkan ${field.label.toLowerCase()}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Edit Section 4: Ringkasan Biaya */}
                  <div>
                    <h4 className={styles.sectionTitle}>Ringkasan Biaya</h4>
                    <div className={inputStyles.formGrid}>
                      {/* Quantity Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editQuantity" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Jumlah (Kuantitas)
                        </label>
                        <input
                          id="editQuantity"
                          type="number"
                          step="0.01"
                          min="0.01"
                          className={inputStyles.input}
                          value={editQuantity === 0 ? '' : editQuantity}
                          onChange={(e) => setEditQuantity(Number(e.target.value))}
                          disabled={isPending}
                          required
                        />
                      </div>

                      {/* Unit Field */}
                      <div className={inputStyles.formGroup}>
                        <label htmlFor="editUnit" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Satuan Ukur
                        </label>
                        <input
                          id="editUnit"
                          type="text"
                          className={inputStyles.input}
                          placeholder="Pcs, Liter, Rim"
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          disabled={isPending}
                          required
                        />
                      </div>

                      {/* Price Per Unit Field */}
                      <div className={inputStyles.formGroup} style={{ gridColumn: 'span 2' }}>
                        <label htmlFor="editPricePerUnit" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>
                          Harga Satuan (Rupiah)
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            id="editPricePerUnit"
                            type="text"
                            inputMode="numeric"
                            className={inputStyles.input}
                            style={{ paddingLeft: 'var(--space-10)' }}
                            value={editPriceDisplay}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              const rawDigits = valStr.replace(/[^0-9]/g, '');
                              const num = rawDigits ? Number(rawDigits) : 0;
                              setEditPricePerUnit(num);
                              setEditPriceDisplay(rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                            }}
                            disabled={isPending}
                            required
                          />
                          <span style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rp</span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown panel for discount and tax details */}
                    <div style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      marginTop: 'var(--space-4)',
                    }}>
                      <button
                        type="button"
                        onClick={() => setEditBreakdownOpen(o => !o)}
                        disabled={isPending}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-3) var(--space-4)',
                          background: editBreakdownOpen ? 'rgba(59,130,246,0.04)' : 'var(--color-surface)',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          fontWeight: 600,
                          fontSize: 'var(--text-sm)',
                          transition: 'background 200ms',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-primary)' }}>
                          Rincian Harga — Diskon &amp; Pajak (Opsional)
                        </span>
                        {editBreakdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {editBreakdownOpen && (
                        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                          <div className={inputStyles.formGrid}>
                            {/* Discount per unit */}
                            <div className={inputStyles.formGroup}>
                              <label htmlFor="editDiscountPerUnit" className={inputStyles.label}>
                                Diskon per Satuan (Rupiah)
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  id="editDiscountPerUnit"
                                  type="text"
                                  inputMode="numeric"
                                  className={inputStyles.input}
                                  style={{ paddingLeft: 'var(--space-10)' }}
                                  placeholder="0"
                                  value={editDiscountPerUnitDisplay}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const num = raw ? Number(raw) : 0;
                                    setEditDiscountPerUnit(num);
                                    setEditDiscountPerUnitDisplay(raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                  }}
                                  disabled={isPending}
                                />
                                <span style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rp</span>
                              </div>
                            </div>

                            {/* Discount total bill */}
                            <div className={inputStyles.formGroup}>
                              <label htmlFor="editDiscountTotal" className={inputStyles.label}>
                                Diskon Total Tagihan (Rupiah)
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  id="editDiscountTotal"
                                  type="text"
                                  inputMode="numeric"
                                  className={inputStyles.input}
                                  style={{ paddingLeft: 'var(--space-10)' }}
                                  placeholder="0"
                                  value={editDiscountTotalDisplay}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const num = raw ? Number(raw) : 0;
                                    setEditDiscountTotal(num);
                                    setEditDiscountTotalDisplay(raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                  }}
                                  disabled={isPending}
                                />
                                <span style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rp</span>
                              </div>
                            </div>

                            {/* Tax amount */}
                            <div className={inputStyles.formGroup}>
                              <label htmlFor="editTaxAmount" className={inputStyles.label}>
                                Pajak (Rupiah)
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  id="editTaxAmount"
                                  type="text"
                                  inputMode="numeric"
                                  className={inputStyles.input}
                                  style={{ paddingLeft: 'var(--space-10)' }}
                                  placeholder="0"
                                  value={editTaxAmountDisplay}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const num = raw ? Number(raw) : 0;
                                    setEditTaxAmount(num);
                                    setEditTaxAmountDisplay(raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                                  }}
                                  disabled={isPending}
                                />
                                <span style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rp</span>
                              </div>
                            </div>

                            {/* Tax note */}
                            <div className={inputStyles.formGroup}>
                              <label htmlFor="editTaxNote" className={inputStyles.label}>
                                Keterangan Pajak
                              </label>
                              <input
                                id="editTaxNote"
                                type="text"
                                className={inputStyles.input}
                                placeholder="Contoh: PPN 12%"
                                value={editTaxNote}
                                onChange={(e) => setEditTaxNote(e.target.value)}
                                disabled={isPending}
                              />
                            </div>
                          </div>

                          {/* Breakdown calculations */}
                          <div style={{
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-2)',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                              <span>Subtotal ({editQuantity} × {formatRupiah(editPricePerUnit)})</span>
                              <span>{formatRupiah(editQuantity * editPricePerUnit)}</span>
                            </div>
                            {editDiscountPerUnit > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                                <span>Diskon per satuan (×{editQuantity})</span>
                                <span>−{formatRupiah(editDiscountPerUnit * editQuantity)}</span>
                              </div>
                            )}
                            {editDiscountTotal > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                                <span>Diskon total tagihan</span>
                                <span>−{formatRupiah(editDiscountTotal)}</span>
                              </div>
                            )}
                            {editTaxAmount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                                <span>Pajak{editTaxNote ? ` (${editTaxNote})` : ''}</span>
                                <span>+{formatRupiah(editTaxAmount)}</span>
                              </div>
                            )}
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--color-text)', fontSize: 'var(--text-base)' }}>
                              <span>Total</span>
                              <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(editComputedTotal)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Total display card */}
                    <div className={inputStyles.totalCard} style={{ marginTop: 'var(--space-4)' }}>
                      <div className={inputStyles.totalLabelBlock}>
                        <span className={inputStyles.totalLabel}>Estimasi Total Pengeluaran</span>
                      </div>
                      <div className={inputStyles.totalValue} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span>{formatRupiah(editComputedTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Edit Section 5: Bukti Pembayaran */}
                  <div className={styles.receiptContainer} style={{ marginTop: 'var(--space-6)' }}>
                    <h4 className={styles.sectionTitle}>Bukti Kuitansi (Nota Fisik)</h4>
                    {editReceiptPath ? (
                      <div className={styles.receiptFrame} style={{ flexDirection: 'column', padding: 'var(--space-4)', gap: 'var(--space-3)' }}>
                        {editReceiptPath.toLowerCase().endsWith('.pdf') ? (
                          <div className={styles.pdfBox} style={{ padding: 'var(--space-2)' }}>
                            <FileText size={48} className={styles.pdfIcon} />
                            <span className={styles.pdfName}>
                              {editReceiptPath.split('/').pop() || 'kuitansi.pdf'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={editReceiptPath}
                            alt="Preview kuitansi baru"
                            className={styles.receiptImg}
                            style={{ maxHeight: '200px', objectFit: 'contain' }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setEditReceiptPath('')}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', background: 'transparent' }}
                        >
                          <Trash2 size={14} />
                          <span>Hapus &amp; Ganti Kuitansi</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`${styles.uploaderContainer} ${uploading ? styles.uploadDisabled : ''}`}
                        onDragOver={handleDragOver}
                        onDrop={handleFileDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            if (!uploading) fileInputRef.current?.click();
                          }
                        }}
                        style={{ minHeight: '150px' }}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          accept=".png, .jpg, .jpeg, .pdf"
                          onChange={handleFileSelect}
                          disabled={uploading}
                        />

                        {uploading ? (
                          <>
                            <div className={styles.spinner} />
                            <span className={styles.uploaderText}>Mengunggah kuitansi...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud size={36} className={styles.uploaderIcon} />
                            <span className={styles.uploaderText}>
                              Tarik &amp; lepas kuitansi baru di sini, atau <span className={styles.uploaderLink}>Pilih Berkas</span>
                            </span>
                            <span className={styles.uploaderText} style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                              Mendukung PNG, JPG, JPEG, atau PDF (Maks. 5MB)
                            </span>
                          </>
                        )}

                        {uploadError && (
                          <div style={{ marginTop: 'var(--space-2)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                            {uploadError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </form>
          ) : (
            /* ============================================================
               STANDARD DISPLAY VIEW
               ============================================================ */
            <>
              {/* Section 1: Ringkasan Utama */}
              <div>
                <h4 className={styles.sectionTitle}>Ringkasan Biaya</h4>
                <div className={styles.grid}>
                  {/* Conditional breakdown: show if any breakdown field is present */}
                  {(txToDisplay.discountPerUnit || txToDisplay.discountTotal || txToDisplay.taxAmount) ? (
                    <div className={styles.item} style={{ gridColumn: 'span 2' }}>
                      <span className={styles.label}>Rincian Harga</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                          <span>Subtotal ({Number(txToDisplay.quantity)} × {formatRupiah(Number(txToDisplay.pricePerUnit))})</span>
                          <span>{formatRupiah(Number(txToDisplay.quantity) * Number(txToDisplay.pricePerUnit))}</span>
                        </div>
                        {txToDisplay.discountPerUnit && Number(txToDisplay.discountPerUnit) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                            <span>Diskon per satuan (×{Number(txToDisplay.quantity)})</span>
                            <span>−{formatRupiah(Number(txToDisplay.discountPerUnit) * Number(txToDisplay.quantity))}</span>
                          </div>
                        )}
                        {txToDisplay.discountTotal && Number(txToDisplay.discountTotal) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                            <span>Diskon total tagihan</span>
                            <span>−{formatRupiah(Number(txToDisplay.discountTotal))}</span>
                          </div>
                        )}
                        {txToDisplay.taxAmount && Number(txToDisplay.taxAmount) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                            <span>Pajak{txToDisplay.taxNote ? ` (${txToDisplay.taxNote})` : ''}</span>
                            <span>+{formatRupiah(Number(txToDisplay.taxAmount))}</span>
                          </div>
                        )}
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Total</span>
                          <span className={styles.valueHighlight}>{formatRupiah(Number(txToDisplay.totalAmount))}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.item}>
                      <span className={styles.label}>Estimasi Total Pengeluaran</span>
                      <span className={styles.valueHighlight}>
                        {formatRupiah(Number(txToDisplay.totalAmount))}
                      </span>
                    </div>
                  )}
                  <div className={styles.item}>
                    <span className={styles.label}>Detail Kuantitas</span>
                    <span className={styles.value}>
                      {Number(txToDisplay.quantity)} {txToDisplay.unit} &times; {formatRupiah(Number(txToDisplay.pricePerUnit))}
                    </span>
                  </div>
                </div>
              </div>
     
              {/* Section 2: Informasi Administrasi */}
              <div>
                <h4 className={styles.sectionTitle}>Informasi Administrasi</h4>
                <div className={styles.grid}>
                  <div className={styles.item}>
                    <span className={styles.label}>
                      <FileText size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Nomor Berita Acara
                    </span>
                    <span className={styles.value} style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {txToDisplay.beritaAcara || '-'}
                    </span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>
                      <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Tanggal Transaksi
                    </span>
                    <span className={styles.value}>
                      {new Date(txToDisplay.transactionDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Cabang Penanggung Jawab
                    </span>
                    <span className={styles.value}>
                      {txToDisplay.branch.name} ({txToDisplay.branch.code})
                    </span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Lokasi
                    </span>
                    <span className={styles.value}>
                      {txToDisplay.location ? (
                        <span className={`badge ${txToDisplay.location === 'SITE' ? 'badge-info' : txToDisplay.location === 'MESS' ? 'badge-warning' : 'badge-success'}`} style={{ textTransform: 'capitalize' }}>
                          {txToDisplay.location.toLowerCase()}
                        </span>
                      ) : '-'}
                    </span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>
                      <User size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Pencatat (Petugas)
                    </span>
                    <span className={styles.value}>
                      {txToDisplay.user.fullName} (@{txToDisplay.user.username})
                    </span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>
                      <CreditCard size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      Metode Pembayaran
                    </span>
                    <span className={styles.value}>
                      {getPaymentLabel(txToDisplay.paymentMethod)}
                    </span>
                  </div>
                </div>
              </div>
     
              {/* Section 3: Informasi Pengeluaran */}
              <div>
                <h4 className={styles.sectionTitle}>Deskripsi Pengeluaran</h4>
                <div className={styles.grid}>
                  <div className={styles.item}>
                    <span className={styles.label}>Kategori &amp; Sub-Kategori</span>
                    <span className={styles.value}>
                      {txToDisplay.category.name} {txToDisplay.subCategory ? `› ${txToDisplay.subCategory.name}` : ''}
                    </span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>Deskripsi Kebutuhan</span>
                    <span className={styles.value}>{txToDisplay.description}</span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>Vendor / Supplier / Penerima</span>
                    <span className={styles.value}>{txToDisplay.vendor || '-'}</span>
                  </div>
                  <div className={styles.item}>
                    <span className={styles.label}>Catatan Tambahan</span>
                    <span className={styles.value}>{txToDisplay.notes || '-'}</span>
                  </div>
                </div>
              </div>
     
              {/* Section 4: Dynamic Custom Fields (Display only if filled) */}
              {activeCustomFields.length > 0 && (
                <div className={styles.customFieldsBox}>
                  <h4 className={styles.sectionTitle} style={{ borderBottomColor: 'var(--color-primary-light)' }}>
                    Informasi Spesifik ({txToDisplay.category.name})
                  </h4>
                  <div className={styles.grid}>
                    {activeCustomFields.map((field) => {
                      const val = customFieldsData[field.key];
                      return (
                        <div key={field.key} className={styles.item}>
                          <span className={styles.label}>{field.label}</span>
                          <span className={styles.value}>{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
     
              {/* Section 5: Bukti Kuitansi (Nota Fisik) */}
              <div className={styles.receiptContainer}>
                <h4 className={styles.sectionTitle}>Bukti Kuitansi (Nota Fisik)</h4>
                {localReceiptPath ? (
                  <div className={styles.receiptFrame}>
                    {localReceiptPath.toLowerCase().endsWith('.pdf') ? (
                      <div className={styles.pdfBox}>
                        <FileText size={48} className={styles.pdfIcon} />
                        <span className={styles.pdfName}>
                          {localReceiptPath.split('/').pop() || 'kuitansi.pdf'}
                        </span>
                        <a
                          href={localReceiptPath || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.pdfDownloadBtn}
                        >
                          <span>Buka &amp; Unduh PDF</span>
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    ) : (
                      <img
                        src={localReceiptPath || undefined}
                        alt="Bukti pembayaran kuitansi"
                        className={styles.receiptImg}
                        onClick={() => window.open(localReceiptPath || undefined, '_blank')}
                        title="Klik untuk memperbesar gambar bukti pembayaran"
                      />
                    )}
                  </div>
                ) : currentUserRole === 'VIEWER' ? (
                  <div className={styles.noReceiptAlert}>
                    <AlertCircle size={18} />
                    <span>Tidak ada foto bukti kuitansi yang diunggah untuk transaksi ini.</span>
                  </div>
                ) : (
                  <div
                    className={`${styles.uploaderContainer} ${uploading ? styles.uploadDisabled : ''}`}
                    onDragOver={handleDragOver}
                    onDrop={handleFileDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (!uploading) fileInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".png, .jpg, .jpeg, .pdf"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />

                    {uploading ? (
                      <>
                        <div className={styles.spinner} />
                        <span className={styles.uploaderText}>Mengunggah kuitansi...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={36} className={styles.uploaderIcon} />
                        <span className={styles.uploaderText}>
                          Tarik &amp; lepas kuitansi di sini, atau <span className={styles.uploaderLink}>Pilih Berkas</span>
                        </span>
                        <span className={styles.uploaderText} style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                          Mendukung PNG, JPG, JPEG, atau PDF (Maks. 5MB)
                        </span>
                      </>
                    )}

                    {uploadError && (
                      <div style={{ marginTop: 'var(--space-2)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        {uploadError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <footer className={styles.footer}>
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: 'var(--text-sm)' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isPending && <Loader2 size={16} className={styles.spinnerIcon} style={{ animation: 'spin 1s linear infinite' }} />}
                <span>Simpan Perubahan</span>
              </button>
            </>
          ) : (
            <>
              {deleteError && (
                <span className={styles.errorMessage}>
                  <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {deleteError}
                </span>
              )}
              
              {currentUserRole !== 'VIEWER' && (
                <button
                  onClick={startEditing}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: 'var(--text-sm)' }}
                  title="Ubah rincian transaksi ini"
                >
                  Edit Transaksi
                </button>
              )}
              
              {currentUserRole === 'SUPERADMIN' && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={styles.deleteBtn}
                  title="Hapus transaksi ini secara permanen dari database"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Hapus Transaksi</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

