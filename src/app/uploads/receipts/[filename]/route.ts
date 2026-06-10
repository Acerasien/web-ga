import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getCurrentUser } from '@/lib/actions/auth';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Sesi tidak valid. Silakan login kembali.', { status: 401 });
    }

    // 2. Resolve parameters asynchronously (Next.js 15+ requirement)
    const { filename } = await params;

    // 3. Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Akses ditolak: Parameter tidak valid.', { status: 403 });
    }

    // 4. Retrieve file from secure uploads folder
    const secureDir = join(process.cwd(), 'uploads', 'receipts');
    const filePath = join(secureDir, filename);

    if (!existsSync(filePath)) {
      return new NextResponse('Berkas tidak ditemukan.', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    
    // Determine MIME type from filename extension
    let mimeType = 'application/octet-stream';
    if (filename.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (filename.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600, no-transform',
      },
    });
  } catch (error) {
    console.error('Error serving secure file:', error);
    return new NextResponse('Terjadi kesalahan internal saat memuat berkas.', { status: 500 });
  }
}
