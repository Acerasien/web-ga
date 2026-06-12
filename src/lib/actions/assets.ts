'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import { createAuditLog } from '@/lib/actions/audit';
import type { AssetFormData, ApiResponse } from '@/types';
import { normalizeAssetCategory } from '@/types';
import { AssetStatus, Prisma } from '@prisma/client';

export interface AssetWithRelations {
  id: number;
  branchId: number;
  userId: number;
  assetTag: string | null;
  name: string;
  brandModel: string | null;
  category: string;
  locationDetail: string | null;
  pic: string | null;
  status: AssetStatus;
  imagePath: string | null;
  notes: string | null;
  purchaseYear: number | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  branch: {
    name: string;
    code: string;
  };
  user: {
    fullName: string;
  };
}

export interface PaginatedAssets {
  assets: AssetWithRelations[];
  totalCount: number;
  totalPages: number;
}

export interface AssetFilters {
  search?: string;
  branchId?: number;
  status?: AssetStatus;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Server Action to query assets based on search query, status, category, and branch.
 * Enforces branch restrictions based on the user's role.
 */
export async function getAssets(filters: AssetFilters = {}): Promise<ApiResponse<PaginatedAssets>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    // 1. Resolve branch isolation constraints
    let branchConstraint: number | undefined = undefined;
    if (user.role !== 'SUPERADMIN') {
      if (!user.branchId) {
        return { success: false, error: 'Cabang asal tidak terdeteksi untuk akun Anda.' };
      }
      branchConstraint = user.branchId;
    } else if (filters.branchId) {
      branchConstraint = filters.branchId;
    }

    // 2. Build where filter clauses
    const whereClause: Prisma.AssetWhereInput = {
      archivedAt: null, // Only return active, non-archived assets
    };

    if (branchConstraint !== undefined) {
      whereClause.branchId = branchConstraint;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.category) {
      whereClause.category = filters.category;
    }

    if (filters.search && filters.search.trim() !== '') {
      const searchTerms = filters.search.trim();
      whereClause.OR = [
        { name: { contains: searchTerms, mode: 'insensitive' } },
        { assetTag: { contains: searchTerms, mode: 'insensitive' } },
        { category: { contains: searchTerms, mode: 'insensitive' } },
        { brandModel: { contains: searchTerms, mode: 'insensitive' } },
        { locationDetail: { contains: searchTerms, mode: 'insensitive' } },
        { pic: { contains: searchTerms, mode: 'insensitive' } },
        { notes: { contains: searchTerms, mode: 'insensitive' } },
      ];
    }

