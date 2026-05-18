'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { PaymentMethod, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface CSVImportResult {
  totalRows: number;
  importedCount: number;
  errors: string[];
}

function parseCSV(text: string): string[][] {
  // Dynamically determine delimiter based on header density (Excel compatibility)
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
        i++; // skip next quote
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

/**
 * Safe Date parser that tolerates both ISO YYYY-MM-DD and ID Excel DD/MM/YYYY formats.
 */
function parseCSVDate(dateStr: string): Date {
  const trimmed = dateStr.trim();
  
  if (trimmed.includes('/') || trimmed.includes('-')) {
    const parts = trimmed.split(/[\/\-]/);
    if (parts.length === 3) {
      // Case 1: YYYY/MM/DD or YYYY-MM-DD
      if (parts[0].length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      // Case 2: DD/MM/YYYY or DD-MM-YYYY (assume standard Indonesian format)
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }
  
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Format tanggal '${dateStr}' tidak valid.`);
  }
  return parsed;
}

/**
 * Server Action to securely bulk-import transactions from a parsed CSV string.
 * Runs atomically in a single Prisma transaction to avoid partial database corruption.
 */
export async function importTransactions(csvString: string): Promise<ApiResponse<CSVImportResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    if (user.role === 'VIEWER') {
      return {
        success: false,
        error: 'Akses Ditolak: Peran VIEWER tidak diizinkan mengunggah data.',
      };
    }

    // Parse the full raw CSV grid
    const rawLines = parseCSV(csvString);
    if (rawLines.length < 2) {
      return {
        success: false,
        error: 'File CSV kosong atau tidak memiliki data baris.',
      };
    }

    // Map headers dynamically (case-insensitive & whitespace trimmed)
    const headers = rawLines[0].map(h => h.trim().toLowerCase());
    
    // Find index offsets for primary columns
    const idxDate = headers.findIndex(h => h.includes('tanggal') || h.includes('date'));
    const idxCategory = headers.findIndex(h => h.includes('kategori') || h.includes('category'));
    const idxSubCategory = headers.findIndex(h => h.includes('sub-kategori') || h.includes('subcategory') || h.includes('subkategori'));
    const idxDescription = headers.findIndex(h => h.includes('deskripsi') || h.includes('description') || h.includes('kebutuhan'));
    const idxQuantity = headers.findIndex(h => h.includes('kuantitas') || h.includes('jumlah') || h.includes('qty') || h.includes('quantity'));
    const idxUnit = headers.findIndex(h => h.includes('satuan') || h.includes('unit'));
    const idxPrice = headers.findIndex(h => h.includes('harga') || h.includes('price'));
    const idxPayment = headers.findIndex(h => h.includes('pembayaran') || h.includes('payment') || h.includes('metode'));
    const idxVendor = headers.findIndex(h => h.includes('vendor') || h.includes('supplier'));
    const idxNotes = headers.findIndex(h => h.includes('catatan') || h.includes('notes'));
    const idxBranch = headers.findIndex(h => h.includes('cabang') || h.includes('branch'));

    // Check mandatory header columns
    if (idxDate === -1 || idxCategory === -1 || idxDescription === -1 || idxQuantity === -1 || idxUnit === -1 || idxPrice === -1) {
      return {
        success: false,
        error: 'Struktur kolom CSV tidak lengkap. Pastikan memiliki kolom: Tanggal, Kategori, Deskripsi, Kuantitas, Satuan, dan Harga Satuan.',
      };
    }

    // Pre-query Categories, Subcategories, and Branches to ensure quick memory-mapping
    const [dbCategories, dbBranches] = await Promise.all([
      prisma.category.findMany({ include: { subCategories: true } }),
      prisma.branch.findMany(),
    ]);

    // Find the default "Lain-lain" category for mismatch fallbacks
    const fallbackCategory = dbCategories.find(c => c.name.toLowerCase() === 'lain-lain') || dbCategories[0];
    if (!fallbackCategory) {
      return {
        success: false,
        error: 'Kategori cadangan ("Lain-lain") tidak ditemukan di database.',
      };
    }

    const dataRows = rawLines.slice(1).filter(r => r.length > 1 && r.some(val => val.trim() !== ''));
    const importErrors: string[] = [];
    const transactionsToInsert: Prisma.TransactionCreateManyInput[] = [];

    // Process and validate rows sequentially
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // Offset for Excel index (1-based + header line)

      try {
        // 1. Date check
        const dateRaw = row[idxDate];
        if (!dateRaw || dateRaw.trim() === '') {
          throw new Error('Tanggal transaksi tidak boleh kosong.');
        }
        const transactionDate = parseCSVDate(dateRaw);

        // 2. Category matching (Poka-Yoke: Fallback mismatches to 'Lain-lain')
        const catNameRaw = row[idxCategory]?.trim().toLowerCase();
        let matchedCategory = dbCategories.find(
          c => c.name.toLowerCase() === catNameRaw || c.code.toLowerCase() === catNameRaw
        );

        if (!matchedCategory) {
          // Fall back to 'Lain-lain' category safely as per user instruction
          matchedCategory = fallbackCategory;
        }

        // 3. Subcategory matching (Optional)
        let subCategoryId: number | null = null;
        if (idxSubCategory !== -1 && row[idxSubCategory]) {
          const subNameRaw = row[idxSubCategory].trim().toLowerCase();
          const matchedSub = matchedCategory.subCategories.find(
            s => s.name.toLowerCase() === subNameRaw
          );
          if (matchedSub) {
            subCategoryId = matchedSub.id;
          }
        }

        // 4. Description check
        const description = row[idxDescription]?.trim();
        if (!description || description === '') {
          throw new Error('Deskripsi kebutuhan tidak boleh kosong.');
        }

        // 5. Quantity & Price metrics check
        const qtyRaw = row[idxQuantity]?.trim().replace(/[^0-9\.]/g, '');
        const priceRaw = row[idxPrice]?.trim().replace(/[^0-9\.]/g, '');

        const quantity = qtyRaw ? Number(qtyRaw) : 1;
        const pricePerUnit = priceRaw ? Number(priceRaw) : 0;

        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Kuantitas '${row[idxQuantity]}' harus berupa angka positif.`);
        }
        if (isNaN(pricePerUnit) || pricePerUnit < 0) {
          throw new Error(`Harga satuan '${row[idxPrice]}' harus berupa angka positif.`);
        }

        const totalAmount = new Prisma.Decimal(quantity * pricePerUnit);
        const unit = row[idxUnit]?.trim() || 'Unit';

        // 6. Payment Method check
        const paymentRaw = row[idxPayment]?.trim().toUpperCase();
        let paymentMethod: PaymentMethod = PaymentMethod.CASH;
        if (paymentRaw === 'TRANSFER' || paymentRaw === 'BANK_TRANSFER') {
          paymentMethod = PaymentMethod.TRANSFER;
        } else if (paymentRaw === 'PETTY_CASH' || paymentRaw === 'KAS_KECIL' || paymentRaw === 'KASKECIL') {
          paymentMethod = PaymentMethod.PETTY_CASH;
        }

        // 7. Branch isolation checks (Poka-Yoke dynamic restriction)
        let branchIdVal: number;
        if (user.role === 'SUPERADMIN') {
          // Superadmin: Match branch by name or code from CSV
          const branchRaw = idxBranch !== -1 ? row[idxBranch]?.trim().toLowerCase() : '';
          const matchedBranch = dbBranches.find(
            b => b.name.toLowerCase() === branchRaw || b.code.toLowerCase() === branchRaw
          );
          if (matchedBranch) {
            branchIdVal = matchedBranch.id;
          } else {
            // Default to home branch or HO (1st branch)
            branchIdVal = user.branchId || dbBranches[0].id;
          }
        } else {
          // DATA_ENTRY: Hard locked to their home branch ID
          if (!user.branchId) {
            throw new Error('Akun Anda tidak memiliki cabang terdaftar.');
          }
          branchIdVal = user.branchId;
        }

        // Optional fields
        const vendor = idxVendor !== -1 ? row[idxVendor]?.trim() || null : null;
        const notes = idxNotes !== -1 ? row[idxNotes]?.trim() || null : null;

        // Populate object into temporary buffer
        transactionsToInsert.push({
          transactionDate,
          categoryId: matchedCategory.id,
          subCategoryId,
          branchId: branchIdVal,
          userId: user.id,
          description,
          quantity: new Prisma.Decimal(quantity),
          unit,
          pricePerUnit: new Prisma.Decimal(pricePerUnit),
          totalAmount,
          paymentMethod,
          vendor,
          notes,
          customFields: Prisma.DbNull, // CSV imports do not map complex custom categories forms natively
        });

      } catch (err: any) {
        importErrors.push(`Baris ${rowNum}: ${err.message || 'Format data salah.'}`);
      }
    }

    // 8. Atomic transaction write or full rollback on errors
    if (importErrors.length > 0) {
      return {
        success: false,
        error: `Gagal Mengunggah: Terdapat ${importErrors.length} baris dengan kesalahan format. Silakan perbaiki file CSV Anda.`,
        data: {
          totalRows: dataRows.length,
          importedCount: 0,
          errors: importErrors,
        },
      };
    }

    // Bulk insert transactions in a single, safe Prisma batch transaction
    await prisma.$transaction(
      transactionsToInsert.map(tx => prisma.transaction.create({ data: tx as any }))
    );

    // Revalidate paths cache for active GA pages
    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');
    revalidatePath('/laporan');

    return {
      success: true,
      data: {
        totalRows: dataRows.length,
        importedCount: transactionsToInsert.length,
        errors: [],
      },
    };

  } catch (error) {
    console.error('Error bulk importing CSV:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem internal saat memproses unggahan data massal.',
    };
  }
}
