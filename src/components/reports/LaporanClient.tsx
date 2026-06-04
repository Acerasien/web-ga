'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Wallet, 
  Receipt, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  PieChart as PieIcon, 
  BarChart3, 
  Download, 
  Upload,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  BarChart as RechartsBarChart, 
  Bar
} from 'recharts';
import { formatRupiah } from '@/lib/formatters';
import { getReportData, getBranchComparisonData } from '@/lib/actions/reports';
import type { ReportPayload, ComparisonDataPoint, ComparisonPeriod, CategoryBreakdown } from '@/lib/actions/reports';
import { getTransactions } from '@/lib/actions/transactions';
import { getCategoriesWithSub } from '@/lib/actions/categories';
import type { CategoryWithSub } from '@/lib/actions/categories';
import Link from 'next/link';
import type { Branch } from '@prisma/client';
import type { AuthUser } from '@/types';
import styles from '@/app/(dashboard)/laporan/reports.module.css';

interface LaporanClientProps {
  user: AuthUser;
  branches: Branch[];
}

// Gorgeous, harmonized professional color palette (Tailwind tailored)
const CHART_COLORS = [
  '#3B82F6', // var(--color-primary)
  '#10B981', // var(--color-success)
  '#F97316', // var(--color-accent)
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#E2E8F0'  // Light Gray fallback
];

