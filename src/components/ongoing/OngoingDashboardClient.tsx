'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  Clock, 
  PlusCircle, 
  FileText,
  Building2, 
  Tag, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Edit2,
  Trash2
} from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import type { AuthUser } from '@/types';
import type { Branch } from '@prisma/client';
import type { CategoryWithSub } from '@/lib/actions/categories';
import { 
  getOngoingPayments, 
  updateOngoingStatusToPaid, 
  deleteOngoingPayment,
  OngoingPaymentWithRelations 
} from '@/lib/actions/ongoing';
import { getTransactionById, TransactionWithRelations } from '@/lib/actions/transactions';
import Link from 'next/link';
import OngoingRealizeModal from '@/components/modals/OngoingRealizeModal';
import OngoingEditModal from '@/components/modals/OngoingEditModal';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import styles from '@/app/(dashboard)/ongoing/list/page.module.css';

interface OngoingDashboardClientProps {
  user: AuthUser;
  categories: CategoryWithSub[];
  branches: Branch[];
}

export default function OngoingDashboardClient({
  user,
  categories,
  branches,
}: OngoingDashboardClientProps) {
  const [isPending, startTransition] = useTransition();

  // Filters State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Paginated data state
  const [payments, setPayments] = useState<OngoingPaymentWithRelations[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 9;


  const [isRealizeOpen, setIsRealizeOpen] = useState<boolean>(false);
  const [realizeData, setRealizeData] = useState<{
    id: number;
    amount: number;
    description: string;
    vendor?: string;
    quantity?: number | null;
    unit?: string | null;
  } | null>(null);

  // Transaction Detail Modal state
  const [selectedTx, setSelectedTx] = useState<TransactionWithRelations | null>(null);
  const [isTxDetailOpen, setIsTxDetailOpen] = useState<boolean>(false);
  const [txLoadingId, setTxLoadingId] = useState<number | null>(null);

  // Confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [payTargetId, setPayTargetId] = useState<number | null>(null);

  // Edit modal states
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editTargetPayment, setEditTargetPayment] = useState<OngoingPaymentWithRelations | null>(null);

  // Delete modal states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Fetch payments based on filters and tab
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = 'ACTIVE';
      const branchFilter = selectedBranchId ? Number(selectedBranchId) : undefined;
      const categoryFilter = selectedCategoryId ? Number(selectedCategoryId) : undefined;

      const res = await getOngoingPayments({
        status: statusFilter,
        branchId: branchFilter,
        categoryId: categoryFilter,
        page: currentPage,
        limit: limit,
      });

      if (res.success && res.data) {
        setPayments(res.data.payments);
        setTotalPages(res.data.totalPages);
      } else {
        console.error(res.error || 'Gagal mengambil data ongoing payment.');
      }
    } catch (error) {
      console.error('Error fetching ongoing payments:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedCategoryId, currentPage]);

  // Trigger fetch when parameters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  // Open Confirmation Modal
  const handlePayClick = (id: number) => {
    setPayTargetId(id);
    setIsConfirmOpen(true);
  };

  // Perform Status Update to Paid upon confirmation
  const handleConfirmPay = () => {
    if (payTargetId === null) return;

    startTransition(async () => {
      try {
        const res = await updateOngoingStatusToPaid(payTargetId);
        if (res.success) {
          fetchPayments();
        } else {
          alert(res.error || 'Gagal memperbarui status pembayaran.');
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan koneksi saat memperbarui status.');
      } finally {
        setIsConfirmOpen(false);
        setPayTargetId(null);
      }
    });
  };

  // Open Realization Modal
  const handleRealizeClick = (payment: OngoingPaymentWithRelations) => {
    setRealizeData({
      id: payment.id,
      amount: payment.amountNeeded,
      description: payment.description,
      vendor: payment.vendor || undefined,
      quantity: payment.quantity,
      unit: payment.unit,
    });
    setIsRealizeOpen(true);
  };

  // Trigger Edit Modal
  const handleEditClick = (payment: OngoingPaymentWithRelations) => {
    setEditTargetPayment(payment);
    setIsEditOpen(true);
  };

  // Open Delete Confirmation Modal
  const handleDeleteClick = (id: number) => {
    setDeleteTargetId(id);
    setIsDeleteConfirmOpen(true);
  };

  // Perform delete upon confirmation
  const handleConfirmDelete = () => {
    if (deleteTargetId === null) return;

    startTransition(async () => {
      try {
        const res = await deleteOngoingPayment(deleteTargetId);
        if (res.success) {
          fetchPayments();
        } else {
          alert(res.error || 'Gagal menghapus request pembayaran.');
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan koneksi saat menghapus request pembayaran.');
      } finally {
        setIsDeleteConfirmOpen(false);
        setDeleteTargetId(null);
      }
    });
  };

  // Open Transaction Detail Modal
  const handleTxClick = async (txId: number) => {
    setTxLoadingId(txId);
    try {
      const res = await getTransactionById(txId);
      if (res.success && res.data) {
        setSelectedTx(res.data);
        setIsTxDetailOpen(true);
      } else {
        alert(res.error || 'Gagal memuat rincian transaksi.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi saat memuat detail transaksi.');
    } finally {
      setTxLoadingId(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Area */}
      <header className={styles.headerBlock}>
        <div className={styles.titleArea}>
          <h2>Pembayaran Berjalan (Ongoing)</h2>
          <p>
            Kelola panjar belanja, pembayaran termin, dan pelacakan realisasi kas dengan kontrol sequential terintegrasi.
          </p>
        </div>
        {user.role !== 'VIEWER' && (
          <Link href="/ongoing/input" className={styles.newRequestBtn}>
            <PlusCircle size={18} />
            <span>Buat Request</span>
          </Link>
        )}
      </header>


      {/* Filters Row */}
      <div className={styles.filtersBar}>
        {user.role === 'SUPERADMIN' && (
          <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="">Semua Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={selectedCategoryId}
          onChange={(e) => {
            setSelectedCategoryId(e.target.value);
            setCurrentPage(1);
          }}
          className={styles.filterSelect}
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state spinner */}
      {loading ? (
        <div className={styles.loaderContainer}>
          <Loader2 size={36} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Memuat data pembayaran berjalan...</span>
        </div>
      ) : payments.length === 0 ? (
        <div className={styles.emptyState}>
          <Clock size={40} style={{ color: 'var(--color-text-light)', opacity: 0.7 }} />
          <div>
            <h4>Tidak Ada Pembayaran</h4>
            <p>
              Belum ada data pembayaran berjalan yang tercatat untuk kriteria filter yang Anda pilih.
            </p>
          </div>
          {user.role !== 'VIEWER' && (
            <Link href="/ongoing/input" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Buat Permintaan Pertama</span>
            </Link>
          )}
        </div>
      ) : (
        /* Active Cards View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className={styles.grid}>
            {payments.map((p) => {
              const isUnpaid = p.status === 'BELUM_DIBAYAR';
              const isPaid = p.status === 'SUDAH_DIBAYAR';

              return (
                <div key={p.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.categoryBadge}>
                      <Tag size={12} />
                      {p.category.name}
                    </span>
                    <span
                      className={`${styles.statusBadge} ${
                        isUnpaid ? styles.statusUnpaid : styles.statusPaid
                      }`}
                    >
                      {isUnpaid ? 'Belum Dibayar' : 'Sudah Dibayar'}
                    </span>
                  </div>

                  <p className={styles.description} title={p.description}>
                    {p.description}
                  </p>

                  {p.vendor && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '-8px', marginBottom: '8px', fontWeight: 600 }}>
                      Vendor: <span style={{ color: 'var(--color-text)' }}>{p.vendor}</span>
                    </div>
                  )}

                  <div className={styles.costSection}>
                    <div>
                      <span className={styles.costLabel}>Estimasi Kebutuhan</span>
                      {p.quantity !== null && p.quantity !== undefined ? (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', fontWeight: 600 }}>
                          Kuantitas: {p.quantity} {p.unit || 'Pcs'}
                        </div>
                      ) : null}
                    </div>
                    <span className={styles.costValue}>{formatRupiah(p.amountNeeded)}</span>
                  </div>

                  <div className={styles.metaRow}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={12} />
                      <span className={styles.branchTag}>{p.branch.code}</span>
                    </span>
                    <span>
                      {new Date(p.requestDate || p.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>

                  <div className={styles.cardActions}>
                    {p.initialReceiptPath && (
                      <a
                        href={p.initialReceiptPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.attachmentLink}
                        title="Lihat Invoice / Lampiran Penawaran Awal"
                      >
                        <FileText size={18} />
                      </a>
                    )}

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleEditClick(p)}
                      className={styles.attachmentLink}
                      style={{ cursor: 'pointer' }}
                      title="Ubah Request Pembayaran"
                    >
                      <Edit2 size={18} style={{ color: 'var(--color-primary)' }} />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(p.id)}
                      className={styles.attachmentLink}
                      style={{ cursor: 'pointer' }}
                      title="Hapus Request Pembayaran"
                    >
                      <Trash2 size={18} style={{ color: 'var(--color-danger)' }} />
                    </button>

                    {isUnpaid ? (
                      <button
                        type="button"
                        onClick={() => handlePayClick(p.id)}
                        disabled={isPending}
                        className={`${styles.actionBtn} ${styles.btnPay}`}
                      >
                        {isPending ? (
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : null}
                        <span>Bayar Dana</span>
                      </button>
                    ) : isPaid ? (
                      <button
                        type="button"
                        onClick={() => handleRealizeClick(p)}
                        className={`${styles.actionBtn} ${styles.btnRealize}`}
                      >
                        <span>Realisasi</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Tab Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: 'var(--space-4)' }}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Berikutnya</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}


      {/* Realize Modal */}
      {realizeData && (
        <OngoingRealizeModal
          isOpen={isRealizeOpen}
          onClose={() => {
            setIsRealizeOpen(false);
            setRealizeData(null);
          }}
          onRealizeSuccess={() => {
            setIsRealizeOpen(false);
            setRealizeData(null);
            fetchPayments();
          }}
          paymentId={realizeData.id}
          estimatedAmount={realizeData.amount}
          description={realizeData.description}
          defaultVendor={realizeData.vendor}
          quantity={realizeData.quantity ?? undefined}
          unit={realizeData.unit ?? undefined}
        />
      )}

      {/* Confirm Pay Modal */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setPayTargetId(null);
        }}
        onConfirm={handleConfirmPay}
        title="Konfirmasi Pembayaran"
        message="Apakah Anda yakin ingin memperbarui status pengeluaran berjalan ini menjadi 'Sudah Dibayar'? Aksi ini menandakan bahwa dana panjar telah diserahkan dari kas."
        confirmText="Ya, Bayar"
        cancelText="Batal"
        isPending={isPending}
      />

      {/* Transaction Detail Overlay */}
      <TransactionDetailModal
        isOpen={isTxDetailOpen}
        transaction={selectedTx}
        currentUserRole={user.role}
        onClose={() => {
          setIsTxDetailOpen(false);
          setSelectedTx(null);
        }}
      />

      {/* Edit Modal */}
      {isEditOpen && editTargetPayment && (
        <OngoingEditModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setEditTargetPayment(null);
          }}
          onUpdateSuccess={() => {
            fetchPayments();
          }}
          user={user}
          categories={categories}
          branches={branches}
          payment={editTargetPayment}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeleteTargetId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Request Pembayaran"
        message="Apakah Anda yakin ingin menghapus request pembayaran berjalan ini secara permanen? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        isPending={isPending}
      />
    </div>
  );
}
