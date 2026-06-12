import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/actions/auth';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Secure API Endpoint to upload inventory / asset photos to local disk.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Protection
    const host = request.headers.get('host');
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    let isValidOrigin = false;

    if (origin) {
      const originHost = new URL(origin).host;
      isValidOrigin = originHost === host;
    } else if (referer) {
      const refererHost = new URL(referer).host;
      isValidOrigin = refererHost === host;
    }

    if (!isValidOrigin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Invalid request origin.' },
        { status: 403 }
      );
    }

    // 2. Authenticate user session
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' },
        { status: 401 }
      );
    }

    // 3. Authorize role - VIEWER is not allowed to upload files
    if (user.role === 'VIEWER') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Akun Viewer tidak diizinkan mengunggah foto.' },
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

    // 4. Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Ukuran foto melebihi batas maksimum 5MB.' },
        { status: 400 }
      );
    }

    // 5. Validate MIME Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Format berkas tidak didukung. Hanya gambar PNG, JPG, dan JPEG yang diperbolehkan.' },
        { status: 400 }
      );
    }

    // 6. Setup secure filesystem destination
    const uploadDir = join(process.cwd(), 'uploads', 'assets');
    await mkdir(uploadDir, { recursive: true });

    // 7. Generate safe random filename
    const MIME_TO_EXT: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
    };
    const fileExtension = MIME_TO_EXT[file.type] || '.bin';
    const safeFilename = `${crypto.randomUUID()}${fileExtension}`;
    const filePath = join(uploadDir, safeFilename);

    // 8. Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, fileBuffer);

    const relativeUrl = `/uploads/assets/${safeFilename}`;

    return NextResponse.json({
      success: true,
      message: 'Foto berhasil diunggah.',
      imagePath: relativeUrl,
    });
  } catch (error) {
    console.error('Error during asset file upload handler:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan sistem saat mengunggah berkas.' },
      { status: 500 }
    );
  }
}
