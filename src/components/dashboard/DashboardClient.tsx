'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Receipt, CreditCard, Activity, ArrowRight, PlusCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/formatters';
import type { DashboardStats } from '@/lib/actions/dashboard';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import type { AuthUser } from '@/types';
import TransactionDetailModal from '@/components/modals/TransactionDetailModal';

interface DashboardClientProps {
  user: AuthUser;
  initialStats: DashboardStats;
}

export default function DashboardClient({ user, initialStats }: DashboardClientProps) {
  const router = useRouter();
  // Modal states for interactive row previews
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

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
      colorClass: 'warning',
      badgeText: 'Kas Kecil Cabang',
      badgeClass: 'badge-warning',
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

      {/* Main Activity Info Panel */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 'var(--space-6)',
        }}
      >
        <div className="card" style={{ minWidth: 0, overflow: 'hidden' }}>
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
      </section>

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
