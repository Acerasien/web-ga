import { useState } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { createUser } from '@/lib/actions/users';
import type { Branch } from '@prisma/client';
import styles from '@/app/(dashboard)/admin/admin.module.css';
import modalStyles from '@/components/modals/modal.module.css';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branches: Branch[];
}

export default function AddUserModal({ isOpen, onClose, onSuccess, branches }: AddUserModalProps) {
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'SUPERADMIN' | 'ADMIN' | 'DATA_ENTRY' | 'VIEWER'>('DATA_ENTRY');
  const [newBranchId, setNewBranchId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
        setNewUsername('');
        setNewFullName('');
        setNewRole('DATA_ENTRY');
        setNewBranchId('');
        setNewPassword('');
        onSuccess();
        onClose();
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

  return (
    <div className={modalStyles.backdrop} onClick={onClose}>
      <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <header className={modalStyles.header}>
          <h3>Tambah Akun Staff GA Baru</h3>
          <button onClick={onClose} className={modalStyles.closeBtn}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

          {/* Mapped Branch selection */}
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batalkan</button>
            <button type="submit" className="btn btn-primary" disabled={addLoading}>
              {addLoading ? 'Mendaftarkan...' : 'Daftar Staff'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
