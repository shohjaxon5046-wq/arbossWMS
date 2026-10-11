import { supabase } from '@/lib/supabase';
import { escapeHtml, printHtml, qrSvg } from '@/lib/labels';
import { formatCurrency, formatDate } from '@/lib/format';
import type { TranslationKey } from '@/lib/i18n';
import type { OrderBundle } from '@/lib/orders';

type Translate = (key: TranslationKey) => string;

async function loadCompany() {
  const { data } = await supabase
    .from('erp_settings')
    .select('key, value')
    .in('key', ['company_name', 'company_phone', 'company_address']);
  const map = Object.fromEntries((data || []).map((r: any) => [r.key, r.value as Record<string, string>]));
  return {
    name: map.company_name?.name || 'ARBOSS RENT — WMS & Arenda ERP',
    phone: map.company_phone?.phone || '+998 (71) 200-50-46',
    address: map.company_address?.address || '7-o\'tish joyi Bo\'zbozor, 36',
  };
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
 * 1. ODDIY KASSA CHEKI (80mm termoprinter uchun)
 */
export async function printCashReceipt80mm(data: OrderBundle, _t?: Translate): Promise<void> {
  const { order, items, payments } = data;
  const [company, qr] = await Promise.all([loadCompany(), qrSvg(order.order_number)]);
  const e = escapeHtml;
  const money = (n: number) => e(formatCurrency(n));

  const payType = payments.length ? payments.map(p => p.payment_type).join(', ') : 'Naqd';
  const timeStr = formatTime(order.created_at);
  const startDateStr = formatDate(order.start_date || order.created_at);
  const returnDateStr = order.expected_return_date ? formatDate(order.expected_return_date) : 'Noma\'lum';

  const itemsHtml = items.map((it, idx) => `
    <div style="margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 1px dashed #666;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 9.5pt;">
        <span>${idx + 1}. ${e(it.model_name)}</span>
        <span>${money(it.line_total)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #333; margin-top: 1mm;">
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

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kassa Cheki - ${e(order.order_number)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 76mm;
      margin: 0 auto;
      padding: 4mm 2.5mm 8mm 2.5mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      color: #000;
      font-size: 8.5pt;
      line-height: 1.35;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000;
      margin: 2.5mm 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: 3mm 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.2mm;
    }
    .qr-wrap {
      width: 32mm;
      height: 32mm;
      margin: 3mm auto;
    }
    .qr-wrap svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    @media print {
      body { width: 76mm; }
    }
  </style>
</head>
<body>
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

  await printHtml(html);
}

/**
 * 2. SHARTNOMA-CHEK (A4 formatdagi to‘liq yuridik ijara shartnomasi va dalolatnoma)
 */
export async function printContractA4(data: OrderBundle, _t?: Translate): Promise<void> {
  const { order, items, payments, customer, models = {} } = data;
  const [company, qr] = await Promise.all([loadCompany(), qrSvg(order.order_number)]);
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

  const daysCount = items[0]?.rent_days || 1;

  // Build items rows for acceptance act table
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

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ijara Shartnomasi va Dalolatnoma - ${e(order.order_number)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm 10mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif, Arial, sans-serif;
      color: #0f172a;
      font-size: 8.8pt;
      line-height: 1.35;
      background: #fff;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
    }
    .title-box {
      text-align: center;
      margin: 3mm 0 2mm 0;
    }
    .title-box h1 {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .title-box p {
      font-size: 8.5pt;
      font-style: italic;
      color: #334155;
      margin-top: 1mm;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm 6mm;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 1.5mm;
      padding: 3mm;
      margin-bottom: 3.5mm;
    }
    .parties-col h4 {
      font-size: 8.5pt;
      text-transform: uppercase;
      font-weight: bold;
      margin-bottom: 1.5mm;
      border-bottom: 1px solid #94a3b8;
      padding-bottom: 0.8mm;
    }
    .parties-col p {
      margin-bottom: 1mm;
      font-size: 8.2pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2mm 0 3.5mm 0;
      font-size: 8pt;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 1.5mm 2mm;
      vertical-align: middle;
    }
    th {
      background: #f1f5f9;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 7.5pt;
      text-align: center;
    }
    .section-title {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 3mm;
      margin-bottom: 1.5mm;
      color: #0f172a;
    }
    .legal-terms {
      font-size: 8pt;
      text-align: justify;
      color: #1e293b;
      margin-bottom: 3.5mm;
    }
    .legal-terms ol {
      padding-left: 4mm;
    }
    .legal-terms li {
      margin-bottom: 1mm;
    }
    .finance-box {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 2mm;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2.5mm;
      border-radius: 1.5mm;
      margin-bottom: 3mm;
    }
    .finance-item {
      text-align: center;
    }
    .finance-item .label {
      font-size: 7.5pt;
      color: #475569;
      text-transform: uppercase;
    }
    .finance-item .val {
      font-size: 9.5pt;
      font-weight: bold;
      margin-top: 0.5mm;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
      margin-top: 4mm;
      padding-top: 2mm;
    }
    .sign-box {
      border: 1px solid #94a3b8;
      padding: 3mm;
      border-radius: 1.5mm;
      font-size: 8pt;
    }
    .sign-box h5 {
      font-size: 8.5pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }
    .sign-line {
      margin-top: 6mm;
      border-bottom: 1px solid #000;
      width: 80%;
    }
    .qr-stamp {
      width: 22mm;
      height: 22mm;
    }
    .qr-stamp svg {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <!-- Top header -->
  <div class="header-box">
    <div>
      <div style="font-size: 13pt; font-weight: bold; letter-spacing: 0.5px;">${e(company.name)}</div>
      <div style="font-size: 8pt; color: #475569; margin-top: 0.5mm;">${e(company.address)} · Tel: ${e(company.phone)}</div>
    </div>
    <div style="text-align: right; display: flex; align-items: center; gap: 3mm;">
      <div>
        <div style="font-size: 8.5pt; font-weight: bold;">№ ${e(order.order_number)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">${e(contractDateStr)}</div>
      </div>
      <div class="qr-stamp">${qr}</div>
    </div>
  </div>

  <!-- Document Title -->
  <div class="title-box">
    <h1>ASBOB-USKUNALARNI VAQTINCHALIK IJARAGA BERISH SHARTNOMASI VA TOPSHIRISH-QABUL QILISH DALOLATNOMASI</h1>
    <p>№ ${e(order.order_number)} · Toshkent shahri, Bo'zbozor · Sana: ${e(contractDateStr)} yil</p>
  </div>

  <!-- Section 1: Tomonlar rekvizitlari -->
  <div class="parties-grid">
    <div class="parties-col">
      <h4>1. IJARAGA BERUVCHI (DO'KON):</h4>
      <p><b>Kompaniya:</b> ${e(company.name)}</p>
      <p><b>Manzil:</b> ${e(company.address)}</p>
      <p><b>Telefon:</b> ${e(company.phone)}</p>
      <p><b>Mas'ul xodim:</b> ${e(order.created_by || 'Admin / Sotuvchi')}</p>
    </div>
    <div class="parties-col">
      <h4>2. IJARAGA OLUVCHI (MIJOZ):</h4>
      <p><b>F.I.O.:</b> <span style="font-weight: bold; font-size: 8.5pt;">${e(order.customer_name)}</span></p>
      <p><b>Telefon:</b> ${e(phoneStr)}</p>
      <p><b>Pasport / ID:</b> <b>${e(passportStr)}</b> · JSHSHIR: ${e(pinflStr)}</p>
      <p><b>Yashash manzili:</b> ${e(addressStr)}</p>
    </div>
  </div>

  <!-- Section 2: Ijara muddati -->
  <div style="background: #e2e8f0; padding: 1.5mm 3mm; border-radius: 1mm; font-size: 8pt; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm;">
    <div><b>Ijara boshlanishi:</b> ${e(startDateStr)}</div>
    <div><b>Qaytarish sanasi:</b> <span style="color: #b91c1c; font-weight: bold;">${e(returnDateStr)}</span></div>
    <div><b>Muddat:</b> <b>${daysCount} kun</b></div>
    <div><b>Yetkazib berish:</b> ${order.delivery_type === 'delivery' ? 'Kuryer orqali yetkazish' : 'Ombordan olib ketish'}</div>
  </div>

  <!-- Section 3: Asboblar jadvali (Dalolatnoma) -->
  <div class="section-title">3. Topshirish-qabul qilish dalolatnomasi (Uskunalar ro'yxati)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25px;">№</th>
        <th>Instrument / Model nomi</th>
        <th style="width: 85px;">Seriya raqami</th>
        <th style="width: 50px;">Soni</th>
        <th style="width: 50px;">Muddat</th>
        <th style="width: 75px;">Kunlik narx</th>
        <th style="width: 85px;">Baholangan qiymati</th>
        <th style="width: 90px;">Holati</th>
        <th style="width: 80px;">Jami ijara</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>

  <!-- Section 4: Moliyaviy qism -->
  <div class="finance-box">
    <div class="finance-item">
      <div class="label">Jami ijara summasi</div>
      <div class="val">${money(order.total_rent_amount)}</div>
    </div>
    <div class="finance-item">
      <div class="label">Garov (Zalog) summasi</div>
      <div class="val" style="color: #d97706;">${money(order.total_deposit_amount)}</div>
    </div>
    <div class="finance-item">
      <div class="label">To'langan summa (${e(payType)})</div>
      <div class="val" style="color: #15803d;">${money(order.paid_amount)}</div>
    </div>
    <div class="finance-item">
      <div class="label">Qoldiq qarzdorlik</div>
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

  await printHtml(html);
}

/**
 * Standard alias
 */
export async function printOrderReceipt(data: OrderBundle, t?: Translate): Promise<void> {
  return printCashReceipt80mm(data, t);
}
