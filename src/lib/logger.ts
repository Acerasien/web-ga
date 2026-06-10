export const logger = {
  error: (message: string, error?: unknown) => {
    let errorDetails = '';
    if (error !== undefined) {
      if (error instanceof Error) {
        errorDetails = ` - Details: ${error.message}\nStack: ${error.stack}`;
      } else {
        errorDetails = ` - Details: ${String(error)}`;
      }
    }
    
    // Redact PostgreSQL connection string credentials (e.g. postgresql://user:password@host)
    const dbUriRegex = /postgresql:\/\/([^:]+):([^@]+)@/g;
    const sanitized = `${message}${errorDetails}`.replace(dbUriRegex, 'postgresql://$1:[REDACTED]@');

    console.error(`[ERROR] ${sanitized}`);
  },
  info: (message: string) => {
    console.log(`[INFO] ${message}`);
  },
  warn: (message: string) => {
    console.warn(`[WARN] ${message}`);
  }
};
