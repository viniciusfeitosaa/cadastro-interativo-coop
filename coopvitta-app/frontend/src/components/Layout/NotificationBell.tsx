import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { medicoService } from '../../services/medico.service';
import type { NotificationKind } from '../../context/notificationTypes';
import { formatNotificationRowForDisplay } from '../../lib/notificationDisplay';

const kindDot: Record<NotificationKind, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
};

function mapTipoToLabel(tipo: string): string {
  const m: Record<string, string> = {
    EQUIPE_VINCULO: 'Equipe',
    SUBGRUPO_VINCULO: 'Subgrupo',
    ESCALA_NOVA: 'Escala',
    ESCALA_EQUIPE_VINCULO: 'Escala',
  };
  return m[tipo] ?? 'Sistema';
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type UnifiedRow = {
  id: string;
  isServer: boolean;
  kind: NotificationKind;
  title?: string;
  message: string;
  source?: string;
  read: boolean;
  createdAt: number;
};

const SERVER_PREFIX = 'srv:';

const NotificationBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { items: localItems, markRead: markLocalRead, markAllRead: markAllLocalRead, clearAll: clearLocalAll } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isMedico = user?.role === 'MEDICO';

  const { data: notifResp, isFetching: loadingServer } = useQuery({
    queryKey: ['medico', 'notificacoes'],
    queryFn: () => medicoService.listNotificacoes(40),
    enabled: isMedico,
    staleTime: 30_000,
    refetchInterval: open ? 45_000 : false,
  });

  const serverRows: UnifiedRow[] = useMemo(() => {
    const list = notifResp?.data ?? [];
    return list.map((n) => ({
      id: `${SERVER_PREFIX}${n.id}`,
      isServer: true,
      kind: 'info' as const,
      title: n.titulo,
      message: n.corpo,
      source: mapTipoToLabel(n.tipo),
      read: !!n.lidaEm,
      createdAt: new Date(n.createdAt).getTime(),
    }));
  }, [notifResp]);

  const localRows: UnifiedRow[] = useMemo(
    () =>
      localItems.map((n) => ({
        id: n.id,
        isServer: false,
        kind: n.kind,
        title: n.title,
        message: n.message,
        source: n.source,
        read: n.read,
        createdAt: n.createdAt,
      })),
    [localItems]
  );

  const merged: UnifiedRow[] = useMemo(() => {
    const byKey = new Map<string, UnifiedRow>();
    [...serverRows, ...localRows].forEach((row) => {
      const prev = byKey.get(row.id);
      if (!prev || row.createdAt >= prev.createdAt) {
        byKey.set(row.id, row);
      }
    });
    return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [serverRows, localRows]);

  const unreadCount = merged.filter((r) => !r.read).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleMarkRead = async (row: UnifiedRow) => {
    if (row.read) return;
    if (row.isServer) {
      const rawId = row.id.startsWith(SERVER_PREFIX) ? row.id.slice(SERVER_PREFIX.length) : row.id;
      try {
        await medicoService.marcarNotificacaoLida(rawId);
        await queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      } catch {
        /* ignore */
      }
    } else {
      markLocalRead(row.id);
    }
  };

  const handleMarkAllRead = async () => {
    markAllLocalRead();
    if (isMedico) {
      try {
        await medicoService.marcarTodasNotificacoesLidas();
        await queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      } catch {
        /* ignore */
      }
    }
  };

  const handleClear = async () => {
    clearLocalAll();
    if (isMedico) {
      try {
        await medicoService.marcarTodasNotificacoesLidas();
        await queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && isMedico) {
            queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
          }
        }}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-coop-200/70 bg-white/90 text-coop-800 shadow-[0_1px_2px_rgba(8,50,20,0.05)] hover:bg-coop-50/95 hover:border-coop-200 transition"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-coop-900 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,440px)] z-50 flex flex-col overflow-hidden animate-fade-in rounded-2xl
          border border-coop-200/70 bg-gradient-to-b from-white via-white to-coop-50/[0.35]
          shadow-[0_16px_48px_-12px_rgba(8,50,20,0.18),0_4px_16px_-4px_rgba(8,50,20,0.08)]
          ring-1 ring-coop-900/[0.04] backdrop-blur-xl"
        >
          <div className="flex-none flex items-center justify-between gap-2 px-4 py-3 border-b border-coop-200/50 bg-gradient-to-r from-coop-50/95 via-white/90 to-coop-50/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-coop-900/5 text-coop-800 ring-1 ring-coop-900/10">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-coop-900 font-display">Notificações</p>
                <p className="text-[10px] text-coop-600 font-serif mt-0.5 truncate">
                  {loadingServer && isMedico
                    ? 'Atualizando…'
                    : merged.length === 0
                      ? 'Nada novo por aqui'
                      : `${merged.length} ${merged.length === 1 ? 'item' : 'itens'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {merged.length > 0 && (
                <>
                  <button
                    type="button"
                    className="text-[11px] text-coop-700 hover:text-coop-950 font-medium px-2.5 py-1.5 rounded-lg hover:bg-coop-100/90 transition font-display"
                    onClick={() => void handleMarkAllRead()}
                  >
                    Lidas
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-coop-600 hover:text-red-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50/90 transition"
                    onClick={() => void handleClear()}
                  >
                    Limpar
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 bg-coop-50/20">
            {merged.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-coop-100/90 to-coop-50/50 ring-1 ring-coop-200/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <svg className="h-8 w-8 text-coop-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-coop-900 font-display">Tudo em dia</p>
                <p className="mt-1.5 text-[11px] text-coop-600 font-serif leading-relaxed max-w-[17rem]">
                  {isMedico
                    ? 'Quando você for alocado a uma equipe, a uma escala ou quando surgir uma escala nova no seu contrato, avisaremos aqui.'
                    : 'Ações concluídas e avisos do sistema aparecerão aqui.'}
                </p>
              </div>
            ) : (
              <ul className="p-2 space-y-1.5">
                {merged.map((row) => {
                  const display = formatNotificationRowForDisplay({
                    title: row.title,
                    message: row.message,
                    kind: row.kind,
                  });
                  return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition border shadow-sm
                        ${!row.read ? 'bg-white border-coop-200/80 border-l-[3px] border-l-coop-600 ring-1 ring-coop-900/[0.03]' : 'bg-white/80 border-coop-200/35 hover:bg-white hover:border-coop-200/55'}`}
                      onClick={() => void handleMarkRead(row)}
                    >
                      <div className="flex gap-2.5">
                        <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${kindDot[row.kind]}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          {display.title && (
                            <p className="text-xs font-semibold text-coop-900 font-display truncate">{display.title}</p>
                          )}
                          <p className="text-[11px] text-coop-800 font-serif leading-snug break-words">{display.message}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-coop-500 tabular-nums">{formatTime(row.createdAt)}</span>
                            {row.source && (
                              <span className="text-[10px] font-medium text-coop-500 uppercase tracking-wide">
                                {row.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
