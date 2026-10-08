import * as XLSX from 'xlsx';

export interface SheetRow {
  [key: string]: string | number;
}

export function readFirstSheet(file: File): Promise<SheetRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

const norm = (v: string | number): string => String(v ?? '').trim();

const KEY_ALIASES: Record<string, string> = {
  full_name: 'full_name',
  ism: 'full_name',
  ism_familiya: 'full_name',
  fio: 'full_name',
  to_liq_ism: 'full_name',
  toliq_ism: 'full_name',
  name: 'full_name',
  nomi: 'full_name',
  nome: 'full_name',
  phone: 'phone',
  telefon: 'phone',
  tel: 'phone',
  phone_primary: 'phone',
  role: 'role',
  lavozim: 'role',
  roli: 'role',
  email: 'email',
  pochtal: 'email',
  password: 'password',
  parol: 'password',
  brand: 'brand',
  brend: 'brand',
  category: 'category',
  kategoriya: 'category',
  kategoriyasi: 'category',
  daily_price: 'daily_price',
  kunlik_narx: 'daily_price',
  kunlik_narxi: 'daily_price',
  narx: 'daily_price',
  price: 'daily_price',
  deposit: 'deposit',
  garov: 'deposit',
  deposit_amount: 'deposit',
  model_code: 'model_code',
  model_kodi: 'model_code',
  kodi: 'model_code',
};

export function normalizeKeys(rows: SheetRow[]): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const alias = KEY_ALIASES[key.trim().toLowerCase()] ?? key.trim().toLowerCase();
      if (!(alias in out)) out[alias] = norm(value);
    }
    return out;
  });
}

export function downloadStaffTemplate() {
  const rows: (string | number)[][] = [
    ['to_liq_ism', 'telefon', 'lavozim', 'email', 'parol'],
    ['Ali Valiyev', '+998901234567', 'seller', 'sotuvchi1@misol.uz', 'parol123'],
    ['Bekzod Karimov', '+998901112233', 'warehouse', 'skladchi1@misol.uz', 'parol123'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Xodimlar');
  XLSX.writeFile(wb, 'xodimlar_namuna.xlsx');
}

export function downloadProductsTemplate() {
  const rows: (string | number)[][] = [
    ['nomi', 'brend', 'kategoriya', 'kunlik_narx', 'garov', 'model_kodi'],
    ['Perforator', 'Bosch', 'Elektr asbob', 80000, 150000, 'GBH-2-26'],
    ['Bolg\'a', 'Makita', 'Elektr asbob', 65000, 100000, 'HM-0810'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mahsulotlar');
  XLSX.writeFile(wb, 'mahsulotlar_namuna.xlsx');
}
