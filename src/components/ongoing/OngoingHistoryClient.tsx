'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import type { AuthUser } from '@/types';
import type { Category, Branch } from '@prisma/client';
import { 
  getOngoingPayments, 
  OngoingPaymentWithRelations 
} from '@/lib/actions/ongoing';
import { getTransactionById, TransactionWithRelations } from '@/lib/actions/transactions';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';
import styles from '@/app/(dashboard)/ongoing/list/page.module.css';

interface OngoingHistoryClientProps {
  user: AuthUser;
  categories: Category[];
  branches: Branch[];
}

export default function OngoingHistoryClient({
  user,
  categories,
  branches,
}: OngoingHistoryClientProps) {
  // Filters State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Paginated data state
  const [payments, setPayments] = useState<OngoingPaymentWithRelations[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 10;

  // Transaction Detail Modal state
  const [selectedTx, setSelectedTx] = useState<TransactionWithRelations | null>(null);
  const [isTxDetailOpen, setIsTxDetailOpen] = useState<boolean>(false);
  const [txLoadingId, setTxLoadingId] = useState<number | null>(null);

  // Fetch payments based on filters
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const branchFilter = selectedBranchId ? Number(selectedBranchId) : undefined;
      const categoryFilter = selectedCategoryId ? Number(selectedCategoryId) : undefined;

      const res = await getOngoingPayments({
        status: 'TER_REALISASI',
        branchId: branchFilter,
        categoryId: categoryFilter,
        page: currentPage,
        limit: limit,
      });

      if (res.success && res.data) {
        setPayments(res.data.payments);
        setTotalPages(res.data.totalPages);
      } else {
        console.error(res.error || 'Gagal mengambil data riwayat ongoing payment.');
      }
    } catch (error) {
      console.error('Error fetching ongoing history:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedCategoryId, currentPage]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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
          <h2>Riwayat Pembayaran Berjalan</h2>
          <p>
            Daftar pembayaran berjalan (panjar) yang telah terealisasi dan tercatat sebagai pengeluaran akhir.
          </p>
        </div>
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
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Memuat data riwayat...</span>
        </div>
      ) : payments.length === 0 ? (
        <div className={styles.emptyState}>
          <CheckCircle2 size={40} style={{ color: 'var(--color-text-light)', opacity: 0.7 }} />
          <div>
            <h4>Tidak Ada Riwayat</h4>
            <p>
              Belum ada data pembayaran berjalan yang telah direalisasikan.
            </p>
          </div>
        </div>
      ) : (
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
                  <th className={styles.th} style={{ textAlign: 'center' }}>Nota Awal</th>
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
                        <div style={{ fontSize: '10px', marginTop: '2px', fontWeight: 600 }}>
                          {variance > 0 ? (
                            <span style={{ color: 'var(--color-success)' }}>Sisa: +{formatRupiah(variance)}</span>
                          ) : variance < 0 ? (
                            <span style={{ color: 'var(--color-danger)' }}>Kurang: -{formatRupiah(Math.abs(variance))}</span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>Pas</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                        {p.initialReceiptPath ? (
                          <a
                            href={p.initialReceiptPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Lihat Nota Awal / Invoice Penawaran"
                          >
                            <FileText size={12} style={{ color: 'var(--color-text-muted)' }} />
                            <span>Nota</span>
                          </a>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>-</span>
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

          {/* Pagination */}
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
