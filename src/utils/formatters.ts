export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  const val = (bytes / Math.pow(k, safeIndex)).toFixed(dm);
  return `${val} ${sizes[safeIndex]}`;
}

export function formatNumber(num: number): string {
  if (!Number.isFinite(num) || isNaN(num)) return '0';
  return new Intl.NumberFormat('zh-TW').format(num);
}

export function formatDate(dateInput: string | number | Date): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '-';
  }
}

export function calculatePercentage(used: number, total: number): number {
  if (!total || total <= 0 || used <= 0) return 0;
  const p = (used / total) * 100;
  return Math.min(100, Math.max(0, Math.round(p * 10) / 10));
}
