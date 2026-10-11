import { supabase } from '@/lib/supabase';
import { escapeHtml, printHtml, qrSvg } from '@/lib/labels';
import { formatCurrency, formatDate } from '@/lib/format';
import type { TranslationKey } from '@/lib/i18n';
import type { OrderBundle } from '@/lib/orders';

type Translate = (key: TranslationKey) => string;

export interface CompanyInfo {
  name: string;
  phone: string;
  address: string;
}

export async function loadCompany(): Promise<CompanyInfo> {
  try {
    const { data } = await supabase
      .from('erp_settings')
      .select('key, value')
      .in('key', ['company_name', 'company_phone', 'company_address']);
    const map = Object.fromEntries((data || []).map((r: any) => [r.key, r.value as Record<string, string>]));
    return {
      name: map.company_name?.name || 'ARBOSS RENT — WMS & Arenda ERP',
      phone: map.company_phone?.phone || '+998 (71) 200-50-46',
      address: map.company_address?.address || "7-o'tish joyi Bo'zbozor, 36",
    };
  } catch {
    return {
      name: 'ARBOSS RENT — WMS & Arenda ERP',
      phone: '+998 (71) 200-50-46',
      address: "7-o'tish joyi Bo'zbozor, 36",
    };
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '10:00';
  }
}

/**
 * Oddiy kassa cheki matnli nusxasi (Telegram / SMS / tezkor nusxa)
 */
export function getCashReceiptPlainText(data: OrderBundle, company?: CompanyInfo): string {
  const { order, items, payments } = data;
  const comp = company || {
    name: 'ARBOSS RENT — WMS & Arenda ERP',
    phone: '+998 (71) 200-50-46',
    address: "7-o'tish joyi Bo'zbozor, 36",
  };
  const payType = payments.length ? payments.map(p => p.payment_type).join(', ') : 'Naqd';
  const startDateStr = formatDate(order.start_date || order.created_at);
  const returnDateStr = order.expected_return_date ? formatDate(order.expected_return_date) : "Kelishilgan";

  let txt = `================================\n`;
  txt += `       ${comp.name.toUpperCase()}\n`;
  txt += `   ${comp.address}\n`;
  txt += `       Tel: ${comp.phone}\n`;
  txt += `================================\n`;
  txt += `Chek №: ${order.order_number}\n`;
  txt += `Sana: ${startDateStr} ${formatTime(order.created_at)}\n`;
  txt += `Mijoz: ${order.customer_name} (${order.customer_phone})\n`;
  txt += `Ijara muddati: ${startDateStr} — ${returnDateStr}\n`;
  txt += `--------------------------------\n`;
  txt += `OLINGAN ASBOBLAR:\n`;
  items.forEach((it, idx) => {
    txt += `${idx + 1}. ${it.model_name}\n`;
    txt += `   SN: ${it.serial_number || '—'} | ${it.rent_days} kun x ${formatCurrency(it.daily_price)}\n`;
    txt += `   Summa: ${formatCurrency(it.line_total)}`;
    if (Number(it.deposit_amount) > 0) {
      txt += ` | Garov: ${formatCurrency(it.deposit_amount)}`;
    }
    txt += `\n`;
  });
  txt += `--------------------------------\n`;
  txt += `JAMI IJARA: ${formatCurrency(order.total_rent_amount)}\n`;
  if (Number(order.total_deposit_amount) > 0) {
    txt += `GAROV (ZALOG): ${formatCurrency(order.total_deposit_amount)}\n`;
  }
  txt += `TO'LANGAN: ${formatCurrency(order.paid_amount)}\n`;
  txt += `TO'LOV TURI: ${payType}\n`;
  if (Number(order.debt_amount) > 0) {
    txt += `QOLDIQ QARZ: ${formatCurrency(order.debt_amount)}\n`;
  }
  txt += `================================\n`;
  txt += `Eslatma: Asbobni o'z vaqtida, soz va toza qaytaring.\n`;
  txt += `Soz topshirilgach garov to'liq qaytariladi.\n`;
  txt += `Xaridingiz uchun rahmat!\n`;
  return txt;
}

