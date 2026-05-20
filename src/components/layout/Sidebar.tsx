'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  BarChart3,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Upload,
  LogOut,
  Clock,
} from 'lucide-react';
import type { AuthUser, NavItem } from '@/types';
import styles from './Sidebar.module.css';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY', 'VIEWER'] },
  { label: 'Input Transaksi', href: '/transaksi/input', icon: 'PlusCircle', roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY'] },
  { label: 'Riwayat', href: '/transaksi/riwayat', icon: 'ClipboardList', roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY'] },
  { label: 'Ongoing Payment', href: '/transaksi/ongoing', icon: 'Clock', roles: ['SUPERADMIN', 'ADMIN'] },
  { label: 'Import Data', href: '/transaksi/import', icon: 'Upload', roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY'] },
  { label: 'Laporan', href: '/laporan', icon: 'BarChart3', roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY', 'VIEWER'] },
  { label: 'Pengguna', href: '/admin/users', icon: 'Users', roles: ['SUPERADMIN'] },
  { label: 'Cabang', href: '/admin/branches', icon: 'Building2', roles: ['SUPERADMIN'] },
  { label: 'Kategori', href: '/admin/kategori', icon: 'Settings', roles: ['SUPERADMIN'] },
];

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  BarChart3,
  Users,
  Building2,
  Settings,
  Upload,
  Clock,
};

interface SidebarProps {
  user: AuthUser;
  onLogout: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  mobileOpen?: boolean;
}

export default function Sidebar({ 
  user, 
  onLogout, 
  collapsed: controlledCollapsed,
  onCollapseToggle,
  mobileOpen = false
}: SidebarProps) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? localCollapsed;
  const toggleCollapse = onCollapseToggle ?? (() => setLocalCollapsed(!localCollapsed));

  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role)
  );

  // Group items: main nav vs admin
  const mainItems = visibleItems.filter((item) => !item.href.startsWith('/admin'));
  const adminItems = visibleItems.filter((item) => item.href.startsWith('/admin'));

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      {/* Brand */}
      <div className={styles.brand}>
        {!collapsed && (
          <div className={styles.brandText}>
            <span className={styles.brandName}>Web GA</span>
            <span className={styles.brandSub}>General Affairs</span>
          </div>
        )}
        <button
          className={styles.collapseBtn}
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {mainItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {adminItems.length > 0 && (
          <>
            <div className={styles.navDivider}>
              {!collapsed && <span>Admin</span>}
            </div>
            <ul className={styles.navList}>
              {adminItems.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={20} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* User Info & Logout */}
      <div className={styles.footer}>
        {!collapsed && (
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user.fullName}</span>
              <span className={styles.userRole}>{user.branchName || 'Semua Cabang'}</span>
            </div>
          </div>
        )}
        <button
          className={styles.logoutBtn}
          onClick={onLogout}
          title="Keluar"
          aria-label="Keluar"
        >
          <LogOut size={18} />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
