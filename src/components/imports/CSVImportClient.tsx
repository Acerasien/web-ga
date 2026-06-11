'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle 
} from 'lucide-react';
import CSVImportSpecsGuide from './CSVImportParts/CSVImportSpecsGuide';
import CSVImportPreviewTable from './CSVImportParts/CSVImportPreviewTable';
import { CSVImportSuccessView, CSVImportFailView } from './CSVImportParts/CSVImportResultViews';
import { importTransactions } from '@/lib/actions/imports';
import type { CSVImportResult } from '@/lib/actions/imports';
import { getCategoriesWithSub } from '@/lib/actions/categories';
import type { CategoryWithSub } from '@/lib/actions/categories';
import type { AuthUser } from '@/types';
import { formatRupiah, formatPaymentMethod } from '@/lib/formatters';
import styles from '@/app/(dashboard)/transaksi/import/import.module.css';

interface CSVImportClientProps {
  user: AuthUser;
}

export default function CSVImportClient({ user }: CSVImportClientProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  
  // Preview states
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{
    totalRows: number;
    totalAmount: number;
    hasErrors: boolean;
  } | null>(null);

  // Importer states
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryWithSub[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCategories = async () => {
      const res = await getCategoriesWithSub();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    };
    loadCategories();
  }, []);

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

  const generatePreview = (worksheet: XLSX.WorkSheet) => {
    try {
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      if (rawRows.length < 2) {
        setPreviewRows([]);
        setPreviewSummary({ totalRows: 0, totalAmount: 0, hasErrors: true });
        return;
      }

      // Map headers dynamically (case-insensitive and trimmed)
      const headers = rawRows[0].map((h: any) => String(h || '').trim().toLowerCase());
      
      const idxDate = headers.findIndex(h => h.includes('tanggal') || h.includes('date'));
      const idxCategory = headers.findIndex(h => h.includes('kategori') || h.includes('category'));
      const idxSubCategory = headers.findIndex(h => h.includes('sub-kategori') || h.includes('subcategory') || h.includes('subkategori'));
      const idxDescription = headers.findIndex(h => h.includes('deskripsi') || h.includes('description') || h.includes('kebutuhan'));
      const idxQuantity = headers.findIndex(h => h.includes('kuantitas') || h.includes('jumlah') || h.includes('qty') || h.includes('quantity'));
      const idxUnit = headers.findIndex(h => h.includes('satuan') || h.includes('unit'));
      const idxPrice = headers.findIndex(h => h.includes('harga') || h.includes('price'));
      const idxPayment = headers.findIndex(h => h.includes('pembayaran') || h.includes('payment') || h.includes('metode'));
      const idxLocation = headers.findIndex(h => h === 'lokasi' || h.includes('location'));
      const idxBranch = headers.findIndex(h => h.includes('cabang') || h.includes('branch'));
      const idxVendor = headers.findIndex(h => h.includes('vendor') || h.includes('supplier'));
      const idxBeritaAcara = headers.findIndex(h => h.includes('berita acara') || h.includes('berita_acara') || h === 'ba');

      // Validate mandatory columns exist in headers
      if (idxDate === -1 || idxCategory === -1 || idxDescription === -1 || idxQuantity === -1 || idxUnit === -1 || idxPrice === -1) {
        setPreviewRows([]);
        setPreviewSummary({ totalRows: 0, totalAmount: 0, hasErrors: true });
        return;
      }

      const dataRows = rawRows.slice(1).filter(r => r.length > 0 && r.some(val => val !== undefined && val !== null && String(val).trim() !== ''));

      let totalAmount = 0;
      let hasErrors = false;
      const seenBAs = new Set<string>();

      const parsedRows = dataRows.map((row: any[], index: number) => {
        const rowNum = index + 2;
        const dateRaw = idxDate !== -1 ? String(row[idxDate] || '').trim() : '';
        const categoryRaw = idxCategory !== -1 ? String(row[idxCategory] || '').trim() : '';
        const subCategoryRaw = idxSubCategory !== -1 ? String(row[idxSubCategory] || '').trim() : '';
        const descriptionRaw = idxDescription !== -1 ? String(row[idxDescription] || '').trim() : '';
        
        const qtyRaw = idxQuantity !== -1 ? String(row[idxQuantity] || '').trim().replace(/[^0-9\.]/g, '') : '';
        const priceRaw = idxPrice !== -1 ? String(row[idxPrice] || '').trim().replace(/[^0-9\.]/g, '') : '';
        
        const quantity = qtyRaw ? Number(qtyRaw) : 1;
        const pricePerUnit = priceRaw ? Number(priceRaw) : 0;
        const subtotal = quantity * pricePerUnit;

        if (!isNaN(subtotal)) {
          totalAmount += subtotal;
        }

        const unitRaw = idxUnit !== -1 ? String(row[idxUnit] || '').trim() : 'Unit';
        const paymentRaw = idxPayment !== -1 ? String(row[idxPayment] || '').trim().toUpperCase() : 'CASH';
        const locationRaw = idxLocation !== -1 ? String(row[idxLocation] || '').trim().toUpperCase() : '';
        const branchRaw = idxBranch !== -1 ? String(row[idxBranch] || '').trim() : '';
        const vendorRaw = idxVendor !== -1 ? String(row[idxVendor] || '').trim() : '';
        const beritaAcaraRaw = idxBeritaAcara !== -1 ? String(row[idxBeritaAcara] || '').trim() : '';

        // Validation rules
        const errors: string[] = [];
        if (!dateRaw) errors.push('Tanggal tidak boleh kosong');
        if (!descriptionRaw) errors.push('Deskripsi tidak boleh kosong');
        if (isNaN(quantity) || quantity <= 0) errors.push('Kuantitas harus positif');
        if (isNaN(pricePerUnit) || pricePerUnit < 0) errors.push('Harga satuan harus positif');

        let locationVal = '';
        if (locationRaw) {
          if (locationRaw === 'SITE' || locationRaw === 'MESS' || locationRaw === 'OFFICE') {
            locationVal = locationRaw;
          } else {
            errors.push('Lokasi harus salah satu dari: Site, Mess, Office');
          }
        }

        if (beritaAcaraRaw) {
          if (seenBAs.has(beritaAcaraRaw)) {
            errors.push(`Nomor Berita Acara '${beritaAcaraRaw}' duplikat dalam file`);
          } else {
            seenBAs.add(beritaAcaraRaw);
          }
        }

        if (errors.length > 0) {
          hasErrors = true;
        }

        return {
          rowNum,
          date: dateRaw,
          category: categoryRaw || 'Lain-lain',
          subCategory: subCategoryRaw,
          description: descriptionRaw,
          quantity,
          unit: unitRaw,
          pricePerUnit,
          subtotal,
          paymentMethod: paymentRaw,
          location: locationVal,
          branch: branchRaw,
          vendor: vendorRaw,
          beritaAcara: beritaAcaraRaw,
          errors,
        };
      });

      setPreviewRows(parsedRows);
      setPreviewSummary({
        totalRows: parsedRows.length,
        totalAmount,
        hasErrors,
      });

    } catch (err) {
      console.error('Error generating preview:', err);
      setPreviewRows([]);
      setPreviewSummary({ totalRows: 0, totalAmount: 0, hasErrors: true });
    }
  };

  const processFile = (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setGeneralError('Format file salah. Hanya file .csv, .xlsx, atau .xls yang diperbolehkan.');
      setFile(null);
      setCsvText('');
      setPreviewRows([]);
      setPreviewSummary(null);
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Normalize Date cells to standard YYYY-MM-DD string format
            for (const key in worksheet) {
              if (key[0] === '!') continue;
              const cell = worksheet[key];
              if (cell && (cell.t === 'd' || cell.v instanceof Date)) {
                const date = cell.v instanceof Date ? cell.v : new Date(cell.v);
                if (!isNaN(date.getTime())) {
                  // Add 12 hours to handle local timezone / historical offset discrepancies (e.g. 23:59:48 instead of 00:00:00)
                  const adjusted = new Date(date.getTime() + 12 * 60 * 60 * 1000);
                  const yyyy = adjusted.getFullYear();
                  const mm = String(adjusted.getMonth() + 1).padStart(2, '0');
                  const dd = String(adjusted.getDate()).padStart(2, '0');
                  const formatted = `${yyyy}-${mm}-${dd}`;
                  cell.t = 's';
                  cell.v = formatted;
                  cell.w = formatted;
                }
              }
            }

            const csvContent = XLSX.utils.sheet_to_csv(worksheet);
            setCsvText(csvContent);
            generatePreview(worksheet);
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
          const csvTextContent = e.target.result as string;
          setCsvText(csvTextContent);
          try {
            const workbook = XLSX.read(csvTextContent, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            generatePreview(worksheet);
          } catch (err) {
            console.error('Error preparing CSV preview:', err);
          }
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
    setPreviewRows([]);
    setPreviewSummary(null);
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
      "Lokasi",
      "Vendor",
      "Catatan",
      "Berita Acara"
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
        "Office",
        "RM Padang Sinar",
        "Makan siang rapat bulanan GA",
        "0001/BA-GA/HO/V/2026"
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
        "Site",
        "Toko Buku Jaya",
        "Stok kertas printer kantor",
        "0002/BA-GA/HO/V/2026"
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
      { wch: 12 }, // Lokasi
      { wch: 20 }, // Vendor
      { wch: 30 }, // Catatan
      { wch: 25 }  // Berita Acara
    ];
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Transaksi");

    // Write file & trigger download
    XLSX.writeFile(wb, "template_import_transaksi.xlsx");
  };

  const handleDownloadCategories = () => {
    if (categories.length === 0) {
      alert('Daftar kategori belum selesai dimuat. Silakan coba sesaat lagi.');
      return;
    }

    const headers = ['Kategori', 'Sub-Kategori'];
    const rows: any[][] = [];

    categories.forEach(cat => {
      if (cat.subCategories.length === 0) {
        rows.push([cat.name, '']);
      } else {
        cat.subCategories.forEach(sub => {
          rows.push([cat.name, sub.name]);
        });
      }
    });

    const data = [headers, ...rows];

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set styling and column widths
    const wscols = [
      { wch: 25 }, // Kategori
      { wch: 25 }  // Sub-Kategori
    ];
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Kategori");

    // Write file & trigger download
    XLSX.writeFile(wb, "daftar_kategori_dan_subkategori.xlsx");
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
          <CSVImportSpecsGuide 
            onDownloadTemplate={handleDownloadTemplate} 
            onDownloadCategories={handleDownloadCategories}
            categories={categories}
          />
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
            <CSVImportSuccessView result={result} />
          ) : (
            /* Importer Fail / Rollback View */
            <CSVImportFailView result={result} onCancel={handleCancelFile} />
          )
        ) : file ? (
          /* File Selected View (Ready to submit) */
          <>
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
                <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={loading || previewSummary?.hasErrors}>
                  Unggah Sekarang
                </button>
              </div>
            </div>

            {/* Interactive Client Preview Panel */}
            {previewSummary && (
              <CSVImportPreviewTable 
                previewSummary={previewSummary}
                previewRows={previewRows}
              />
            )}
          </>
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
