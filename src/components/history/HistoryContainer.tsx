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
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { getTransactions, deleteTransactions } from '@/lib/actions/transactions';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import type { CategoryWithSub } from '@/lib/actions/categories';
import type { Branch, PaymentMethod } from '@prisma/client';
import type { AuthUser } from '@/types';
import { formatRupiah } from '@/lib/formatters';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';
import styles from '@/app/(dashboard)/transaksi/riwayat/history.module.css';
import stylesModal from '@/components/modals/modal.module.css';

interface HistoryContainerProps {
  user: AuthUser;
  categories: CategoryWithSub[];
  branches: Branch[];
}

export default function HistoryContainer({ user, categories, branches }: HistoryContainerProps) {
  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

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

  // Sorting States
  const [sortBy, setSortBy] = useState<string>('transactionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Advanced Filters toggle state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Active filters count for visual badge
  const activeFiltersCount = [
    branchId,
    categoryId,
    paymentMethod,
    startDate,
    endDate,
  ].filter(Boolean).length;

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
      setSelectedIds(new Set());
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
          sortBy,
          sortOrder,
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
  }, [debouncedSearch, branchId, categoryId, paymentMethod, startDate, endDate, page, refreshTrigger, sortBy, sortOrder]);

  // Handle Interactive Header Clicks Sorting
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'category' || field === 'branch' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  // Reset all filters in one click
  const handleResetFilters = () => {
    setSearch('');
    setBranchId('');
    setCategoryId('');
    setPaymentMethod('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setSortBy('transactionDate');
    setSortOrder('desc');
  };

  // Toggle selection for a single row
  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bulk Delete Submission Handler
  const handleBulkDelete = async () => {
    if (confirmText !== 'HAPUS') return;
    setBulkDeleting(true);
    setBulkDeleteError(null);
    try {
      const idsToDelete = Array.from(selectedIds);
      const res = await deleteTransactions(idsToDelete);
      if (res.success) {
        setBulkModalOpen(false);
        setConfirmText('');
        setSelectedIds(new Set());
        setRefreshTrigger(prev => prev + 1);
      } else {
        setBulkDeleteError(res.error || 'Gagal menghapus transaksi terpilih.');
      }
    } catch (err) {
      console.error('Bulk delete client error:', err);
      setBulkDeleteError('Koneksi terputus. Gagal menghubungi server.');
    } finally {
      setBulkDeleting(false);
    }
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
        {/* Modern Primary Toolbar Row */}
        <div className={styles.toolbarRow}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Cari deskripsi kebutuhan, vendor toko, catatan tambahan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={18} style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.6 }} />
          </div>

          <div className={styles.actionButtons}>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`${styles.toggleBtn} ${showAdvancedFilters ? styles.toggleActive : ''}`}
              title="Tampilkan Penyaringan Lanjutan"
            >
              <Filter size={16} />
              <span>Filter Lanjutan</span>
              {activeFiltersCount > 0 && (
                <span className={styles.badge}>{activeFiltersCount}</span>
              )}
            </button>

            {(search || activeFiltersCount > 0) && (
              <button 
                type="button" 
                onClick={handleResetFilters} 
                className={styles.resetBtn}
                title="Reset Semua Penyaringan"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Slide-Down Panel */}
        {showAdvancedFilters && (
          <div className={styles.advancedPanel}>
            <div className={styles.advancedGrid}>
              {/* Row 1, Col 1: Cabang */}
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

              {/* Row 1, Col 2: Kategori */}
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

              {/* Row 1, Col 3: Pembayaran */}
              <div className={styles.filterGroup}>
                <label htmlFor="payment-filter" className={styles.label}>Metode Pembayaran</label>
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

              {/* Row 2, Col 1: Start Date */}
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

              {/* Row 2, Col 2: End Date */}
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

              {/* Row 2, Col 3: Sorting */}
              <div className={styles.filterGroup}>
                <label htmlFor="sort-filter" className={styles.label}>Urutan Tampilan</label>
                <select
                  id="sort-filter"
                  className={styles.input}
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order as 'asc' | 'desc');
                    setPage(1);
                  }}
                >
                  <option value="transactionDate-desc">Tanggal (Terbaru)</option>
                  <option value="transactionDate-asc">Tanggal (Terlama)</option>
                  <option value="totalAmount-desc">Total Biaya (Tertinggi)</option>
                  <option value="totalAmount-asc">Total Biaya (Terendah)</option>
                  <option value="category-asc">Kategori (A - Z)</option>
                  <option value="category-desc">Kategori (Z - A)</option>
                  {user.role === 'SUPERADMIN' && (
                    <>
                      <option value="branch-asc">Cabang (A - Z)</option>
                      <option value="branch-desc">Cabang (Z - A)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>
        )}
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
                    {user.role === 'SUPERADMIN' && (
                      <th className={styles.checkboxCol}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(transactions.map(tx => tx.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          aria-label="Pilih semua transaksi di halaman ini"
                        />
                      </th>
                    )}
                    <th className={styles.th} onClick={() => handleSort('transactionDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Tanggal</span>
                        {sortBy === 'transactionDate' ? (
                          sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        ) : (
                          <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                        )}
                      </div>
                    </th>
                    {user.role === 'SUPERADMIN' && (
                      <th className={styles.th} onClick={() => handleSort('branch')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>Cabang</span>
                          {sortBy === 'branch' ? (
                            sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                          )}
                        </div>
                      </th>
                    )}
                    <th className={styles.th} onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Kategori</span>
                        {sortBy === 'category' ? (
                          sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        ) : (
                          <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                        )}
                      </div>
                    </th>
                    <th className={styles.th}>Deskripsi / Kebutuhan</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Jumlah</th>
                    <th className={styles.th} onClick={() => handleSort('totalAmount')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                        <span>Total Biaya</span>
                        {sortBy === 'totalAmount' ? (
                          sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        ) : (
                          <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
                        )}
                      </div>
                    </th>
                    <th className={styles.th} style={{ textAlign: 'center' }}>Pembayaran</th>
                    <th className={styles.th} style={{ textAlign: 'center' }}>Bukti</th>
                    <th className={styles.th} style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      className={`${styles.tr} ${selectedIds.has(tx.id) ? styles.trSelected : ''}`}
                      onClick={() => handleRowClick(tx)}
                      title="Klik untuk melihat detail lengkap transaksi ini"
                    >
                      {user.role === 'SUPERADMIN' && (
                        <td className={styles.checkboxCell} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={selectedIds.has(tx.id)}
                            onChange={() => handleToggleSelect(tx.id)}
                            aria-label={`Pilih transaksi ${tx.description}`}
                          />
                        </td>
                      )}
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
        onUploadSuccess={() => {
          setRefreshTrigger(prev => prev + 1);
        }}
        onClose={() => {
          setModalOpen(false);
          setSelectedTransaction(null);
        }}
      />

      {/* Floating action bar for bulk delete */}
      {user.role === 'SUPERADMIN' && (
        <div className={`${styles.floatingBar} ${selectedIds.size > 0 ? styles.floatingBarActive : ''}`}>
          <div className={styles.floatingBarInfo}>
            <span className={styles.floatingBarCount}>{selectedIds.size}</span>
            <span>Transaksi terpilih</span>
          </div>
          <button
            type="button"
            className={styles.floatingBarBtn}
            onClick={() => setBulkModalOpen(true)}
          >
            <Trash2 size={16} />
            <span>Hapus Terpilih</span>
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkModalOpen && (
        <div 
          className={stylesModal.backdrop} 
          onClick={() => {
            if (!bulkDeleting) {
              setBulkModalOpen(false);
              setConfirmText('');
              setBulkDeleteError(null);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className={stylesModal.modal} 
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={stylesModal.header}>
              <h3>Konfirmasi Hapus Masal</h3>
              <button 
                type="button" 
                className={stylesModal.closeBtn}
                onClick={() => {
                  setBulkModalOpen(false);
                  setConfirmText('');
                  setBulkDeleteError(null);
                }}
                disabled={bulkDeleting}
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className={stylesModal.body}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                Anda akan menghapus secara permanen <strong>{selectedIds.size} transaksi</strong> berikut ini:
              </p>

              <div style={{ 
                maxHeight: '180px', 
                overflowY: 'auto', 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-lg)', 
                padding: 'var(--space-3)', 
                backgroundColor: 'var(--color-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)'
              }}>
                {transactions
                  .filter(tx => selectedIds.has(tx.id))
                  .map(tx => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', paddingTop: '2px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description}
                      </span>
                      <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                        {formatRupiah(tx.totalAmount)}
                      </span>
                    </div>
                  ))
                }
              </div>

              <p style={{ margin: 'var(--space-2) 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Tindakan ini tidak dapat dibatalkan. Log audit permanen akan dicatat untuk aktivitas ini.
              </p>

              <div style={{ marginTop: 'var(--space-2)' }}>
                <label htmlFor="confirm-typing" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Ketik "HAPUS" untuk menyetujui penghapusan
                </label>
                <input
                  id="confirm-typing"
                  type="text"
                  className={styles.confirmationInput}
                  placeholder="Ketik HAPUS di sini..."
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={bulkDeleting}
                  autoComplete="off"
                />
              </div>

              {bulkDeleteError && (
                <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <XCircle size={14} />
                  <span>{bulkDeleteError}</span>
                </div>
              )}
            </div>

            <div className={stylesModal.footer}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setBulkModalOpen(false);
                  setConfirmText('');
                  setBulkDeleteError(null);
                }}
                disabled={bulkDeleting}
                style={{ minHeight: '38px' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleBulkDelete}
                disabled={confirmText !== 'HAPUS' || bulkDeleting}
                style={{ 
                  minHeight: '38px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 'var(--space-2)',
                  backgroundColor: confirmText === 'HAPUS' ? 'var(--color-danger)' : 'var(--color-border)',
                  color: confirmText === 'HAPUS' ? 'white' : 'var(--color-text-muted)',
                  cursor: confirmText === 'HAPUS' ? 'pointer' : 'not-allowed'
                }}
              >
                {bulkDeleting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                <span>Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
