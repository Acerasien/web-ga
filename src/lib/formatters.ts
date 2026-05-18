/**
 * Format angka ke format Rupiah Indonesia
 * @example formatRupiah(75000) → "Rp 75.000"
 * @example formatRupiah(1500000) → "Rp 1.500.000"
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format angka ke format ringkas (untuk chart labels)
 * @example formatRupiahShort(1500000) → "Rp 1,5jt"
 * @example formatRupiahShort(500000) → "Rp 500rb"
 */
export function formatRupiahShort(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1).replace('.0', '')}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace('.0', '')}jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)}rb`;
  }
  return `Rp ${amount}`;
}

/**
 * Format tanggal ke format Indonesia
 * @example formatDate(new Date()) → "12 Mei 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Format tanggal pendek
 * @example formatDateShort(new Date()) → "12/05/2026"
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Format tanggal + waktu
 * @example formatDateTime(new Date()) → "12 Mei 2026, 14:30"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Label untuk metode pembayaran
 */
export function formatPaymentMethod(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'Tunai',
    TRANSFER: 'Transfer',
    PETTY_CASH: 'Kas Kecil',
  };
  return labels[method] || method;
}

/**
 * Label untuk role pengguna
 */
export function formatRole(role: string): string {
  const labels: Record<string, string> = {
    SUPERADMIN: 'Super Admin',
    DATA_ENTRY: 'Data Entry',
    VIEWER: 'Viewer',
  };
  return labels[role] || role;
}
