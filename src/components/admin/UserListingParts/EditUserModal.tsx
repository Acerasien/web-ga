import { useState, useEffect } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { updateUser } from '@/lib/actions/users';
import type { UserDetailPayload } from '@/lib/actions/users';
import type { Branch } from '@prisma/client';
import styles from '@/app/(dashboard)/admin/admin.module.css';
import modalStyles from '@/components/modals/modal.module.css';

interface EditUserModalProps {
  isOpen: boolean;
  user: UserDetailPayload | null;
  onClose: () => void;
  onSuccess: () => void;
  branches: Branch[];
}

export default function EditUserModal({ isOpen, user, onClose, onSuccess, branches }: EditUserModalProps) {
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'SUPERADMIN' | 'ADMIN' | 'DATA_ENTRY' | 'VIEWER'>('DATA_ENTRY');
  const [editBranchId, setEditBranchId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setEditFullName(user.fullName);
      setEditRole(user.role);
      setEditBranchId(user.branchId ? String(user.branchId) : '');
      setEditError(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await updateUser(user.id, {
        fullName: editFullName,
        role: editRole,
        branchId: editRole === 'SUPERADMIN' ? null : (editBranchId ? Number(editBranchId) : null)
      });

      if (res.success) {
        onSuccess();
        onClose();
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

  return (
    <div className={modalStyles.backdrop} onClick={onClose}>
      <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <header className={modalStyles.header}>
          <h3>Ubah Detail Pengguna</h3>
          <button onClick={onClose} className={modalStyles.closeBtn}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {editError && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{editError}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Username Login</label>
            <input type="text" className={styles.searchInput} value={user.username} disabled style={{ backgroundColor: 'var(--color-bg)', cursor: 'not-allowed' }} />
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batalkan</button>
            <button type="submit" className="btn btn-primary" disabled={editLoading}>
              {editLoading ? 'Menyimpan...' : 'Simpan Detail'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
