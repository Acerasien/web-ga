'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  History,
  LayoutDashboard
} from 'lucide-react';
import { importTransactions } from '@/lib/actions/imports';
import type { CSVImportResult } from '@/lib/actions/imports';
import type { AuthUser } from '@/types';
import styles from '@/app/(dashboard)/transaksi/import/import.module.css';

interface CSVImportClientProps {
  user: AuthUser;
}

export default function CSVImportClient({ user }: CSVImportClientProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  
  // Importer states
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setGeneralError('Format file salah. Hanya file .csv, .xlsx, atau .xls yang diperbolehkan.');
      setFile(null);
      setCsvText('');
      return;
    }
    
    setFile(selectedFile);
    setGeneralError(null);
    setResult(null);

    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (e) => {
        try {
          if (e.target?.result) {
            const data = new Uint8Array(e.target.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const csvContent = XLSX.utils.sheet_to_csv(worksheet);
            setCsvText(csvContent);
          }
        } catch (err) {
          console.error('Error parsing Excel file:', err);
          setGeneralError('Gagal membaca file Excel. Pastikan file tidak rusak.');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      reader.onload = (e) => {
        if (e.target?.result) {
          setCsvText(e.target.result as string);
        }
      };
      reader.readAsText(selectedFile);
    }
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
    setResult(null);

    try {
      const res = await importTransactions(csvText);

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setGeneralError(res.error || 'Terjadi kesalahan format pada file unggahan.');
        if (res.data) {
          setResult(res.data);
        }
      }
    } catch (err) {
      console.error(err);
      setGeneralError('Koneksi terputus. Gagal mengunggah file ke server.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelFile = () => {
    setFile(null);
    setCsvText('');
    setResult(null);
    setGeneralError(null);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Tanggal",
      "Kategori",
      "Sub-Kategori",
      "Deskripsi",
      "Kuantitas",
      "Satuan",
      "Harga Satuan",
      "Pembayaran",
      "Vendor",
      "Catatan"
    ];

    const sampleRows = [
      [
        "2026-05-18",
        "Konsumsi",
        "Rapat",
        "Beli makan siang nasi kotak rapat GA",
        15,
        "Box",
        35000,
        "CASH",
        "RM Padang Sinar",
        "Makan siang rapat bulanan GA"
      ],
      [
        "2026-05-19",
        "Operasional",
        "ATK",
        "Pembelian kertas HVS A4 untuk printer",
        5,
        "Rim",
        48000,
        "PETTY_CASH",
        "Toko Buku Jaya",
        "Stok kertas printer kantor"
      ]
    ];

    const data = [headers, ...sampleRows];
    
    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set styling and column widths
    const wscols = [
      { wch: 12 }, // Tanggal
      { wch: 15 }, // Kategori
      { wch: 15 }, // Sub-Kategori
      { wch: 30 }, // Deskripsi
      { wch: 10 }, // Kuantitas
      { wch: 8 },  // Satuan
      { wch: 12 }, // Harga Satuan
      { wch: 12 }, // Pembayaran
      { wch: 20 }, // Vendor
      { wch: 30 }  // Catatan
    ];
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Transaksi");

    // Write file & trigger download
    XLSX.writeFile(wb, "template_import_transaksi.xlsx");
  };

  return (
    <div className={styles.container}>
      <header className={styles.titleBlock}>
        <h2>Impor Transaksi Massal</h2>
        <p>Unggah file Excel atau CSV untuk memasukkan data transaksi General Affairs dalam jumlah besar sekaligus.</p>
      </header>

      <div className={styles.card}>
        {/* Specs & Guide banner shown by default unless showing success page */}
        {(!result || result.errors.length > 0) && (
          <div className={styles.specsBox} style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <FileSpreadsheet size={24} className={styles.specsIcon} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className={styles.specsTitle}>Spesifikasi Header & Format Kolom Excel / CSV:</span>
              <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
                Pastikan baris pertama file Anda berisi nama kolom berikut (tidak harus berurutan):
              </span>
              
              {/* Responsive wrapped badges / tags row to prevent overflow */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginTop: '6px', marginBottom: '6px' }}>
                {['Tanggal', 'Kategori', 'Sub-Kategori', 'Deskripsi', 'Kuantitas', 'Satuan', 'Harga Satuan', 'Pembayaran', 'Vendor', 'Catatan'].map(col => (
                  <span key={col} style={{ 
                    fontSize: '10px', 
                    fontFamily: 'var(--font-mono)', 
                    padding: '2px 8px', 
                    backgroundColor: 'var(--color-bg)', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: '12px', 
                    color: 'var(--color-text-light)', 
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    {col}
                  </span>
                ))}
              </div>

              <ul style={{ margin: 'var(--space-2) 0 0 0', paddingLeft: 'var(--space-4)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Tanggal</strong> mendukung format <code style={{ fontWeight: 600 }}>YYYY-MM-DD</code> atau standard Excel Indonesia <code style={{ fontWeight: 600 }}>DD/MM/YYYY</code>.</li>
                <li><strong>Pembayaran</strong> menerima salah satu nilai berikut: <code style={{ fontWeight: 600 }}>CASH</code>, <code style={{ fontWeight: 600 }}>TRANSFER</code>, atau <code style={{ fontWeight: 600 }}>PETTY_CASH</code>.</li>
                <li><strong>Kategori Mismatch (Poka-Yoke)</strong>: Jika nama kategori tidak dikenali di database, transaksi otomatis dipetakan ke kategori <code style={{ fontWeight: 600 }}>"Lain-lain"</code>.</li>
                <li><strong>Relational Rollback (Atomic Safeguard)</strong>: Jika terdapat kesalahan format pada baris mana pun, seluruh impor akan digagalkan dan dibatalkan (rollback) untuk menjaga integritas database.</li>
              </ul>

              <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid rgba(59, 130, 246, 0.1)', paddingTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="btn btn-secondary btn-sm"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)',
                    borderColor: 'var(--color-primary)',
                    color: 'var(--color-primary)',
                    backgroundColor: 'transparent',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 12px',
                    height: '30px',
                    cursor: 'pointer'
                  }}
                  title="Unduh file template Excel (.xlsx) sebagai acuan pengisian data"
                >
                  <FileSpreadsheet size={14} />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {generalError && !result && (
          <div className={styles.errorBanner} style={{ margin: 0 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span className={styles.errorTitle}>Gagal Mengunggah:</span>
              <p className={styles.errorSub}>{generalError}</p>
            </div>
          </div>
        )}

        {/* Dynamic State Router */}
        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>Memvalidasi dan memproses transaksi secara aman...</span>
          </div>
        ) : result ? (
          result.errors.length === 0 ? (
            /* Importer Success View */
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                <CheckCircle size={36} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
                Impor Data Sukses!
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', maxWidth: '480px', margin: '0 auto var(--space-8)' }}>
                Sebanyak <strong>{result.importedCount}</strong> baris transaksi pengeluaran GA berhasil divalidasi dan diunggah secara aman ke database.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <Link href="/transaksi/riwayat" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <History size={18} />
                  <span>Lihat Riwayat</span>
                </Link>
                <Link href="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <LayoutDashboard size={18} />
                  <span>Ke Dashboard</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Importer Fail / Rollback View */
            <div className={styles.errorCard}>
              <div className={styles.errorBanner}>
                <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 className={styles.errorTitle}>Impor Data Ditolak (Database Rollback Aktif)</h4>
                  <p className={styles.errorSub}>
                    Ditemukan <strong>{result.errors.length}</strong> kesalahan format data. Seluruh pengunggahan dibatalkan demi menjaga integritas keuangan sistem.
                  </p>
                </div>
              </div>

              <div className={styles.errorScroll}>
                {result.errors.map((err, idx) => (
                  <div key={idx} className={styles.errorLine}>
                    &bull; {err}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCancelFile}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary" onClick={handleCancelFile}>
                  Perbaiki & Coba Lagi
                </button>
              </div>
            </div>
          )
        ) : file ? (
          /* File Selected View (Ready to submit) */
          <div className={styles.fileFrame}>
            <div className={styles.fileMetaBlock}>
              <div className={styles.fileIconWrapper}>
                <FileSpreadsheet size={32} />
              </div>
              <div>
                <h4 className={styles.fileName}>{file.name}</h4>
                <p className={styles.fileSize}>
                  {(file.size / 1024).toFixed(1)} KB &bull; {file.name.endsWith('.csv') ? 'CSV File' : 'Excel Spreadsheet'}
                </p>
              </div>
            </div>

            <div className={styles.fileActions}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelFile} disabled={loading}>
                Ganti File
              </button>
              <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={loading}>
                Unggah Sekarang
              </button>
            </div>
          </div>
        ) : (
          /* Drag & Drop Zone Initial View */
          <div
            className={`${styles.dragZone} ${dragActive ? styles.dragActive : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            title="Seret file Excel atau CSV ke sini atau klik untuk memilih file"
          >
            <Upload size={48} className={styles.uploadIcon} />
            <div>
              <p className={styles.dragTitle}>
                Seret file Excel / CSV Anda ke sini, atau <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>pilih dari komputer</span>
              </p>
              <p className={styles.dragSub}>Mendukung file dengan ekstensi .xlsx, .xls, atau .csv</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
