import { useEffect, useMemo, useState } from 'react';
import type { AppNotificationInput, NotificationKind } from '../../context/notificationTypes';

type ToastItem = AppNotificationInput & { id: string };

const toastStyleByKind: Record<NotificationKind, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
};

const iconByKind: Record<NotificationKind, string> = {
  success: '✓',
  error: '!',
  info: 'i',
  warning: '!',
};

const GlobalToasts = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (evt: Event) => {
      const custom = evt as CustomEvent<AppNotificationInput>;
      if (!custom?.detail?.message) return;
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [{ id, ...custom.detail }, ...prev].slice(0, 4));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, 3500);
    };
    window.addEventListener('viva:toast', onToast as EventListener);
    return () => window.removeEventListener('viva:toast', onToast as EventListener);
  }, []);

  const visible = useMemo(() => items.slice(0, 3), [items]);
  if (visible.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-[70] flex w-[min(92vw,24rem)] flex-col gap-2">
      {visible.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-sm animate-fade-in ${toastStyleByKind[item.kind]}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs font-bold">
              {iconByKind[item.kind]}
            </span>
            <div className="min-w-0 flex-1">
              {item.title ? <p className="text-sm font-semibold font-display">{item.title}</p> : null}
              <p className="text-xs leading-snug font-serif">{item.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlobalToasts;