    // 3. Query records & total count in parallel
    const [assets, totalCount] = await Promise.all([
      prisma.asset.findMany({
        where: whereClause,
        include: {
          branch: { select: { name: true, code: true } },
          user: { select: { fullName: true } },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.asset.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      data: {
        assets: JSON.parse(JSON.stringify(assets)) as AssetWithRelations[],
        totalCount,
        totalPages,
      },
    };
  } catch (error) {
    console.error('Error fetching assets:', error);
    return { success: false, error: 'Gagal memuat daftar inventaris dari database.' };
  }
}

/**
 * Server Action to register a new asset.
 */
export async function createAsset(data: AssetFormData): Promise<ApiResponse<AssetWithRelations>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role === 'VIEWER') {
      return { success: false, error: 'Akses ditolak: Viewer tidak diizinkan menambah inventaris.' };
    }

    // Determine target Branch ID based on role permissions
    let targetBranchId: number;
    if (user.role === 'SUPERADMIN') {
      if (!data.branchId) {
        return { success: false, error: 'Administrator wajib menentukan cabang penanggung jawab.' };
      }
      targetBranchId = data.branchId;
    } else {
      if (!user.branchId) {
        return { success: false, error: 'Cabang asal tidak terdeteksi untuk akun Anda.' };
      }
      targetBranchId = user.branchId;
    }

    // Validate fields
    if (!data.name.trim()) {
      return { success: false, error: 'Nama aset tidak boleh kosong.' };
    }
    const categoryNormalized = normalizeAssetCategory(data.category);
    if (!categoryNormalized) {
      return { success: false, error: 'Kategori aset tidak valid.' };
    }

    // Validate purchaseYear
    if (data.purchaseYear === undefined || data.purchaseYear === null) {
      return { success: false, error: 'Tahun pembelian wajib diisi.' };
    }
    const currentYear = new Date().getFullYear();
    if (isNaN(data.purchaseYear) || data.purchaseYear < 1900 || data.purchaseYear > currentYear + 5) {
      return { success: false, error: `Tahun pembelian tidak valid (harus antara 1900 dan ${currentYear + 5}).` };
    }

    // Check assetTag uniqueness in active assets
    if (data.assetTag && data.assetTag.trim() !== '') {
      const existing = await prisma.asset.findFirst({
        where: {
          assetTag: data.assetTag.trim(),
          archivedAt: null,
        },
      });
      if (existing) {
        return { success: false, error: `Kode Tag Aset '${data.assetTag}' sudah terdaftar.` };
      }
    }

    const newAsset = await prisma.asset.create({
      data: {
        branchId: targetBranchId,
        userId: user.id,
        assetTag: data.assetTag?.trim() || null,
        name: data.name.trim(),
        brandModel: data.brandModel?.trim() || null,
        category: categoryNormalized,
        locationDetail: data.locationDetail?.trim() || null,
        pic: data.pic?.trim() || null,
        status: data.status,
        imagePath: data.imagePath || null,
        notes: data.notes?.trim() || null,
        purchaseYear: data.purchaseYear,
      },
      include: {
        branch: { select: { name: true, code: true } },
        user: { select: { fullName: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      actionType: 'CREATE',
      targetTable: 'Asset',
      targetId: String(newAsset.id),
      description: `Menambahkan aset baru: ${newAsset.name} (${newAsset.category}) di cabang ${newAsset.branch.name}`,
    });

    revalidatePath('/inventaris');

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newAsset)) as AssetWithRelations,
    };
  } catch (error) {
    console.error('Error creating asset:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat mendaftarkan aset.' };
  }
}

/**
 * Server Action to update an existing asset.
 */
export async function updateAsset(
  id: number,
  data: AssetFormData
): Promise<ApiResponse<AssetWithRelations>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role === 'VIEWER') {
      return { success: false, error: 'Akses ditolak: Viewer tidak diizinkan mengubah inventaris.' };
    }

    // Fetch existing asset to verify branch permission boundary
    const existingAsset = await prisma.asset.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!existingAsset || existingAsset.archivedAt) {
      return { success: false, error: 'Aset tidak ditemukan atau sudah diarsipkan.' };
    }

    // Enforce branch safety limits
    if (user.role !== 'SUPERADMIN' && existingAsset.branchId !== user.branchId) {
      return { success: false, error: 'Akses ditolak: Anda tidak memiliki akses untuk mengubah aset cabang lain.' };
    }

    // Validate fields
    if (!data.name.trim()) {
      return { success: false, error: 'Nama aset tidak boleh kosong.' };
    }
    const categoryNormalized = normalizeAssetCategory(data.category);
    if (!categoryNormalized) {
      return { success: false, error: 'Kategori aset tidak valid.' };
    }

    // Validate purchaseYear
    if (data.purchaseYear === undefined || data.purchaseYear === null) {
      return { success: false, error: 'Tahun pembelian wajib diisi.' };
    }
    const currentYear = new Date().getFullYear();
    if (isNaN(data.purchaseYear) || data.purchaseYear < 1900 || data.purchaseYear > currentYear + 5) {
      return { success: false, error: `Tahun pembelian tidak valid (harus antara 1900 dan ${currentYear + 5}).` };
    }

    // Check assetTag uniqueness if changed
    const newTag = data.assetTag?.trim();
    if (newTag && newTag !== (existingAsset.assetTag || '')) {
      const conflicting = await prisma.asset.findFirst({
        where: {
          assetTag: newTag,
          archivedAt: null,
          id: { not: id },
        },
      });
      if (conflicting) {
        return { success: false, error: `Kode Tag Aset '${newTag}' sudah terdaftar pada aset lain.` };
      }
    }

    // Resolve update branchId
    let updateBranchId = existingAsset.branchId;
    if (user.role === 'SUPERADMIN' && data.branchId) {
      updateBranchId = data.branchId;
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: {
        branchId: updateBranchId,
        assetTag: newTag || null,
        name: data.name.trim(),
        brandModel: data.brandModel?.trim() || null,
        category: categoryNormalized,
        locationDetail: data.locationDetail?.trim() || null,
        pic: data.pic?.trim() || null,
        status: data.status,
        imagePath: data.imagePath || existingAsset.imagePath,
        notes: data.notes?.trim() || null,
        purchaseYear: data.purchaseYear,
      },
      include: {
        branch: { select: { name: true, code: true } },
        user: { select: { fullName: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      actionType: 'UPDATE',
      targetTable: 'Asset',
      targetId: String(id),
      description: `Mengubah detail aset ${updated.name} (ID: ${id})`,
    });

    revalidatePath('/inventaris');

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updated)) as AssetWithRelations,
    };
  } catch (error) {
    console.error('Error updating asset:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat memperbarui aset.' };
  }
}