export default function LaporanClient({ user, branches }: LaporanClientProps) {
  // Tabs Navigation State
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'COMPARISON'>('SUMMARY');

  // Categories Master List (fetched on mount)
  const [categories, setCategories] = useState<CategoryWithSub[]>([]);

  // Summary Tab Filters States
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [months, setMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [branchIds, setBranchIds] = useState<number[]>([]);

  // Summary Tab Report Metrics States
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryBreakdown | null>(null);

  // Comparison Tab Filters States
  const [compPeriods, setCompPeriods] = useState<ComparisonPeriod[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    return [
      { year: prevYear, month: prevMonth },
      { year: currentYear, month: currentMonth }
    ];
  });
  const [compareType, setCompareType] = useState<'TOTAL' | 'CATEGORY'>('TOTAL');
  const [compCategoryIds, setCompCategoryIds] = useState<number[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonDataPoint[]>([]);
  const [comparisonBranches, setComparisonBranches] = useState<{ code: string; name: string }[]>([]);
  const [selectedBranchCodes, setSelectedBranchCodes] = useState<string[]>([]);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [compError, setCompError] = useState<string | null>(null);

  // CSV utilities states
  const [exporting, setExporting] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const [branchDropdownOpen, setBranchDropdownOpen] = useState<boolean>(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<boolean>(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [periodDropdownOpen, setPeriodDropdownOpen] = useState<boolean>(false);
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  const [summaryMonthOpen, setSummaryMonthOpen] = useState<boolean>(false);
  const summaryMonthRef = useRef<HTMLDivElement>(null);

  const [summaryBranchOpen, setSummaryBranchOpen] = useState<boolean>(false);
  const summaryBranchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setPeriodDropdownOpen(false);
      }
      if (summaryMonthRef.current && !summaryMonthRef.current.contains(event.target as Node)) {
        setSummaryMonthOpen(false);
      }
      if (summaryBranchRef.current && !summaryBranchRef.current.contains(event.target as Node)) {
        setSummaryBranchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch Categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      const response = await getCategoriesWithSub();
      if (response.success && response.data) {
        setCategories(response.data);
        if (response.data.length > 0) {
          // Pre-select all categories by default
          setCompCategoryIds(response.data.map((c) => c.id));
        }
      }
    };
    loadCategories();
  }, []);

  // Fetch comparison data dynamically
  const loadComparisonData = async () => {
    if (activeTab !== 'COMPARISON') return;
    setCompLoading(true);
    setCompError(null);
    try {
      const response = await getBranchComparisonData({
        periods: compPeriods,
        compareType,
        categoryIds: compareType === 'CATEGORY' ? compCategoryIds : undefined,
      });

      if (response.success && response.data) {
        setComparisonData(response.data.chartData);
        const activeBranches = response.data.activeBranches;
        setComparisonBranches(activeBranches);
        setSelectedBranchCodes((prev) => {
          if (prev.length === 0) {
            return activeBranches.map((b) => b.code);
          }
          const activeCodes = activeBranches.map((b) => b.code);
          return prev.filter((code) => activeCodes.includes(code));
        });
      } else {
        setCompError(response.error || 'Gagal memuat perbandingan cabang.');
      }
    } catch (err) {
      console.error(err);
      setCompError('Koneksi bermasalah. Gagal menghubungi server.');
    } finally {
      setCompLoading(false);
    }
  };

  useEffect(() => {
    loadComparisonData();
  }, [activeTab, compPeriods, compareType, compCategoryIds]);

  const togglePeriod = (yearVal: number, monthVal: number) => {
    setCompPeriods((prev) => {
      const exists = prev.some((p) => p.year === yearVal && p.month === monthVal);
      if (exists) {
        if (prev.length === 1) return prev; // Do not allow empty period selection
        return prev.filter((p) => !(p.year === yearVal && p.month === monthVal));
      } else {
        return [...prev, { year: yearVal, month: monthVal }].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
      }
    });
  };

  const toggleBranch = (branchCode: string) => {
    setSelectedBranchCodes((prev) => {
      if (prev.includes(branchCode)) {
        if (prev.length === 1) return prev; // Do not allow empty branch selection
        return prev.filter((code) => code !== branchCode);
      } else {
        return [...prev, branchCode];
      }
    });
  };

  const toggleCategory = (catId: number) => {
    setCompCategoryIds((prev) => {
      if (prev.includes(catId)) {
        if (prev.length === 1) return prev; // Do not allow empty category selection
        return prev.filter((id) => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  // Generate Year dropdown range (current year +/- 2 years)
  const activeYear = new Date().getFullYear();
  const yearsRange = Array.from({ length: 5 }, (_, i) => activeYear - 3 + i);

  // Generate Indonesian Month Names
  const monthsIndo = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
  ];

  // 1. Fetch reporting metrics on filter changes
  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getReportData({
        period,
        year: Number(year),
        months: period === 'YEARLY' ? undefined : months,
        branchIds: branchIds.length > 0 ? branchIds : undefined
      });

      if (result.success && result.data) {
        setReport(result.data);
      } else {
        setError(result.error || 'Gagal memuat visualisasi laporan.');
      }
    } catch (err) {
      console.error(err);
      setError('Koneksi bermasalah. Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCategory(null);
    loadReportData();
  }, [period, year, months, branchIds]);

  // 2. Perform client-side CSV Export matching filters (MTD)
  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Determine date ranges for the CSV search query
      let startDateStr: string | undefined = undefined;
      let endDateStr: string | undefined = undefined;

      if (period === 'YEARLY') {
        startDateStr = `${year - 4}-01-01`;
        endDateStr = `${year}-12-31`;
      } else {
        const minMonth = Math.min(...months);
        const maxMonth = Math.max(...months);
        const daysInMaxMonth = new Date(year, maxMonth, 0).getDate();
        const formattedMinMonth = String(minMonth).padStart(2, '0');
        const formattedMaxMonth = String(maxMonth).padStart(2, '0');
        startDateStr = `${year}-${formattedMinMonth}-01`;
        endDateStr = `${year}-${formattedMaxMonth}-${daysInMaxMonth}`;
      }

      const result = await getTransactions({
        branchId: undefined, // Query all, we filter in-memory
        startDate: startDateStr,
        endDate: endDateStr,
        page: 1,
        limit: 10000 // Query full dataset ignoring pagination limits
      });

      if (!result.success || !result.data) {
        alert('Terjadi kesalahan saat mengambil data transaksi.');
        setExporting(false);
        return;
      }

      // Filter in-memory by selected months and branchIds
      let exportedTxs = result.data.transactions;
      if (period !== 'YEARLY' && months.length > 0) {
        exportedTxs = exportedTxs.filter(tx => months.includes(new Date(tx.transactionDate).getMonth() + 1));
      }
      if (branchIds.length > 0) {
        exportedTxs = exportedTxs.filter(tx => branchIds.includes(tx.branchId));
      } else if (user.role !== 'SUPERADMIN' && user.branchId) {
        exportedTxs = exportedTxs.filter(tx => tx.branchId === user.branchId);
      }

      if (exportedTxs.length === 0) {
        alert('Tidak ada transaksi terekam untuk kriteria filter ini.');
        setExporting(false);
        return;
      }

      // Format RFC-4180 compliant CSV string (Poka-Yoke: wraps fields in double quotes)
      const headers = ['Tanggal', 'Cabang', 'Kategori', 'Sub-Kategori', 'Deskripsi', 'Kuantitas', 'Satuan', 'Harga Satuan', 'Total Biaya', 'Pembayaran', 'Vendor', 'Catatan', 'Pencatat'];
      const rows = exportedTxs.map(tx => [
        new Date(tx.transactionDate).toISOString().split('T')[0],
        tx.branch.code,
        tx.category.name,
        tx.subCategory?.name || '',
        tx.description.replace(/"/g, '""'),
        Number(tx.quantity),
        tx.unit,
        Number(tx.pricePerUnit),
        Number(tx.totalAmount),
        tx.paymentMethod,
        (tx.vendor || '').replace(/"/g, '""'),
        (tx.notes || '').replace(/"/g, '""'),
        tx.user.fullName
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(val => `"${val}"`).join(','))
      ].join('\r\n');

      // Trigger browser blob download (prepended with UTF-8 BOM so Excel opens it in correct columns instantly)
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_GA_${period}_${year}_months.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('CSV Export failure:', err);
      alert('Terjadi kesalahan saat memproses unduhan Excel/CSV.');
    } finally {
      setExporting(false);
    }
  };

  // Perform client-side Microsoft Excel Export (.xlsx)
  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Determine date ranges for the search query
      let startDateStr: string | undefined = undefined;
      let endDateStr: string | undefined = undefined;

      if (period === 'YEARLY') {
        startDateStr = `${year - 4}-01-01`;
        endDateStr = `${year}-12-31`;
      } else {
        const minMonth = Math.min(...months);
        const maxMonth = Math.max(...months);
        const daysInMaxMonth = new Date(year, maxMonth, 0).getDate();
        const formattedMinMonth = String(minMonth).padStart(2, '0');
        const formattedMaxMonth = String(maxMonth).padStart(2, '0');
        startDateStr = `${year}-${formattedMinMonth}-01`;
        endDateStr = `${year}-${formattedMaxMonth}-${daysInMaxMonth}`;
      }

      const result = await getTransactions({
        branchId: undefined, // Query all, we filter in-memory
        startDate: startDateStr,
        endDate: endDateStr,
        page: 1,
        limit: 10000 // Query full dataset ignoring pagination limits
      });

      if (!result.success || !result.data) {
        alert('Terjadi kesalahan saat mengambil data transaksi.');
        setExporting(false);
        return;
      }

      // Filter in-memory by selected months and branchIds
      let exportedTxs = result.data.transactions;
      if (period !== 'YEARLY' && months.length > 0) {
        exportedTxs = exportedTxs.filter(tx => months.includes(new Date(tx.transactionDate).getMonth() + 1));
      }
      if (branchIds.length > 0) {
        exportedTxs = exportedTxs.filter(tx => branchIds.includes(tx.branchId));
      } else if (user.role !== 'SUPERADMIN' && user.branchId) {
        exportedTxs = exportedTxs.filter(tx => tx.branchId === user.branchId);
      }

      if (exportedTxs.length === 0) {
        alert('Tidak ada transaksi terekam untuk kriteria filter ini.');
        setExporting(false);
        return;
      }

      // 1. Prepare raw data for SheetJS worksheet
      const headers = [
        'Tanggal', 
        'Cabang', 
        'Kategori', 
        'Sub-Kategori', 
        'Deskripsi', 
        'Kuantitas', 
        'Satuan', 
        'Harga Satuan', 
        'Total Biaya', 
        'Pembayaran', 
        'Vendor', 
        'Catatan', 
        'Pencatat'
      ];
      
      const rows = exportedTxs.map(tx => [
        new Date(tx.transactionDate).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        `${tx.branch.name} (${tx.branch.code})`,
        tx.category.name,
        tx.subCategory?.name || '',
        tx.description,
        Number(tx.quantity),
        tx.unit,
        Number(tx.pricePerUnit),
        Number(tx.totalAmount),
        tx.paymentMethod === 'PETTY_CASH' ? 'Kas Kecil' : tx.paymentMethod === 'TRANSFER' ? 'Transfer Bank' : 'Tunai',
        tx.vendor || '',
        tx.notes || '',
        tx.user.fullName
      ]);

      // 2. Build SheetJS Workbook & Worksheet
      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // 3. Apply cell formatting for premium financial reports
      // Set custom column widths to prevent ### truncation or squished content
      const colsWidth = [
        { wch: 12 }, // Tanggal
        { wch: 22 }, // Cabang
        { wch: 18 }, // Kategori
        { wch: 18 }, // Sub-Kategori
        { wch: 28 }, // Deskripsi
        { wch: 10 }, // Kuantitas
        { wch: 10 }, // Satuan
        { wch: 15 }, // Harga Satuan
        { wch: 18 }, // Total Biaya
        { wch: 15 }, // Pembayaran
        { wch: 20 }, // Vendor
        { wch: 20 }, // Catatan
        { wch: 18 }  // Pencatat
      ];
      ws['!cols'] = colsWidth;

      // 4. Format price columns as standard currency numbers (Rp #,##0)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let r = 1; r <= range.e.r; r++) {
        // Price per unit (Col index 7 / 'H')
        const cellPrice = ws[XLSX.utils.encode_cell({ r, c: 7 })];
        if (cellPrice && cellPrice.t === 'n') {
          cellPrice.z = '"Rp "#,##0';
        }
        // Total amount (Col index 8 / 'I')
        const cellTotal = ws[XLSX.utils.encode_cell({ r, c: 8 })];
        if (cellTotal && cellTotal.t === 'n') {
          cellTotal.z = '"Rp "#,##0';
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan GA');

      // 5. Trigger binary xlsx file download directly inside the browser
      XLSX.writeFile(wb, `Laporan_GA_${period}_${year}_months.xlsx`);

    } catch (err) {
      console.error('Excel Export failure:', err);
      alert('Terjadi kesalahan saat memproses unduhan Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Block */}
      <header className={styles.headerRow}>
        <div>
          <h2>Laporan & Visualisasi Grafis</h2>
          <p className="text-muted" style={{ margin: 0 }}>Analisis pengeluaran General Affairs dengan grafis interaktif dan utilitas import/export.</p>
        </div>
        
        {/* Excel & CSV Import/Export Buttons - Only displayed in Summary Tab */}
        {activeTab === 'SUMMARY' && (
          <div className={styles.actionsRow}>
            <button 
              type="button" 
              onClick={handleExportExcel} 
              className={`${styles.actionBtn} ${styles.exportBtn}`}
              disabled={exporting}
              style={{ backgroundColor: '#107c41', borderColor: '#107c41', color: '#fff' }}
            >
              <FileSpreadsheet size={16} />
              <span>{exporting ? 'Mengekspor...' : 'Ekspor Excel (.xlsx)'}</span>
            </button>
            
            {user.role !== 'VIEWER' && (
              <Link 
                href="/transaksi/import" 
                className={`${styles.actionBtn} ${styles.importBtn}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Upload size={16} />
                <span>Unggah Excel / CSV</span>
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Tab Switcher - Only for SUPERADMIN */}
      {user.role === 'SUPERADMIN' && (
        <nav className={styles.tabsContainer}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'SUMMARY' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('SUMMARY')}
          >
            Ringkasan Laporan
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'COMPARISON' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('COMPARISON')}
          >
            Perbandingan Cabang
          </button>
        </nav>
      )}

      {/* ============================================================
         Tab Panel 1: Summary Dashboard
         ============================================================ */}
      {activeTab === 'SUMMARY' && (
        <>
          {/* Dynamic Filters Card */}
          <section className={styles.filterCard}>
            <div className={styles.filterGrid}>
              {/* Scale selection */}
              <div className={styles.filterGroup}>
                <label htmlFor="period-scale" className={styles.label}>Skala Periode</label>
                <select
                  id="period-scale"
                  className={styles.input}
                  value={period}
                  onChange={(e) => {
                    const newPeriod = e.target.value as any;
                    setPeriod(newPeriod);
                    if ((newPeriod === 'DAILY' || newPeriod === 'WEEKLY') && months.length > 1) {
                      setMonths([months[0]]);
                    }
                  }}
                >
                  <option value="DAILY" disabled={months.length > 1}>Harian (Hari ini)</option>
                  <option value="WEEKLY" disabled={months.length > 1}>Mingguan (Fase 1-5)</option>
                  <option value="MONTHLY">Bulanan (Tren Tahun)</option>
                  <option value="YEARLY">Tahunan (5 Tahun Lalu)</option>
                </select>
              </div>

              {/* Year selector */}
              <div className={styles.filterGroup}>
                <label htmlFor="year-select" className={styles.label}>Tahun</label>
                <select
                  id="year-select"
                  className={styles.input}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {yearsRange.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month selector */}
              {period !== 'YEARLY' ? (
                <div className={styles.filterGroup} ref={summaryMonthRef}>
                  <span className={styles.label}>Bulan</span>
                  <div style={{ position: 'relative', marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setSummaryMonthOpen(!summaryMonthOpen)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'var(--space-2)' }}>
                        <CalendarIcon size={16} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
                        <span>
                          {months.length === 12
                            ? 'Semua Bulan'
                            : months.length === 0
                            ? 'Pilih Bulan'
                            : months.length <= 3
                            ? months.map(m => monthsIndo.find(mi => mi.value === m)?.label.substring(0, 3)).join(', ')
                            : `${months.length} Bulan`}
                        </span>
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-light)' }}>
                        {summaryMonthOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {summaryMonthOpen && (
                      <div className={styles.dropdownMenu} style={{ minWidth: '200px' }}>
                        {monthsIndo.map(m => {
                          const isChecked = months.includes(m.value);
                          return (
                            <label key={m.value} className={styles.dropdownItem}>
                              <input
                                type="checkbox"
                                className={styles.dropdownItemInput}
                                checked={isChecked}
                                onChange={() => {
                                  if (period === 'DAILY' || period === 'WEEKLY') {
                                    setMonths([m.value]);
                                    setSummaryMonthOpen(false);
                                  } else {
                                    setMonths((prev) => {
                                      if (prev.includes(m.value)) {
                                        if (prev.length === 1) return prev;
                                        return prev.filter(v => v !== m.value);
                                      } else {
                                        return [...prev, m.value].sort((a, b) => a - b);
                                      }
                                    });
                                  }
                                }}
                              />
                              <span>{m.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.filterGroup}>
                  <span className={styles.label}>Bulan Terkunci</span>
                  <input type="text" className={styles.input} style={{ marginTop: 'var(--space-1)' }} value="Semua Bulan" disabled />
                </div>
              )}

              {/* Branch selector */}
              {user.role === 'SUPERADMIN' ? (
                <div className={styles.filterGroup} ref={summaryBranchRef}>
                  <span className={styles.label}>Penyaringan Cabang</span>
                  <div style={{ position: 'relative', marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setSummaryBranchOpen(!summaryBranchOpen)}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'var(--space-2)' }}>
                        {branchIds.length === 0
                          ? 'Semua Cabang'
                          : branchIds.length === branches.length
                          ? 'Semua Cabang'
                          : `${branchIds.length} Cabang`}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-light)' }}>
                        {summaryBranchOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {summaryBranchOpen && (
                      <div className={styles.dropdownMenu} style={{ minWidth: '220px' }}>
                        <label className={styles.dropdownItem}>
                          <input
                            type="checkbox"
                            className={styles.dropdownItemInput}
                            checked={branchIds.length === 0}
                            onChange={() => setBranchIds([])}
                          />
                          <strong>Semua Cabang</strong>
                        </label>
                        {branches.map(b => {
                          const isChecked = branchIds.includes(b.id);
                          return (
                            <label key={b.id} className={styles.dropdownItem}>
                              <input
                                type="checkbox"
                                className={styles.dropdownItemInput}
                                checked={isChecked}
                                onChange={() => {
                                  setBranchIds((prev) => {
                                    if (prev.includes(b.id)) {
                                      return prev.filter(v => v !== b.id);
                                    } else {
                                      return [...prev, b.id].sort((a, b) => a - b);
                                    }
                                  });
                                }}
                              />
                              <span>{b.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.filterGroup}>
                  <span className={styles.label}>Cabang Terkunci</span>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ marginTop: 'var(--space-1)' }}
                    value={user.branchId ? branches.find(b => b.id === user.branchId)?.name || 'Cabang Terdaftar' : '-'}
                    disabled
                  />
                </div>
              )}
            </div>
          </section>

          {/* KPI Stats Section */}
          {report && (
            <section className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiIcon}>
                  <Wallet size={22} />
                </div>
                <div className={styles.kpiContent}>
                  <p className={styles.kpiLabel}>Total Pengeluaran</p>
                  <h3 className={styles.kpiValue}>{formatRupiah(report.totalSpending)}</h3>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIcon} ${styles.kpiIconSuccess}`}>
                  <Receipt size={22} />
                </div>
                <div className={styles.kpiContent}>
                  <p className={styles.kpiLabel}>Jumlah Transaksi</p>
                  <h3 className={styles.kpiValue}>{report.transactionCount} Catatan</h3>
                </div>
              </div>
            </section>
          )}

          {/* Main Charts Dashboard */}
          {error && (
            <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
            </div>
          ) : report ? (
            <section className={styles.chartsGrid}>
              
              {/* Line Chart: Trend */}
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>
                  <TrendingUp size={16} />
                  <span>Tren Pengeluaran GA</span>
                </h3>
                <div className={styles.chartFrame}>
                  {report.trendData.length === 0 || report.totalSpending === 0 ? (
                    <div className={styles.chartFrameEmpty}>
                      Tidak ada data tren untuk divisualisasikan.
                    </div>
                  ) : mounted ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <LineChart data={report.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis 
                          stroke="#94A3B8" 
                          fontSize={11} 
                          tickLine={false} 
                          tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}Jt` : val}
                        />
                        <Tooltip 
                          formatter={(value) => [formatRupiah(Number(value)), 'Total Biaya']}
                          contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="var(--color-primary)" 
                          strokeWidth={3} 
                          dot={{ r: 4, stroke: 'var(--color-primary)', strokeWidth: 2, fill: '#FFF' }}
                          activeDot={{ r: 6 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
              </div>

              {/* Donut Chart: Categories */}
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>
                  <PieIcon size={16} />
                  <span>Proporsi Pengeluaran Kategori</span>
                </h3>
                <div className={styles.chartFrame} style={{ height: '180px' }}>
                  {report.byCategory.length === 0 || report.totalSpending === 0 ? (
                    <div className={styles.chartFrameEmpty}>
                      Belum ada data proporsi.
                    </div>
                  ) : mounted ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <RechartsPieChart>
                        <Pie
                          data={report.byCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="total"
                          onClick={(data: any) => {
                            if (data && data.id) {
                              const found = report.byCategory.find(c => c.id === data.id);
                              if (found) setSelectedCategory(found);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {report.byCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
 
                {report.byCategory.length > 0 && report.totalSpending > 0 && (
                  !selectedCategory ? (
                    <>
                      <div className={styles.donutBreakdownRow}>
                        {report.byCategory.map((cat, idx) => (
                          <div 
                            key={cat.id} 
                            className={styles.breakdownItem}
                            onClick={() => setSelectedCategory(cat)}
                            style={{ cursor: 'pointer' }}
                            title={`Klik untuk melihat sub-kategori ${cat.name}`}
                          >
                            <span className={styles.breakdownLabel}>
                              <span 
                                className={styles.dot} 
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                              />
                              <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{cat.name}</span>
                            </span>
                            <span className={styles.breakdownValue}>
                              {cat.percentage}% ({formatRupiah(cat.total)})
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                        * Tip: Klik kategori di atas untuk melihat sub-kategori.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                          Sub-kategori: {selectedCategory.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(null)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            backgroundColor: '#E2E8F0',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#1E293B',
                            fontWeight: 500
                          }}
                        >
                          &larr; Kembali
                        </button>
                      </div>
                      <div className={styles.donutBreakdownRow} style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {selectedCategory.subCategories.length === 0 ? (
                          <div style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8', padding: '12px', width: '100%' }}>
                            Tidak ada rincian sub-kategori.
                          </div>
                        ) : (
                          selectedCategory.subCategories.map((sub, idx) => (
                            <div key={sub.id} className={styles.breakdownItem}>
                              <span className={styles.breakdownLabel}>
                                <span 
                                  className={styles.dot} 
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                                />
                                <span>{sub.name}</span>
                              </span>
                              <span className={styles.breakdownValue}>
                                {sub.percentage}% ({formatRupiah(sub.total)})
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )
                )}
              </div>

              {/* Stacked Area Chart: Category Trend (All Roles) */}
              <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
                <h3 className={styles.chartTitle}>
                  <TrendingUp size={16} />
                  <span>Tren Komposisi Pengeluaran Kategori</span>
                </h3>
                <div className={styles.chartFrame} style={{ height: '260px' }}>
                  {report.trendData.length === 0 || report.totalSpending === 0 ? (
                    <div className={styles.chartFrameEmpty}>
                      Tidak ada data komposisi tren untuk divisualisasikan.
                    </div>
                  ) : mounted ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <AreaChart data={report.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis 
                          stroke="#94A3B8" 
                          fontSize={11} 
                          tickLine={false} 
                          tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}Jt` : val}
                        />
                        <Tooltip 
                          formatter={(value, name) => [formatRupiah(Number(value)), name]}
                          contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {report.byCategory.map((cat, index) => (
                          <Area
                            key={cat.id}
                            type="monotone"
                            dataKey={cat.name}
                            stackId="1"
                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            fillOpacity={0.4}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* ============================================================
         Tab Panel 2: Branch Comparison Dashboard (Superadmin Only)
         ============================================================ */}
      {activeTab === 'COMPARISON' && user.role === 'SUPERADMIN' && (
        <>
          {/* Comparison Filters Card */}
          <section className={styles.filterCard}>
            <div className={styles.comparisonGrid}>
              
              {/* Pembanding selector & Kategori */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className={styles.filterGroup} ref={categoryDropdownRef}>
                  <span className={styles.label}>Pilih Kategori</span>
                  <div style={{ position: 'relative', marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className={`${styles.dropdownTrigger} ${compareType !== 'CATEGORY' ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                      disabled={compareType !== 'CATEGORY'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'var(--space-2)' }}>
                        {compCategoryIds.length === categories.length
                          ? 'Semua Kategori Terpilih'
                          : compCategoryIds.length === 0
                          ? 'Pilih Kategori'
                          : `${compCategoryIds.length} Kategori Terpilih`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                        {compCategoryIds.length > 0 && compCategoryIds.length < categories.length && compareType === 'CATEGORY' && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompCategoryIds(categories.map((c) => c.id));
                            }}
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: '14px', 
                              fontWeight: 'bold', 
                              color: 'var(--color-text-muted)', 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Pilih Semua"
                          >
                            &times;
                          </span>
                        )}
                        <span style={{ fontSize: '9px', color: 'var(--color-text-light)' }}>
                          {categoryDropdownOpen ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {categoryDropdownOpen && compareType === 'CATEGORY' && (
                      <div className={styles.dropdownMenu}>
                        {/* Group selected options first */}
                        {compCategoryIds.length > 0 && (
                          <>
                            <div className={styles.dropdownSelectedHeader}>Terpilih</div>
                            {categories
                              .filter((cat) => compCategoryIds.includes(cat.id))
                              .map((cat) => (
                                <label key={cat.id} className={styles.dropdownItem}>
                                  <input
                                    type="checkbox"
                                    className={styles.dropdownItemInput}
                                    checked={true}
                                    onChange={() => toggleCategory(cat.id)}
                                  />
                                  <span>{cat.name}</span>
                                </label>
                              ))}
                          </>
                        )}

                        {/* Unselected options */}
                        {compCategoryIds.length < categories.length && (
                          <>
                            <div className={styles.dropdownSelectedHeader}>Pilihan Lain</div>
                            {categories
                              .filter((cat) => !compCategoryIds.includes(cat.id))
                              .map((cat) => (
                                <label key={cat.id} className={styles.dropdownItem}>
                                  <input
                                    type="checkbox"
                                    className={styles.dropdownItemInput}
                                    checked={false}
                                    onChange={() => toggleCategory(cat.id)}
                                  />
                                  <span>{cat.name}</span>
                                </label>
                              ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <span className={styles.label}>Pembanding Biaya</span>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioOption}>
                      <input
                        type="radio"
                        name="compareType"
                        value="TOTAL"
                        checked={compareType === 'TOTAL'}
                        onChange={() => setCompareType('TOTAL')}
                      />
                      <span>Total MTD Bulanan</span>
                    </label>
                    <label className={styles.radioOption}>
                      <input
                        type="radio"
                        name="compareType"
                        value="CATEGORY"
                        checked={compareType === 'CATEGORY'}
                        onChange={() => setCompareType('CATEGORY')}
                      />
                      <span>Per Kategori Pengeluaran</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Month & Branch pills selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className={styles.filterGroup} ref={periodDropdownRef}>
                  <span className={styles.label}>Pilih Periode Perbandingan</span>
                  <div style={{ position: 'relative', marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'var(--space-2)' }}>
                        <CalendarIcon size={16} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
                        <span>
                          {compPeriods.length === 0
                            ? 'Pilih Periode'
                            : compPeriods.length <= 3
                            ? compPeriods
                                .map(
                                  (p) =>
                                    `${monthsIndo
                                      .find((m) => m.value === p.month)
                                      ?.label.substring(0, 3)} '${String(p.year).substring(2)}`
                                )
                                .join(', ')
                            : `${compPeriods.length} Periode Terpilih`}
                        </span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', color: 'var(--color-text-light)' }}>
                          {periodDropdownOpen ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {periodDropdownOpen && (
                      <div className={styles.periodPopoverMenu}>
                        {/* Dynamic Year Select (Option B) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                            Tahun:
                          </span>
                          <select
                            className={styles.input}
                            style={{ minHeight: '38px', padding: '0 var(--space-2)', flex: 1 }}
                            value={viewYear}
                            onChange={(e) => setViewYear(Number(e.target.value))}
                          >
                            {yearsRange.map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>

                        {/* Month Grid */}
                        <div className={styles.monthGrid}>
                          {monthsIndo.map(m => {
                            const isActive = compPeriods.some(p => p.year === viewYear && p.month === m.value);
                            return (
                              <button
                                key={m.value}
                                type="button"
                                className={`${styles.monthGridBtn} ${isActive ? styles.monthGridBtnActive : ''}`}
                                onClick={() => togglePeriod(viewYear, m.value)}
                              >
                                {m.label.substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected Periods Tag Chips (Footer) */}
                        {compPeriods.length > 0 && (
                          <div className={styles.selectedPeriodsFooter}>
                            <div className={styles.selectedPeriodsTitle}>Periode Terpilih ({compPeriods.length}):</div>
                            <div className={styles.tagChipsContainer}>
                              {compPeriods.map(p => (
                                <span key={`${p.year}-${p.month}`} className={styles.tagChip}>
                                  <span>
                                    {monthsIndo.find(m => m.value === p.month)?.label.substring(0, 3)} '{String(p.year).substring(2)}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.tagChipRemove}
                                    onClick={() => togglePeriod(p.year, p.month)}
                                    title="Hapus"
                                    disabled={compPeriods.length === 1}
                                    style={compPeriods.length === 1 ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                                  >
                                    &times;
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.filterGroup} ref={branchDropdownRef}>
                  <span className={styles.label}>Pilih Cabang</span>
                  <div style={{ position: 'relative', marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'var(--space-2)' }}>
                        {selectedBranchCodes.length === comparisonBranches.length
                          ? 'Semua Cabang Terpilih'
                          : selectedBranchCodes.length === 0
                          ? 'Pilih Cabang'
                          : `${selectedBranchCodes.length} Cabang Terpilih`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                        {selectedBranchCodes.length > 0 && selectedBranchCodes.length < comparisonBranches.length && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBranchCodes(comparisonBranches.map(b => b.code));
                            }}
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: '14px', 
                              fontWeight: 'bold', 
                              color: 'var(--color-text-muted)', 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Pilih Semua"
                          >
                            &times;
                          </span>
                        )}
                        <span style={{ fontSize: '9px', color: 'var(--color-text-light)' }}>
                          {branchDropdownOpen ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {branchDropdownOpen && (
                      <div className={styles.dropdownMenu}>
                        {/* Group selected options first */}
                        {selectedBranchCodes.length > 0 && (
                          <>
                            <div className={styles.dropdownSelectedHeader}>Terpilih</div>
                            {comparisonBranches
                              .filter((b) => selectedBranchCodes.includes(b.code))
                              .map((b) => (
                                <label key={b.code} className={styles.dropdownItem}>
                                  <input
                                    type="checkbox"
                                    className={styles.dropdownItemInput}
                                    checked={true}
                                    onChange={() => toggleBranch(b.code)}
                                  />
                                  <span>{b.name} ({b.code})</span>
                                </label>
                              ))}
                          </>
                        )}

                        {/* Unselected options */}
                        {selectedBranchCodes.length < comparisonBranches.length && (
                          <>
                            <div className={styles.dropdownSelectedHeader}>Pilihan Lain</div>
                            {comparisonBranches
                              .filter((b) => !selectedBranchCodes.includes(b.code))
                              .map((b) => (
                                <label key={b.code} className={styles.dropdownItem}>
                                  <input
                                    type="checkbox"
                                    className={styles.dropdownItemInput}
                                    checked={false}
                                    onChange={() => toggleBranch(b.code)}
                                  />
                                  <span>{b.name} ({b.code})</span>
                                </label>
                              ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Comparison Charts Frame */}
          {compError && (
            <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <AlertCircle size={20} />
              <span>{compError}</span>
            </div>
          )}

          <div className={styles.chartCard} style={{ width: '100%', position: 'relative' }}>
            {compLoading && (
              <div 
                className={styles.loadingOverlay} 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  background: 'rgba(255, 255, 255, 0.7)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  zIndex: 10,
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <div className={styles.spinner} />
              </div>
            )}
            <h3 className={styles.chartTitle}>
              <BarChart3 size={16} />
              <span>
                Perbandingan Biaya {compareType === 'TOTAL' ? 'Total MTD' : compCategoryIds.length === categories.length ? 'Semua Kategori' : `${compCategoryIds.length} Kategori Terpilih`} Antar Cabang
              </span>
            </h3>
            
            <div className={styles.chartFrame} style={{ height: '350px', marginTop: 'var(--space-4)' }}>
              {comparisonData.length === 0 ? (
                <div className={styles.chartFrameEmpty}>
                  Tidak ada data perbandingan untuk bulan yang dipilih.
                </div>
              ) : mounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <RechartsBarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#94A3B8" 
                      fontSize={11} 
                      tickLine={false} 
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}Jt` : val}
                    />
                    <Tooltip 
                      formatter={(value) => [formatRupiah(Number(value)), 'Pengeluaran']}
                      contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    
                    {comparisonBranches
                      .filter((branch) => selectedBranchCodes.includes(branch.code))
                      .map((branch, index) => (
                        <Bar 
                          key={branch.code} 
                          dataKey={branch.code} 
                          name={`${branch.name} (${branch.code})`} 
                          fill={CHART_COLORS[index % CHART_COLORS.length]} 
                          radius={[4, 4, 0, 0]} 
                        />
                      ))}
                  </RechartsBarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
