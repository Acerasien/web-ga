'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { logout } from '@/lib/actions/auth';
import type { AuthUser } from '@/types';
import styles from './DashboardShell.module.css';

interface DashboardShellProps {
  user: AuthUser;
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const response = await logout();
      if (response.success) {
        // Clear route history, refresh tokens, and send back to login
        router.refresh();
        router.push('/login');
      } else {
        alert(response.error || 'Gagal keluar. Silakan coba lagi.');
      }
    } catch (error) {
      console.error('Logout handler error:', error);
      alert('Terjadi kesalahan koneksi saat keluar.');
    }
  };

  // Map route path to header title (in Indonesian matching the sidebar labels)
  const getHeaderTitle = (path: string): string => {
    if (path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/transaksi/input')) return 'Input Transaksi';
    if (path.startsWith('/transaksi/riwayat')) return 'Riwayat Transaksi';
    if (path.startsWith('/transaksi/import')) return 'Import Data';
    if (path.startsWith('/ongoing/list')) return 'Daftar Pembayaran';
    if (path.startsWith('/ongoing/input')) return 'Input Pembayaran';
    if (path.startsWith('/ongoing/riwayat')) return 'Riwayat Pembayaran';
    if (path.startsWith('/admin/tagihan-rutin')) return 'Tagihan Rutin';
    if (path.startsWith('/admin/users')) return 'Pengguna';
    if (path.startsWith('/admin/branches')) return 'Cabang';
    if (path.startsWith('/admin/kategori')) return 'Kategori';
    if (path.startsWith('/admin/audit-log')) return 'Audit Log';
    if (path.startsWith('/laporan')) return 'Laporan Keuangan';
    return 'Dashboard';
  };

  const title = getHeaderTitle(pathname);

  return (
    <div className={styles.shell}>
      {/* Sidebar navigation drawer - desktop fixed, mobile slide-in */}
      <Sidebar
        user={user}
        onLogout={handleLogout}
        collapsed={collapsed}
        onCollapseToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileMenuOpen}
      />

      {/* Backdrop for closing mobile navigation drawer when clicked outside */}
      {mobileMenuOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu samping"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setMobileMenuOpen(false);
            }
          }}
        />
      )}

      {/* Main Content container */}
      <div className={`${styles.mainContainer} ${collapsed ? styles.collapsed : ''}`}>
        {/* Top header navigation bar */}
        <Header
          user={user}
          title={title}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Child Pages Content */}
        <main className={styles.content}>{children}</main>

        {/* Bottom Navigation for mobile/tablet screens (< 1024px) */}
        <BottomNav user={user} />
      </div>
    </div>
  );
}
