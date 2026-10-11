import { supabase } from '@/lib/supabase';
import { escapeHtml, printHtml, qrSvg } from '@/lib/labels';
import { formatCurrency, formatDate } from '@/lib/format';
import type { TranslationKey } from '@/lib/i18n';
import type { OrderBundle } from '@/lib/orders';

type Translate = (key: TranslationKey) => string;

async function loadCompany() {
  const { data } = await supabase.from('erp_settings').select('key, value')
    .in('key', ['company_name', 'company_phone', 'company_address']);
  const map = Object.fromEntries((data || []).map((r: any) => [r.key, r.value as Record<string, string>]));
  return {
    name: map.company_name?.name || 'WMS Arenda ERP',
    phone: map.company_phone?.phone || '',
    address: map.company_address?.address || '',
  };
}

export async function printOrderReceipt(data: OrderBundle, t: Translate): Promise<void> {
  const { order, items, services, payments, partnerNames } = data;
  const [company, qr] = await Promise.all([loadCompany(), qrSvg(order.order_number)]);
  const e = escapeHtml;
  const money = (n: number) => e(formatCurrency(n));

  const itemRows = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${e(it.model_name)}</b><div class="muted">${e(it.serial_number)}</div></td>
      <td class="r">${it.rent_days}</td>
      <td class="r">${money(it.daily_price)}</td>
      <td class="r">${Number(it.discount_pct) > 0 ? `${Number(it.discount_pct)}%` : '—'}</td>
      <td class="r">${money(it.deposit_amount)}</td>
      <td class="r"><b>${money(it.line_total)}</b></td>
    </tr>`).join('');

  const serviceRows = services.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${e(s.service_category)}</b>${s.service_details ? `<div class="muted">${e(s.service_details)}</div>` : ''}</td>
      <td>${e(s.assigned_partner_id ? partnerNames[s.assigned_partner_id] || '' : '')}</td>
      <td>${e([s.address, s.scheduled_time].filter(Boolean).join(' · '))}</td>
      <td class="r"><b>${money(s.customer_total_price)}</b></td>
    </tr>`).join('');

  const paymentRows = payments.map(p => `
    <tr><td>${e(formatDate(p.date))}</td><td>${e(p.payment_type)}</td><td class="r">${money(p.amount)}</td></tr>`).join('');

  const rentSubtotal = Number(order.total_rent_amount) - Number(order.total_service_amount);

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${e(order.order_number)}</title><style>
    @page { size: A4; margin: 14mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 10pt; line-height: 1.45; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 5mm; }
    .brand { font-size: 17pt; font-weight: 700; }
    .muted { color: #64748b; font-size: 8.5pt; }
    .qr { width: 26mm; height: 26mm; } .qr svg { width: 100%; height: 100%; }
    .title { margin-top: 5mm; display: flex; justify-content: space-between; align-items: baseline; }
    .title h1 { font-size: 14pt; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 8mm; margin-top: 4mm; padding: 4mm; background: #f1f5f9; border-radius: 2mm; }
    .grid .k { color: #64748b; font-size: 8.5pt; } .grid .v { font-weight: 700; }
    h2 { font-size: 11pt; margin: 6mm 0 2mm; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 8pt; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding: 1.5mm 2mm; }
    td { border-bottom: 1px solid #e2e8f0; padding: 2mm; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .totals { margin-top: 5mm; margin-left: auto; width: 85mm; }
    .totals div { display: flex; justify-content: space-between; padding: 1mm 0; }
    .totals .grand { border-top: 2px solid #0f172a; margin-top: 1mm; padding-top: 2mm; font-size: 13pt; font-weight: 700; }
    .debt { color: #b91c1c; font-weight: 700; }
    .terms { margin-top: 8mm; font-size: 8.5pt; color: #475569; }
    .signs { margin-top: 14mm; display: grid; grid-template-columns: 1fr 1fr; gap: 20mm; }
    .signs div { border-top: 1px solid #0f172a; padding-top: 1.5mm; font-size: 8.5pt; color: #475569; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">${e(company.name)}</div>
        <div class="muted">${e([company.address, company.phone].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="qr">${qr}</div>
    </div>
    <div class="title"><h1>${e(t('ordReceiptTitle'))} ${e(order.order_number)}</h1><span class="muted">${e(formatDate(order.created_at))}</span></div>
    <div class="grid">
      <div><div class="k">${e(t('customer'))}</div><div class="v">${e(order.customer_name)}</div></div>
      <div><div class="k">${e(t('phone'))}</div><div class="v">${e(order.customer_phone)}</div></div>
      ${data.passport ? `<div><div class="k">${e(t('custPassport'))}</div><div class="v">${e(data.passport)}</div></div>` : ''}
      ${order.expected_return_date ? `<div><div class="k">${e(t('ordReturnBy'))}</div><div class="v">${e(formatDate(order.expected_return_date))}</div></div>` : ''}
      ${order.delivery_address ? `<div><div class="k">${e(t('deliveryAddress'))}</div><div class="v">${e(order.delivery_address)}</div></div>` : ''}
      ${order.created_by ? `<div><div class="k">${e(t('ordStaff'))}</div><div class="v">${e(order.created_by)}</div></div>` : ''}
    </div>
    ${items.length ? `<h2>${e(t('ordItemsSection'))}</h2><table>
      <thead><tr><th>#</th><th>${e(t('ordStepItems'))}</th><th class="r">${e(t('ordDays'))}</th><th class="r">${e(t('ordPerDay'))}</th><th class="r">${e(t('ordDiscount'))}</th><th class="r">${e(t('ordDeposit'))}</th><th class="r">${e(t('ordGrandTotal'))}</th></tr></thead>
      <tbody>${itemRows}</tbody></table>` : ''}
    ${services.length ? `<h2>${e(t('ordServicesSection'))}</h2><table>
      <thead><tr><th>#</th><th>${e(t('ordServiceCategory'))}</th><th>${e(t('ordPartner'))}</th><th>${e(t('ordAddress'))}</th><th class="r">${e(t('ordGrandTotal'))}</th></tr></thead>
      <tbody>${serviceRows}</tbody></table>` : ''}
    <div class="totals">
      ${items.length ? `<div><span>${e(t('ordRentSubtotal'))}</span><span>${money(rentSubtotal)}</span></div>` : ''}
      ${Number(order.discount_amount) > 0 ? `<div><span>${e(t('ordDiscount'))}</span><span>−${money(order.discount_amount)}</span></div>` : ''}
      ${services.length ? `<div><span>${e(t('ordServicesSubtotal'))}</span><span>${money(order.total_service_amount)}</span></div>` : ''}
      <div class="grand"><span>${e(t('ordGrandTotal'))}</span><span>${money(order.total_rent_amount)}</span></div>
      <div><span>${e(t('paidAmount'))}</span><span>${money(order.paid_amount)}</span></div>
      <div><span>${e(t('ordRemaining'))}</span><span class="${Number(order.debt_amount) > 0 ? 'debt' : ''}">${money(order.debt_amount)}</span></div>
      ${Number(order.total_deposit_amount) > 0 ? `<div><span>${e(t('ordDeposit'))}</span><span>${money(order.total_deposit_amount)}</span></div>` : ''}
    </div>
    ${payments.length ? `<h2>${e(t('ordPaymentsSection'))}</h2><table><tbody>${paymentRows}</tbody></table>` : ''}
    ${items.length ? `<p class="terms">${e(t('ordReceiptTerms'))}</p>` : ''}
    <div class="signs"><div>${e(t('ordReceiptSignCustomer'))}</div><div>${e(t('ordReceiptSignStaff'))}</div></div>
  </body></html>`;

  await printHtml(html);
}
