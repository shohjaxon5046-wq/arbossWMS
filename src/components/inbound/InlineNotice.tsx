import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type Notice = { kind: 'error' | 'success'; text: string } | null;

export function InlineNotice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  const isError = notice.kind === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${isError
      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{notice.text}</span>
      <button onClick={onClose} className="rounded p-0.5 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{children}</label>;
}
