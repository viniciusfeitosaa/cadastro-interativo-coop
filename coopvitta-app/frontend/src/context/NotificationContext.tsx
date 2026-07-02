import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { registerNotificationHandler, notify as emitNotify } from '../lib/notificationEmitter';
import type { AppNotificationInput, StoredNotification } from './notificationTypes';

function buildStored(input: AppNotificationInput): StoredNotification {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    ...input,
    id,
    read: false,
    createdAt: Date.now(),
  };
}

const STORAGE_KEY = 'viva_app_notifications_v1';
const MAX_ITEMS = 40;

type NotificationsContextValue = {
  items: StoredNotification[];
  unreadCount: number;
  notify: (input: AppNotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function loadFromStorage(): StoredNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredNotification[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.id === 'string' && typeof x.message === 'string');
  } catch {
    return [];
  }
}

function saveToStorage(items: StoredNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota */
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StoredNotification[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const add = useCallback((input: AppNotificationInput) => {
    setItems((prev) => {
      const next = [buildStored(input), ...prev].slice(0, MAX_ITEMS);
      return next;
    });
  }, []);

  useEffect(() => {
    registerNotificationHandler(add);
    return () => registerNotificationHandler(null);
  }, [add]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      notify: emitNotify,
      markRead,
      markAllRead,
      clearAll,
    }),
    [items, unreadCount, markRead, markAllRead, clearAll]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications deve ser usado dentro de NotificationProvider');
  }
  return ctx;
}
