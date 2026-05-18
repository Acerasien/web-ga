'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar as CalendarIcon, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Plus, 
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { getTransactions } from '@/lib/actions/transactions';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import type { CategoryWithSub } from '@/lib/actions/categories';
import type { Branch, PaymentMethod } from '@prisma/client';
import type { AuthUser } from '@/types';
import { formatRupiah } from '@/lib/formatters';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';
import styles from '@/app/(dashboard)/transaksi/riwayat/history.module.css';

interface HistoryContainerProps {
  user: AuthUser;
  categories: CategoryWithSub[];
  branches: Branch[];
}

export default function HistoryContainer({ user, categories, branches }: HistoryContainerProps) {
  // Filter States
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Queries States
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // 1. Debounce Search queries to prevent typing lags (Poka-Yoke)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 upon typing new search query
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Reset page pagination index when other filters change
  const handleFilterChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  // 2. Query transactions from Server Action on dependencies trigger
  useEffect(() => {
    const loadTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getTransactions({
          search: debouncedSearch,
          branchId: branchId ? Number(branchId) : undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          paymentMethod: (paymentMethod || undefined) as PaymentMethod | undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit: 10, // Locked pagination size from feedback recommendation
        });

        if (result.success && result.data) {
          setTransactions(result.data.transactions);
          setTotalCount(result.data.totalCount);
          setTotalPages(result.data.totalPages);
        } else {
          setError(result.error || 'Gagal memuat riwayat pengeluaran.');
        }
      } catch (err) {
        console.error('Fetch transactions client error:', err);
        setError('Koneksi terputus. Gagal menghubungi server.');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [debouncedSearch, branchId, categoryId, paymentMethod, startDate, endDate, page, refreshTrigger]);

  // Reset all filters in one click
  const handleResetFilters = () => {
    setSearch('');
    setBranchId('');
    setCategoryId('');
    setPaymentMethod('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Click row handlers
  const handleRowClick = (tx: TransactionWithRelations) => {
    setSelectedTransaction(tx);
    setModalOpen(true);
  };

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case 'CASH':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>Tunai</span>;
      case 'TRANSFER':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>Transfer</span>;
      case 'PETTY_CASH':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-accent)' }}>Kas Kecil</span>;
      default:
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#E2E8F0', color: '#64748B' }}>{method}</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Block */}
      <header className={styles.headerRow} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2>Riwayat Transaksi</h2>
          <p className="text-muted" style={{ margin: 0 }}>Melihat dan memfilter rekaman aktivitas pengeluaran General Affairs.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <Link href="/transaksi/input" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Plus size={18} />
            <span>Catat Baru</span>
          </Link>
        )}
      </header>

      {/* Filter Card */}
      <section className={styles.filterCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
          <Filter size={16} />
          <span>Panel Penyaringan</span>
        </div>

        <div className={styles.filterGrid}>
          {/* SUPERADMIN Only: Branch Dropdown */}
          {user.role === 'SUPERADMIN' ? (
            <div className={styles.filterGroup}>
              <label htmlFor="branch-filter" className={styles.label}>Cabang</label>
              <select
                id="branch-filter"
                className={styles.input}
                value={branchId}
                onChange={(e) => handleFilterChange(setBranchId, e.target.value)}
              >
                <option value="">Semua Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            // Non-Superadmin: Lock display layout to clarify context
            <div className={styles.filterGroup}>
              <label className={styles.label}>Cabang Terkunci</label>
              <input
                type="text"
                className={styles.input}
                value={user.branchId ? branches.find(b => b.id === user.branchId)?.name || 'Cabang Terdaftar' : '-'}
                disabled
              />
            </div>
          )}

          {/* Category Dropdown */}
          <div className={styles.filterGroup}>
            <label htmlFor="category-filter" className={styles.label}>Kategori</label>
            <select
              id="category-filter"
              className={styles.input}
              value={categoryId}
              onChange={(e) => handleFilterChange(setCategoryId, e.target.value)}
            >
              <option value="">Semua Kategori</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Method Dropdown */}
          <div className={styles.filterGroup}>
            <label htmlFor="payment-filter" className={styles.label}>Pembayaran</label>
            <select
              id="payment-filter"
              className={styles.input}
              value={paymentMethod}
              onChange={(e) => handleFilterChange(setPaymentMethod, e.target.value)}
            >
              <option value="">Semua Metode</option>
              <option value="CASH">Tunai (Cash)</option>
              <option value="TRANSFER">Transfer Bank</option>
              <option value="PETTY_CASH">Kas Kecil (Petty Cash)</option>
            </select>
          </div>

          {/* Start Date */}
          <div className={styles.filterGroup}>
            <label htmlFor="start-date-filter" className={styles.label}>Mulai Tanggal</label>
            <input
              id="start-date-filter"
              type="date"
              className={styles.input}
              value={startDate}
              onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className={styles.filterGroup}>
            <label htmlFor="end-date-filter" className={styles.label}>Hingga Tanggal</label>
            <input
              id="end-date-filter"
              type="date"
              className={styles.input}
              value={endDate}
              onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
            />
          </div>
        </div>

        {/* Bottom Search & Action bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-4)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className={styles.input}
              placeholder="Cari deskripsi kebutuhan, vendor toko, catatan tambahan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 'var(--space-10)' }}
            />
            <Search size={16} style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          </div>
          <button 
            type="button" 
            onClick={handleResetFilters} 
            className="btn btn-secondary"
            style={{ height: '38px', minWidth: '100px' }}
          >
            Reset Filter
          </button>
        </div>
      </section>

      {/* Main Table Card */}
      <section className={styles.tableCard}>
        {error && (
          <div style={{ padding: 'var(--space-6)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <XCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingCover}>
            <div className={styles.spinner} />
          </div>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <FileSpreadsheet size={48} style={{ margin: '0 auto var(--space-4)', color: 'var(--color-text-muted)', opacity: 0.5 }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>Tidak Ada Data Ditemukan</h3>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              Tidak ada riwayat pengeluaran yang cocok dengan kriteria filter Anda saat ini.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Tanggal</th>
                    {user.role === 'SUPERADMIN' && <th className={styles.th}>Cabang</th>}
                    <th className={styles.th}>Kategori</th>
                    <th className={styles.th}>Deskripsi / Kebutuhan</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Jumlah</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Total Biaya</th>
                    <th className={styles.th} style={{ textAlign: 'center' }}>Pembayaran</th>
                    <th className={styles.th} style={{ textAlign: 'center' }}>Bukti</th>
                    <th className={styles.th} style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      className={styles.tr} 
                      onClick={() => handleRowClick(tx)}
                      title="Klik untuk melihat detail lengkap transaksi ini"
                    >
                      <td className={styles.td}>
                        {new Date(tx.transactionDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      {user.role === 'SUPERADMIN' && (
                        <td className={`${styles.td} ${styles.tdBold}`}>{tx.branch.code}</td>
                      )}
                      <td className={styles.td}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className={styles.tdBold}>{tx.category.name}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            {tx.subCategory?.name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className={styles.td} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {Number(tx.quantity)} {tx.unit}
                      </td>
                      <td className={`${styles.td} ${styles.tdBold}`} style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-primary)' }}>
                        {formatRupiah(Number(tx.totalAmount))}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                        {getPaymentBadge(tx.paymentMethod)}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                        {tx.receiptPath ? (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>Ada</span>
                        ) : (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>Tidak</span>
                        )}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleRowClick(tx)}
                          style={{ padding: 'var(--space-1.5) var(--space-3)', fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={12} />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className={styles.paginationRow}>
              <div className={styles.paginationInfo}>
                Menampilkan <strong>{transactions.length}</strong> dari <strong>{totalCount}</strong> catatan pengeluaran
              </div>
              <div className={styles.paginationActions}>
                <button
                  type="button"
                  className={`${styles.navBtn} ${page === 1 ? styles.btnDisabled : ''}`}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Halaman Sebelumnya"
                >
                  <ChevronLeft size={16} />
                  <span>Sebelum</span>
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  // Render pagination numbers dynamically
                  if (totalPages > 5 && Math.abs(p - page) > 1 && p !== 1 && p !== totalPages) {
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} style={{ color: 'var(--color-text-muted)', padding: '0 4px' }}>...</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.pageBtn} ${page === p ? styles.btnActive : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={`${styles.navBtn} ${page === totalPages ? styles.btnDisabled : ''}`}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Halaman Selanjutnya"
                >
                  <span>Lanjut</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Detail Modal Anchor */}
      <TransactionDetailModal
        isOpen={modalOpen}
        transaction={selectedTransaction}
        currentUserRole={user.role}
        onDeleteSuccess={() => {
          setRefreshTrigger(prev => prev + 1);
        }}
        onClose={() => {
          setModalOpen(false);
          setSelectedTransaction(null);
        }}
      />
    </div>
  );
}
