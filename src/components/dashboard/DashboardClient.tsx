'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, 
  Receipt, 
  CreditCard, 
  Activity, 
  ArrowRight, 
  PlusCircle, 
  Search, 
  Clock, 
  CheckCircle2, 
  Coins,
  TrendingUp,
  PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell
} from 'recharts';
import Link from 'next/link';
import { formatRupiah } from '@/lib/formatters';
import type { DashboardStats } from '@/lib/actions/dashboard';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import type { ReportPayload, CategoryBreakdown } from '@/lib/actions/reports';
import type { Branch } from '@prisma/client';
import type { AuthUser } from '@/types';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';

interface DashboardClientProps {
  user: AuthUser;
  initialStats: DashboardStats;
  initialChartData: ReportPayload;
  branches: Branch[];
  selectedBranchId?: number;
}

// Harmonized professional chart colors
const CHART_COLORS = [
  '#3B82F6', // var(--color-primary)
  '#10B981', // var(--color-success)
  '#F97316', // var(--color-accent)
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#CBD5E1'  // Slate fallbacks
];

export default function DashboardClient({ 
  user, 
  initialStats,
  initialChartData,
  branches,
  selectedBranchId
}: DashboardClientProps) {
  const router = useRouter();
  const isAuthorized = user.role === 'SUPERADMIN' || user.role === 'ADMIN';
  
  // Modal states for interactive row previews
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Client hydration check to prevent Next.js SSR hydration shifts
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Dynamic Indonesian Month Name for KPI Badges (Enterprise Premium Polish)
  const currentMonthLabel = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const stats = [
    {
      label: 'Pengeluaran Bulan Ini',
      value: formatRupiah(initialStats.monthlyExpense),
      icon: Wallet,
      colorClass: 'primary',
      badgeText: 'Total MTD',
      badgeClass: 'badge-success',
    },
    ...(isAuthorized
      ? [
          {
            label: 'Kas Berjalan',
            value: formatRupiah(initialStats.activePanjarExpense),
            icon: Coins,
            colorClass: 'warning',
            badgeText: 'Panjar Belum Realisasi',
            badgeClass: 'badge-warning',
          },
        ]
      : []),
    {
      label: 'Jumlah Transaksi',
      value: String(initialStats.monthlyCount),
      icon: Receipt,
      colorClass: 'success',
      badgeText: currentMonthLabel,
      badgeClass: 'badge-info',
    },
    {
      label: 'Metode Petty Cash',
      value: formatRupiah(initialStats.pettyCashExpense),
      icon: CreditCard,
      colorClass: 'info',
      badgeText: 'Kas Kecil Cabang',
      badgeClass: 'badge-info',
    },
  ];

  const handleRowClick = (tx: TransactionWithRelations) => {
    setSelectedTransaction(tx);
    setModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', width: '100%' }}>
      {/* Greetings Block */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            Selamat Datang, {user.fullName}!
          </h2>
          <p className="text-muted" style={{ fontSize: 'var(--text-base)', margin: 0 }}>
            General Affairs Activity Tracker &mdash;{' '}
            <strong className="text-primary">{user.branchName || 'HQ (Semua Cabang)'}</strong>
          </p>
        </div>
        
        {/* Dynamic Branch Dropdown Selector + Navigation Actions */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {user.role === 'SUPERADMIN' && branches && branches.length > 0 && (
            <select
              value={selectedBranchId || ''}
              onChange={(e) => {
                const id = e.target.value;
                router.push(id ? `/dashboard?branchId=${id}` : '/dashboard');
              }}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-text)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                minHeight: '44px',
                width: '240px',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                transition: 'border-color var(--transition-fast)'
              }}
              className="form-select"
            >
              <option value="">Semua Cabang (HQ)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {user.role !== 'VIEWER' && (
            <Link 
              href="/transaksi/input" 
              className="btn btn-primary" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <PlusCircle size={18} />
              <span>Catat Transaksi</span>
            </Link>
          )}
        </div>
      </header>

      {/* Grid of KPI Stat Cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="stat-card">
              <div className={`stat-icon ${stat.colorClass}`}>
                <Icon size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">{stat.label}</p>
                <h3 className="stat-value">{stat.value}</h3>
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <span className={`badge ${stat.badgeClass}`}>{stat.badgeText}</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Activity Info Panel & Active Checklist Feed */}
      <section className={isAuthorized ? 'dashboard-grid' : ''} style={!isAuthorized ? { display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)' } : undefined}>
        <div className="card dashboard-main" style={{ minWidth: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'var(--color-primary)' }} />
              <span>Aktivitas Terkini</span>
            </h3>
            <Link 
              href="/transaksi/riwayat" 
              className="text-primary" 
              style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              <span>Semua Riwayat</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {initialStats.recentTransactions.length === 0 ? (
            <div style={{ padding: 'var(--space-12) var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Activity size={32} style={{ margin: '0 auto var(--space-4)', opacity: 0.5 }} />
              <p style={{ fontSize: 'var(--text-sm)', maxWidth: '400px', margin: '0 auto var(--space-4)' }}>
                Belum ada transaksi yang tercatat. Silakan lakukan pencatatan pengeluaran baru untuk melihat rekam jejak di sini.
              </p>
              {user.role !== 'VIEWER' && (
                <Link href="/transaksi/input" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>Buat Catatan Pertama</span>
                </Link>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 700 }}>Tanggal</th>
                    <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 700 }}>Kategori</th>
                    <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 700 }}>Deskripsi</th>
                    <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'right' }}>Total Biaya</th>
                    <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'center' }}>Pembayaran</th>
                    <th style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {initialStats.recentTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                      onClick={() => handleRowClick(tx)}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.01)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      title="Klik untuk membuka rincian modal pengeluaran"
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                        {new Date(tx.transactionDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{tx.category.name}</td>
                      <td style={{ padding: '12px 16px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right', color: 'var(--color-primary)' }}>
                        {formatRupiah(Number(tx.totalAmount))}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {tx.paymentMethod === 'PETTY_CASH' ? (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-accent)' }}>Kas Kecil</span>
                        ) : tx.paymentMethod === 'TRANSFER' ? (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>Transfer</span>
                        ) : (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>Tunai</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleRowClick(tx)}
                          style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Search size={10} />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isAuthorized && (
          <aside className="card dashboard-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)', padding: 0 }}>
              <h3 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Clock size={18} style={{ color: 'var(--color-primary)' }} />
                <span>Pekerjaan Berjalan</span>
              </h3>
              <span className="badge badge-info" style={{ fontWeight: 700 }}>
                {initialStats.activeOngoingPayments.length} Aktif
              </span>
            </div>
            
            <p className="text-muted" style={{ fontSize: 'var(--text-xs)', margin: '0 0 var(--space-1) 0', lineHeight: 1.4 }}>
              Daftar permintaan pembayaran berjalan yang memerlukan perhatian atau tindakan realisasi segera.
            </p>

            {initialStats.activeOngoingPayments.length === 0 ? (
              <div className="checklist-empty-state" style={{ flex: 1 }}>
                <CheckCircle2 size={32} style={{ color: 'var(--color-success)', marginBottom: 'var(--space-3)', opacity: 0.8 }} />
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: '0 0 var(--space-1) 0', color: 'var(--color-text)' }}>
                  Semua Pekerjaan Beres!
                </h4>
                <p style={{ fontSize: 'var(--text-xs)', maxWidth: '280px', margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Tidak ada pengajuan pembayaran berjalan yang perlu tindakan saat ini. Kinerja operasional luar biasa!
                </p>
              </div>
            ) : (
              <div className="checklist-scrollable-container" style={{ maxHeight: '420px' }}>
                {initialStats.activeOngoingPayments.map((p) => (
                  <Link 
                    key={p.id}
                    href="/transaksi/ongoing"
                    className="checklist-card"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <span className="badge badge-primary" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          {p.branch.name}
                        </span>
                        <span className="badge" style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px',
                          backgroundColor: 'rgba(96, 165, 250, 0.1)', 
                          color: '#2563EB',
                          fontWeight: 600
                        }}>
                          {p.category.name}
                        </span>
                      </div>
                      
                      {p.status === 'BELUM_DIBAYAR' ? (
                        <span className="badge" style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                          color: '#D97706', 
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          fontWeight: 700 
                        }}>
                          Belum Dibayar
                        </span>
                      ) : (
                        <span className="badge" style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                          color: 'var(--color-primary-hover)', 
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          fontWeight: 700 
                        }}>
                          Sudah Dibayar
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-1)' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 'var(--space-2)' }}>
                        <p style={{ 
                          fontWeight: 600, 
                          fontSize: 'var(--text-xs)', 
                          margin: 0, 
                          color: 'var(--color-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {p.description}
                        </p>
                        <p style={{ 
                          fontSize: '10px', 
                          color: 'var(--color-text-muted)', 
                          margin: '2px 0 0 0' 
                        }}>
                          Oleh {p.user.fullName} &bull; {new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span style={{ 
                          fontWeight: 700, 
                          fontSize: 'var(--text-xs)', 
                          color: 'var(--color-primary)' 
                        }}>
                          {formatRupiah(p.amountNeeded)}
                        </span>
                        <ArrowRight size={12} className="checklist-arrow" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        )}
      </section>

      {/* Dashboard Visual Charts Section (Priority 8 - Charts & Data) */}
      {mounted && (
        <section 
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 'var(--space-6)',
            width: '100%'
          }}
        >
          {initialChartData.totalSpending === 0 ? (
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 'var(--space-10) var(--space-6)',
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-muted)'
              }}
            >
              <TrendingUp size={36} style={{ marginBottom: 'var(--space-3)', opacity: 0.5, color: 'var(--color-primary)' }} />
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: '0 0 var(--space-1) 0', color: 'var(--color-text)' }}>
                Belum Ada Pengeluaran Tercatat Bulan Ini
              </h4>
              <p style={{ fontSize: 'var(--text-xs)', maxWidth: '380px', margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Belum ada transaksi operasional terdaftar untuk bulan ini. Grafik visualisasi akan muncul otomatis setelah transaksi pertama dicatat.
              </p>
            </div>
          ) : (
            <>
              {/* Top Row: Spending Trend & Category share */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 'var(--space-6)',
                  width: '100%'
                }}
              >
                {/* Chart 1: Line Chart (Spending Trend) */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
                      <span>Tren Pengeluaran Bulan Ini</span>
                    </h3>
                    <Link href="/laporan" className="text-primary" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textDecoration: 'none' }}>
                      Lihat Analisis Detail →
                    </Link>
                  </div>
                  <div style={{ height: '220px', width: '100%', marginTop: 'var(--space-2)' }}>
                    {mounted ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={initialChartData.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                          <YAxis 
                            stroke="#94A3B8" 
                            fontSize={10} 
                            tickLine={false} 
                            tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}Jt` : val >= 1000 ? `${(val / 1000).toFixed(0)}rb` : val}
                          />
                          <Tooltip 
                            formatter={(value) => [formatRupiah(Number(value)), 'Total Biaya']}
                            contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '11px', boxShadow: 'var(--shadow-md)' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="total" 
                            stroke="var(--color-primary)" 
                            strokeWidth={3} 
                            dot={{ r: 3, stroke: 'var(--color-primary)', strokeWidth: 2, fill: '#FFF' }}
                            activeDot={{ r: 5 }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        Memuat data grafik...
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart 2: Donut Chart (Category Shares) */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
                  <h3 style={{ fontSize: 'var(--text-base)', display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <PieIcon size={16} style={{ color: 'var(--color-primary)' }} />
                    <span>Proporsi Kategori Pengeluaran</span>
                  </h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', width: '100%', position: 'relative' }}>
                    {mounted ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <RechartsPieChart>
                            <Pie
                              data={initialChartData.byCategory}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={55}
                              paddingAngle={3}
                              dataKey="total"
                            >
                              {initialChartData.byCategory.map((entry: CategoryBreakdown, index: number) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatRupiah(Number(value))} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                        {/* Centered overall sum label */}
                        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total MTD</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)' }}>
                            {initialChartData.totalSpending >= 1000000 
                              ? `${(initialChartData.totalSpending / 1000000).toFixed(1)} Jt` 
                              : formatRupiah(initialChartData.totalSpending)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        Memuat data grafik...
                      </div>
                    )}
                  </div>

                  {/* Dynamic scrollable custom legend list */}
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                      gap: 'var(--space-2)',
                      maxHeight: '65px', 
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}
                    className="checklist-scrollable-container"
                  >
                    {initialChartData.byCategory.slice(0, 6).map((cat: CategoryBreakdown, idx: number) => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }} title={cat.name}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: CHART_COLORS[idx % CHART_COLORS.length], flexShrink: 0 }} />
                          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{cat.name}</span>
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{cat.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Rincian Detail Modal Overlay */}
      <TransactionDetailModal
        isOpen={modalOpen}
        transaction={selectedTransaction}
        currentUserRole={user.role}
        onDeleteSuccess={() => {
          router.refresh();
        }}
        onClose={() => {
          setModalOpen(false);
          setSelectedTransaction(null);
        }}
      />
    </div>
  );
}

