'use client';

import { Menu } from 'lucide-react';
import type { AuthUser } from '@/types';
import { formatRole } from '@/lib/formatters';
import styles from './Header.module.css';

/**
 * Top header bar for mobile view.
 * Shows page title, hamburger menu for mobile, and user badge.
 * On desktop, shows inside the main content area.
 */

interface HeaderProps {
  user: AuthUser;
  title?: string;
  onMenuToggle?: () => void;
}

export default function Header({ user, title = 'Dashboard', onMenuToggle }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.right}>
        <div className={styles.userBadge}>
          <span className={styles.userName}>{user.fullName}</span>
          <span className={styles.userRole}>{formatRole(user.role)}</span>
        </div>
      </div>
    </header>
  );
}
