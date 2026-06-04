'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  User as UserIcon,
  Database,
  Tag,
  RefreshCw,
  XCircle,
  Trash2,
} from 'lucide-react';
import type { UserDetailPayload } from '@/lib/actions/users';
import type { AuditLogWithUser } from '@/lib/actions/audit';
import { getAuditLogs, purgeAuditLogs } from '@/lib/actions/audit';
import { formatDateTime } from '@/lib/formatters';
import styles from './AuditLogClient.module.css';

interface AuditLogClientProps {
  users: UserDetailPayload[];
}

export default function AuditLogClient({ users }: AuditLogClientProps) {
  // Query Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [actionType, setActionType] = useState<string>('');
  const [targetTable, setTargetTable] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Data State
  const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Logs function
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAuditLogs({
        page,
        limit,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userId: userId ? Number(userId) : undefined,
        actionType: actionType || undefined,
        targetTable: targetTable || undefined,
        search: search || undefined,
      });

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotalCount(response.data.totalCount);
        setTotalPages(response.data.totalPages);
      } else {
        setError(response.error || 'Gagal memuat log audit.');
      }
    } catch (err) {
      console.error('Audit logs query error:', err);
      setError('Koneksi terputus. Gagal mengambil data dari server.');
    } finally {
      setLoading(false);
    }
  };

  // Purge/Prune older logs action (Superadmin Cleanup)
  const handlePurgeLogs = async () => {
    const confirmPurge = window.confirm(
      'Apakah Anda yakin ingin menghapus log audit yang berusia lebih dari 90 hari?\nTindakan ini tidak dapat dibatalkan.'
    );
    if (!confirmPurge) return;

    setLoading(true);
    setError(null);
    try {
      const response = await purgeAuditLogs(90);
      if (response.success) {
        alert(response.message || 'Log audit berhasil dibersihkan.');
        setPage(1);
        await fetchLogs();
      } else {
        setError(response.error || 'Gagal membersihkan log audit.');
      }
    } catch (err) {
      console.error('Audit logs purge error:', err);
      setError('Koneksi terputus. Gagal membersihkan log.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when dependency state changes
  useEffect(() => {
    fetchLogs();
  }, [page, limit, userId, actionType, targetTable, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setSearch('');
    setUserId('');
    setActionType('');
    setTargetTable('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeClass = (type: string) => {
    switch (type) {
      case 'CREATE':
        return styles.badgeCreate;
      case 'UPDATE':
        return styles.badgeUpdate;
      case 'DELETE':
        return styles.badgeDelete;
      default:
        return '';
    }
  };

  const translateTargetTable = (table: string) => {
    switch (table) {
      case 'Transaction':
        return 'Transaksi';
      case 'User':
        return 'User / Staff';
      case 'Branch':
        return 'Cabang';
      case 'SubCategory':
        return 'Sub-Kategori';
      case 'Category':
        return 'Kategori';
      default:
        return table;
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <ShieldAlert size={28} className={styles.headerIcon} />
          <div>
            <h1>System Audit Log</h1>
            <p>Riwayat perubahan data dan aktivitas sistem untuk keperluan audit (Superadmin Only).</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handlePurgeLogs}
            className={styles.purgeBtn}
            title="Bersihkan Log > 90 Hari"
            disabled={loading}
          >
            <Trash2 size={16} />
            <span>Bersihkan Log Lama</span>
          </button>
          <button
            type="button"
            onClick={() => { setPage(1); fetchLogs(); }}
            className={styles.refreshBtn}
            title="Refresh Data"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Filter Card */}
      <section className={styles.toolbarCard}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <div className={styles.searchRow}>
            <div className={styles.inputWithIcon}>
              <Search size={16} className={styles.inputIcon} />
              <input
                type="text"
                placeholder="Cari deskripsi, username, nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <button type="submit" className={styles.searchBtn} disabled={loading}>
              Cari
            </button>
          </div>
        </form>

        <div className={styles.filtersGrid}>
          {/* Actor Filter */}
          <div className={styles.filterField}>
            <label htmlFor="user-select">Aktor / Pengguna</label>
            <select
              id="user-select"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className={styles.selectInput}
            >
              <option value="">Semua Pengguna</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          {/* Action Type Filter */}
          <div className={styles.filterField}>
            <label htmlFor="action-select">Tipe Aksi</label>
            <select
              id="action-select"
              value={actionType}
              onChange={(e) => { setActionType(e.target.value); setPage(1); }}
              className={styles.selectInput}
            >
              <option value="">Semua Aksi</option>
              <option value="CREATE">CREATE (Tambah)</option>
              <option value="UPDATE">UPDATE (Edit)</option>
              <option value="DELETE">DELETE (Hapus)</option>
            </select>
          </div>

          {/* Target Table Filter */}
          <div className={styles.filterField}>
            <label htmlFor="table-select">Entitas Modul</label>
            <select
              id="table-select"
              value={targetTable}
              onChange={(e) => { setTargetTable(e.target.value); setPage(1); }}
              className={styles.selectInput}
            >
              <option value="">Semua Modul</option>
              <option value="Transaction">Transaksi</option>
              <option value="User">User / Staff</option>
              <option value="Branch">Cabang</option>
              <option value="SubCategory">Sub-Kategori</option>
            </select>
          </div>

          {/* Date Range Filters */}
          <div className={styles.filterField}>
            <label htmlFor="start-date-input">Rentang Tanggal</label>
            <div className={styles.dateRangeContainer}>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className={styles.dateInput}
              />
              <span className={styles.dateSeparator}>s/d</span>
              <input
                type="date"
                value={endDate}
                aria-label="Tanggal Akhir"
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className={styles.dateInput}
              />
            </div>
          </div>
        </div>

        {(search || userId || actionType || targetTable || startDate || endDate) && (
          <div className={styles.clearRow}>
            <button
              type="button"
              onClick={handleClearFilters}
              className={styles.clearBtn}
            >
              <XCircle size={14} style={{ marginRight: '4px' }} />
              Reset Semua Filter
            </button>
          </div>
        )}
      </section>

      {/* Audit Log Timeline/Feed */}
      {error ? (
        <div className={styles.errorAlert}>
          <ShieldAlert size={28} />
          <p>{error}</p>
        </div>
      ) : loading && logs.length === 0 ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Sedang memuat data log audit...</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>
                  <Clock size={12} className={styles.thIcon} /> Waktu Kejadian
                </th>
                <th style={{ width: '180px' }}>
                  <UserIcon size={12} className={styles.thIcon} /> Aktor
                </th>
                <th style={{ width: '120px' }}>Tipe Aksi</th>
                <th style={{ width: '150px' }}>
                  <Database size={12} className={styles.thIcon} /> Modul / ID
                </th>
                <th>Deskripsi Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.noDataCell}>
                    Tidak ditemukan log audit yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.dateCell}>{formatDateTime(log.createdAt)}</td>
                    <td>
                      <div className={styles.actorCell}>
                        <span className={styles.actorName}>{log.user.fullName}</span>
                        <span className={styles.actorUsername}>@{log.user.username}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getActionBadgeClass(log.actionType)}`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td>
                      <div className={styles.targetCell}>
                        <span className={styles.targetTable}>{translateTargetTable(log.targetTable)}</span>
                        <span className={styles.targetId}>ID: {log.targetId}</span>
                      </div>
                    </td>
                    <td className={styles.descCell}>{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination controls */}
          {logs.length > 0 && (
            <footer className={styles.paginationRow}>
              <div className={styles.pageSizeSelector}>
                <label htmlFor="pageSize-select">Tampilkan</label>
                <select
                  id="pageSize-select"
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className={styles.limitSelect}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value={100}>100 Baris</option>
                </select>
              </div>

              <div className={styles.paginationControls}>
                <span className={styles.pageInfo}>
                  Total <strong>{totalCount}</strong> item &bull; Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  aria-label="Halaman Sebelumnya"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={page === totalPages || loading}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  aria-label="Halaman Selanjutnya"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}