/**
 * Server Action to archive (soft delete) an asset.
 */
export async function archiveAsset(id: number): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role === 'VIEWER') {
      return { success: false, error: 'Akses ditolak: Viewer tidak diizinkan menghapus inventaris.' };
    }

    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset || existingAsset.archivedAt) {
      return { success: false, error: 'Aset tidak ditemukan atau sudah diarsipkan.' };
    }

    // Enforce branch safety limits
    if (user.role !== 'SUPERADMIN' && existingAsset.branchId !== user.branchId) {
      return { success: false, error: 'Akses ditolak: Anda tidak memiliki akses untuk menghapus aset cabang lain.' };
    }

    await prisma.asset.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      actionType: 'DELETE',
      targetTable: 'Asset',
      targetId: String(id),
      description: `Mengarsipkan aset ${existingAsset.name} (ID: ${id})`,
    });

    revalidatePath('/inventaris');

    return { success: true };
  } catch (error) {
    console.error('Error archiving asset:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat menghapus aset.' };
  }
}

function parseCSV(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const lines: string[][] = [];
  let row: string[] = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }

  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }

  return lines;
}

export interface CSVImportResult {
  totalRows: number;
  importedCount: number;
  errors: string[];
}

/**
 * Server Action to bulk import assets from a CSV string.
 * Automatically resolves status (case-insensitively with default fallbacks) and maps branch codes/names.
 */
