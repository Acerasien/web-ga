'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  BarChart3,
} from 'lucide-react';
import type { AuthUser } from '@/types';
import styles from './BottomNav.module.css';

/**
 * Mobile bottom navigation bar.
 * Shows max 4 items based on user role.
 * Visible only on screens < 1024px.
 */

interface BottomNavProps {
  user: AuthUser;
}

interface BottomNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const ITEMS: BottomNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY', 'VIEWER'] },
  { label: 'Input', href: '/transaksi/input', icon: PlusCircle, roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY'] },
  { label: 'Riwayat', href: '/transaksi/riwayat', icon: ClipboardList, roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY'] },
  { label: 'Laporan', href: '/laporan', icon: BarChart3, roles: ['SUPERADMIN', 'ADMIN', 'DATA_ENTRY', 'VIEWER'] },
];

export default function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();

  const visibleItems = ITEMS.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <nav className={styles.bottomNav} aria-label="Navigasi utama mobile">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon size={22} />
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
