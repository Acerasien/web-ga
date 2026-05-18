'use client';

import { useState, useEffect } from 'react';
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
import { getReportData } from '@/lib/actions/reports';
import { getTransactions } from '@/lib/actions/transactions';
import type { ReportPayload, ReportFilter } from '@/lib/actions/reports';
import type { Branch } from '@prisma/client';
import type { AuthUser } from '@/types';
import CSVImportModal from '@/components/modals/CSVImportModal';
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
  // Filters States
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [branchId, setBranchId] = useState<string>('');

  // Report Metrics States
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // CSV utilities states
  const [exporting, setExporting] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);

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
        month: period === 'YEARLY' ? undefined : Number(month),
        branchId: branchId ? Number(branchId) : undefined
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
    loadReportData();
  }, [period, year, month, branchId]);

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
        const daysInMonth = new Date(year, month, 0).getDate();
        const formattedMonth = String(month).padStart(2, '0');
        startDateStr = `${year}-${formattedMonth}-01`;
        endDateStr = `${year}-${formattedMonth}-${daysInMonth}`;
      }

      const result = await getTransactions({
        branchId: branchId ? Number(branchId) : undefined,
        startDate: startDateStr,
        endDate: endDateStr,
        page: 1,
        limit: 10000 // Query full dataset ignoring pagination limits
      });

      if (!result.success || !result.data || result.data.transactions.length === 0) {
        alert('Tidak ada transaksi terekam untuk kriteria filter ini.');
        setExporting(false);
        return;
      }

      // Format RFC-4180 compliant CSV string (Poka-Yoke: wraps fields in double quotes)
      const headers = ['Tanggal', 'Cabang', 'Kategori', 'Sub-Kategori', 'Deskripsi', 'Kuantitas', 'Satuan', 'Harga Satuan', 'Total Biaya', 'Pembayaran', 'Vendor', 'Catatan', 'Pencatat'];
      const rows = result.data.transactions.map(tx => [
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
      link.setAttribute('download', `Laporan_GA_${period}_${year}_${month}.csv`);
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

  return (
    <div className={styles.container}>
      {/* Header Block */}
      <header className={styles.headerRow}>
        <div>
          <h2>Laporan & Visualisasi Grafis</h2>
          <p className="text-muted" style={{ margin: 0 }}>Analisis pengeluaran General Affairs dengan grafis interaktif dan utilitas import/export.</p>
        </div>
        
        {/* CSV Import/Export Buttons */}
        <div className={styles.actionsRow}>
          <button 
            type="button" 
            onClick={handleExportCSV} 
            className={`${styles.actionBtn} ${styles.exportBtn}`}
            disabled={exporting}
          >
            <Download size={16} />
            <span>{exporting ? 'Mengekspor...' : 'Ekspor CSV'}</span>
          </button>
          
          {user.role !== 'VIEWER' && (
            <button 
              type="button" 
              onClick={() => setImportModalOpen(true)} 
              className={`${styles.actionBtn} ${styles.importBtn}`}
            >
              <Upload size={16} />
              <span>Unggah CSV Bulk</span>
            </button>
          )}
        </div>
      </header>

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
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <option value="DAILY">Harian (Hari ini)</option>
              <option value="WEEKLY">Mingguan (Fase 1-5)</option>
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

          {/* Month selector (Display only if period isn't YEARLY) */}
          {period !== 'YEARLY' ? (
            <div className={styles.filterGroup}>
              <label htmlFor="month-select" className={styles.label}>Bulan</label>
              <select
                id="month-select"
                className={styles.input}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {monthsIndo.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.filterGroup}>
              <label className={styles.label}>Bulan Terkunci</label>
              <input type="text" className={styles.input} value="Semua Bulan" disabled />
            </div>
          )}

          {/* SUPERADMIN Only: Branch filter */}
          {user.role === 'SUPERADMIN' ? (
            <div className={styles.filterGroup}>
              <label htmlFor="branch-select" className={styles.label}>Penyaringan Cabang</label>
              <select
                id="branch-select"
                className={styles.input}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
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

      {/* Main Charts & Visualizations Dashboard */}
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
          
          {/* Chart 1: Line Chart (Spending Trend over Selected scale) */}
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
              ) : (
                <ResponsiveContainer width="100%" height="100%">
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
              )}
            </div>
          </div>

          {/* Chart 2: Donut Chart (Category Shares breakdown) */}
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
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={report.byCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="total"
                    >
                      {report.byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Customized Category shares Dot list */}
            {report.byCategory.length > 0 && report.totalSpending > 0 && (
              <div className={styles.donutBreakdownRow}>
                {report.byCategory.map((cat, idx) => (
                  <div key={cat.id} className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>
                      <span 
                        className={styles.dot} 
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                      />
                      <span>{cat.name}</span>
                    </span>
                    <span className={styles.breakdownValue}>
                      {cat.percentage}% ({formatRupiah(cat.total)})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 3: Bar Chart (Superadmin Only: Direct Branch expense comparatives) */}
          {user.role === 'SUPERADMIN' && (
            <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
              <h3 className={styles.chartTitle}>
                <BarChart3 size={16} />
                <span>Distribusi Biaya Antar Cabang</span>
              </h3>
              <div className={styles.chartFrame} style={{ height: '240px' }}>
                {report.byBranch.length === 0 || report.totalSpending === 0 ? (
                  <div className={styles.chartFrameEmpty}>
                    Belum ada data cabang terekam.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={report.byBranch} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="code" stroke="#94A3B8" fontSize={11} tickLine={false} />
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
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {report.byBranch.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

        </section>
      ) : null}

      {/* CSV Bulk Importer Modal Anchor */}
      <CSVImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => {
          loadReportData(); // Refresh dynamic reports grid upon successful import
        }}
      />
    </div>
  );
}
