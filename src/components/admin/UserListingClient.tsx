'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UserPlus, 
  Edit2, 
  Key, 
  AlertCircle, 
  User as UserIcon,
  Building,
  Eye
} from 'lucide-react';
import { getUsers, updateUser } from '@/lib/actions/users';
import type { UserDetailPayload } from '@/lib/actions/users';
import type { Branch } from '@prisma/client';
import styles from '@/app/(dashboard)/admin/admin.module.css';
import UserListingToolbar from './UserListingParts/UserListingToolbar';
import AddUserModal from './UserListingParts/AddUserModal';
import EditUserModal from './UserListingParts/EditUserModal';
import ResetPasswordModal from './UserListingParts/ResetPasswordModal';

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



  // 3. Edit User Triggers
  const openEditModal = (user: UserDetailPayload) => {
    setSelectedUser(user);
    setEditUserOpen(true);
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
    setResetPassOpen(true);
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
          onClick={() => setAddUserOpen(true)} 
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <UserPlus size={16} />
          <span>Tambah Pengguna</span>
        </button>
      </header>

      {/* Toolbar Search Panel */}
      <UserListingToolbar 
        search={search}
        setSearch={setSearch}
        role={role}
        setRole={setRole}
        branchId={branchId}
        setBranchId={setBranchId}
        branches={branches}
      />

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

      <AddUserModal 
        isOpen={addUserOpen} 
        onClose={() => setAddUserOpen(false)} 
        onSuccess={loadUsers} 
        branches={branches} 
      />

      <EditUserModal 
        isOpen={editUserOpen} 
        user={selectedUser} 
        onClose={() => setEditUserOpen(false)} 
        onSuccess={loadUsers} 
        branches={branches} 
      />

      <ResetPasswordModal 
        isOpen={resetPassOpen} 
        user={selectedUser} 
        onClose={() => setResetPassOpen(false)} 
      />
    </div>
  );
}
