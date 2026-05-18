'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
          title="Dashboard" // Will adapt dynamically once we build out sub-route state context
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
