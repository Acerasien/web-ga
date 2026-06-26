/**
 * Utility functions for shifting the monthly period from (1 to 31) to (21st of previous month to 20th of current month).
 * For example: January monthly is Dec 21 - Jan 20.
 */

export interface PeriodicMonthYear {
  month: number; // 1-12
  year: number;  // YYYY
}

/**
 * Returns the periodic month (1-12) and year that a given calendar date falls into.
 * - Date >= 21st belongs to the NEXT month.
 * - Date <= 20th belongs to the CURRENT calendar month.
 */
export function getPeriodicMonthAndYear(date: Date | string): PeriodicMonthYear {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate();
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();

  if (day >= 21) {
    if (month === 11) {
      return { month: 1, year: year + 1 };
    } else {
      return { month: month + 2, year };
    }
  } else {
    return { month: month + 1, year };
  }
}

/**
 * Returns the local date range bounds for a specific target periodic month and year.
 * For example: January (1) 2026 returns Dec 21, 2025 (00:00:00) to Jan 20, 2026 (23:59:59.999).
 */
export function getBoundsForPeriodicMonth(month: number, year: number): { startDate: Date; endDate: Date } {
  // Calculate start year and month (0-11)
  let startYear = year;
  let startMonth = month - 2; // e.g. for Jan (1), 1 - 2 = -1 (Dec of prev year)
  if (startMonth < 0) {
    startMonth = 11;
    startYear = year - 1;
  }

  // Calculate end year and month (0-11)
  const endYear = year;
  const endMonth = month - 1;

  const startDate = new Date(startYear, startMonth, 21, 0, 0, 0, 0);
  const endDate = new Date(endYear, endMonth, 20, 23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Returns the local date range bounds for the periodic month enclosing the given date.
 */
export function getPeriodicBounds(date: Date | string): { startDate: Date; endDate: Date } {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { month, year } = getPeriodicMonthAndYear(d);
  return getBoundsForPeriodicMonth(month, year);
}