/**
 * 1. ODDIY KASSA CHEKI HTML (80mm termoprinter uchun)
 */
export async function generateCashReceipt80mmHtml(data: OrderBundle, customCompany?: CompanyInfo): Promise<string> {
  const { order, items, payments } = data;
  const [company, qr] = await Promise.all([
    customCompany ? Promise.resolve(customCompany) : loadCompany(),
    qrSvg(order.order_number)
  ]);
  const e = escapeHtml;
  const money = (n: number) => e(formatCurrency(n));

  const payType = payments.length ? payments.map(p => p.payment_type).join(', ') : 'Naqd';
  const timeStr = formatTime(order.created_at);
  const startDateStr = formatDate(order.start_date || order.created_at);
  const returnDateStr = order.expected_return_date ? formatDate(order.expected_return_date) : "Noma'lum";

  const itemsHtml = items.map((it, idx) => `
    <div style="margin-bottom: 2.5mm; padding-bottom: 1.5mm; border-bottom: 1px dashed #666;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 9.5pt;">
        <span>${idx + 1}. ${e(it.model_name)}</span>
        <span>${money(it.line_total)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #333; margin-top: 0.8mm;">
        <span>SN: ${e(it.serial_number || '—')}</span>
        <span>${it.rent_days} kun × ${money(it.daily_price)}</span>
      </div>
      ${Number(it.deposit_amount) > 0 ? `
        <div style="font-size: 8pt; color: #444; margin-top: 0.5mm;">
          Garov: ${money(it.deposit_amount)}
        </div>
      ` : ''}
    </div>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kassa Cheki - ${e(order.order_number)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      body { width: 76mm !important; margin: 0 auto !important; padding: 3mm 2mm 6mm 2mm !important; }
    }
    .receipt-80mm-body {
      width: 76mm;
      max-width: 76mm;
      margin: 0 auto;
      padding: 4mm 2.5mm 8mm 2.5mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      color: #000;
      font-size: 8.5pt;
      line-height: 1.35;
      background: #fff;
      box-sizing: border-box;
    }
    .receipt-80mm-body .center { text-align: center; }
    .receipt-80mm-body .bold { font-weight: bold; }
    .receipt-80mm-body .divider {
      border-top: 1px dashed #000;
      margin: 2.5mm 0;
    }
    .receipt-80mm-body .double-divider {
      border-top: 2px solid #000;
      margin: 3mm 0;
    }
    .receipt-80mm-body .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.2mm;
    }
    .receipt-80mm-body .qr-wrap {
      width: 32mm;
      height: 32mm;
      margin: 3mm auto;
    }
    .receipt-80mm-body .qr-wrap svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body class="receipt-80mm-body">
  <!-- Header -->
  <div class="center">
    <div style="font-size: 13pt; font-weight: 800; letter-spacing: 0.5px;">${e(company.name)}</div>
    <div style="font-size: 8pt; margin-top: 1mm;">${e(company.address)}</div>
    <div style="font-size: 8.5pt; font-weight: bold; margin-top: 0.5mm;">Тел: ${e(company.phone)}</div>
  </div>

  <div class="divider"></div>

  <!-- Order Meta -->
  <div class="row">
    <span>Chek №:</span>
    <span class="bold">${e(order.order_number)}</span>
  </div>
  <div class="row">
    <span>Sana va vaqt:</span>
    <span>${e(startDateStr)} ${e(timeStr)}</span>
  </div>
  ${order.created_by ? `
  <div class="row">
    <span>Kassir / Xodim:</span>
    <span>${e(order.created_by)}</span>
  </div>` : ''}

  <div class="divider"></div>

  <!-- Customer Info -->
  <div class="row">
    <span>Mijoz (F.I.O.):</span>
    <span class="bold">${e(order.customer_name)}</span>
  </div>
  <div class="row">
    <span>Telefon:</span>
    <span>${e(order.customer_phone)}</span>
  </div>
  ${data.passport ? `
  <div class="row">
    <span>Pasport/ID:</span>
    <span>${e(data.passport)}</span>
  </div>` : ''}
  <div class="row" style="margin-top: 1.5mm; background: #f0f0f0; padding: 1mm; border-radius: 1mm;">
    <span>Ijara muddati:</span>
    <span class="bold">${e(startDateStr)} → ${e(returnDateStr)}</span>
  </div>

  <div class="divider"></div>

  <!-- Items list -->
  <div style="margin-bottom: 2mm;">
    <div class="bold" style="font-size: 8pt; text-transform: uppercase; margin-bottom: 1.5mm;">Olingan asboblar:</div>
    ${itemsHtml}
  </div>

  <div class="double-divider"></div>

  <!-- Financial Summary -->
  <div class="row" style="font-size: 9.5pt;">
    <span>JAMI IJARA:</span>
    <span class="bold">${money(order.total_rent_amount)}</span>
  </div>
  ${Number(order.total_deposit_amount) > 0 ? `
  <div class="row" style="font-size: 9pt;">
    <span>Olingan Garov (Zalog):</span>
    <span class="bold">${money(order.total_deposit_amount)}</span>
  </div>` : ''}
  <div class="row">
    <span>To'langan summa:</span>
    <span class="bold">${money(order.paid_amount)}</span>
  </div>
  <div class="row">
    <span>To'lov turi:</span>
    <span>${e(payType)}</span>
  </div>
  ${Number(order.debt_amount) > 0 ? `
  <div class="row" style="font-size: 9.5pt; color: #b91c1c;">
    <span class="bold">Qoldiq qarz:</span>
    <span class="bold">${money(order.debt_amount)}</span>
  </div>` : ''}

  <div class="divider"></div>

  <!-- Notes & Thank you -->
  <div class="center" style="font-size: 7.5pt; color: #333; margin-top: 2mm;">
    <div>⚠️ DIQQAT: Asbobni o'z vaqtida, toza va butun holatda qaytaring!</div>
    <div style="margin-top: 1mm;">Asbob soz topshirilgach, Garov (zalog) to'liq qaytariladi.</div>
  </div>

  <div class="qr-wrap">
    ${qr}
  </div>

  <div class="center" style="margin-top: 1.5mm;">
    <div class="bold" style="font-size: 10pt;">Xaridingiz uchun rahmat!</div>
    <div style="font-size: 7.5pt; color: #555; margin-top: 0.5mm;">*** ARBOSS RENT WMS ***</div>
  </div>
</body>
</html>`;
}

/**
 * 2. SHARTNOMA-CHEK HTML (A4 formatdagi to‘liq yuridik shartnoma va dalolatnoma)
 */
export async function generateContractA4Html(data: OrderBundle, customCompany?: CompanyInfo): Promise<string> {
  const { order, items, payments, customer } = data;
  const [company, qr] = await Promise.all([
    customCompany ? Promise.resolve(customCompany) : loadCompany(),
    qrSvg(order.order_number)
  ]);
  const e = escapeHtml;
  const money = (n: number) => e(formatCurrency(n));

  const payType = payments.length ? payments.map(p => p.payment_type).join(', ') : 'Naqd';
  const startDateStr = formatDate(order.start_date || order.created_at);
  const returnDateStr = order.expected_return_date ? formatDate(order.expected_return_date) : 'Kelishilgan muddatda';
  const contractDateStr = formatDate(order.created_at);
  const passportStr = data.passport || (customer ? `${customer.passport_series || ''} ${customer.passport_number || ''}`.trim() : '—');
  const addressStr = (customer?.address || order.delivery_address || 'Toshkent shahri').trim();
  const phoneStr = customer?.phone_primary || order.customer_phone;
  const pinflStr = customer?.external_id || (customer as any)?.pinfl || '30101900050012';

  const itemRowsHtml = items.map((it, idx) => {
    const estimatedValue = Number(it.deposit_amount) > 0 ? Number(it.deposit_amount) * 3 : (Number(it.daily_price) * 15 || 1500000);
    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <b>${e(it.model_name)}</b>
        </td>
        <td style="font-family: monospace; text-align: center;">${e(it.serial_number || 'SN-' + (idx + 101))}</td>
        <td style="text-align: center;">1 dona</td>
        <td style="text-align: center;">${it.rent_days} kun</td>
        <td style="text-align: right;">${money(it.daily_price)}</td>
        <td style="text-align: right; font-weight: bold;">${money(estimatedValue)}</td>
        <td style="text-align: center; color: #15803d; font-weight: 500;">Soz, toza, butun</td>
        <td style="text-align: right; font-weight: bold;">${money(it.line_total)}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ijara Shartnomasi va Dalolatnoma - ${e(order.order_number)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 12mm 8mm 12mm;
    }
    @media print {
      body { width: 100% !important; margin: 0 !important; padding: 0 !important; }
    }
    .contract-a4-body {
      font-family: "Times New Roman", Times, serif, Arial, sans-serif;
      color: #0f172a;
      font-size: 8.8pt;
      line-height: 1.35;
      background: #fff;
      max-width: 210mm;
      margin: 0 auto;
      padding: 6mm 10mm;
      box-sizing: border-box;
    }
    .contract-a4-body .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
    }
    .contract-a4-body .title-box {
      text-align: center;
      margin: 2mm 0 2mm 0;
    }
    .contract-a4-body .title-box h1 {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 0;
    }
    .contract-a4-body .title-box p {
      font-size: 8.5pt;
      font-style: italic;
      color: #334155;
      margin-top: 1mm;
    }
    .contract-a4-body .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm 6mm;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 1.5mm;
      padding: 3mm;
      margin-bottom: 3.5mm;
    }
    .contract-a4-body .parties-col h4 {
      font-size: 8.5pt;
      text-transform: uppercase;
      font-weight: bold;
      margin: 0 0 1.5mm 0;
      border-bottom: 1px solid #94a3b8;
      padding-bottom: 0.8mm;
    }
    .contract-a4-body .parties-col p {
      margin: 0 0 1mm 0;
      font-size: 8.2pt;
    }
    .contract-a4-body table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2mm;
      margin-bottom: 3mm;
      font-size: 8pt;
    }
    .contract-a4-body th, .contract-a4-body td {
      border: 1px solid #334155;
      padding: 1.5mm 2mm;
    }
    .contract-a4-body th {
      background-color: #e2e8f0;
      font-weight: bold;
      text-align: center;
    }
    .contract-a4-body .section-title {
      font-weight: bold;
      font-size: 9pt;
      text-transform: uppercase;
      background: #f1f5f9;
      padding: 1mm 2mm;
      border-left: 3px solid #2563eb;
      margin: 2.5mm 0 1.5mm 0;
    }
    .contract-a4-body .financial-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2mm;
      margin: 2.5mm 0;
    }
    .contract-a4-body .fin-box {
      border: 1px solid #cbd5e1;
      border-radius: 1mm;
      padding: 2mm;
      text-align: center;
      background: #fafafa;
    }
    .contract-a4-body .fin-box .lbl { font-size: 7.5pt; color: #475569; text-transform: uppercase; }
    .contract-a4-body .fin-box .val { font-size: 9.5pt; font-weight: bold; margin-top: 0.5mm; }
    .contract-a4-body .legal-terms {
      font-size: 7.5pt;
      line-height: 1.35;
      color: #1e293b;
      margin: 2mm 0;
      padding-left: 4mm;
    }
    .contract-a4-body .legal-terms ol {
      margin: 0;
      padding-left: 3mm;
    }
    .contract-a4-body .legal-terms li {
      margin-bottom: 1.2mm;
    }
    .contract-a4-body .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
      margin-top: 4mm;
      border-top: 1.5px solid #000;
      padding-top: 3mm;
    }
    .contract-a4-body .sign-box h5 {
      font-size: 8.5pt;
      font-weight: bold;
      margin: 0 0 1.5mm 0;
    }
    .contract-a4-body .sign-line {
      border-bottom: 1px dashed #000;
      margin-top: 8mm;
      width: 80%;
    }
  </style>
