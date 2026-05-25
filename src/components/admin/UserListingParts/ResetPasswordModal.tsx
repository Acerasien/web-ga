import { useState, useEffect } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { adminResetPassword } from '@/lib/actions/users';
import type { UserDetailPayload } from '@/lib/actions/users';
import styles from '@/app/(dashboard)/admin/admin.module.css';
import modalStyles from '@/components/modals/modal.module.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  user: UserDetailPayload | null;
  onClose: () => void;
}

export default function ResetPasswordModal({ isOpen, user, onClose }: ResetPasswordModalProps) {
  const [resetPassText, setResetPassText] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResetPassText('');
      setResetError(null);
      setResetSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);

    try {
      const res = await adminResetPassword(user.id, resetPassText);

      if (res.success) {
        setResetSuccess(true);
        setTimeout(() => {
          onClose();
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
    <div className={modalStyles.backdrop} onClick={onClose}>
      <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <header className={modalStyles.header}>
          <h3>Reset Kata Sandi Pengguna</h3>
          <button onClick={onClose} className={modalStyles.closeBtn}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {resetSuccess ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
              <Check size={48} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-2)' }} />
              <p style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                Kata sandi untuk '{user.fullName}' berhasil diperbarui!
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
                Resetting password login untuk username: <strong style={{ color: 'var(--color-text)' }}>{user.username}</strong>
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
                <button type="button" className="btn btn-secondary" onClick={onClose}>Batalkan</button>
                <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                  {resetLoading ? 'Menyimpan...' : 'Ganti Kata Sandi'}
                </button>
              </footer>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
