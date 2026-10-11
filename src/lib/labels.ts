import QRCode from 'qrcode';

export interface Label {
  qrValue: string;
  title: string;
  subtitle?: string;
}

export type LabelFormat = 'a4' | 'label';

export function qrSvg(value: string): Promise<string> {
  return QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}

export const escapeHtml = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const styles: Record<LabelFormat, string> = {
  a4: `
    @page { size: A4; margin: 10mm 5mm; }
    .sheet { display: grid; grid-template-columns: repeat(3, 66mm); grid-auto-rows: 34.5mm; gap: 2mm 3mm; justify-content: center; }
    .label { border: 0.2mm dashed #cbd5e1; }
    .qr { width: 27mm; height: 27mm; }
    .title { font-size: 15pt; }
  `,
  label: `
    @page { size: 58mm 40mm; margin: 0; }
    .label { width: 58mm; height: 40mm; page-break-after: always; break-after: page; }
    .qr { width: 30mm; height: 30mm; }
    .title { font-size: 14pt; }
  `,
};

export async function printLabels(labels: Label[], format: LabelFormat): Promise<void> {
  const svgs = await Promise.all(labels.map(l => qrSvg(l.qrValue)));
  const body = labels.map((l, i) => `
    <div class="label">
      <div class="qr">${svgs[i]}</div>
      <div class="text">
        <div class="title">${escapeHtml(l.title)}</div>
        ${l.subtitle ? `<div class="sub">${escapeHtml(l.subtitle)}</div>` : ''}
      </div>
    </div>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; }
    .label { display: flex; align-items: center; gap: 3mm; padding: 2.5mm; overflow: hidden; }
    .qr svg { width: 100%; height: 100%; display: block; }
    .text { min-width: 0; }
    .title { font-weight: 700; line-height: 1.15; word-break: break-all; }
    .sub { margin-top: 1mm; font-size: 8pt; line-height: 1.3; color: #333; }
    ${styles[format]}
  </style></head><body>${format === 'a4' ? `<div class="sheet">${body}</div>` : body}</body></html>`;

  await printHtml(html);
}

export async function printHtml(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error('Print unavailable');
  }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise(r => setTimeout(r, 150));
  win.focus();
  win.print();
  setTimeout(() => frame.remove(), 60000);
}
