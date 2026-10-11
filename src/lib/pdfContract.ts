import { generateContractA4Html, type CompanyInfo, loadCompany } from '@/lib/receipt';
import { printHtml } from '@/lib/labels';
import type { Customer, ProductItem, ProductModel } from '@/types';
import type { OrderBundle } from '@/lib/orders';

export interface DraftContractParams {
  customer: Customer;
  itemIds: string[];
  models: ProductModel[];
  available: ProductItem[];
  days: number;
  delivery: 'pickup' | 'delivery';
  address?: string;
  notes?: string;
  payAmount?: number;
  payType?: string;
  staffName?: string;
}

/**
 * Creates a mock OrderBundle from draft modal state
 * so it can use the exact same contract template and formatting.
 */
export function buildDraftBundle(params: DraftContractParams): OrderBundle {
  const {
    customer,
    itemIds,
    models,
    available,
    days,
    delivery,
    address,
    notes,
    payAmount = 0,
    payType = 'naqd',
    staffName = 'Kassir / Menejer'
  } = params;

  const modelById = new Map(models.map(m => [m.id, m]));
  const itemMap = new Map(available.map(i => [i.id, i]));
  const now = new Date();

  let gross = 0;
  let rent = 0;
  let deposit = 0;

  const orderItems = itemIds.map(id => {
    const item = itemMap.get(id);
    const model = item ? modelById.get(item.model_id) : undefined;
    const dailyPrice = Number(model?.daily_price || 0);
    const lineTotal = dailyPrice * days;
    const dep = Number(model?.deposit_amount || 0);

    gross += lineTotal;
    rent += lineTotal;
    deposit += dep;

    return {
      id: `draft-item-${id}`,
      order_id: 'draft-order',
      product_item_id: id,
      model_id: model?.id || null,
      model_name: model?.name || 'Uskuna',
      serial_number: item?.serial_number || '—',
      rent_days: days,
      daily_price: dailyPrice,
      deposit_amount: dep,
      picking_status: 'kutilmoqda',
      return_status: 'topshirilmadi',
      discount_pct: 0,
      line_total: lineTotal,
      depreciation_applied: 0,
      created_at: now.toISOString()
    };
  });

  const orderNumber = 'SHARTNOMA-' + Math.floor(10000 + Math.random() * 90000).toString();
  const returnDate = new Date(now.getTime() + days * 86400000);

  const passport = customer.passport_series && customer.passport_number
    ? `${customer.passport_series} ${customer.passport_number}`
    : '';

  return {
    order: {
      id: 'draft-order-id',
      order_number: orderNumber,
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_phone: customer.phone_primary,
      status: 'yangi',
      total_rent_amount: rent,
      total_service_amount: 0,
      discount_amount: 0,
      paid_amount: payAmount,
      debt_amount: Math.max(0, rent - payAmount),
      total_deposit_amount: deposit,
      deposit_returned: 0,
      start_date: now.toISOString(),
      expected_return_date: returnDate.toISOString(),
      actual_return_date: null,
      delivery_type: delivery,
      delivery_address: address || '',
      notes: notes || '',
      created_by: staffName,
      created_by_user_id: null,
      source: 'manual',
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    },
    items: orderItems,
    services: [],
    payments: payAmount > 0 ? [{
      id: 'draft-pay-1',
      order_id: 'draft-order-id',
      amount: payAmount,
      payment_type: payType,
      cash_register_id: null,
      date: now.toISOString(),
      notes: '',
      created_by: staffName,
      created_at: now.toISOString()
    }] : [],
    partnerNames: {},
    passport,
    customer
  };
}

/**
 * Downloads the contract as a standard A4 PDF document.
 * Uses html2canvas + jsPDF with crisp rendering.
 */
export async function downloadContractPdf(
  bundleOrDraft: OrderBundle | DraftContractParams,
  filename?: string
): Promise<void> {
  const bundle = 'order' in bundleOrDraft ? bundleOrDraft : buildDraftBundle(bundleOrDraft);
  const html = await generateContractA4Html(bundle);

  const finalName = filename || `Ijara_Shartnomasi_${bundle.order.order_number}_${bundle.order.customer_name.replace(/\s+/g, '_')}.pdf`;

  // Render HTML in an off-screen container matching A4 dimensions at 96 DPI (approx 794px x 1123px)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width at 96dpi
  container.style.minHeight = '1123px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.boxSizing = 'border-box';
  container.style.padding = '0';

  // Extract body and styles
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styles = headMatch ? headMatch[1] : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  container.innerHTML = `<div>${styles}<div style="padding: 24px; background: #fff;">${bodyContent}</div></div>`;
  document.body.appendChild(container);

  try {
    // Wait for fonts and layouts to settle
    await new Promise(r => setTimeout(r, 200));

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    const canvas = await html2canvas(container, {
      scale: 2, // Retinal high resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(finalName);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Triggers native printing for the contract (A4 preview & dialog).
 */
export async function printContractDocument(
  bundleOrDraft: OrderBundle | DraftContractParams
): Promise<void> {
  const bundle = 'order' in bundleOrDraft ? bundleOrDraft : buildDraftBundle(bundleOrDraft);
  const html = await generateContractA4Html(bundle);
  await printHtml(html);
}