export async function importAssets(csvString: string): Promise<ApiResponse<CSVImportResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role === 'VIEWER') {
      return { success: false, error: 'Akses ditolak: Viewer tidak diizinkan mengimpor data.' };
    }

    const rawLines = parseCSV(csvString);
    if (rawLines.length < 2) {
      return { success: false, error: 'File CSV/Excel kosong atau tidak memiliki data baris.' };
    }

    const headers = rawLines[0].map(h => h.trim().toLowerCase());

    // Find index offsets for headings
    const idxTag = headers.findIndex(h => h.includes('tag') || h.includes('kode') || h === 'code');
    const idxName = headers.findIndex(h => h === 'nama' || h === 'name' || h.includes('barang') || h.includes('aset'));
    const idxBrand = headers.findIndex(h => h.includes('brand') || h.includes('model') || h.includes('merek'));
    const idxCategory = headers.findIndex(h => h === 'kategori' || h === 'category');
    const idxLocation = headers.findIndex(h => h.includes('lokasi') || h.includes('location') || h.includes('detail'));
    const idxPIC = headers.findIndex(h => h.includes('pic') || h.includes('penanggung') || h.includes('holder'));
    const idxStatus = headers.findIndex(h => h.includes('status') || h.includes('kondisi'));
    const idxNotes = headers.findIndex(h => h.includes('catatan') || h.includes('notes') || h.includes('keterangan'));
    const idxBranch = headers.findIndex(h => h.includes('cabang') || h.includes('branch'));
    const idxYear = headers.findIndex(h => h.includes('tahun') || h.includes('year') || h === 'thn' || h.includes('pembelian'));

    // Validate mandatory headers
    if (idxName === -1 || idxCategory === -1 || idxYear === -1) {
      return {
        success: false,
        error: 'Struktur kolom tidak lengkap. Pastikan memiliki kolom dengan tajuk: Nama (Name), Kategori (Category), dan Tahun (Year).',
      };
    }

    // Load branches database cache
    const dbBranches = await prisma.branch.findMany();
    const dataRows = rawLines.slice(1).filter(r => r.length > 0 && r.some(val => val.trim() !== ''));

    const importErrors: string[] = [];
    const assetsToInsert: Prisma.AssetCreateManyInput[] = [];

    // Pre-query existing active asset tags to avoid N+1 DB operations
    const fileTags = new Set<string>();
    if (idxTag !== -1) {
      for (const row of dataRows) {
        const tag = row[idxTag]?.trim();
        if (tag && tag !== '') {
          fileTags.add(tag);
        }
      }
    }

    const dbTags = new Set<string>();
    if (fileTags.size > 0) {
      const existingAssets = await prisma.asset.findMany({
        where: {
          assetTag: { in: Array.from(fileTags) },
          archivedAt: null,
        },
        select: { assetTag: true },
      });
      existingAssets.forEach(a => {
        if (a.assetTag) dbTags.add(a.assetTag);
      });
    }

    const seenImportTags = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      try {
        // 1. Name Check
        const name = row[idxName]?.trim();
        if (!name) {
          throw new Error('Nama aset tidak boleh kosong.');
        }

        // 2. Category Check
        const categoryRaw = row[idxCategory]?.trim();
        if (!categoryRaw) {
          throw new Error('Kategori aset tidak boleh kosong.');
        }
        const categoryNormalized = normalizeAssetCategory(categoryRaw);
        if (!categoryNormalized) {
          throw new Error(`Kategori '${categoryRaw}' tidak valid.`);
        }

        // 3. Asset Tag Unique Validation
        let assetTag: string | null = null;
        if (idxTag !== -1 && row[idxTag]?.trim()) {
          assetTag = row[idxTag].trim();
          if (seenImportTags.has(assetTag)) {
            throw new Error(`Kode Tag Aset '${assetTag}' duplikat di dalam file.`);
          }
          if (dbTags.has(assetTag)) {
            throw new Error(`Kode Tag Aset '${assetTag}' sudah digunakan di database.`);
          }
          seenImportTags.add(assetTag);
        }

        // 4. Brand Model
        const brandModel = idxBrand !== -1 ? row[idxBrand]?.trim() || null : null;

        // 5. Location Detail
        const locationDetail = idxLocation !== -1 ? row[idxLocation]?.trim() || null : null;

        // 6. PIC
        const pic = idxPIC !== -1 ? row[idxPIC]?.trim() || null : null;

        // 7. Notes
        const notes = idxNotes !== -1 ? row[idxNotes]?.trim() || null : null;

        // 8. Status Matching Case-insensitively
        let status: AssetStatus = AssetStatus.AKTIF;
        if (idxStatus !== -1 && row[idxStatus]) {
          const statusRaw = row[idxStatus].trim().toLowerCase();
          if (statusRaw.includes('rusak') || statusRaw === 'broken' || statusRaw === 'damaged') {
            status = AssetStatus.RUSAK;
          } else if (statusRaw.includes('perbaikan') || statusRaw.includes('servis') || statusRaw === 'repair' || statusRaw === 'diperbaiki') {
            status = AssetStatus.DIPERBAIKI;
          } else if (statusRaw.includes('hilang') || statusRaw === 'lost' || statusRaw === 'missing') {
            status = AssetStatus.HILANG;
          } else if (statusRaw.includes('aktif') || statusRaw.includes('good') || statusRaw === 'active' || statusRaw === 'bagus') {
            status = AssetStatus.AKTIF;
          }
        }

        // 9. Branch Isolation check
        let branchIdVal: number;
        if (user.role === 'SUPERADMIN') {
          const branchRaw = idxBranch !== -1 ? row[idxBranch]?.trim().toLowerCase() : '';
          const matchedBranch = dbBranches.find(
            b => b.name.toLowerCase() === branchRaw || b.code.toLowerCase() === branchRaw
          );
          if (matchedBranch) {
            branchIdVal = matchedBranch.id;
          } else {
            // Default to Superadmin home branch or the first registered branch
            branchIdVal = user.branchId || dbBranches[0]?.id;
            if (!branchIdVal) {
              throw new Error('Cabang penanggung jawab tidak valid dan tidak ada cabang default.');
            }
          }
        } else {
          // Locked to Data Entry / Admin branch
          if (!user.branchId) {
            throw new Error('Cabang asal tidak terdeteksi untuk akun Anda.');
          }
          branchIdVal = user.branchId;
        }

        // 10. Purchase Year Check
        let purchaseYear: number;
        if (idxYear !== -1 && row[idxYear]?.trim()) {
          const parsedYear = parseInt(row[idxYear].trim(), 10);
          const currentYear = new Date().getFullYear();
          if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > currentYear + 5) {
            throw new Error('Tahun pembelian harus berupa angka tahun yang valid (misal: 2024).');
          }
          purchaseYear = parsedYear;
        } else {
          throw new Error('Tahun pembelian wajib diisi.');
        }

        assetsToInsert.push({
          branchId: branchIdVal,
          userId: user.id,
          assetTag,
          name,
          brandModel,
          category: categoryNormalized,
          locationDetail,
          pic,
          status,
          notes,
          purchaseYear,
          imagePath: null, // Initial import does not carry photo files
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Kesalahan tidak diketahui';
        importErrors.push(`Baris ${rowNum}: ${message}`);
      }
    }

    // If there are errors, fail-fast and return them without database modifications (atomic safety)
    if (importErrors.length > 0) {
      return {
        success: false,
        error: 'Beberapa baris data gagal divalidasi.',
        data: {
          totalRows: dataRows.length,
          importedCount: 0,
          errors: importErrors,
        },
      };
    }

    // Commit records in a transaction block
    await prisma.$transaction(async (tx) => {
      for (const asset of assetsToInsert) {
        await tx.asset.create({ data: asset });
      }
    });

    await createAuditLog({
      userId: user.id,
      actionType: 'CREATE',
      targetTable: 'Asset',
      targetId: 'BULK',
      description: `Melakukan impor massal ${assetsToInsert.length} aset dari Excel/CSV`,
    });

    revalidatePath('/inventaris');

    return {
      success: true,
      data: {
        totalRows: dataRows.length,
        importedCount: assetsToInsert.length,
        errors: [],
      },
    };
  } catch (error) {
    console.error('Error importing assets:', error);
    return { success: false, error: 'Terjadi kesalahan internal saat memproses impor data.' };
  }
}

