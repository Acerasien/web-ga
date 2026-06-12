'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon,
  HelpCircle,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Wrench
} from 'lucide-react';
import { getAssets } from '@/lib/actions/assets';
import type { AssetWithRelations, AssetFilters, BranchAssetStats } from '@/lib/actions/assets';
import type { Branch, AssetStatus } from '@prisma/client';
import { type AuthUser, ASSET_CATEGORIES } from '@/types';
import AssetDetailModal from '@/components/modals/AssetDetailModal';
import AssetImportModal from '@/components/modals/AssetImportModal';
import styles from '@/app/(dashboard)/inventaris/inventaris.module.css';


interface InventoryContainerProps {
  user: AuthUser;
  branches: Branch[];
  branchStats?: BranchAssetStats[];
}

export default function InventoryContainer({ user, branches, branchStats = [] }: InventoryContainerProps) {
  // Filter States
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Sorting States
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Advanced Filters toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Queries States
  const [assets, setAssets] = useState<AssetWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [selectedAsset, setSelectedAsset] = useState<AssetWithRelations | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [createMode, setCreateMode] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);



  // Active filters count
  const activeFiltersCount = [
    branchId,
    status,
    category,
  ].filter(Boolean).length;

  // 1. Debounce Search queries
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 450);

    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when other filters change
  const handleFilterChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  // 2. Query assets from Server Action
  useEffect(() => {
    const loadAssets = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAssets({
          search: debouncedSearch,
          branchId: branchId ? Number(branchId) : undefined,
          status: (status || undefined) as AssetStatus | undefined,
          category: category || undefined,
          page,
          limit: 10,
          sortBy,
          sortOrder,
        });

        if (result.success && result.data) {
          setAssets(result.data.assets);
          setTotalCount(result.data.totalCount);
          setTotalPages(result.data.totalPages);


        } else {
          setError(result.error || 'Gagal memuat daftar inventaris.');
        }
      } catch (err) {
        console.error('Fetch assets client error:', err);
        setError('Koneksi terputus. Gagal menghubungi server.');
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [debouncedSearch, branchId, status, category, page, refreshTrigger, sortBy, sortOrder]);

  // Handle header sorting click
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setBranchId('');
    setStatus('');
    setCategory('');
    setPage(1);
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const handleRowClick = (asset: AssetWithRelations) => {
    setSelectedAsset(asset);
    setCreateMode(false);
    setDetailModalOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedAsset(null);
    setCreateMode(true);
    setDetailModalOpen(true);
  };

  const getStatusBadge = (assetStatus: AssetStatus) => {
    switch (assetStatus) {
      case 'AKTIF':
        return <span className={`${styles.statusBadge} ${styles.badgeActive}`}>Aktif</span>;
      case 'RUSAK':
        return <span className={`${styles.statusBadge} ${styles.badgeBroken}`}>Rusak</span>;
      case 'DIPERBAIKI':
        return <span className={`${styles.statusBadge} ${styles.badgeServicing}`}>Servis</span>;
      case 'HILANG':
        return <span className={`${styles.statusBadge} ${styles.badgeLost}`}>Hilang</span>;
      default:
        return <span className={styles.statusBadge}>{assetStatus}</span>;
    }
  };

  // Calculate aggregate stats for Superadmin Overview
  const totalAssetsSum = branchStats?.reduce((acc, curr) => acc + curr.totalCount, 0) || 0;
  const totalAktifSum = branchStats?.reduce((acc, curr) => acc + curr.aktifCount, 0) || 0;
  const totalRusakSum = branchStats?.reduce((acc, curr) => acc + curr.rusakCount, 0) || 0;
  const totalServisSum = branchStats?.reduce((acc, curr) => acc + curr.diperbaikiCount, 0) || 0;
  const totalHilangSum = branchStats?.reduce((acc, curr) => acc + curr.hilangCount, 0) || 0;

  const handleBranchCardClick = (id: number) => {
    setBranchId(String(id));
    setPage(1);
  };

  const isSuperadminDeck = user.role === 'SUPERADMIN' && branchId === '' && search === '';

  return (
    <div className={styles.container}>
      {/* Header Block */}
      <header className={styles.headerRow} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2>Inventaris & Aset</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            {isSuperadminDeck 
              ? 'Ringkasan inventaris dan aset operasional di seluruh cabang.'
              : 'Mencatat, melacak, dan mengalokasikan aset operasional General Affairs.'}
          </p>
        </div>
        {user.role !== 'VIEWER' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: '44px' }}
            >
              <Upload size={18} />
              <span>Import Aset</span>
            </button>
            <button
              type="button"
              onClick={handleCreateClick}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: '44px' }}
            >
              <Plus size={18} />
              <span>Tambah Aset</span>
            </button>
          </div>
        )}
      </header>

      {isSuperadminDeck ? (
        <>
          {/* Superadmin Ringkasan KPI Cards */}
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-2)'
            }}
          >
            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-icon primary" style={{ width: '40px', height: '40px' }}>
                <Building2 size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label" style={{ fontSize: 'var(--text-xs)' }}>Total Semua Aset</p>
                <h3 className="stat-value" style={{ fontSize: 'var(--text-xl)' }}>{totalAssetsSum}</h3>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-icon success" style={{ width: '40px', height: '40px' }}>
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label" style={{ fontSize: 'var(--text-xs)' }}>Aktif / Bagus</p>
                <h3 className="stat-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-success)' }}>{totalAktifSum}</h3>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-icon info" style={{ width: '40px', height: '40px' }}>
                <Wrench size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label" style={{ fontSize: 'var(--text-xs)' }}>Dalam Servis</p>
                <h3 className="stat-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-primary)' }}>{totalServisSum}</h3>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-icon danger" style={{ width: '40px', height: '40px' }}>
                <AlertTriangle size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label" style={{ fontSize: 'var(--text-xs)' }}>Rusak / Rusak Berat</p>
                <h3 className="stat-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-danger)' }}>{totalRusakSum}</h3>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stat-icon" style={{ width: '40px', height: '40px', backgroundColor: 'rgba(100, 116, 139, 0.1)', color: 'var(--color-text-muted)' }}>
                <HelpCircle size={20} />
              </div>
              <div className="stat-content">
                <p className="stat-label" style={{ fontSize: 'var(--text-xs)' }}>Aset Hilang</p>
                <h3 className="stat-value" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-muted)' }}>{totalHilangSum}</h3>
              </div>
            </div>
          </section>

          {/* Branch cards grid */}
          <section className={styles.branchGrid}>
            {branchStats.map((b) => (
              <div 
                key={b.branchId} 
                className={styles.branchCard}
                onClick={() => handleBranchCardClick(b.branchId)}
              >
                <div className={styles.branchCardHeader}>
                  <div className={styles.branchInfo}>
                    <h3>{b.name}</h3>
                  </div>
                  <span className={styles.branchCodeBadge}>{b.code}</span>
                </div>

                <div className={styles.branchStatsGrid}>
                  <div className={`${styles.branchStatItem} ${styles.aktif}`}>
                    <span className={styles.statCount}>{b.aktifCount}</span>
                    <span className={styles.statLabel}>Aktif</span>
                  </div>
                  <div className={`${styles.branchStatItem} ${styles.servis}`}>
                    <span className={styles.statCount}>{b.diperbaikiCount}</span>
                    <span className={styles.statLabel}>Servis</span>
                  </div>
                  <div className={`${styles.branchStatItem} ${styles.rusak}`}>
                    <span className={styles.statCount}>{b.rusakCount}</span>
                    <span className={styles.statLabel}>Rusak</span>
                  </div>
                  <div className={`${styles.branchStatItem} ${styles.hilang}`}>
                    <span className={styles.statCount}>{b.hilangCount}</span>
                    <span className={styles.statLabel}>Hilang</span>
                  </div>
                </div>

                <div className={styles.branchCardFooter}>
                  <span>Total: {b.totalCount} Aset</span>
                  <span className={styles.branchFooterArrow} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Detail Aset</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          {/* Back to All Branches for Superadmin */}
          {user.role === 'SUPERADMIN' && (branchId !== '' || search !== '') && (
            <div className={styles.backButtonRow}>
              <button 
                type="button" 
                onClick={handleResetFilters} 
                className={styles.backBtn}
              >
                <ArrowLeft size={16} />
                <span>Kembali ke Semua Cabang</span>
              </button>
            </div>
          )}

          {/* Filter Card */}
          <section className={styles.filterCard}>
            {/* Modern Search Row */}
            <div className={styles.toolbarRow}>
              <div className={styles.searchWrapper}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Cari nama aset, kode tag, kategori, PIC holder..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Search size={18} style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.6 }} />
              </div>

              <div className={styles.actionButtons}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(prev => !prev)}
                  className={`${styles.toggleBtn} ${showAdvancedFilters ? styles.toggleActive : ''}`}
                  title="Tampilkan Penyaringan Lanjutan"
                >
                  <Filter size={16} />
                  <span>Filter Lanjutan</span>
                  {activeFiltersCount > 0 && (
                    <span className={styles.badge}>{activeFiltersCount}</span>
                  )}
                </button>

                {(search || activeFiltersCount > 0) && (
                  <button 
                    type="button" 
                    onClick={handleResetFilters} 
                    className={styles.resetBtn}
                    title="Reset Semua Filter"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className={styles.advancedPanel}>
                <div className={styles.advancedGrid}>
                  {/* Branch Isolation Filter */}
                  {user.role === 'SUPERADMIN' ? (
                    <div className={styles.filterGroup}>
                      <label htmlFor="branch-filter" className={styles.label}>Cabang</label>
                      <select
                        id="branch-filter"
                        className={styles.input}
                        value={branchId}
                        onChange={(e) => handleFilterChange(setBranchId, e.target.value)}
                      >
                        <option value="">Semua Cabang</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={styles.filterGroup}>
                      <label className={styles.label}>Cabang Terkunci</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={user.branchId ? branches.find(b => b.id === user.branchId)?.name || 'Cabang Terdaftar' : '-'}
                        disabled
                      />
                    </div>
                  )}

                  {/* Status Filter */}
                  <div className={styles.filterGroup}>
                    <label htmlFor="status-filter" className={styles.label}>Kondisi / Status</label>
                    <select
                      id="status-filter"
                      className={styles.input}
                      value={status}
                      onChange={(e) => handleFilterChange(setStatus, e.target.value)}
                    >
                      <option value="">Semua Kondisi</option>
                      <option value="AKTIF">Aktif (Bagus)</option>
                      <option value="RUSAK">Rusak</option>
                      <option value="DIPERBAIKI">Dalam Servis</option>
                      <option value="HILANG">Hilang</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className={styles.filterGroup}>
                    <label htmlFor="category-filter" className={styles.label}>Kategori</label>
                    <select
                      id="category-filter"
                      className={styles.input}
                      value={category}
                      onChange={(e) => handleFilterChange(setCategory, e.target.value)}
                    >
                      <option value="">Semua Kategori</option>
                      {ASSET_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Main Table Listing */}
          <section className={styles.tableCard}>
            {loading ? (
              <div className={styles.loadingCover}>
                <div className={styles.spinner}></div>
              </div>
            ) : error ? (
              <div className={styles.emptyState}>
                <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</p>
                <button 
                  type="button" 
                  onClick={() => setRefreshTrigger(prev => prev + 1)}
                  className="btn btn-secondary"
                  style={{ marginTop: 'var(--space-2)', minHeight: '38px' }}
                >
                  Coba Lagi
                </button>
              </div>
            ) : assets.length === 0 ? (
              <div className={styles.emptyState}>
                <HelpCircle size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', opacity: 0.5 }} />
                <h3>Tidak Ada Data Aset</h3>
                <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto var(--space-4) auto' }}>
                  Tidak ditemukan inventaris yang sesuai dengan filter atau pencarian Anda.
                </p>
                {user.role !== 'VIEWER' && (
                  <button 
                    type="button" 
                    onClick={handleCreateClick}
                    className="btn btn-primary"
                    style={{ minHeight: '44px' }}
                  >
                    Mulai Catat Baru
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th} style={{ width: '60px', textAlign: 'center' }}>Foto</th>
                        <th className={styles.th} style={{ cursor: 'pointer' }} onClick={() => handleSort('assetTag')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Kode Tag</span>
                            <ArrowUpDown size={14} />
                          </div>
                        </th>
                        <th className={styles.th} style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Nama Aset</span>
                            <ArrowUpDown size={14} />
                          </div>
                        </th>
                        <th className={styles.th} style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Kategori</span>
                            <ArrowUpDown size={14} />
                          </div>
                        </th>
                        <th className={styles.th}>Brand / Model</th>
                        <th className={styles.th}>Lokasi Detail</th>
                        <th className={styles.th}>PIC</th>
                        <th className={styles.th} style={{ cursor: 'pointer', width: '100px' }} onClick={() => handleSort('status')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Status</span>
                            <ArrowUpDown size={14} />
                          </div>
                        </th>
                        {user.role === 'SUPERADMIN' && (
                          <th className={styles.th} style={{ cursor: 'pointer' }} onClick={() => handleSort('branchId')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>Cabang</span>
                              <ArrowUpDown size={14} />
                            </div>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => (
                        <tr 
                          key={asset.id} 
                          className={styles.tr}
                          onClick={() => handleRowClick(asset)}
                        >
                          <td className={styles.td} style={{ textAlign: 'center' }}>
                            <div className={styles.assetPhotoCell}>
                              {asset.imagePath ? (
                                <img 
                                  src={asset.imagePath} 
                                  alt={asset.name} 
                                  className={styles.assetPhotoThumb}
                                  onError={(e) => {
                                    // Fallback image check
                                    (e.target as HTMLImageElement).src = '';
                                  }}
                                />
                              ) : (
                                <ImageIcon size={18} className={styles.assetPhotoPlaceholder} />
                              )}
                            </div>
                          </td>
                          <td className={`${styles.td} ${styles.tdBold}`}>{asset.assetTag || '-'}</td>
                          <td className={styles.td} style={{ fontWeight: 600 }}>{asset.name}</td>
                          <td className={styles.td}>{asset.category}</td>
                          <td className={styles.td}>{asset.brandModel || '-'}</td>
                          <td className={styles.td}>{asset.locationDetail || '-'}</td>
                          <td className={styles.td}>{asset.pic || '-'}</td>
                          <td className={styles.td}>{getStatusBadge(asset.status)}</td>
                          {user.role === 'SUPERADMIN' && (
                            <td className={styles.td}>{asset.branch?.name || '-'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                <div className={styles.paginationRow}>
                  <div className={styles.paginationInfo}>
                    Menampilkan <b>{Math.min(totalCount, (page - 1) * 10 + 1)}</b> hingga <b>{Math.min(totalCount, page * 10)}</b> dari <b>{totalCount}</b> aset
                  </div>
                  <div className={styles.paginationActions}>
                    <button
                      type="button"
                      className={`${styles.navBtn} ${page === 1 ? styles.btnDisabled : ''}`}
                      onClick={() => page > 1 && setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft size={16} />
                      <span>Sebelumnya</span>
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`${styles.pageBtn} ${page === p ? styles.btnActive : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`${styles.navBtn} ${page === totalPages ? styles.btnDisabled : ''}`}
                      onClick={() => page < totalPages && setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      <span>Berikutnya</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* Asset Detail, Create, and Edit Modal */}
      {detailModalOpen && (
        <AssetDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          asset={selectedAsset}
          user={user}
          branches={branches}
          createMode={createMode}
          onSaveSuccess={() => {
            setDetailModalOpen(false);
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {importModalOpen && (
        <AssetImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          user={user}
          branches={branches}
          onImportSuccess={() => {
            setImportModalOpen(false);
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
