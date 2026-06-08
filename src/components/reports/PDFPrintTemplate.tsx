import React from 'react';
import { 
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
import type { ReportPayload, ComparisonDataPoint } from '@/lib/actions/reports';
import type { Transaction } from '@prisma/client';

export interface PDFPrintTemplateProps {
  user: { fullName: string; role: string; };
  branchName: string;
  periodText: string;
  report: ReportPayload;
  comparisonData: ComparisonDataPoint[];
  comparisonBranches: { code: string; name: string }[];
  selectedBranchCodes: string[];
  transactions?: any[];
}

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F97316', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#F59E0B', '#EF4444',
  '#14B8A6', '#6366F1', '#F43F5E', '#84CC16',
  '#A855F7', '#EAB308'
];

export const PDFPrintTemplate = React.forwardRef<HTMLDivElement, PDFPrintTemplateProps>(
  ({ user, branchName, periodText, report, comparisonData, comparisonBranches, selectedBranchCodes, transactions }, ref) => {
    
    // Page dimensions matching A4 Landscape approx at 96 DPI
    // 297mm x 210mm -> ~1122px x ~793px
    const PAGE_WIDTH = 1120;
    const PAGE_HEIGHT = 790;
    
    const pageStyle: React.CSSProperties = {
      width: `${PAGE_WIDTH}px`,
      height: `${PAGE_HEIGHT}px`,
      padding: '30px',
      backgroundColor: '#ffffff',
      color: '#1E293B',
      fontFamily: '"Open Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    };

    // Calculate chunks for transaction table pagination
    const ROWS_PER_PAGE = 20;
    const txChunks = [];
    if (transactions && transactions.length > 0) {
      for (let i = 0; i < transactions.length; i += ROWS_PER_PAGE) {
        txChunks.push(transactions.slice(i, i + ROWS_PER_PAGE));
      }
    }

    // Dynamic category grouping: top 5 + "Lainnya" to prevent chart/legend overflow
    const groupedCategoryData = React.useMemo(() => {
      if (!report || !report.byCategory || report.byCategory.length === 0) {
        return [];
      }
      const sorted = [...report.byCategory].sort((a, b) => b.total - a.total);
      if (sorted.length <= 6) {
        return sorted;
      }
      
      const top5 = sorted.slice(0, 5);
      const others = sorted.slice(5);
      const othersTotal = others.reduce((sum, item) => sum + item.total, 0);
      
      return [
        ...top5,
        { name: 'Lainnya', total: othersTotal }
      ];
    }, [report]);

    // Dynamic branch grouping: top 5 branches by total spending across all comparison periods
    const topBranchCodes = React.useMemo(() => {
      if (!comparisonData || comparisonData.length === 0 || selectedBranchCodes.length <= 5) {
        return selectedBranchCodes;
      }
      // Sum totals per branch across all comparison data points
      const branchTotals = new Map<string, number>();
      for (const code of selectedBranchCodes) {
        let total = 0;
        for (const dp of comparisonData) {
          total += (dp as any)[code] || 0;
        }
        branchTotals.set(code, total);
      }
      // Sort by total descending and take top 5
      return [...branchTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code]) => code);
    }, [comparisonData, selectedBranchCodes]);

    return (
      <div 
        ref={ref} 
        style={{ 
          position: 'absolute', 
          left: '-9999px', 
          top: 0, 
          zIndex: -9999,
        }}
        className="pdf-print-container"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .pdf-print-container * {
            box-sizing: border-box;
          }
        `}} />

        {/* PAGE 1: EXECUTIVE SUMMARY */}
        <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column' }} className="pdf-page pdf-page-1">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px', flexShrink: 0 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: 700 }}>Laporan General Affairs</h1>
              <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '13px' }}>{branchName}</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
              <p style={{ margin: '0 0 3px', fontWeight: 600, color: '#0F172A' }}>{periodText}</p>
              <p style={{ margin: '0 0 3px' }}>Dicetak: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p style={{ margin: 0 }}>Oleh: {user.fullName}</p>
            </div>
          </div>

          {/* Row 1: Metrics + Charts — fixed height */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', height: '260px', flexShrink: 0 }}>
            {/* Left Column: KPI Metrics */}
            <div style={{ width: '22%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total Pengeluaran</p>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: 700 }}>{formatRupiah(report.totalSpending)}</h3>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Jumlah Transaksi</p>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: 700 }}>{report.transactionCount}</h3>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Rata-rata Transaksi</p>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: 700 }}>{formatRupiah(report.transactionCount > 0 ? report.totalSpending / report.transactionCount : 0)}</h3>
              </div>
            </div>

            {/* Middle Column: Trend Chart */}
            <div style={{ width: '48%', backgroundColor: '#FFFFFF', padding: '12px 15px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#0F172A' }}>Tren Pengeluaran</h4>
              <div style={{ flex: 1 }}>
                {report.trendData.length > 0 ? (
                  <AreaChart
                    width={470}
                    height={215}
                    data={report.trendData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPrintAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748B' }} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#64748B' }}
                      tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(0)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                    />
                    <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorPrintAmount)" isAnimationActive={false} />
                  </AreaChart>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '12px' }}>
                    Tidak ada data tren
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Pie Chart */}
            <div style={{ width: '30%', backgroundColor: '#FFFFFF', padding: '12px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#0F172A', paddingLeft: '5px' }}>Proporsi Kategori</h4>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {groupedCategoryData.length > 0 ? (
                  <RechartsPieChart width={290} height={230}>
                    <Pie
                      data={groupedCategoryData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="44%"
                      innerRadius={35}
                      outerRadius={68}
                      paddingAngle={2}
                      isAnimationActive={false}
                      label={(props: any) => {
                        const { cx, cy, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return percent > 0.05 ? (
                          <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={9} fontWeight="bold">
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        ) : null;
                      }}
                    >
                      {groupedCategoryData.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '8px', paddingTop: '2px', lineHeight: '14px' }} />
                  </RechartsPieChart>
                ) : (
                  <div style={{ color: '#94A3B8', fontSize: '12px' }}>Tidak ada data proporsi</div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Tables & Comparisons — fills remaining space */}
          <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
            {/* Bottom Left: Komposisi Table */}
            <div style={{ width: '42%', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 15px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', flexShrink: 0 }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#0F172A' }}>Komposisi Pengeluaran</h4>
              </div>
              <div style={{ padding: '0 15px', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600, fontSize: '10px' }}>Kategori</th>
                      <th style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600, fontSize: '10px' }}>Proporsi</th>
                      <th style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600, fontSize: '10px' }}>Total Biaya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCategoryData.map((cat: any, idx: number) => {
                      const percentage = report.totalSpending > 0 ? (cat.total / report.totalSpending) * 100 : 0;
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9', color: '#0F172A', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: CHART_COLORS[idx % CHART_COLORS.length], flexShrink: 0 }}></div>
                              {cat.name}
                            </div>
                          </td>
                          <td style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9', textAlign: 'right', color: '#475569', fontSize: '11px' }}>
                            {percentage.toFixed(1)}%
                          </td>
                          <td style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9', textAlign: 'right', color: '#0F172A', fontWeight: 500, fontSize: '11px' }}>
                            {formatRupiah(cat.total)}
                          </td>
                        </tr>
                      );
                    })}
                    {groupedCategoryData.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '15px 0', textAlign: 'center', color: '#94A3B8' }}>Tidak ada data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Right: Distribusi Per Cabang */}
            <div style={{ width: '58%', backgroundColor: '#FFFFFF', padding: '12px 15px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#0F172A' }}>Distribusi Per Cabang</h4>
              <div style={{ flex: 1 }}>
                {comparisonData.length > 0 && topBranchCodes.length > 0 ? (
                  <RechartsBarChart
                    width={580}
                    height={260}
                    data={comparisonData}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748B' }} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#64748B' }}
                      tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(0)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                    />
                    <Legend wrapperStyle={{ fontSize: '9px', lineHeight: '14px' }} />
                    {topBranchCodes.map((code, index) => {
                      const branchInfo = comparisonBranches.find((b) => b.code === code);
                      return (
                        <Bar 
                          key={code} 
                          dataKey={code} 
                          name={branchInfo?.name || code} 
                          fill={CHART_COLORS[index % CHART_COLORS.length]} 
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </RechartsBarChart>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '12px' }}>
                    Data perbandingan cabang tidak tersedia atau filter cabang tunggal digunakan
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2+: DETAILED TRANSACTIONS */}
        {txChunks.map((chunk, pageIndex) => (
          <div key={`page-${pageIndex + 2}`} style={{ ...pageStyle, paddingTop: '30px' }} className={`pdf-page pdf-page-${pageIndex + 2}`}>
            {/* Header for continuation pages */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #E2E8F0', paddingBottom: '10px', marginBottom: '15px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: 600 }}>Daftar Transaksi Detail (Halaman {pageIndex + 1} dari {txChunks.length})</h2>
              </div>
              <div style={{ fontSize: '12px', color: '#475569' }}>
                {periodText}
              </div>
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Tanggal</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Cabang</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Kategori</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Deskripsi</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Biaya</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Vendor</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>Pencatat</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((tx, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A' }}>
                      {new Date(tx.transactionDate).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A' }}>{tx.branch?.code || '-'}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A' }}>
                      {tx.category?.name}
                      {tx.subCategory?.name ? <span style={{ color: '#64748B' }}> / {tx.subCategory.name}</span> : ''}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.description}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A', textAlign: 'right' }}>
                      {Number(tx.quantity)} {tx.unit}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A', textAlign: 'right', fontWeight: 500 }}>
                      {formatRupiah(Number(tx.totalAmount))}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.vendor || '-'}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #E2E8F0', color: '#0F172A' }}>
                      {tx.user?.fullName?.split(' ')[0] || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }
);

PDFPrintTemplate.displayName = 'PDFPrintTemplate';
export default PDFPrintTemplate;
