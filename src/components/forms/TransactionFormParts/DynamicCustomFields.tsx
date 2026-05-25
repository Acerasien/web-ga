import type { CategoryField } from '@/types';
import styles from '@/app/(dashboard)/transaksi/input/input.module.css';

interface DynamicCustomFieldsProps {
  dynamicFields: CategoryField[];
  customFields: Record<string, string | number>;
  categoryName?: string;
  isPending: boolean;
  onChange: (key: string, value: string | number) => void;
}

export default function DynamicCustomFields({
  dynamicFields,
  customFields,
  categoryName,
  isPending,
  onChange
}: DynamicCustomFieldsProps) {
  if (dynamicFields.length === 0) return null;

  return (
    <>
      <h3 className={styles.sectionTitle}>Informasi Tambahan ({categoryName})</h3>
      <div className={styles.formGrid}>
        {dynamicFields.map((field) => {
          const val = customFields[field.key] ?? '';
          return (
            <div key={field.key} className={styles.formGroup}>
              <label htmlFor={field.key} className={`${styles.label} ${field.required ? styles.labelRequired : ''}`}>
                {field.label}
              </label>

              {field.type === 'select' ? (
                <select
                  id={field.key}
                  className={styles.input}
                  value={val}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  disabled={isPending}
                  required={field.required}
                >
                  <option value="">-- Pilih {field.label} --</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={field.key}
                  className={`${styles.input} ${styles.textarea}`}
                  value={val}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  disabled={isPending}
                  required={field.required}
                  placeholder={`Masukkan ${field.label.toLowerCase()}`}
                />
              ) : (
                <input
                  id={field.key}
                  type={field.type}
                  className={styles.input}
                  value={val}
                  onChange={(e) => {
                    const inputVal = field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value;
                    onChange(field.key, inputVal);
                  }}
                  disabled={isPending}
                  required={field.required}
                  placeholder={`Masukkan ${field.label.toLowerCase()}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
