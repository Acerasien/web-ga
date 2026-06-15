'use client';

import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  HelpCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import { importAssets } from '@/lib/actions/assets';
import type { CSVImportResult } from '@/lib/actions/assets';
import type { Branch } from '@prisma/client';
import { type AuthUser, normalizeAssetCategory } from '@/types';
import styles from './modal.module.css';
import { readExcelOrCsvFile } from '@/lib/excel';

interface AssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  branches: Branch[];
  onImportSuccess: () => void;
}

export default function AssetImportModal({
  isOpen,
  onClose,
  user,
  branches,
  onImportSuccess,
}: AssetImportModalProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  
  // Preview states
  interface AssetPreviewRow {
    rowNum: number;
    name: string;
    category: string;
    assetTag: string;
    brandModel: string;
    pic: string;
    locationDetail: string;
    status: string;
    branch: string;
    notes: string;
    purchaseYear: string;
    errors: string[];
  }

  const [previewRows, setPreviewRows] = useState<AssetPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{
    totalRows: number;
    hasErrors: boolean;
    errorCount: number;
  } | null>(null);

  // Importer states
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const generatePreview = (worksheet: XLSX.WorkSheet) => {
    try {
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
      if (rawRows.length < 2) {
        setPreviewRows([]);
        setPreviewSummary({ totalRows: 0, hasErrors: true, errorCount: 1 });
        return;
      }

      // Map headers dynamically (case-insensitive and trimmed)
      const headers = (rawRows[0] || []).map((h) => String(h || '').trim().toLowerCase());
      
      const idxTag = headers.findIndex(h => h.includes('tag') || h.includes('kode') || h === 'code');
      const idxName = headers.findIndex(h => h === 'nama' || h === 'name' || h.includes('barang') || h.includes('aset'));
      const idxBrand = headers.findIndex(h => h.includes('brand') || h.includes('model') || h.includes('merek'));
      const idxCategory = headers.findIndex(h => h === 'kategori' || h === 'category');
      const idxLocation = headers.findIndex(h => h.includes('lokasi') || h.includes('location') || h.includes('detail'));
      const idxPIC = headers.findIndex(h => h.includes('pic') || h.includes('penanggung') || h.includes('holder'));
      const idxStatus = headers.findIndex(h => h.includes('status') || h.includes('kondisi'));
      const idxNotes = headers.findIndex(h => h.includes('catatan') || h.includes('notes') || h.includes('keterangan'));
      const idxBranch = headers.findIndex(h => h.includes('cabang') || h.includes('branch'));
      const idxYear = headers.findIndex(h => h.includes('tahun') || h.includes('year') || h === 'thn' || h.includes('pembelian'));

      // Validate required columns
      if (idxName === -1 || idxCategory === -1 || idxYear === -1) {
        setGeneralError('Tajuk kolom tidak valid. File harus memiliki kolom "Nama" (Name), "Kategori" (Category), dan "Tahun" (Year).');
        setPreviewRows([]);
        setPreviewSummary({ totalRows: 0, hasErrors: true, errorCount: 1 });
        return;
      }

      const dataRows = rawRows.slice(1).filter((r): r is unknown[] => Array.isArray(r) && r.length > 0 && r.some(val => val !== undefined && val !== null && String(val).trim() !== ''));

      let errorCount = 0;
      const seenTags = new Set<string>();

      const parsedRows = dataRows.map((row: unknown[], index: number) => {
        const rowNum = index + 2;
        const nameRaw = idxName !== -1 ? String(row[idxName] || '').trim() : '';
        const categoryRaw = idxCategory !== -1 ? String(row[idxCategory] || '').trim() : '';
        const tagRaw = idxTag !== -1 ? String(row[idxTag] || '').trim() : '';
        const brandRaw = idxBrand !== -1 ? String(row[idxBrand] || '').trim() : '';
        const picRaw = idxPIC !== -1 ? String(row[idxPIC] || '').trim() : '';
        const locationRaw = idxLocation !== -1 ? String(row[idxLocation] || '').trim() : '';
        const statusRaw = idxStatus !== -1 ? String(row[idxStatus] || '').trim() : 'AKTIF';
        const notesRaw = idxNotes !== -1 ? String(row[idxNotes] || '').trim() : '';
        const branchRaw = idxBranch !== -1 ? String(row[idxBranch] || '').trim() : '';
        const yearRaw = idxYear !== -1 ? String(row[idxYear] || '').trim() : '';

        // Validation checks
        const errors: string[] = [];
        if (!nameRaw) errors.push('Nama aset tidak boleh kosong');

        let categoryDisplay = '';
        if (!categoryRaw) {
          errors.push('Kategori aset tidak boleh kosong');
        } else {
          const categoryNormalized = normalizeAssetCategory(categoryRaw);
          if (categoryNormalized) {
            categoryDisplay = categoryNormalized;
          } else {
            errors.push(`Kategori '${categoryRaw}' tidak valid (Gunakan salah satu dari: Elektronik, Peralatan Kantor, Mebel & Furniture, Kendaraan, Peralatan Dapur & Mess, Perkakas & Alat Berat, Lain-lain)`);
            categoryDisplay = categoryRaw;
          }
        }

        let yearDisplay = '';
        if (!yearRaw) {
          errors.push('Tahun pembelian wajib diisi');
        } else {
          const parsedYear = parseInt(yearRaw, 10);
          const currentYear = new Date().getFullYear();
          if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > currentYear + 5) {
            errors.push('Tahun pembelian harus berupa 4 digit angka tahun yang valid (misal: 2024)');
          }
          yearDisplay = yearRaw;
        }

        if (tagRaw) {
          if (seenTags.has(tagRaw)) {
            errors.push(`Kode Tag Aset '${tagRaw}' duplikat dalam file`);
          }
          seenTags.add(tagRaw);
        }

        // Validate Status mapping
        let statusDisplay = 'Aktif (Bagus)';
        if (statusRaw) {
          const sLower = statusRaw.toLowerCase();
          if (sLower.includes('rusak') || sLower === 'broken' || sLower === 'damaged') {
            statusDisplay = 'Rusak';
          } else if (sLower.includes('perbaikan') || sLower.includes('servis') || sLower === 'repair' || sLower === 'diperbaiki') {
            statusDisplay = 'Dalam Servis';
          } else if (sLower.includes('hilang') || sLower === 'lost' || sLower === 'missing') {
            statusDisplay = 'Hilang';
          } else if (sLower.includes('aktif') || sLower.includes('active') || sLower === 'bagus' || sLower === 'good') {
            statusDisplay = 'Aktif (Bagus)';
          } else {
            errors.push(`Status '${statusRaw}' tidak valid (Gunakan: Aktif, Rusak, Servis, Hilang)`);
          }
        }

        // Verify Branch mapping for SUPERADMIN
        let branchDisplay = '';
        if (user.role === 'SUPERADMIN') {
          if (branchRaw) {
            const matchedBranch = branches.find(
              b => b.name.toLowerCase() === branchRaw.toLowerCase() || b.code.toLowerCase() === branchRaw.toLowerCase()
            );
            if (matchedBranch) {
              branchDisplay = matchedBranch.name;
            } else {
              errors.push(`Cabang '${branchRaw}' tidak dikenali`);
            }
          } else {
            branchDisplay = branches.find(b => b.id === user.branchId)?.name || branches[0]?.name || '-';
          }
        } else {
          branchDisplay = branches.find(b => b.id === user.branchId)?.name || 'Cabang Terdaftar';
        }

        if (errors.length > 0) {
          errorCount++;
        }

        return {
          rowNum,
          name: nameRaw,
          category: categoryDisplay,
          assetTag: tagRaw,
          brandModel: brandRaw,
          pic: picRaw,
          locationDetail: locationRaw,
          status: statusDisplay,
          branch: branchDisplay,
          notes: notesRaw,
          purchaseYear: yearDisplay,
          errors,
        };
      });

      setPreviewRows(parsedRows);
      setPreviewSummary({
        totalRows: parsedRows.length,
        hasErrors: errorCount > 0,
        errorCount,
      });

    } catch (err) {
      console.error('Error generating asset preview:', err);
      setGeneralError('Gagal memproses file. Pastikan struktur tabel valid.');
      setPreviewRows([]);
      setPreviewSummary(null);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setGeneralError(null);
    setResult(null);

    readExcelOrCsvFile(
      selectedFile,
      (csvContent, worksheet) => {
        setCsvText(csvContent);
        generatePreview(worksheet);
      },
      (errorMsg) => {
        setGeneralError(errorMsg);
        setFile(null);
        setCsvText('');
        setPreviewRows([]);
        setPreviewSummary(null);
      }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!csvText || loading) return;
    setLoading(true);
    setGeneralError(null);

    try {
      const res = await importAssets(csvText);

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setGeneralError(res.error || 'Terjadi kesalahan saat mengimpor data.');
        if (res.data?.errors && res.data.errors.length > 0) {
          // Sync server-side validation error array
          setGeneralError(res.error + ' Periksa daftar error baris.');
        }
      }
    } catch (err) {
      console.error('Bulk import submit error:', err);
      setGeneralError('Koneksi terputus. Gagal mengirim data impor.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvText('');
    setPreviewRows([]);
    setPreviewSummary(null);
    setResult(null);
    setGeneralError(null);
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} style={{ maxWidth: '800px', width: '90vw' }} onClick={(e) => e.stopPropagation()}>
        {/* Header Block */}
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={22} style={{ color: 'var(--color-primary)' }} />
            <h3>Impor Inventaris Massal</h3>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Tutup modal">
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Wizard Body */}
        <div className={styles.body} style={{ maxHeight: '80vh' }}>
          
          {generalError && (
            <div className={styles.errorMessage} style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.08)', margin: 0 }}>
              <AlertCircle size={16} />
              <span>{generalError}</span>
            </div>
          )}

          {result ? (
            /* Success / Final Result Screen */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8) 0', textAlign: 'center', gap: 'var(--space-4)' }}>
              <CheckCircle2 size={56} style={{ color: 'var(--color-success)' }} />
              <h3 style={{ margin: 0, fontWeight: 700 }}>Impor Selesai Berhasil!</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                Berhasil mengimpor <b>{result.importedCount}</b> aset baru ke database.
              </p>
              <button 
                type="button" 
                onClick={() => {
                  onImportSuccess();
                }} 
                className="btn btn-primary"
                style={{ minHeight: '44px', width: '100%', maxWidth: '200px', marginTop: 'var(--space-4)' }}
              >
                Tutup & Muat Ulang
              </button>
            </div>
          ) : !file ? (
            /* Upload File Drag Zone & Setup Guide */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              {/* Uploader Box */}
              <div 
                className={`${styles.uploaderContainer} ${dragActive ? styles.dragActive : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                style={{ padding: 'var(--space-8) var(--space-4)', borderStyle: 'dashed', minHeight: '180px' }}
              >
                <Upload size={36} className={styles.uploaderIcon} />
                <span className={styles.uploaderText} style={{ fontSize: 'var(--text-base)' }}>
                  Tarik berkas Excel/CSV ke sini, atau <span className={styles.uploaderLink}>Pilih File</span>
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Format yang didukung: .xlsx, .xls, .csv (Maksimal 5MB)
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  style={{ display: 'none' }}
                />
              </div>

              {/* Template Guideline Card */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(59, 130, 246, 0.01)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                  <Info size={16} />
                  <span>Panduan Format Kolom Excel</span>
                </div>
                <p className="text-muted" style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                  Gunakan baris pertama sebagai tajuk kolom (header). Tajuk dapat menggunakan bahasa Indonesia atau Inggris (tidak sensitif huruf besar/kecil):
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                  <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                    • <b>Nama / Name <span style={{ color: 'var(--color-danger)' }}>*</span></b>: Nama barang/aset.<br/>
                    • <b>Kategori / Category <span style={{ color: 'var(--color-danger)' }}>*</span></b>: Kategori aset (Gunakan: <i>Elektronik, Peralatan Kantor, Mebel & Furniture, Kendaraan, Peralatan Dapur & Mess, Perkakas & Alat Berat, Lain-lain</i>).<br/>
                    • <b>Tahun / Year <span style={{ color: 'var(--color-danger)' }}>*</span></b>: Tahun pembelian aset (misal: 2024).<br/>
                    • <b>Kode / Tag Aset</b>: Kode identifikasi unik aset.<br/>
                    • <b>Brand / Model</b>: Merek atau tipe spesifik barang.<br/>
                    • <b>PIC / Penanggung Jawab</b>: Pemegang/penanggung jawab barang saat ini.<br/>
                    • <b>Lokasi / Location Detail</b>: Penempatan detail barang (e.g. Kantor Utama Lt.1).<br/>
                    • <b>Status / Kondisi</b>: Gunakan salah satu: <i>Aktif, Rusak, Servis, Hilang</i> (default: Aktif).<br/>
                    • <b>Catatan / Notes</b>: Catatan tambahan.<br/>
                    {user.role === 'SUPERADMIN' && (
                      <span>• <b>Cabang / Branch</b>: Nama atau Kode Cabang (Khusus Superadmin, e.g. HO, MESS-A).</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Preview Data State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              
              {/* Preview Info Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ fontWeight: 600 }}>File:</span>
                  <span className="text-muted">{file.name}</span>
                </div>
                {previewSummary && (
                  <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', fontWeight: 600 }}>
                      Total: {previewSummary.totalRows} baris
                    </span>
                    {previewSummary.hasErrors ? (
                      <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', fontWeight: 700 }}>
                        {previewSummary.errorCount} Baris Bermasalah
                      </span>
                    ) : (
                      <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)', fontWeight: 700 }}>
                        Semua Baris Valid
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Preview Scrollable Table Grid */}
              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
                <table className={styles.table} style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th className={styles.th} style={{ width: '40px', textAlign: 'center' }}>No</th>
                      <th className={styles.th}>Tag Aset</th>
                      <th className={styles.th}>Nama Aset</th>
                      <th className={styles.th}>Kategori</th>
                      <th className={styles.th}>Brand</th>
                      <th className={styles.th}>Tahun</th>
                      <th className={styles.th}>PIC</th>
                      <th className={styles.th}>Lokasi</th>
                      <th className={styles.th}>Status</th>
                      {user.role === 'SUPERADMIN' && <th className={styles.th}>Cabang</th>}
                      <th className={styles.th} style={{ width: '150px' }}>Keterangan / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => {
                      const hasErr = row.errors.length > 0;
                      return (
                        <tr 
                          key={idx} 
                          className={styles.tr} 
                          style={hasErr ? { backgroundColor: 'rgba(239, 68, 68, 0.03)' } : undefined}
                        >
                          <td className={styles.td} style={{ textAlign: 'center', fontWeight: 600 }}>{row.rowNum}</td>
                          <td className={styles.td} style={{ fontFamily: 'monospace' }}>{row.assetTag || '-'}</td>
                          <td className={styles.td} style={{ fontWeight: 600, color: hasErr && !row.name ? 'var(--color-danger)' : 'inherit' }}>{row.name || '(Kosong)'}</td>
                          <td className={styles.td} style={{ color: hasErr && !row.category ? 'var(--color-danger)' : 'inherit' }}>{row.category || '(Kosong)'}</td>
                          <td className={styles.td}>{row.brandModel || '-'}</td>
                          <td className={styles.td} style={{ color: hasErr && !row.purchaseYear ? 'var(--color-danger)' : 'inherit' }}>{row.purchaseYear || '(Kosong)'}</td>
                          <td className={styles.td}>{row.pic || '-'}</td>
                          <td className={styles.td}>{row.locationDetail || '-'}</td>
                          <td className={styles.td}>{row.status}</td>
                          {user.role === 'SUPERADMIN' && <td className={styles.td}>{row.branch}</td>}
                          <td className={styles.td} style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                            {hasErr ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {row.errors.map((errStr: string, eIdx: number) => (
                                  <span key={eIdx}>• {errStr}</span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-success)' }}>Ok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Block upload warning if errors exist (Poka-Yoke) */}
              {previewSummary?.hasErrors && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 600 }}>
                  <AlertCircle size={14} />
                  <span>Harap perbaiki semua baris data berwarna merah di file Excel Anda terlebih dahulu sebelum mengonfirmasi impor database.</span>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Action Button Footer */}
        <footer className={styles.footer}>
          {!result && (
            <>
              {file ? (
                <>
                  <button 
                    type="button" 
                    onClick={handleReset} 
                    className="btn btn-secondary" 
                    disabled={loading}
                    style={{ minHeight: '40px' }}
                  >
                    Ganti File
                  </button>
                  <button 
                    type="button" 
                    onClick={handleUpload} 
                    className="btn btn-primary" 
                    disabled={loading || !csvText || (previewSummary?.hasErrors ?? true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px' }}
                  >
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={16} />}
                    <span>Konfirmasi Impor</span>
                  </button>
                </>
              ) : (
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="btn btn-secondary"
                  style={{ minHeight: '40px' }}
                >
                  Tutup
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
