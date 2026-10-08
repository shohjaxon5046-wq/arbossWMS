export function formatCurrency(amount: number, currency = 'so\'m'): string {
  const formatted = new Intl.NumberFormat('ru-RU').format(Math.round(amount || 0));
  return `${formatted} ${currency}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 9) return `+998 ${clean.slice(0, 2)} ${clean.slice(2, 5)}-${clean.slice(5, 7)}-${clean.slice(7, 9)}`;
  if (clean.length === 12 && clean.startsWith('998')) return `+998 ${clean.slice(3, 5)} ${clean.slice(5, 8)}-${clean.slice(8, 10)}-${clean.slice(10, 12)}`;
  return phone;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    yangi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    yigilmoqda: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'faol_ijarada': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    kechikkan: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    yakunlandi: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    bekor: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    omborda_bosh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    ijarada: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    tamirda: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    yoqolgan: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    sotildi: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    aktiv: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    bosh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    band: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    'hamkor_qabul_qildi': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    hamkor_yolda: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    bajarilmoqda: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    bajarildi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    yuborildi: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    qisman_qabul: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    qabul_qilindi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    almashtirildi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    pul_qaytarildi: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    joylashtirish_kutilmoqda: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    qaytarish_kutilmoqda: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    qaytarilmoqda: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    qaytarildi: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}
