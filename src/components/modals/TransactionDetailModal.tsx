'use client';

import { useState } from 'react';
import { X, FileText, AlertCircle, Calendar, User, MapPin, CreditCard, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import { deleteTransaction } from '@/lib/actions/transactions';
import type { FieldsConfig, CategoryField } from '@/types';
import styles from './modal.module.css';

interface TransactionDetailModalProps {
  transaction: TransactionWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  onDeleteSuccess?: () => void;
}

export default function TransactionDetailModal({ 
  transaction, 
  isOpen, 
  onClose,
  currentUserRole,
  onDeleteSuccess
}: TransactionDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;


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
  const customFieldsData = transaction.customFields
    ? (transaction.customFields as unknown as Record<string, string | number>)
    : {};

  const fieldsConfig = transaction.category.fieldsConfig
    ? (transaction.category.fieldsConfig as unknown as FieldsConfig)
    : null;
  const dynamicFields: CategoryField[] = fieldsConfig?.fields || [];

  // Filter filled custom fields to display in a clean grid
  const activeCustomFields = dynamicFields.filter(
    field => customFieldsData[field.key] !== undefined && customFieldsData[field.key] !== ''
  );

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      'Apakah Anda yakin ingin menghapus transaksi ini secara PERMANEN?\n\nTindakan ini akan menghapus catatan pengeluaran dari database selamanya dan tidak dapat dibatalkan.'
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await deleteTransaction(transaction.id);
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
          <h3 id="modal-title">Rincian Transaksi</h3>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Tutup Detail Transaksi">
            <X size={20} />
          </button>
        </header>
 
        {/* Modal Body */}
        <div className={styles.body}>
          {/* Section 1: Ringkasan Utama */}
          <div>
            <h4 className={styles.sectionTitle}>Ringkasan Biaya</h4>
            <div className={styles.grid}>
              <div className={styles.item}>
                <span className={styles.label}>Estimasi Total Pengeluaran</span>
                <span className={styles.valueHighlight}>
                  {formatRupiah(Number(transaction.totalAmount))}
                </span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>Detail Kuantitas</span>
                <span className={styles.value}>
                  {Number(transaction.quantity)} {transaction.unit} &times; {formatRupiah(Number(transaction.pricePerUnit))}
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
                  {transaction.beritaAcara || '-'}
                </span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>
                  <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Tanggal Transaksi
                </span>
                <span className={styles.value}>
                  {new Date(transaction.transactionDate).toLocaleDateString('id-ID', {
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
                  {transaction.branch.name} ({transaction.branch.code})
                </span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>
                  <User size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Pencatat (Petugas)
                </span>
                <span className={styles.value}>
                  {transaction.user.fullName} (@{transaction.user.username})
                </span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>
                  <CreditCard size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Metode Pembayaran
                </span>
                <span className={styles.value}>
                  {getPaymentLabel(transaction.paymentMethod)}
                </span>
              </div>
            </div>
          </div>
 
          {/* Section 3: Informasi Pengeluaran */}
          <div>
            <h4 className={styles.sectionTitle}>Deskripsi Pengeluaran</h4>
            <div className={styles.grid}>
              <div className={styles.item}>
                <span className={styles.label}>Kategori & Sub-Kategori</span>
                <span className={styles.value}>
                  {transaction.category.name} {transaction.subCategory ? `› ${transaction.subCategory.name}` : ''}
                </span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>Deskripsi Kebutuhan</span>
                <span className={styles.value}>{transaction.description}</span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>Vendor / Supplier / Penerima</span>
                <span className={styles.value}>{transaction.vendor || '-'}</span>
              </div>
              <div className={styles.item}>
                <span className={styles.label}>Catatan Tambahan</span>
                <span className={styles.value}>{transaction.notes || '-'}</span>
              </div>
            </div>
          </div>
 
          {/* Section 4: Dynamic Custom Fields (Display only if filled) */}
          {activeCustomFields.length > 0 && (
            <div className={styles.customFieldsBox}>
              <h4 className={styles.sectionTitle} style={{ borderBottomColor: 'var(--color-primary-light)' }}>
                Informasi Spesifik ({transaction.category.name})
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
 
          {/* Section 5: Bukti Kuitansi (Nota) */}
          <div className={styles.receiptContainer}>
            <h4 className={styles.sectionTitle}>Bukti Kuitansi (Nota Fisik)</h4>
            {transaction.receiptPath ? (
              <div className={styles.receiptFrame}>
                {transaction.receiptPath.toLowerCase().endsWith('.pdf') ? (
                  // PDF Preview (Fallback Action to satisfy Android/iOS volatility constraints)
                  <div className={styles.pdfBox}>
                    <FileText size={48} className={styles.pdfIcon} />
                    <span className={styles.pdfName}>
                      {transaction.receiptPath.split('/').pop() || 'kuitansi.pdf'}
                    </span>
                    <a
                      href={transaction.receiptPath || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.pdfDownloadBtn}
                    >
                      <span>Buka & Unduh PDF</span>
                      <ExternalLink size={16} />
                    </a>
                  </div>
                ) : (
                  // Image Preview slot with browser Zoom support
                  <img
                    src={transaction.receiptPath || undefined}
                    alt="Bukti pembayaran kuitansi"
                    className={styles.receiptImg}
                    onClick={() => window.open(transaction.receiptPath || undefined, '_blank')}
                    title="Klik untuk memperbesar gambar bukti pembayaran"
                  />
                )}
              </div>
            ) : (
              // Soft warn alert banner
              <div className={styles.noReceiptAlert}>
                <AlertCircle size={18} />
                <span>Tidak ada foto bukti kuitansi yang diunggah untuk transaksi ini.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer (Action Footer for all users) */}
        <footer className={styles.footer}>
          {deleteError && (
            <span className={styles.errorMessage}>
              <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {deleteError}
            </span>
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
        </footer>
      </div>
    </div>
  );
}
