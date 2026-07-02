import type { AppNotificationInput } from '../context/notificationTypes';

type AddFn = (input: AppNotificationInput) => void;

let addFn: AddFn | null = null;

/** Registrado pelo NotificationProvider ao montar. */
export function registerNotificationHandler(fn: AddFn | null) {
  addFn = fn;
}

/** Dispara uma notificação na central (header). Seguro se o provider ainda não montou (no-op). */
export function notify(input: AppNotificationInput): void {
  addFn?.(input);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AppNotificationInput>('viva:toast', { detail: input }));
  }
}
