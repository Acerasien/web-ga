'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { importTransactions } from '@/lib/actions/imports';
import type { CSVImportResult } from '@/lib/actions/imports';
import styles from './modal.module.css';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function CSVImportModal({ isOpen, onClose, onImportSuccess }: CSVImportModalProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  
  // Upload status states
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Drag and Drop triggers
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
        onImportSuccess(); // Refresh reports charts instantly!
      } else {
        setGeneralError(res.error || 'Terjadi kesalahan saat memproses data.');
        if (res.data) {
          setResult(res.data);
        }
      }
    } catch (err) {
      console.error(err);
      setGeneralError('Koneksi terputus. Gagal melakukan upload ke server.');
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

  return (
    <div 
      className={styles.backdrop} 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        {/* Modal Header */}
        <header className={styles.header}>
          <h3 id="import-title">Unggah Data Transaksi Excel / CSV</h3>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Tutup Panel Unggah">
            <X size={20} />
          </button>
        </header>

        {/* Modal Body */}
        <div className={styles.body} style={{ gap: 'var(--space-4)' }}>
          
          {/* Section 1: Standard CSV Structure Instructions banner */}
          {!result && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
              <FileSpreadsheet size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text)', marginBottom: '2px' }}>Struktur Kolom Excel / CSV yang Diperlukan:</strong>
                <span>Pastikan file Excel / CSV memiliki baris header dengan kolom berikut (urutan bebas):</span>
                <span style={{ display: 'block', marginTop: '4px', fontFamily: 'monospace', padding: '4px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  Tanggal, Kategori, Sub-Kategori, Deskripsi, Kuantitas, Satuan, Harga Satuan, Pembayaran, Vendor, Catatan
                </span>
                <span style={{ display: 'block', marginTop: '4px', fontSize: '10px' }}>
                  * Tanggal mendukung format <code style={{ fontWeight: 600 }}>YYYY-MM-DD</code> atau <code style={{ fontWeight: 600 }}>DD/MM/YYYY</code>.
                </span>
                <span style={{ display: 'block', marginTop: '2px', fontSize: '10px' }}>
                  * Kategori yang tidak terdaftar otomatis dimasukkan ke <code style={{ fontWeight: 600 }}>"Lain-lain"</code>.
                </span>
              </div>
            </div>
          )}

          {generalError && (
            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{generalError}</span>
            </div>
          )}

          {/* Importer State Router */}
          {loading ? (
            // State A: Loading spinner
            <div className={styles.pdfBox} style={{ padding: 'var(--space-12) 0' }}>
              <div className={styles.spinner} />
              <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Sedang memproses dan menvalidasi data CSV secara atomik...
              </p>
            </div>
          ) : result ? (
            // State B: Done results (Success or Errors list)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {result.errors.length === 0 ? (
                // Success output
                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <CheckCircle size={56} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-4)' }} />
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                    Impor CSV Berhasil!
                  </h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Sebanyak <strong>{result.importedCount}</strong> baris transaksi berhasil dimasukkan secara aman ke database.
                  </p>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={onClose} 
                    style={{ marginTop: 'var(--space-6)', minWidth: '150px' }}
                  >
                    Selesai
                  </button>
                </div>
              ) : (
                // Failure Output
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)' }}>
                    <AlertTriangle size={32} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                        Impor CSV Ditolak (Rollback Terpicu)
                      </h4>
                      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        Ditemukan <strong>{result.errors.length}</strong> kesalahan data. Seluruh baris digagalkan demi menjaga integritas database.
                      </p>
                    </div>
                  </div>

                  {/* Scrollable list of errors */}
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {result.errors.map((err, idx) => (
                      <div key={idx} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-danger)' }}>
                        • {err}
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleCancelFile} 
                    style={{ marginTop: 'var(--space-3)', alignSelf: 'flex-end' }}
                  >
                    Perbaiki & Coba Lagi
                  </button>
                </div>
              )}
            </div>
          ) : file ? (
            // State C: File selected (Pending Action)
            <div style={{ border: '1.5px solid var(--color-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', backgroundColor: 'rgba(59, 130, 246, 0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
                  <FileSpreadsheet size={32} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {file.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {(file.size / 1024).toFixed(1)} KB &bull; {file.name.endsWith('.csv') ? 'CSV File' : 'Excel Spreadsheet'}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelFile}>
                  Ganti File
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleUpload}>
                  Unggah Sekarang
                </button>
              </div>
            </div>
          ) : (
            // State D: Initial drag zone
            <div
              className={`${styles.receiptFrame} ${dragActive ? styles.dragActive : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              style={{ minHeight: '200px', borderStyle: 'dashed', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
              title="Seret file Excel atau CSV ke sini atau klik untuk memilih file"
            >
              <Upload size={36} style={{ color: 'var(--color-text-muted)' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0' }}>
                  Seret file Excel / CSV ke sini, atau <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>klik untuk browsing</span>
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                  Dukung file dengan format .xlsx, .xls, atau .csv
                </p>
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
    </div>
  );
}
