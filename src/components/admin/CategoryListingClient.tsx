'use client';

import { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  FolderOpen, 
  ShieldAlert, 
  ListPlus, 
  Tag, 
  Settings, 
  AlertCircle,
  FolderDot
} from 'lucide-react';
import { getAdminCategories, addSubCategory, deleteSubCategory } from '@/lib/actions/categoryAdmin';
import type { CategoryAdminPayload, SubCategoryAdminPayload } from '@/lib/actions/categoryAdmin';
import styles from '@/app/(dashboard)/admin/admin.module.css';

export default function CategoryListingClient() {
  const [categories, setCategories] = useState<CategoryAdminPayload[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryAdminPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form states - Add Subcategory
  const [newSubName, setNewSubName] = useState<string>('');
  const [subActionError, setSubActionError] = useState<string | null>(null);
  const [subActionLoading, setSubActionLoading] = useState<boolean>(false);

  // 1. Fetch Categories configurations
  const loadCategories = async (selectIdToRestore?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminCategories();
      if (res.success && res.data) {
        setCategories(res.data);
        
        // Restore active category selection if possible, otherwise default to first item
        if (res.data.length > 0) {
          const matched = selectIdToRestore 
            ? res.data.find(c => c.id === selectIdToRestore) 
            : res.data[0];
          setSelectedCategory(matched || res.data[0]);
        }
      } else {
        setError(res.error || 'Gagal memuat konfigurasi kategori.');
      }
    } catch (err) {
      console.error(err);
      setError('Koneksi terputus. Gagal memuat kategori dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // 2. Add subcategory submission handler
  const handleAddSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    setSubActionError(null);
    setSubActionLoading(true);

    try {
      const res = await addSubCategory(selectedCategory.id, newSubName);
      if (res.success && res.data) {
        setNewSubName('');
        // Reload all categories and maintain selection
        await loadCategories(selectedCategory.id);
      } else {
        setSubActionError(res.error || 'Gagal menambahkan sub-kategori.');
      }
    } catch (err) {
      console.error(err);
      setSubActionError('Koneksi terputus. Silakan coba kembali.');
    } finally {
      setSubActionLoading(false);
    }
  };

  // 3. Delete subcategory handler (Verifies relational safety locks)
  const handleDeleteSub = async (sub: SubCategoryAdminPayload) => {
    if (!selectedCategory) return;
    
    const confirmMessage = `Apakah Anda yakin ingin menghapus sub-kategori '${sub.name}'?`;
    if (!window.confirm(confirmMessage)) return;

    setSubActionError(null);

    try {
      const res = await deleteSubCategory(sub.id);
      if (res.success) {
        // Reload list and restore selected
        await loadCategories(selectedCategory.id);
      } else {
        setSubActionError(res.error || 'Gagal menghapus sub-kategori.');
      }
    } catch (err) {
      console.error(err);
      setSubActionError('Koneksi terputus. Gagal menghapus.');
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.headerRow}>
        <div>
          <h2>Pengaturan Kategori & Sub-Kategori</h2>
          <p className="text-muted" style={{ margin: 0 }}>Kelola master kategori anggaran belanja General Affairs, daftar sub-kategori, dan konfigurasi isian formulir dinamis.</p>
        </div>
      </header>

      {/* Main layout: Responsive Split Pane Dashboard (Left Table + Right Sidebar Details) */}
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
        <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)', alignItems: 'flex-start' }} className="grid-split-md">
          <style dangerouslySetInnerHTML={{ __html: `
            @media (min-width: 1024px) {
              .grid-split-md {
                grid-template-columns: 1.4fr 1fr !important;
              }
            }
          ` }} />

          {/* ============================================================
             LEFT PANE: Category Selection Listing Table
             ============================================================ */}
          <div className={styles.tableWrapper}>
            <table className={`${styles.table} ${styles.denseTable}`}>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Kode</th>
                  <th>Order</th>
                  <th style={{ textAlign: 'center' }}>Sistem</th>
                  <th style={{ textAlign: 'right' }}>Sub-Kategori</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const isActive = selectedCategory?.id === c.id;
                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => {
                        setSelectedCategory(c);
                        setSubActionError(null);
                        setNewSubName('');
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.04)' : undefined,
                        borderLeft: isActive ? '4px solid var(--color-primary)' : '4px solid transparent'
                      }}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.code}</td>
                      <td>{c.sortOrder}</td>
                      <td style={{ textAlign: 'center' }}>
                        {c.isSystem ? (
                          <span className={styles.badge} style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>Ya</span>
                        ) : (
                          <span className={styles.badge} style={{ backgroundColor: 'rgba(100, 116, 139, 0.05)', color: 'var(--color-text-muted)', border: '1px solid rgba(100, 116, 139, 0.1)' }}>Kustom</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, paddingRight: 'var(--space-6)' }}>
                        {c.subCategories.length} Item
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ============================================================
             RIGHT PANE: Dynamic details container (Active Category details)
             ============================================================ */}
          {selectedCategory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              {/* Category sub-listing and inline creator card */}
              <div className={styles.card} style={{ gap: 'var(--space-4)' }}>
                <div className={styles.cardHeader} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2.5)', alignItems: 'center' }}>
                    <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                      <FolderOpen size={16} />
                    </div>
                    <div>
                      <h3 className={styles.cardTitle}>{selectedCategory.name}</h3>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Mempunyai {selectedCategory.subCategories.length} Sub-Kategori</span>
                    </div>
                  </div>
                  <span className={styles.cardCode}>{selectedCategory.code}</span>
                </div>

                {/* Subcategory interactive list */}
                <div className={styles.cardBody} style={{ gap: 'var(--space-2)' }}>
                  {subActionError && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', width: '100%', marginBottom: 'var(--space-2)' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{subActionError}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1.5)', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                    {selectedCategory.subCategories.length === 0 ? (
                      <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: 'var(--space-4) 0', textAlign: 'center' }}>
                        Belum ada sub-kategori terdaftar. Tambahkan sub-kategori di bawah ini.
                      </div>
                    ) : (
                      selectedCategory.subCategories.map((sub) => (
                        <div 
                          key={sub.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: 'var(--space-2) var(--space-3)', 
                            backgroundColor: 'var(--color-bg)', 
                            border: '1px solid var(--color-border)', 
                            borderRadius: 'var(--radius-md)' 
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <FolderDot size={12} style={{ color: 'var(--color-text-muted)' }} />
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}>{sub.name}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-light)' }}>
                              {sub.transactionCount} Transaksi
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSub(sub)}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--color-danger)', 
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Hapus Sub-Kategori"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Inline Form to add Subcategory */}
                  <form onSubmit={handleAddSubSubmit} style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                      <ListPlus size={14} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)' }} />
                      <input
                        type="text"
                        placeholder="e.g. Kertas HVS A4"
                        className={styles.searchInput}
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        style={{ paddingLeft: '32px', width: '100%', minHeight: '34px', fontSize: 'var(--text-xs)' }}
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={subActionLoading}
                      style={{ height: '34px', padding: '0 var(--space-3)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}
                    >
                      <Plus size={12} />
                      <span>Tambah</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* dynamic fieldsConfig JSON viewer card */}
              <div className={styles.card}>
                <div className={styles.cardHeader} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2.5)', alignItems: 'center' }}>
                    <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                      <Settings size={16} />
                    </div>
                    <div>
                      <h3 className={styles.cardTitle}>Struktur Isian Formulir Dinamis</h3>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Membaca schema JSONB fields_config</span>
                    </div>
                  </div>
                </div>

                <div className={styles.cardBody} style={{ padding: 0 }}>
                  {selectedCategory.fieldsConfig ? (
                    <pre 
                      style={{ 
                        margin: 0, 
                        padding: 'var(--space-4)', 
                        backgroundColor: '#1E293B', 
                        color: '#34D399', 
                        borderRadius: 'var(--radius-md)', 
                        fontFamily: 'monospace', 
                        fontSize: '11px',
                        overflowX: 'auto',
                        lineHeight: '1.5'
                      }}
                    >
                      {JSON.stringify(selectedCategory.fieldsConfig, null, 2)}
                    </pre>
                  ) : (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      <ShieldAlert size={14} style={{ color: 'var(--color-accent)' }} />
                      <span>Kategori ini menggunakan formulir standard (Tanpa isian custom).</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </section>
      )}
    </div>
  );
}
