import { Search } from 'lucide-react';
import type { Branch } from '@prisma/client';
import styles from '@/app/(dashboard)/admin/admin.module.css';

interface UserListingToolbarProps {
  search: string;
  setSearch: (val: string) => void;
  role: string;
  setRole: (val: string) => void;
  branchId: string;
  setBranchId: (val: string) => void;
  branches: Branch[];
}

export default function UserListingToolbar({
  search, setSearch, role, setRole, branchId, setBranchId, branches
}: UserListingToolbarProps) {
  return (
    <section className={styles.toolbarCard}>
      <div className={styles.filterGroup}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Cari nama atau username..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>

        <select
          className={styles.selectInput}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Semua Peran</option>
          <option value="SUPERADMIN">Superadmin</option>
          <option value="ADMIN">Admin Cabang</option>
          <option value="DATA_ENTRY">Data Entry</option>
          <option value="VIEWER">Viewer</option>
        </select>

        <select
          className={styles.selectInput}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">Semua Cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
    </section>
  );
}
