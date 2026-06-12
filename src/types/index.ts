// Shared TypeScript types for Web_GA
// These supplement Prisma's generated types with frontend-specific interfaces

import type { UserRole, PaymentMethod, Location } from '@prisma/client';

// ============================================================
// Auth Types
// ============================================================

export interface JWTPayload {
  userId: number;
  username: string;
  role: UserRole;
  branchId: number | null;
  branchCode: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;
}

// ============================================================
// Category Dynamic Fields
// ============================================================

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

export interface CategoryField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // For 'select' type
}

export interface FieldsConfig {
  fields: CategoryField[];
}

// ============================================================
// Transaction Form
// ============================================================

export interface TransactionFormData {
  categoryId: number;
  subCategoryId?: number;
  transactionDate: string;
  description: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  // Price breakdown fields (all optional — null/undefined = not applicable)
  discountPerUnit?: number;
  discountTotal?: number;
  taxAmount?: number;
  taxNote?: string;
  paymentMethod: PaymentMethod;
  location?: Location;
  vendor?: string;
  receiptPath?: string;
  notes?: string;
  customFields?: Record<string, string | number>;
  beritaAcara?: string;
  invoiceNumber?: string | null;
  ongoingPaymentId?: number;
}

// ============================================================
// Report / Analytics Types
// ============================================================

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReportFilter {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  branchId?: number;
  categoryId?: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface CategorySummary {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  totalAmount: number;
  transactionCount: number;
}

// ============================================================
// API Response Wrapper
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================
// Navigation
// ============================================================

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
}

// ============================================================
// Asset Types
// ============================================================

export const ASSET_CATEGORIES = [
  'Elektronik',
  'Peralatan Kantor',
  'Mebel & Furniture',
  'Kendaraan',
  'Peralatan Dapur & Mess',
  'Perkakas & Alat Berat',
  'Lain-lain'
] as const;

export type AssetCategory = typeof ASSET_CATEGORIES[number];

export function isValidAssetCategory(category: string): category is AssetCategory {
  return ASSET_CATEGORIES.includes(category as AssetCategory);
}

export function normalizeAssetCategory(category: string): AssetCategory | null {
  const normalized = category.trim().toLowerCase();
  const matched = ASSET_CATEGORIES.find(c => c.toLowerCase() === normalized);
  return matched || null;
}

export interface AssetFormData {
  assetTag?: string | null;
  name: string;
  brandModel?: string | null;
  category: string;
  locationDetail?: string | null;
  pic?: string | null;
  status: 'AKTIF' | 'RUSAK' | 'DIPERBAIKI' | 'HILANG';
  imagePath?: string | null;
  notes?: string | null;
  purchaseYear: number;
  branchId?: number;
}


