'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
  Clock,
  User as UserIcon,
  Tag,
  Building,
  CreditCard,
  CircleDollarSign,
} from 'lucide-react';
import type { UserDetailPayload } from '@/lib/actions/users';
import { getUserTransactionHistory } from '@/lib/actions/users';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import {
  formatRupiah,
  formatDate,
  formatDateShort,
  formatPaymentMethod,
  formatRole,
} from '@/lib/formatters';
import styles from './UserAuditDetailClient.module.css';

interface UserAuditDetailClientProps {
  user: UserDetailPayload;
}

export default function UserAuditDetailClient({ user }: UserAuditDetailClientProps) {
  // Filters & Pagination state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Transactions query payload state
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic initials generator (Poka-Yoke / Fallback)
  const getInitials = (name: string) => {
    if (!name) return 'GA';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Persistent HSL hue generator based on Username (UX booster!)
  const getAvatarBgColor = (username: string) => {
    if (!username) return 'hsl(210, 65%, 45%)';
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    // Dynamic HSL: stable saturation/lightness, unique hue per username
    return `hsl(${hue}, 60%, 45%)`;
  };

  // Load user transactions list from secure Server Action
  useEffect(() => {
    const fetchHistory = async () => {
      // Viewer roles do not have transaction privileges, skip query
      if (user.role === 'VIEWER') return;

      setLoading(true);
      setError(null);
      try {
        const response = await getUserTransactionHistory(user.id, {
          page,
          limit,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });

        if (response.success && response.data) {
          setTransactions(response.data.transactions);
          setTotalCount(response.data.totalCount);
          setTotalPages(response.data.totalPages);
        } else {
          setError(response.error || 'Gagal memuat log transaksi.');
        }
      } catch (err) {
        console.error('Audit transaction query error:', err);
        setError('Koneksi terputus. Gagal memuat data dari server.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user.id, user.role, page, limit, startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setPage(1);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const initials = getInitials(user.fullName);
  const avatarBg = getAvatarBgColor(user.username);

  return (
    <div className={styles.container}>
      {/* Top Navigation Row */}
      <header className={styles.headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Link href="/admin/users" className={styles.backBtn}>
            <ArrowLeft size={14} />
            <span>Kembali ke Pengguna</span>
          </Link>
          <h2>Log Audit Akun</h2>
        </div>
      </header>

      {/* Profile Details Card */}
      <section className={styles.profileCard}>
        <div className={styles.avatarContainer}>
          <div className={styles.avatarBig} style={{ backgroundColor: avatarBg }}>
            {initials}
          </div>
        </div>

        <div className={styles.profileInfo}>
          <div className={styles.profileTitleRow}>
            <h3>{user.fullName}</h3>
            <span
              className={`${styles.badge} ${
                user.isActive ? styles.badgeActive : styles.badgeInactive
              }`}
            >
              {user.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Username</span>
              <span className={styles.metaValue} style={{ fontFamily: 'monospace' }}>
                @{user.username}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Hak Akses Sistem</span>
              <span className={styles.metaValue}>
                <span
                  className={`${styles.badge} ${
                    user.role === 'SUPERADMIN'
                      ? styles.badgeSuperadmin
                      : user.role === 'DATA_ENTRY'
                      ? styles.badgeDataEntry
                      : styles.badgeViewer
                  }`}
                  style={{ display: 'inline-block', padding: '1px 6px', fontSize: '9px' }}
                >
                  {formatRole(user.role)}
                </span>
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Kantor Cabang Mapped</span>
              <span className={styles.metaValue}>
                {user.branch ? (
                  `${user.branch.name} (${user.branch.code})`
                ) : (
                  <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                    Global / Semua Cabang
                  </span>
                )}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Akun Dibuat Pada</span>
              <span className={styles.metaValue}>{formatDate(user.createdAt)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Transaction History Section */}
      {user.role === 'VIEWER' ? (
        /* Viewer banner - Viewer does not log inputs */
        <section className={styles.infoBanner}>
          <Info size={36} style={{ color: 'var(--color-text-muted)' }} />
          <div style={{ maxWidth: '480px' }}>
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              Tidak Ada Input Riwayat Transaksi
            </p>
            <p style={{ fontSize: 'var(--text-xs)' }}>
              Akun ini terdaftar dengan peran <strong>Viewer</strong>. Peran Viewer hanya diizinkan membaca laporan global dan visual analytics, serta tidak memiliki akses memasukkan data transaksi.
            </p>
          </div>
        </section>
      ) : (
        /* History logs table for Superadmin and Data Entry accounts */
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Query Filter Toolbar */}
          <div className={styles.toolbarCard}>
            <h4 className={styles.toolbarTitle}>Daftar Transaksi Inputted</h4>

            <div className={styles.filterGroup}>
              <div className={styles.dateRangeContainer}>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={startDate}
                  onChange={handleStartDateChange}
                  aria-label="Tanggal Mulai"
                  title="Tanggal Mulai"
                />
                <span className={styles.dateSeparator}>s/d</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={endDate}
                  onChange={handleEndDateChange}
                  aria-label="Tanggal Akhir"
                  title="Tanggal Akhir"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className={styles.clearBtn}
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Table / Loading Feed */}
          {error ? (
            <div className={styles.infoBanner}>
              <ShieldAlert size={28} style={{ color: 'var(--color-danger)' }} />
              <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</p>
            </div>
          ) : loading ? (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th><Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Tanggal</th>
                    <th>Detail Transaksi</th>
                    <th><Tag size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Kategori</th>
                    <th><Building size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Cabang</th>
                    <th><CreditCard size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Pembayaran</th>
                    <th style={{ textAlign: 'right' }}><CircleDollarSign size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: 'center',
                          color: 'var(--color-text-muted)',
                          padding: 'var(--space-10)',
                        }}
                      >
                        Tidak ada catatan transaksi ditemukan untuk rentang pencarian ini.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 600 }}>{formatDateShort(tx.transactionDate)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                              {tx.description}
                            </span>
                            {tx.vendor && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                Vendor: {tx.vendor}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 500 }}>{tx.category.name}</span>
                            {tx.subCategory && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                {tx.subCategory.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{tx.branch.name}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 6px',
                              backgroundColor: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {formatPaymentMethod(tx.paymentMethod)}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--color-text)',
                          }}
                        >
                          {formatRupiah(tx.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination controls footer */}
              {transactions.length > 0 && (
                <div className={styles.paginationRow}>
                  {/* Rows dropdown limit */}
                  <div className={styles.pageSizeSelector}>
                    <label htmlFor="pageSize-select">Tampilkan</label>
                    <select
                      id="pageSize-select"
                      className={styles.pageSizeSelect}
                      value={limit}
                      onChange={handleLimitChange}
                    >
                      <option value={10}>10 Baris</option>
                      <option value={25}>25 Baris</option>
                      <option value={50}>50 Baris</option>
                    </select>
                  </div>

                  {/* Navigation controls */}
                  <div className={styles.paginationControls}>
                    <span className={styles.pageInfo}>
                      Total {totalCount} item &bull; Halaman {page} dari {totalPages}
                    </span>

                    <button
                      type="button"
                      className={styles.pageBtn}
                      disabled={page === 1}
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      aria-label="Halaman Sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <button
                      type="button"
                      className={styles.pageBtn}
                      disabled={page === totalPages}
                      onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                      aria-label="Halaman Selanjutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
