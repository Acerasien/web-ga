import { useRef } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import styles from '@/app/(dashboard)/transaksi/input/input.module.css';

interface ReceiptUploadDropzoneProps {
  receiptPath: string;
  uploadFileName: string;
  uploadFileSize: string;
  uploadError: string | null;
  uploading: boolean;
  isPending: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}

export default function ReceiptUploadDropzone({
  receiptPath,
  uploadFileName,
  uploadFileSize,
  uploadError,
  uploading,
  isPending,
  onUpload,
  onRemove
}: ReceiptUploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading || isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      // Reset input value so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      {receiptPath ? (
        // Preview Box
        <div className={styles.previewFrame}>
          {uploadFileName.toLowerCase().endsWith('.pdf') ? (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-danger)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <FileText size={32} />
            </div>
          ) : (
            <img src={receiptPath} alt="Bukti kuitansi" className={styles.previewThumb} />
          )}
          <div className={styles.previewMeta}>
            <span className={styles.previewName}>{uploadFileName}</span>
            <span className={styles.previewSize}>{uploadFileSize}</span>
          </div>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={onRemove}
            disabled={isPending}
            aria-label="Hapus berkas kuitansi"
          >
            <X size={20} />
          </button>
        </div>
      ) : (
        // Drag & Drop Box
        <div
          className={`${styles.uploaderContainer} ${uploading || isPending ? styles.uploadDisabled : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleFileDrop}
          onClick={() => !uploading && !isPending && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!uploading && !isPending) fileInputRef.current?.click();
            }
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".png, .jpg, .jpeg, .pdf"
            onChange={handleFileSelect}
            disabled={uploading || isPending}
          />

          {uploading ? (
            <>
              <div className={styles.spinner} style={{ borderTopColor: 'var(--color-primary)', width: '28px', height: '28px' }} />
              <span className={styles.uploaderText}>Mengunggah berkas kuitansi...</span>
            </>
          ) : (
            <>
              <UploadCloud size={36} className={styles.uploaderIcon} />
              <span className={styles.uploaderText}>
                Tarik & lepas berkas kuitansi di sini, atau <span className={styles.uploaderLink}>Pilih Berkas</span>
              </span>
              <span className={styles.uploaderText} style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                Mendukung PNG, JPG, JPEG, atau PDF (Maks. 5MB)
              </span>
            </>
          )}

          {uploadError && (
            <div style={{ marginTop: 'var(--space-2)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              {uploadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
