import { type ReactNode } from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      {text && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{text}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-10 w-10 text-red-500" />
      <p className="mt-3 text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {icon || <Inbox className="h-12 w-12 text-slate-300 dark:text-slate-600" />}
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
