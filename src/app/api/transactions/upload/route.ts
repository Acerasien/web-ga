import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/actions/auth';

// Configuration boundaries for uploader safety (Poka-Yoke)
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Megabytes in bytes

/**
 * API Route Handler to securely upload transaction receipts to the server's local disk.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user session
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Sesi Anda telah berakhir atau tidak valid. Silakan login kembali.' },
        { status: 401 }
      );
    }

    // 2. Authorize user role - VIEWER is not allowed to upload files
    if (user.role === 'VIEWER') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Peran Anda tidak diizinkan untuk mengunggah berkas.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada berkas yang dikirimkan.' },
        { status: 400 }
      );
    }

    // 1. Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Ukuran berkas melebihi batas maksimum 5MB.' },
        { status: 400 }
      );
    }

    // 2. Validate MIME Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Format berkas tidak didukung. Gunakan PNG, JPG, JPEG, atau PDF.' },
        { status: 400 }
      );
    }

    // 3. Setup secure filesystem destination
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'receipts');
    // Ensure parent folders are initialized
    await mkdir(uploadDir, { recursive: true });

    // 4. Generate highly randomized, safe filename to prevent path traversal
    const fileExtension = extname(file.name) || (file.type === 'application/pdf' ? '.pdf' : '.jpg');
    const safeFilename = `${crypto.randomUUID()}${fileExtension}`;
    const filePath = join(uploadDir, safeFilename);

    // 5. Convert Web File stream to Node Buffer and write to disk
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, fileBuffer);

    // Return the relative URL path accessible by the frontend
    const relativeUrl = `/uploads/receipts/${safeFilename}`;

    return NextResponse.json({
      success: true,
      message: 'Berkas berhasil diunggah.',
      receiptPath: relativeUrl,
    });
  } catch (error) {
    console.error('Error during receipt file upload handler:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan sistem saat mengunggah berkas.' },
      { status: 500 }
    );
  }
}
