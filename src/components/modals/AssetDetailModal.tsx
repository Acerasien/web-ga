'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Edit, 
  Trash2, 
  Save, 
  Undo2, 
  Upload, 
  ImageIcon, 
  Loader2, 
  AlertCircle,
  Package,
  Calendar,
  User as UserIcon,
  MapPin,
  Tag
} from 'lucide-react';
import { createAsset, updateAsset, archiveAsset } from '@/lib/actions/assets';
import type { AssetWithRelations } from '@/lib/actions/assets';
import type { Branch, AssetStatus } from '@prisma/client';
import { type AuthUser, ASSET_CATEGORIES } from '@/types';
import styles from './modal.module.css';
import inputStyles from '@/app/(dashboard)/transaksi/input/input.module.css';

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetWithRelations | null;
  user: AuthUser;
  branches: Branch[];
  createMode: boolean;
  onSaveSuccess: () => void;
}

export default function AssetDetailModal({
  isOpen,
  onClose,
  asset,
  user,
  branches,
  createMode: initialCreateMode,
  onSaveSuccess,
}: AssetDetailModalProps) {
  const [isEditing, setIsEditing] = useState<boolean>(initialCreateMode);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [assetTag, setAssetTag] = useState<string>('');
  const [brandModel, setBrandModel] = useState<string>('');
  const [pic, setPic] = useState<string>('');
  const [locationDetail, setLocationDetail] = useState<string>('');
  const [status, setStatus] = useState<AssetStatus>('AKTIF');
  const [notes, setNotes] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [imagePath, setImagePath] = useState<string>('');

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial asset values
  useEffect(() => {
    if (asset) {
      setName(asset.name);
      setCategory(asset.category);
      setAssetTag(asset.assetTag || '');
      setBrandModel(asset.brandModel || '');
      setPic(asset.pic || '');
      setLocationDetail(asset.locationDetail || '');
      setStatus(asset.status);
      setNotes(asset.notes || '');
      setBranchId(String(asset.branchId));
      setImagePath(asset.imagePath || '');
      setIsEditing(false);
    } else {
      setName('');
      setCategory('');
      setAssetTag('');
      setBrandModel('');
      setPic('');
      setLocationDetail('');
      setStatus('AKTIF');
      setNotes('');
      setBranchId(user.branchId ? String(user.branchId) : '');
      setImagePath('');
      setIsEditing(true);
    }
    setError(null);
    setIsDeleting(false);
  }, [asset, initialCreateMode, isOpen]);

  if (!isOpen) return null;

  // File Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setImagePath(resData.imagePath);
      } else {
        setUploadError(resData.error || 'Gagal mengunggah foto.');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      setUploadError('Gagal mengunggah foto. Koneksi terputus.');
    } finally {
      setUploadingImage(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!name.trim()) {
      setError('Nama aset wajib diisi.');
      return;
    }
    if (!category.trim()) {
      setError('Kategori aset wajib diisi.');
      return;
    }
    if (user.role === 'SUPERADMIN' && !branchId) {
      setError('Pilih cabang penanggung jawab.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = {
      name: name.trim(),
      category: category.trim(),
      assetTag: assetTag.trim() || null,
      brandModel: brandModel.trim() || null,
      pic: pic.trim() || null,
      locationDetail: locationDetail.trim() || null,
      status,
      notes: notes.trim() || null,
      branchId: branchId ? Number(branchId) : undefined,
      imagePath: imagePath || null,
    };

    try {
      let result;
      if (asset) {
        result = await updateAsset(asset.id, formData);
      } else {
        result = await createAsset(formData);
      }

      if (result.success) {
        onSaveSuccess();
      } else {
        setError(result.error || 'Gagal menyimpan data aset.');
      }
    } catch (err) {
      console.error('Save asset server action error:', err);
      setError('Koneksi terputus. Gagal menyimpan data ke server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!asset || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await archiveAsset(asset.id);
      if (result.success) {
        onSaveSuccess();
      } else {
        setError(result.error || 'Gagal menghapus aset.');
        setIsDeleting(false);
      }
    } catch (err) {
      console.error('Archive asset action error:', err);
      setError('Koneksi terputus. Gagal melakukan aksi hapus.');
      setIsDeleting(false);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (s: AssetStatus) => {
    switch (s) {
      case 'AKTIF': return 'Aktif (Bagus)';
      case 'RUSAK': return 'Rusak';
      case 'DIPERBAIKI': return 'Dalam Servis';
      case 'HILANG': return 'Hilang';
      default: return s;
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header Block */}
        <header className={styles.header}>
          <h3>
            {initialCreateMode ? 'Tambah Aset Baru' : isEditing ? 'Edit Detail Aset' : 'Detail Informasi Aset'}
          </h3>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Tutup modal">
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Form/View Body */}
        <div className={styles.body}>
          {error && (
            <div className={styles.errorMessage} style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.08)', margin: '0 0 var(--space-2) 0' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isDeleting ? (
            /* Delete Confirmation Mode */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8) 0', textAlign: 'center', gap: 'var(--space-4)' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={30} />
              </div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-lg)' }}>Apakah Anda Yakin?</h3>
              <p className="text-muted" style={{ maxWidth: '400px', margin: 0, fontSize: 'var(--text-sm)' }}>
                Aset <b>{asset?.name}</b> akan diarsipkan dan tidak akan muncul lagi di daftar inventaris aktif. Tindakan ini aman untuk rekap audit.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%', maxWidth: '300px', marginTop: 'var(--space-2)' }}>
                <button type="button" onClick={() => setIsDeleting(false)} className="btn btn-secondary" style={{ flex: 1, minHeight: '44px' }} disabled={loading}>
                  Batal
                </button>
                <button type="button" onClick={handleDeleteConfirm} className="btn btn-primary" style={{ flex: 1, minHeight: '44px', backgroundColor: 'var(--color-danger)', border: 'none' }} disabled={loading}>
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          ) : isEditing ? (
            /* Edit / Create Form Mode */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className={inputStyles.formGrid}>
                {/* Name Input */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="assetName" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>Nama Aset</label>
                  <input
                    id="assetName"
                    type="text"
                    required
                    className={inputStyles.input}
                    placeholder="Contoh: Laptop ThinkPad L14"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Category Input */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="assetCategory" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>Kategori</label>
                  <select
                    id="assetCategory"
                    required
                    className={inputStyles.input}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Pilih Kategori</option>
                    {ASSET_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Asset Tag Code */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="assetTag" className={inputStyles.label}>Kode Tag Aset (Optional)</label>
                  <input
                    id="assetTag"
                    type="text"
                    className={inputStyles.input}
                    placeholder="Contoh: AST-HO-2026-001"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                  />
                </div>

                {/* Brand / Model */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="brandModel" className={inputStyles.label}>Brand / Model (Optional)</label>
                  <input
                    id="brandModel"
                    type="text"
                    className={inputStyles.input}
                    placeholder="Contoh: Lenovo L14 Gen 2"
                    value={brandModel}
                    onChange={(e) => setBrandModel(e.target.value)}
                  />
                </div>

                {/* PIC Holder */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="pic" className={inputStyles.label}>PIC / Pemegang Saat Ini</label>
                  <input
                    id="pic"
                    type="text"
                    className={inputStyles.input}
                    placeholder="Nama penanggung jawab"
                    value={pic}
                    onChange={(e) => setPic(e.target.value)}
                  />
                </div>

                {/* Location Detail */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="locationDetail" className={inputStyles.label}>Detail Lokasi (Mess/Office/Site)</label>
                  <input
                    id="locationDetail"
                    type="text"
                    className={inputStyles.input}
                    placeholder="Contoh: Ruang Rapat Lt. 2 HO"
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                  />
                </div>

                {/* Status Selection */}
                <div className={inputStyles.formGroup}>
                  <label htmlFor="status" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>Status Kondisi</label>
                  <select
                    id="status"
                    className={inputStyles.input}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  >
                    <option value="AKTIF">Aktif (Bagus)</option>
                    <option value="RUSAK">Rusak</option>
                    <option value="DIPERBAIKI">Dalam Servis / Perbaikan</option>
                    <option value="HILANG">Hilang</option>
                  </select>
                </div>

                {/* Branch Selection (Superadmin only) */}
                {user.role === 'SUPERADMIN' ? (
                  <div className={inputStyles.formGroup}>
                    <label htmlFor="branchId" className={`${inputStyles.label} ${inputStyles.labelRequired}`}>Cabang Penanggung Jawab</label>
                    <select
                      id="branchId"
                      className={inputStyles.input}
                      required
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                    >
                      <option value="">Pilih Cabang</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className={inputStyles.formGroup}>
                    <label htmlFor="branchId" className={inputStyles.label}>Cabang</label>
                    <input
                      id="branchId"
                      type="text"
                      className={inputStyles.input}
                      value={branches.find(b => b.id === Number(branchId))?.name || '-'}
                      disabled
                    />
                  </div>
                )}
              </div>

              {/* Photo Image Uploader */}
              <div className={`${styles.receiptContainer} ${inputStyles.fullWidth}`}>
                <label className={inputStyles.label}>Foto Aset (Optional)</label>
                <div className={styles.receiptFrame} style={{ minHeight: '160px' }}>
                  {imagePath ? (
                    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <img src={imagePath} alt="Preview Foto Aset" className={styles.receiptImg} style={{ maxHeight: '200px' }} />
                      <button
                        type="button"
                        onClick={() => setImagePath('')}
                        style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                        title="Hapus Foto"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : uploadingImage ? (
                    <div className={styles.pdfBox}>
                      <div className={styles.spinner}></div>
                      <span className={styles.uploaderText}>Mengunggah foto...</span>
                    </div>
                  ) : (
                    <div className={styles.uploaderContainer} onClick={triggerFileInput} style={{ width: '100%', minHeight: '120px' }}>
                      <Upload size={24} className={styles.uploaderIcon} />
                      <span className={styles.uploaderText}>
                        Tarik gambar ke sini, atau <span className={styles.uploaderLink}>Pilih File</span>
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Maksimal 5MB (PNG, JPG, JPEG)</span>
                      {uploadError && <span style={{ color: 'var(--color-danger)', fontSize: '11px', fontWeight: 600 }}>{uploadError}</span>}
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/png, image/jpeg, image/jpg"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Notes Area */}
              <div className={`${inputStyles.formGroup} ${inputStyles.fullWidth}`}>
                <label htmlFor="notes" className={inputStyles.label}>Catatan Tambahan</label>
                <textarea
                  id="notes"
                  className={`${inputStyles.input} ${inputStyles.textarea}`}
                  placeholder="Keterangan spesifikasi, riwayat perbaikan, dsb."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Form Action Footer */}
              <div className={styles.footer} style={{ borderTop: 'none', padding: 'var(--space-2) 0 0 0' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (initialCreateMode) {
                      onClose();
                    } else {
                      setIsEditing(false);
                    }
                  }}
                  className="btn btn-secondary"
                  disabled={loading}
                  style={{ minHeight: '40px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || uploadingImage}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px' }}
                >
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                  <span>{asset ? 'Simpan Perubahan' : 'Catat Aset'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* View Details Mode */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* Photo Display Frame */}
              {imagePath ? (
                <div style={{ width: '100%', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', overflow: 'hidden', display: 'flex', justifyContent: 'center', maxHeight: '280px' }}>
                  <img 
                    src={imagePath} 
                    alt={name} 
                    style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} 
                  />
                </div>
              ) : (
                <div style={{ width: '100%', height: '140px', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)', backgroundColor: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                  <ImageIcon size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Tidak ada foto aset terlampir</span>
                </div>
              )}

              {/* Fields Key-Values Grid */}
              <div>
                <h4 className={styles.sectionTitle}>Spesifikasi Aset</h4>
                <div className={styles.grid}>
                  <div className={styles.item}>
                    <span className={styles.label}>Nama Aset</span>
                    <span className={styles.value} style={{ fontSize: 'var(--text-base)' }}>{name}</span>
                  </div>

                  <div className={styles.item}>
                    <span className={styles.label}>Kategori</span>
                    <span className={styles.value}>{category}</span>
                  </div>

                  <div className={styles.item}>
                    <span className={styles.label}>Kode Tag Aset</span>
                    <span className={styles.value} style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                      <Tag size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      {assetTag || '-'}
                    </span>
                  </div>

                  <div className={styles.item}>
                    <span className={styles.label}>Brand / Model</span>
                    <span className={styles.value}>{brandModel || '-'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={styles.sectionTitle}>Alokasi & Kondisi</h4>
                <div className={styles.grid}>
                  <div className={styles.item}>
                    <span className={styles.label}>Kondisi</span>
                    <span style={{ marginTop: '2px' }}>
                      {asset?.status === 'AKTIF' && <span className={`${styles.statusBadge} ${styles.badgeActive}`}>Aktif (Bagus)</span>}
                      {asset?.status === 'RUSAK' && <span className={`${styles.statusBadge} ${styles.badgeBroken}`}>Rusak</span>}
                      {asset?.status === 'DIPERBAIKI' && <span className={`${styles.statusBadge} ${styles.badgeServicing}`}>Dalam Servis</span>}
                      {asset?.status === 'HILANG' && <span className={`${styles.statusBadge} ${styles.badgeLost}`}>Hilang</span>}
                    </span>
                  </div>

                  <div className={styles.item}>
                    <span className={styles.label}>PIC Pemegang</span>
                    <span className={styles.value}>
                      <UserIcon size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      {pic || '-'}
                    </span>
                  </div>

                  <div className={styles.item}>
                    <span className={styles.label}>Detail Lokasi</span>
                    <span className={styles.value}>
                      <MapPin size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      {locationDetail || '-'}
                    </span>
                  </div>

                  <div className={styles.item}>
                    <span className={styles.label}>Cabang</span>
                    <span className={styles.value}>{asset?.branch?.name || '-'}</span>
                  </div>
                </div>
              </div>

              {notes && (
                <div>
                  <h4 className={styles.sectionTitle}>Catatan Tambahan</h4>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', margin: 0, padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                    {notes}
                  </p>
                </div>
              )}

              {/* History Audit detail */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  <span>Daftar: {asset ? new Date(asset.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserIcon size={12} />
                  <span>Petugas: {asset?.user?.fullName || '-'}</span>
                </div>
              </div>

              {/* Footer Buttons for view-mode */}
              {user.role !== 'VIEWER' && (
                <div className={styles.footer} style={{ borderTop: 'none', padding: 'var(--space-2) 0 0 0' }}>
                  {/* Superadmin or branch officers can archive/delete */}
                  <button
                    type="button"
                    onClick={() => setIsDeleting(true)}
                    className={styles.deleteBtn}
                    style={{ marginRight: 'auto' }}
                  >
                    <Trash2 size={16} />
                    <span>Hapus Aset</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px' }}
                  >
                    <Edit size={16} />
                    <span>Edit Aset</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
