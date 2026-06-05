'use client';

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import type { AuthUser } from '@/types';
import styles from './Header.module.css';

/**
 * Top header bar for mobile view.
 * Shows page title, hamburger menu for mobile, and live date/time.
 * On desktop, shows inside the main content area.
 */

interface HeaderProps {
  user: AuthUser;
  title?: string;
  onMenuToggle?: () => void;
}

export default function Header({ user, title = 'Dashboard', onMenuToggle }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
          <span className={styles.userName}>
            {currentTime ? currentTime.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }) : 'Memuat tanggal...'}
          </span>
          <span className={styles.userRole}>
            {currentTime ? currentTime.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }) : '--:--:--'}
          </span>
        </div>
      </div>
    </header>
  );
}
