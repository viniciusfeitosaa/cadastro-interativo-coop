export type NotificationKind = 'success' | 'error' | 'info' | 'warning';

export interface AppNotificationInput {
  kind: NotificationKind;
  title?: string;
  message: string;
  /** Agrupa no painel (ex.: ponto, perfil, escala). */
  source?: string;
}

export interface StoredNotification extends AppNotificationInput {
  id: string;
  read: boolean;
  createdAt: number;
}
