'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  UserPlus, 
  Edit2, 
  Key, 
  AlertCircle, 
  Check, 
  User as UserIcon,
  ShieldAlert,
  Building,
  Eye
} from 'lucide-react';
import { getUsers, createUser, updateUser, adminResetPassword } from '@/lib/actions/users';
import type { UserDetailPayload } from '@/lib/actions/users';
import type { Branch } from '@prisma/client';
import styles from '@/app/(dashboard)/admin/admin.module.css';
import modalStyles from '@/components/modals/modal.module.css';

interface UserListingClientProps {
  branches: Branch[];
}

export default function UserListingClient({ branches }: UserListingClientProps) {
  // Query Filters States
  const [search, setSearch] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');

  // Main list states
  const [users, setUsers] = useState<UserDetailPayload[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal control states
  const [addUserOpen, setAddUserOpen] = useState<boolean>(false);
  const [editUserOpen, setEditUserOpen] = useState<boolean>(false);
  const [resetPassOpen, setResetPassOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserDetailPayload | null>(null);

  // Form states - Add User
  const [newUsername, setNewUsername] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newRole, setNewRole] = useState<'SUPERADMIN' | 'ADMIN' | 'DATA_ENTRY' | 'VIEWER'>('DATA_ENTRY');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState<boolean>(false);

  // Form states - Edit User
  const [editFullName, setEditFullName] = useState<string>('');
  const [editRole, setEditRole] = useState<'SUPERADMIN' | 'ADMIN' | 'DATA_ENTRY' | 'VIEWER'>('DATA_ENTRY');
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<boolean>(false);

  // Form states - Reset Password
  const [resetPassText, setResetPassText] = useState<string>('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  // 1. Fetch filtered list of users
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsers({
        search,
        role,
        branchId: branchId ? Number(branchId) : undefined
      });

      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        setError(res.error || 'Gagal memuat daftar pengguna.');
      }
    } catch (err) {
      console.error(err);
      setError('Koneksi terputus. Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, role, branchId]);

  // 2. Add New User Submission Handler
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);

    try {
      const res = await createUser({
        username: newUsername,
        fullName: newFullName,
        role: newRole,
        branchId: newRole === 'SUPERADMIN' ? null : (newBranchId ? Number(newBranchId) : null),
        passwordText: newPassword
      });

      if (res.success) {
        setAddUserOpen(false);
        // Reset Add inputs
        setNewUsername('');
        setNewFullName('');
        setNewRole('DATA_ENTRY');
        setNewBranchId('');
        setNewPassword('');
        // Reload table
        loadUsers();
      } else {
        setAddError(res.error || 'Gagal membuat akun.');
      }
    } catch (err) {
      console.error(err);
      setAddError('Koneksi terputus. Silakan coba kembali.');
    } finally {
      setAddLoading(false);
    }
  };

  // 3. Edit User Triggers
  const openEditModal = (user: UserDetailPayload) => {
    setSelectedUser(user);
    setEditFullName(user.fullName);
    setEditRole(user.role);
    setEditBranchId(user.branchId ? String(user.branchId) : '');
    setEditError(null);
    setEditUserOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await updateUser(selectedUser.id, {
        fullName: editFullName,
        role: editRole,
        branchId: editRole === 'SUPERADMIN' ? null : (editBranchId ? Number(editBranchId) : null)
      });

      if (res.success) {
        setEditUserOpen(false);
        loadUsers();
      } else {
        setEditError(res.error || 'Gagal memperbarui profil.');
      }
    } catch (err) {
      console.error(err);
      setEditError('Koneksi terputus. Silakan coba kembali.');
    } finally {
      setEditLoading(false);
    }
  };

  // 4. Quick toggle Active switch directly from the table row (UX booster!)
  const handleToggleStatus = async (user: UserDetailPayload) => {
    try {
      const res = await updateUser(user.id, {
        isActive: !user.isActive
      });

      if (res.success) {
        // Optimistic state updates
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      } else {
        alert(res.error || 'Gagal memperbarui status akun.');
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi bermasalah. Gagal merubah status.');
    }
  };

  // 5. Reset Password Handler
  const openResetModal = (user: UserDetailPayload) => {
    setSelectedUser(user);
    setResetPassText('');
    setResetError(null);
    setResetSuccess(false);
    setResetPassOpen(true);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetError(null);
    setResetLoading(true);

    try {
      const res = await adminResetPassword(selectedUser.id, resetPassText);

      if (res.success) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetPassOpen(false);
        }, 1500);
      } else {
        setResetError(res.error || 'Gagal mereset kata sandi.');
      }
    } catch (err) {
      console.error(err);
      setResetError('Koneksi terputus. Silakan coba kembali.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.headerRow}>
        <div>
          <h2>Manajemen Pengguna</h2>
          <p className="text-muted" style={{ margin: 0 }}>Kelola detail akun staff operasional GA, hak akses level, dan reset kata sandi.</p>
        </div>
        
        <button 
          type="button" 
          onClick={() => {
            setAddError(null);
            setAddUserOpen(true);
          }} 
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <UserPlus size={16} />
          <span>Tambah Pengguna</span>
        </button>
      </header>

      {/* Toolbar Search Panel */}
      <section className={styles.toolbarCard}>
        <div className={styles.filterGroup}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Cari nama atau username..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>

          <select
            className={styles.selectInput}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Semua Peran</option>
            <option value="SUPERADMIN">Superadmin</option>
            <option value="ADMIN">Admin Cabang</option>
            <option value="DATA_ENTRY">Data Entry</option>
            <option value="VIEWER">Viewer</option>
          </select>

          <select
            className={styles.selectInput}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">Semua Cabang</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Main Users Listing Grid Table */}
      {error ? (
        <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
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
                <th>Nama Pengguna</th>
                <th>Username</th>
                <th>Cabang Mapped</th>
                <th>Peran Akses</th>
                <th>Status Akif</th>
                <th style={{ textAlign: 'right' }}>Aksi Kelola</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>
                    Tidak ada data staff ditemukan.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                          <UserIcon size={14} />
                        </div>
                        <span>{u.fullName}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{u.username}</td>
                    <td>{u.branch ? `${u.branch.name} (${u.branch.code})` : <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Global / HQ</span>}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        u.role === 'SUPERADMIN' ? styles.badgeSuperadmin :
                        u.role === 'ADMIN' ? styles.badgeAdmin :
                        u.role === 'DATA_ENTRY' ? styles.badgeDataEntry :
                        styles.badgeViewer
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {/* Interactive toggle switch slider */}
                      <label className={styles.switch} title="Klik untuk mengaktifkan/menonaktifkan akun">
                        <input
                          type="checkbox"
                          checked={u.isActive}
                          onChange={() => handleToggleStatus(u)}
                        />
                        <span className={styles.slider} />
                      </label>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px var(--space-2)', minHeight: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}
                          title="Audit Detail Transaksi"
                        >
                          <Eye size={12} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px var(--space-2)', minHeight: '32px' }}
                          title="Ubah Profil Akun"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openResetModal(u)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px var(--space-2)', minHeight: '32px', color: 'var(--color-accent)' }}
                          title="Reset Password"
                        >
                          <Key size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
         ADD NEW USER MODAL OVERLAY
         ============================================================ */}
      {addUserOpen && (
        <div className={modalStyles.backdrop} onClick={() => setAddUserOpen(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <header className={modalStyles.header}>
              <h3>Tambah Akun Staff GA Baru</h3>
              <button onClick={() => setAddUserOpen(false)} className={modalStyles.closeBtn}>&times;</button>
            </header>

            <form onSubmit={handleAddSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {addError && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{addError}</span>
                </div>
              )}

              {/* Username field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="username-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Username Login</label>
                <input
                  id="username-input"
                  type="text"
                  placeholder="e.g. budi.ga"
                  className={styles.searchInput}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>

              {/* Full Name field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="fullName-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Nama Lengkap</label>
                <input
                  id="fullName-input"
                  type="text"
                  placeholder="e.g. Budi Santoso"
                  className={styles.searchInput}
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  required
                />
              </div>

              {/* Initial Password field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="password-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Kata Sandi Pertama</label>
                <input
                  id="password-input"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  className={styles.searchInput}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              {/* Access Role dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="role-select" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Tingkat Peran Hak Akses</label>
                <select
                  id="role-select"
                  className={styles.selectInput}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="DATA_ENTRY">Data Entry (Hanya Cabang Mapped)</option>
                  <option value="ADMIN">Admin (Mengelola Cabang & Ongoing)</option>
                  <option value="VIEWER">Viewer (Membaca Data Cabang Mapped)</option>
                  <option value="SUPERADMIN">Superadmin (Global / Semua Cabang)</option>
                </select>
              </div>

              {/* Mapped Branch selection (Poka-Yoke: Hides/disables if SUPERADMIN role chosen) */}
              {newRole !== 'SUPERADMIN' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="branch-select" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Cabang Penempatan</label>
                  <select
                    id="branch-select"
                    className={styles.selectInput}
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Cabang Penempatan --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  <ShieldAlert size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Akun Superadmin otomatis memiliki kendali global di seluruh kantor cabang.</span>
                </div>
              )}

              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddUserOpen(false)}>Batalkan</button>
                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                  {addLoading ? 'Mendaftarkan...' : 'Daftar Staff'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
         EDIT USER DETAIL MODAL OVERLAY
         ============================================================ */}
      {editUserOpen && selectedUser && (
        <div className={modalStyles.backdrop} onClick={() => setEditUserOpen(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <header className={modalStyles.header}>
              <h3>Ubah Detail Pengguna</h3>
              <button onClick={() => setEditUserOpen(false)} className={modalStyles.closeBtn}>&times;</button>
            </header>

            <form onSubmit={handleEditSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {editError && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{editError}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Username Login</label>
                <input type="text" className={styles.searchInput} value={selectedUser.username} disabled style={{ backgroundColor: 'var(--color-bg)', cursor: 'not-allowed' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="editFullName-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Nama Lengkap</label>
                <input
                  id="editFullName-input"
                  type="text"
                  className={styles.searchInput}
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="editRole-select" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Peran Akses</label>
                <select
                  id="editRole-select"
                  className={styles.selectInput}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <option value="DATA_ENTRY">Data Entry</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
              </div>

              {editRole !== 'SUPERADMIN' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="editBranch-select" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Cabang Penempatan</label>
                  <select
                    id="editBranch-select"
                    className={styles.selectInput}
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Cabang Penempatan --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  <ShieldAlert size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Superadmin otomatis mapped secara global ke seluruh cabang operasional.</span>
                </div>
              )}

              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditUserOpen(false)}>Batalkan</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Menyimpan...' : 'Simpan Detail'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
         RESET PASSWORD MODAL OVERLAY
         ============================================================ */}
      {resetPassOpen && selectedUser && (
        <div className={modalStyles.backdrop} onClick={() => setResetPassOpen(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <header className={modalStyles.header}>
              <h3>Reset Kata Sandi Pengguna</h3>
              <button onClick={() => setResetPassOpen(false)} className={modalStyles.closeBtn}>&times;</button>
            </header>

            <form onSubmit={handleResetSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {resetSuccess ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                  <Check size={48} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-2)' }} />
                  <p style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                    Kata sandi untuk '{selectedUser.fullName}' berhasil diperbarui!
                  </p>
                </div>
              ) : (
                <>
                  {resetError && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Resetting password login untuk username: <strong style={{ color: 'var(--color-text)' }}>{selectedUser.username}</strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="resetPass-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Kata Sandi Baru</label>
                    <input
                      id="resetPass-input"
                      type="password"
                      placeholder="Minimal 6 karakter"
                      className={styles.searchInput}
                      value={resetPassText}
                      onChange={(e) => setResetPassText(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setResetPassOpen(false)}>Batalkan</button>
                    <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                      {resetLoading ? 'Menyimpan...' : 'Ganti Kata Sandi'}
                    </button>
                  </footer>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