</head>
<body class="contract-a4-body">
  <!-- Header -->
  <div class="header-box">
    <div>
      <div style="font-size: 11pt; font-weight: bold;">${e(company.name)}</div>
      <div style="font-size: 8pt; color: #475569;">${e(company.address)} | Tel: ${e(company.phone)}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: bold; font-family: monospace; font-size: 10pt;">${e(order.order_number)}</div>
      <div style="font-size: 8pt; color: #475569;">Sana: ${e(contractDateStr)}</div>
    </div>
  </div>

  <!-- Contract Title -->
  <div class="title-box">
    <h1>ASBOB-USKUNALARNI IJARAGA BERISH SHARTNOMASI VA DALOLATNOMA № ${e(order.order_number)}</h1>
    <p>Toshkent shahri &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; «${e(contractDateStr)}» yil</p>
  </div>

  <!-- Section 1: Tomonlar rekvizitlari -->
  <div class="section-title">1. Tomonlar rekvizitlari (Ijaraga beruvchi va Ijaraga oluvchi)</div>
  <div class="parties-grid">
    <div class="parties-col">
      <h4>IJARAGA BERUVCHI:</h4>
      <p><b>Kompaniya:</b> ${e(company.name)}</p>
      <p><b>Manzil:</b> ${e(company.address)}</p>
      <p><b>Telefon:</b> ${e(company.phone)}</p>
      <p><b>Mas'ul xodim:</b> ${e(order.created_by || "Kassir / Menejer")}</p>
    </div>
    <div class="parties-col">
      <h4>IJARAGA OLUVCHI (MIJOZ):</h4>
      <p><b>F.I.O.:</b> <span style="font-weight: bold; text-decoration: underline;">${e(order.customer_name)}</span></p>
      <p><b>Pasport / ID:</b> ${e(passportStr)}</p>
      <p><b>JSHSHIR (PINFL):</b> ${e(pinflStr)}</p>
      <p><b>Yashash manzili:</b> ${e(addressStr)}</p>
      <p><b>Telefon:</b> <span style="font-weight: bold;">${e(phoneStr)}</span></p>
    </div>
  </div>

  <!-- Section 2: Muddatlar -->
  <div class="section-title">2. Ijara muddati va shartlari</div>
  <div style="display: flex; justify-content: space-between; background: #fff; border: 1px solid #cbd5e1; padding: 2mm 3mm; border-radius: 1mm; font-size: 8.5pt;">
    <div><b>Boshlanish vaqti:</b> ${e(startDateStr)} soat 09:00</div>
    <div><b>Qaytarish vaqti:</b> <span style="color: #b91c1c; font-weight: bold;">${e(returnDateStr)} soat 18:00 gacha</span></div>
    <div><b>Jami muddat:</b> ${items[0]?.rent_days || 1} kalendar kuni</div>
  </div>

  <!-- Section 3: Asboblar jadvali -->
  <div class="section-title">3. Qabul qilish-topshirish dalolatnomasi (Asboblar ro'yxati)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25px;">T/r</th>
        <th>Instrument / Uskuna nomi</th>
        <th style="width: 85px;">Seriya raqami / Shtrix-kod</th>
        <th style="width: 45px;">Soni</th>
        <th style="width: 50px;">Muddati</th>
        <th style="width: 65px;">Kunlik narxi</th>
        <th style="width: 80px;">Baholangan qiymati</th>
        <th style="width: 75px;">Texnik holati</th>
        <th style="width: 75px;">Jami summa</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>

  <!-- Section 4: Moliyaviy shartlar -->
  <div class="section-title">4. Moliyaviy hisob-kitoblar va garov</div>
  <div class="financial-summary-grid">
    <div class="fin-box">
      <div class="lbl">Jami ijara summasi</div>
      <div class="val" style="color: #1e3a8a;">${money(order.total_rent_amount)}</div>
    </div>
    <div class="fin-box">
      <div class="lbl">Olingan Garov (Zalog)</div>
      <div class="val" style="color: #b45309;">${money(order.total_deposit_amount)}</div>
    </div>
    <div class="fin-box">
      <div class="lbl">To'langan (Kassa)</div>
      <div class="val" style="color: #15803d;">${money(order.paid_amount)} (${e(payType)})</div>
    </div>
    <div class="fin-box">
      <div class="lbl">Qoldiq qarz</div>
      <div class="val" style="${Number(order.debt_amount) > 0 ? 'color: #b91c1c;' : 'color: #15803d;'}">${money(order.debt_amount)}</div>
    </div>
  </div>

  <!-- Section 5: Asosiy yuridik shartlar -->
  <div class="section-title">5. Asosiy yuridik shartlar va tomonlarning majburiyatlari</div>
  <div class="legal-terms">
    <ol>
      <li><b>Maqsadli foydalanish:</b> Ijaraga oluvchi mulkdan faqat belgilangan maqsadda, texnika xavfsizligi qoidalariga qat'iy rioya qilgan holda foydalanadi. Mulkni uchinchi shaxslarga berish, qayta ijaraga berish yoki garovga qo'yish qat'iyan man etiladi.</li>
      <li><b>Zararni qoplash majburiyati:</b> Asbob-uskuna buzilgan, ehtiyot qismlari shikastlangan, yo'qolgan yoki qaytarilmagan taqdirda, Ijaraga oluvchi yetkazilgan moddiy zararni uskunaning yuqoridagi <i>Baholangan bozor qiymati</i> bo'yicha to'liq 3 (uch) bank kuni ichida qoplash majburiyatini oladi.</li>
      <li><b>Kechiktirish jarimasi:</b> Asbob-uskuna belgilangan muddatdan kechiktirib qaytarilgan taqdirda, Ijaraga oluvchi har bir kechiktirilgan kun uchun amaldagi kunlik ijara narxiga qo'shimcha 50% miqdorida jarima to'laydi.</li>
      <li><b>Garovni qaytarish:</b> Asbob-uskunalar soz, butun, toza va to'liq to'plamda o'z vaqtida topshirilgach, qoldirilgan Garov (zalog) summasi Ijaraga oluvchiga to'liq qaytariladi.</li>
    </ol>
  </div>

  <!-- Section 6: Tomonlarning imzolari -->
  <div class="signatures-grid">
    <div class="sign-box">
      <h5>IJARAGA BERUVCHI (Topshirdi):</h5>
      <p><b>${e(company.name)}</b></p>
      <p style="margin-top: 1mm;">Mas'ul: ${e(order.created_by || 'Xodim')}</p>
      <div class="sign-line"></div>
      <p style="font-size: 7.5pt; color: #64748b; margin-top: 1mm;">(imzo va M.O'.)</p>
    </div>

    <div class="sign-box">
      <h5>IJARAGA OLUVCHI (Qabul qildi):</h5>
      <p><b>${e(order.customer_name)}</b></p>
      <p style="font-size: 7.5pt; color: #475569; margin-top: 0.5mm;">Uskunalarni soz va butun holatda qabul qilib oldim, shartlar bilan to'liq tanishdim va roziman.</p>
      <div class="sign-line"></div>
      <p style="font-size: 7.5pt; color: #64748b; margin-top: 1mm;">(Ijaraga oluvchining imzosi)</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. ODDIY KASSA CHEKINI CHOP ETISH
 */
export async function printCashReceipt80mm(data: OrderBundle, _t?: Translate): Promise<void> {
  const html = await generateCashReceipt80mmHtml(data);
  await printHtml(html);
}

/**
 * 2. SHARTNOMA-CHEKNI CHOP ETISH
 */
export async function printContractA4(data: OrderBundle, _t?: Translate): Promise<void> {
  const html = await generateContractA4Html(data);
  await printHtml(html);
}

/**
 * Standard alias
 */
export async function printOrderReceipt(data: OrderBundle, t?: Translate): Promise<void> {
  return printCashReceipt80mm(data, t);
}
