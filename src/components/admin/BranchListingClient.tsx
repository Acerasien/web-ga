'use client';

import { useState, useEffect } from 'react';
import { 
  Building, 
  Plus, 
  Edit3, 
  MapPin, 
  Users, 
  Receipt, 
  Wallet, 
  AlertCircle,
  Search
} from 'lucide-react';
import { getAdminBranches, createBranch, updateBranch } from '@/lib/actions/branches';
import type { BranchAdminPayload } from '@/lib/actions/branches';
import { formatRupiah } from '@/lib/formatters';
import styles from '@/app/(dashboard)/admin/admin.module.css';
import modalStyles from '@/components/modals/modal.module.css';

export default function BranchListingClient() {
  const [branches, setBranches] = useState<BranchAdminPayload[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal controls
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchAdminPayload | null>(null);

  // Form states - Add Branch
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState<boolean>(false);

  // Form states - Edit Branch
  const [editName, setEditName] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<boolean>(false);

  // 1. Fetch branches details
  const loadBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminBranches();
      if (res.success && res.data) {
        setBranches(res.data);
      } else {
        setError(res.error || 'Gagal memuat daftar cabang.');
      }
    } catch (err) {
      console.error(err);
      setError('Koneksi terputus. Gagal memuat data cabang dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  // 2. Add Branch submit handler
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);

    try {
      const res = await createBranch({
        code: newCode,
        name: newName,
        address: newAddress
      });

      if (res.success) {
        setAddOpen(false);
        setNewCode('');
        setNewName('');
        setNewAddress('');
        loadBranches();
      } else {
        setAddError(res.error || 'Gagal membuat cabang baru.');
      }
    } catch (err) {
      console.error(err);
      setAddError('Koneksi terputus. Silakan coba kembali.');
    } finally {
      setAddLoading(false);
    }
  };

  // 3. Edit Branch Trigger
  const openEditModal = (branch: BranchAdminPayload) => {
    setSelectedBranch(branch);
    setEditName(branch.name);
    setEditAddress(branch.address || '');
    setEditIsActive(branch.isActive);
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await updateBranch(selectedBranch.id, {
        name: editName,
        address: editAddress,
        isActive: editIsActive
      });

      if (res.success) {
        setEditOpen(false);
        loadBranches();
      } else {
        setEditError(res.error || 'Gagal menyimpan perubahan.');
      }
    } catch (err) {
      console.error(err);
      setEditError('Koneksi terputus. Silakan coba kembali.');
    } finally {
      setEditLoading(false);
    }
  };

  // Filter list by client search
  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.headerRow}>
        <div>
          <h2>Pengaturan Kantor Cabang & Site</h2>
          <p className="text-muted" style={{ margin: 0 }}>Kelola kantor cabang operasional perusahaan, site penempatan staff, dan ringkasan pengeluaran.</p>
        </div>
        
        <button 
          type="button" 
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }} 
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <Plus size={16} />
          <span>Tambah Cabang</span>
        </button>
      </header>

      {/* Filter toolbar */}
      <section className={styles.toolbarCard} style={{ justifyContent: 'flex-start' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', maxWidth: '360px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Cari cabang berdasarkan nama atau kode..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>
      </section>

      {/* Main card grid showcasing branch analytics */}
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
        <section className={styles.cardGrid}>
          {filteredBranches.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-12)' }}>
              Tidak ada data kantor cabang penempatan ditemukan.
            </div>
          ) : (
            filteredBranches.map((b) => (
              <div key={b.id} className={styles.card}>
                {/* Card Header details */}
                <div className={styles.cardHeader}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                      <Building size={20} />
                    </div>
                    <div>
                      <h3 className={styles.cardTitle}>{b.name}</h3>
                      <div className={`${styles.statusIndicator} ${b.isActive ? styles.indicatorActive : styles.indicatorInactive}`} style={{ fontSize: '10px', marginTop: '2px' }}>
                        <span className={styles.indicatorDot} />
                        <span>{b.isActive ? 'Operasional Aktif' : 'Non-Aktif'}</span>
                      </div>
                    </div>
                  </div>
                  <span className={styles.cardCode}>{b.code}</span>
                </div>

                {/* Card Address Profile */}
                <div className={styles.cardBody}>
                  <p style={{ display: 'flex', gap: 'var(--space-1.5)', alignItems: 'flex-start', color: 'var(--color-text-light)', margin: '0 0 var(--space-2) 0' }}>
                    <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-text-muted)' }} />
                    <span>{b.address || 'Alamat kantor cabang belum dicantumkan.'}</span>
                  </p>

                  {/* Branch KPI counts aggregates */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} />
                      <span>Operator GA</span>
                    </span>
                    <span className={styles.statValue}>{b.userCount} Akun</span>
                  </div>

                  <div className={styles.statRow}>
                    <span className={styles.statLabel} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Receipt size={12} />
                      <span>Transaksi</span>
                    </span>
                    <span className={styles.statValue}>{b.transactionCount} Item</span>
                  </div>

                  <div className={styles.statRow} style={{ borderBottom: 'none' }}>
                    <span className={styles.statLabel} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Wallet size={12} />
                      <span>Pengeluaran</span>
                    </span>
                    <span className={styles.statValue} style={{ color: 'var(--color-primary)' }}>
                      {formatRupiah(b.totalSpending)}
                    </span>
                  </div>
                </div>

                {/* Card Actions controls */}
                <div className={styles.cardActions}>
                  <button 
                    type="button" 
                    onClick={() => openEditModal(b)} 
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit3 size={12} />
                    <span>Ubah Cabang</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* ============================================================
         ADD NEW BRANCH MODAL OVERLAY
         ============================================================ */}
      {addOpen && (
        <div className={modalStyles.backdrop} onClick={() => setAddOpen(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <header className={modalStyles.header}>
              <h3>Tambah Kantor Cabang Baru</h3>
              <button onClick={() => setAddOpen(false)} className={modalStyles.closeBtn}>&times;</button>
            </header>

            <form onSubmit={handleAddSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {addError && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{addError}</span>
                </div>
              )}

              {/* Branch Code field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="code-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Kode Cabang (e.g. BDG)</label>
                <input
                  id="code-input"
                  type="text"
                  placeholder="Maksimal 10 Karakter"
                  className={styles.searchInput}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>

              {/* Branch Name field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="name-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Nama Kantor Cabang</label>
                <input
                  id="name-input"
                  type="text"
                  placeholder="e.g. Bandung Site"
                  className={styles.searchInput}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              {/* Branch Address field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="address-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Alamat Cabang</label>
                <textarea
                  id="address-input"
                  placeholder="Tulis alamat lengkap penempatan cabang..."
                  className={styles.searchInput}
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  style={{ minHeight: '80px', padding: 'var(--space-2) var(--space-3)', resize: 'vertical' }}
                />
              </div>

              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Batalkan</button>
                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                  {addLoading ? 'Membuat...' : 'Buat Cabang'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
         EDIT BRANCH MODAL OVERLAY
         ============================================================ */}
      {editOpen && selectedBranch && (
        <div className={modalStyles.backdrop} onClick={() => setEditOpen(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <header className={modalStyles.header}>
              <h3>Ubah Detail Cabang</h3>
              <button onClick={() => setEditOpen(false)} className={modalStyles.closeBtn}>&times;</button>
            </header>

            <form onSubmit={handleEditSubmit} className={modalStyles.body} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {editError && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Immutable Code display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Kode Cabang</label>
                <input type="text" className={styles.searchInput} value={selectedBranch.code} disabled style={{ backgroundColor: 'var(--color-bg)', cursor: 'not-allowed' }} />
              </div>

              {/* Branch Name field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="editName-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Nama Kantor Cabang</label>
                <input
                  id="editName-input"
                  type="text"
                  className={styles.searchInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              {/* Branch Address field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="editAddress-input" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Alamat Cabang</label>
                <textarea
                  id="editAddress-input"
                  className={styles.searchInput}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  style={{ minHeight: '80px', padding: 'var(--space-2) var(--space-3)', resize: 'vertical' }}
                />
              </div>

              {/* Branch Status Switch toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Status Operasional Cabang</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>Batalkan</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Menyimpan...' : 'Simpan Detail'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
