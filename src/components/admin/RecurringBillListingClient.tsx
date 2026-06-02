'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  Plus,
  Pencil,
  PowerOff,
  Power,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
} from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import type { AuthUser } from '@/types';
import type { RecurringBillWithRelations } from '@/lib/actions/recurring';
import type { Branch } from '@prisma/client';
import type { CategoryWithSub } from '@/lib/actions/categories';
import {
  createRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  getRecurringBills,
} from '@/lib/actions/recurring';
import type { RecurringBillFrequency } from '@prisma/client';
import styles from '@/app/(dashboard)/admin/admin.module.css';

interface RecurringBillListingClientProps {
  user: AuthUser;
  initialBills: RecurringBillWithRelations[];
  branches: Branch[];
  categories: CategoryWithSub[];
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'Bulanan',
  QUARTERLY: 'Kuartalan',
  YEARLY: 'Tahunan',
};

// ── Helpers ──────────────────────────────────────────────────
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatIDDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Component ─────────────────────────────────────────────────
export default function RecurringBillListingClient({
  user,
  initialBills,
  branches,
  categories,
}: RecurringBillListingClientProps) {
  const router = useRouter();
  const [bills, setBills] = useState<RecurringBillWithRelations[]>(initialBills);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(initialBills.length);

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // "ALL", "ACTIVE", "INACTIVE"
  const [sortBy, setSortBy] = useState('nextDueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState<RecurringBillWithRelations | null>(null);

  // Form state
  const [formBranchId, setFormBranchId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formAmountDisplay, setFormAmountDisplay] = useState('');
  const [formFrequency, setFormFrequency] = useState<RecurringBillFrequency>('MONTHLY');
  const [formNextDueDate, setFormNextDueDate] = useState(today());
  const [formNotes, setFormNotes] = useState('');

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search Debouncer (Poka-Yoke to avoid API spamming)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset page to 1 on new search
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Fetch paginated, searched and sorted bills from server action
  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeParam = statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE';
      const branchParam = branchFilter ? Number(branchFilter) : undefined;

      const res = await getRecurringBills({
        page: currentPage,
        limit: 10,
        search: debouncedSearch.trim() || undefined,
        branchId: branchParam,
        isActive: activeParam,
        sortBy,
        sortOrder,
      });

      if (res.success && res.data) {
        setBills(res.data.bills);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.totalCount);
      } else {
        setError(res.error || 'Gagal memuat data tagihan berulang.');
      }
    } catch (err) {
      console.error(err);
      setError('Koneksi terputus. Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, branchFilter, statusFilter, sortBy, sortOrder]);

  // Load bills on filter change
  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Handle Dynamic Sort
  function handleSort(column: string) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  }

  function openCreateModal() {
    setEditBill(null);
    setFormBranchId(user.role === 'ADMIN' && user.branchId ? String(user.branchId) : '');
    setFormCategoryId('');
    setFormDescription('');
    setFormAmount('');
    setFormAmountDisplay('');
    setFormFrequency('MONTHLY');
    setFormNextDueDate(today());
    setFormNotes('');
    setError(null);
    setShowModal(true);
  }

  function openEditModal(bill: RecurringBillWithRelations) {
    setEditBill(bill);
    setFormBranchId(String(bill.branchId));
    setFormCategoryId(String(bill.categoryId));
    setFormDescription(bill.description);
    const amt = bill.amountExpected ? String(bill.amountExpected) : '';
    setFormAmount(amt);
    setFormAmountDisplay(amt ? Number(amt).toLocaleString('id-ID') : '');
    setFormFrequency(bill.frequency);
    setFormNextDueDate(new Date(bill.nextDueDate).toISOString().split('T')[0]);
    setFormNotes(bill.notes || '');
    setError(null);
    setShowModal(true);
  }

  function handleSubmit() {
    if (!formDescription.trim() || !formCategoryId || !formNextDueDate) {
      setError('Mohon isi semua bidang wajib.');
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const data = {
          branchId: formBranchId ? Number(formBranchId) : undefined,
          categoryId: Number(formCategoryId),
          description: formDescription.trim(),
          amountExpected: formAmount ? Number(formAmount.replace(/\./g, '')) : undefined,
          frequency: formFrequency,
          nextDueDate: formNextDueDate,
          notes: formNotes.trim() || undefined,
        };

        const result = editBill
          ? await updateRecurringBill(editBill.id, data)
          : await createRecurringBill(data);

        if (result.success) {
          setSuccess(result.message || 'Tagihan berulang berhasil disimpan.');
          setShowModal(false);
          fetchBills(); // Refresh table contents
          router.refresh();
        } else {
          setError(result.error || 'Terjadi kesalahan.');
        }
      } catch {
        setError('Terjadi kesalahan koneksi.');
      }
    });
  }

  function handleToggleActive(bill: RecurringBillWithRelations) {
    startTransition(async () => {
      const result = await updateRecurringBill(bill.id, { isActive: !bill.isActive });
      if (result.success) {
        setSuccess('Status tagihan berhasil diubah.');
        fetchBills();
      } else {
        setError(result.error || 'Gagal mengubah status.');
      }
    });
  }

  function handleDelete(bill: RecurringBillWithRelations) {
    if (!confirm(`Hapus tagihan "${bill.description}"?\n\nJika sudah ada pembayaran terkait, tagihan akan dinonaktifkan.`)) return;
    startTransition(async () => {
      const result = await deleteRecurringBill(bill.id);
      if (result.success) {
        setSuccess(result.message || 'Tagihan berhasil dihapus.');
        fetchBills();
      } else {
        setError(result.error || 'Gagal menghapus tagihan.');
      }
    });
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Tagihan Berulang</h2>
          <p className={styles.pageSubtitle}>
            Kelola template tagihan rutin yang otomatis dijadwalkan setiap siklus pembayaran.
          </p>
        </div>
        <div>
          <button
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <Plus size={16} />
            Tambah Tagihan Baru
          </button>
        </div>
      </header>

      {/* Toolbar Search Panel */}
      <section className={styles.toolbarCard}>
        <div className={styles.filterGroup}>
          {/* Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Cari deskripsi, catatan, kategori..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>

          {/* Branch Filter (SUPERADMIN only) */}
          {user.role === 'SUPERADMIN' && (
            <select
              className={styles.selectInput}
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            className={styles.selectInput}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ACTIVE">Status: Aktif</option>
            <option value="INACTIVE">Status: Nonaktif</option>
            <option value="ALL">Semua Status</option>
          </select>
        </div>
      </section>

      {/* Feedback banners */}
      {success && (
        <div className={styles.successBanner}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {error && !showModal && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Loading state spinner */}
      {loading ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
        </div>
      ) : bills.length === 0 ? (
        <div className={styles.emptyState}>
          <CalendarClock size={40} style={{ opacity: 0.4, marginBottom: 'var(--space-3)' }} />
          <p>Belum ada tagihan berulang yang terdaftar atau sesuai kriteria pencarian.</p>
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            Tambah Tagihan
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Bill table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('description')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span>Deskripsi</span>
                      {sortBy === 'description' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('branch')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span>Cabang</span>
                      {sortBy === 'branch' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span>Kategori</span>
                      {sortBy === 'category' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('frequency')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span>Frekuensi</span>
                      {sortBy === 'frequency' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }} onClick={() => handleSort('amountExpected')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', justifyContent: 'flex-end', width: '100%' }}>
                      <span>Jumlah</span>
                      {sortBy === 'amountExpected' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('nextDueDate')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span>Jatuh Tempo Berikutnya</span>
                      {sortBy === 'nextDueDate' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('isActive')}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span>Status</span>
                      {sortBy === 'isActive' ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronDown size={14} style={{ opacity: 0.15 }} />
                      )}
                    </div>
                  </th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => (
                  <tr key={bill.id} style={{ opacity: bill.isActive ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <CalendarClock size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        {bill.description}
                      </div>
                      {bill.notes && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {bill.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                      {bill.branch.name}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '10px' }}>
                        {bill.category.name}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                        {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: bill.amountExpected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                      {bill.amountExpected ? formatRupiah(bill.amountExpected) : 'Variabel'}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>
                      {formatIDDate(bill.nextDueDate)}
                    </td>
                    <td>
                      <span
                        className={`badge ${bill.isActive ? 'badge-success' : ''}`}
                        style={!bill.isActive ? { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' } : {}}
                      >
                        {bill.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(bill)}
                          disabled={isPending}
                          title="Edit tagihan"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleActive(bill)}
                          disabled={isPending}
                          title={bill.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'}
                        >
                          {bill.isActive ? <PowerOff size={12} /> : <Power size={12} />}
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDelete(bill)}
                          disabled={isPending}
                          title="Hapus tagihan"
                          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', backgroundColor: 'transparent' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: 'var(--space-4)' }}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || loading}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Halaman {currentPage} dari {totalPages} <span style={{ fontWeight: 400, opacity: 0.7 }}>({totalCount} item)</span>
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || loading}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Berikutnya</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: '560px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)' }}>
                {editBill ? 'Edit Tagihan Berulang' : 'Tambah Tagihan Berulang'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {error && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', color: 'var(--color-danger)', fontSize: 'var(--text-sm)', backgroundColor: 'rgba(239,68,68,0.06)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* Branch — SUPERADMIN only */}
              {user.role === 'SUPERADMIN' && (
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    Cabang <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select
                    className={styles.input ?? ''}
                    style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                    value={formBranchId}
                    onChange={e => setFormBranchId(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Kategori <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                  value={formCategoryId}
                  onChange={e => setFormCategoryId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Deskripsi Tagihan <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="Contoh: Tagihan Internet Biznet HO"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {/* Frequency + Amount row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>Frekuensi</label>
                  <select
                    style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                    value={formFrequency}
                    onChange={e => setFormFrequency(e.target.value as RecurringBillFrequency)}
                    disabled={isPending}
                  >
                    <option value="MONTHLY">Bulanan</option>
                    <option value="QUARTERLY">Kuartalan (3 bln)</option>
                    <option value="YEARLY">Tahunan</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    Jumlah (Rp) <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>opsional</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      style={{ width: '100%', padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-10)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                      placeholder="0"
                      value={formAmountDisplay}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setFormAmount(raw);
                        setFormAmountDisplay(raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                      }}
                      disabled={isPending}
                    />
                    <span style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rp</span>
                  </div>
                </div>
              </div>

              {/* Next Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Tanggal Jatuh Tempo Pertama <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="date"
                  style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                  value={formNextDueDate}
                  onChange={e => setFormNextDueDate(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>Catatan</label>
                <input
                  type="text"
                  style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="Catatan tambahan (opsional)"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', backgroundColor: 'var(--color-bg)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={isPending}
                style={{ minWidth: '120px' }}
              >
                {isPending ? 'Menyimpan...' : editBill ? 'Simpan Perubahan' : 'Tambah Tagihan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
