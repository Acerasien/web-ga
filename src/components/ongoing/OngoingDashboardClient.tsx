'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  Clock, 
  PlusCircle, 
  FileText,
  CheckCircle2, 
  Building2, 
  Tag, 
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import type { AuthUser } from '@/types';
import type { Category, Branch } from '@prisma/client';
import { 
  getOngoingPayments, 
  updateOngoingStatusToPaid, 
  OngoingPaymentWithRelations 
} from '@/lib/actions/ongoing';
import { getTransactionById, TransactionWithRelations } from '@/lib/actions/transactions';
import OngoingRequestModal from '@/components/modals/OngoingRequestModal';
import OngoingRealizeModal from '@/components/modals/OngoingRealizeModal';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import styles from '@/app/(dashboard)/transaksi/ongoing/page.module.css';

interface OngoingDashboardClientProps {
  user: AuthUser;
  categories: Category[];
  branches: Branch[];
}

export default function OngoingDashboardClient({
  user,
  categories,
  branches,
}: OngoingDashboardClientProps) {
  const [isPending, startTransition] = useTransition();

  // Tab & Filters State
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Paginated data state
  const [payments, setPayments] = useState<OngoingPaymentWithRelations[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 9;

  // Modals state
  const [isRequestOpen, setIsRequestOpen] = useState<boolean>(false);
  
  const [isRealizeOpen, setIsRealizeOpen] = useState<boolean>(false);
  const [realizeData, setRealizeData] = useState<{
    id: number;
    amount: number;
    description: string;
  } | null>(null);

  // Transaction Detail Modal state
  const [selectedTx, setSelectedTx] = useState<TransactionWithRelations | null>(null);
  const [isTxDetailOpen, setIsTxDetailOpen] = useState<boolean>(false);
  const [txLoadingId, setTxLoadingId] = useState<number | null>(null);

  // Confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [payTargetId, setPayTargetId] = useState<number | null>(null);

  // Fetch payments based on filters and tab
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === 'active' ? 'ACTIVE' : 'TER_REALISASI';
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
  }, [activeTab, selectedBranchId, selectedCategoryId, currentPage]);

  // Trigger fetch when parameters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  // Handle Tab Switch (reset page to 1)
  const handleTabChange = (tab: 'active' | 'history') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

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
    });
    setIsRealizeOpen(true);
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
          <button onClick={() => setIsRequestOpen(true)} className={styles.newRequestBtn}>
            <PlusCircle size={18} />
            <span>Buat Request</span>
          </button>
        )}
      </header>

      {/* Tabs Row */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => handleTabChange('active')}
          className={`${styles.tabButton} ${activeTab === 'active' ? styles.tabButtonActive : ''}`}
        >
          <Clock size={16} />
          <span>Active Request</span>
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`${styles.tabButton} ${activeTab === 'history' ? styles.tabButtonActive : ''}`}
        >
          <CheckCircle2 size={16} />
          <span>Riwayat Realisasi</span>
        </button>
      </div>

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
          {user.role !== 'VIEWER' && activeTab === 'active' && (
            <button onClick={() => setIsRequestOpen(true)} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Buat Permintaan Pertama</span>
            </button>
          )}
        </div>
      ) : activeTab === 'active' ? (
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

                  <div className={styles.costSection}>
                    <span className={styles.costLabel}>Estimasi Kebutuhan</span>
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

                    {isUnpaid ? (
                      <button
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
      ) : (
        /* History Table View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Tanggal</th>
                  <th className={styles.th}>Cabang</th>
                  <th className={styles.th}>Kategori</th>
                  <th className={styles.th}>Deskripsi</th>
                  <th className={styles.th} style={{ textAlign: 'right' }}>Estimasi</th>
                  <th className={styles.th} style={{ textAlign: 'right' }}>Realisasi</th>
                  <th className={styles.th} style={{ textAlign: 'right' }}>Selisih (Variance)</th>
                  <th className={styles.th} style={{ textAlign: 'center' }}>BA Acara</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const est = p.amountNeeded;
                  const act = p.actualAmount || 0;
                  const variance = est - act;

                  return (
                    <tr key={p.id} className={styles.tr}>
                      <td className={styles.td} style={{ whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                        {new Date(p.requestDate || p.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={styles.td} style={{ fontWeight: 700 }}>
                        {p.branch.code}
                      </td>
                      <td className={styles.td}>
                        {p.category.name}
                      </td>
                      <td className={styles.td} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.description}>
                        {p.description}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatRupiah(est)}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {formatRupiah(act)}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        {variance > 0 ? (
                          <span className={styles.varianceSurplus} title="Sisa dana dikembalikan ke kas">
                            +{formatRupiah(variance)} (Sisa)
                          </span>
                        ) : variance < 0 ? (
                          <span className={styles.varianceShortage} title="Kekurangan dana ditambahkan">
                            -{formatRupiah(Math.abs(variance))} (Kurang)
                          </span>
                        ) : (
                          <span className={styles.varianceEqual}>
                            Pas
                          </span>
                        )}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                        {p.transactionId && p.transaction?.beritaAcara ? (
                          <button
                            onClick={() => handleTxClick(p.transactionId!)}
                            disabled={txLoadingId === p.transactionId}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Klik untuk melihat detail Berita Acara Transaksi"
                          >
                            {txLoadingId === p.transactionId ? (
                              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <FileText size={12} style={{ color: 'var(--color-primary)' }} />
                            )}
                            <span>{p.transaction.beritaAcara.split('/')[0]}</span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* History Pagination */}
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

      {/* New Request Modal */}
      <OngoingRequestModal
        isOpen={isRequestOpen}
        onClose={() => setIsRequestOpen(false)}
        onSubmitSuccess={() => {
          setIsRequestOpen(false);
          fetchPayments();
        }}
        user={user}
        categories={categories}
        branches={branches}
      />

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
    </div>
  );
}