export interface BranchAssetStats {
  branchId: number;
  name: string;
  code: string;
  totalCount: number;
  aktifCount: number;
  rusakCount: number;
  diperbaikiCount: number;
  hilangCount: number;
}

/**
 * Server Action to fetch aggregated asset status counts grouped by branch.
 * Enforces SUPERADMIN permission boundaries.
 */
export async function getBranchAssetStats(): Promise<ApiResponse<BranchAssetStats[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya Superadmin yang dapat memuat statistik cabang.' };
    }

    // 1. Fetch branches list
    const branches = await prisma.branch.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // 2. Aggregate count of active assets by branch and status in one database trip
    const counts = await prisma.asset.groupBy({
      by: ['branchId', 'status'],
      where: {
        archivedAt: null,
      },
      _count: {
        id: true,
      },
    });

    // 3. Map aggregates to branch objects
    const stats: BranchAssetStats[] = branches.map(b => {
      const branchCounts = counts.filter(c => c.branchId === b.id);
      
      const totalCount = branchCounts.reduce((acc, c) => acc + c._count.id, 0);
      const aktifCount = branchCounts.find(c => c.status === AssetStatus.AKTIF)?._count.id || 0;
      const rusakCount = branchCounts.find(c => c.status === AssetStatus.RUSAK)?._count.id || 0;
      const diperbaikiCount = branchCounts.find(c => c.status === AssetStatus.DIPERBAIKI)?._count.id || 0;
      const hilangCount = branchCounts.find(c => c.status === AssetStatus.HILANG)?._count.id || 0;

      return {
        branchId: b.id,
        name: b.name,
        code: b.code,
        totalCount,
        aktifCount,
        rusakCount,
        diperbaikiCount,
        hilangCount,
      };
    });

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('Error fetching branch asset stats:', error);
    return { success: false, error: 'Gagal memuat statistik aset per cabang.' };
  }
}

