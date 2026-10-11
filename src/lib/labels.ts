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

export function openHtmlInNewTab(html: string): void {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
      // Revoke after a minute
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (err) {
    console.error('Failed to open HTML in new tab:', err);
  }
}

export function downloadHtmlFile(html: string, filename: string): void {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (err) {
    console.error('Failed to download HTML file:', err);
  }
}

export async function printHtml(html: string): Promise<void> {
  // Update main DOM #printable-area for native @media print (Ctrl+P / window.print)
  let printArea = document.getElementById('printable-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'printable-area';
    printArea.className = 'hidden print:block';
    document.body.appendChild(printArea);
  }

  // Extract head styles and body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const stylesOnly = headMatch ? headMatch[1] : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  printArea.innerHTML = `<div>${stylesOnly}${bodyContent}</div>`;

  // Wait 200ms to guarantee DOM reflow and styling application before triggering window.print
  await new Promise(r => setTimeout(r, 200));

  try {
    window.focus();
    window.print();
  } catch (winErr) {
    console.error('window.print error:', winErr);
  }
}

