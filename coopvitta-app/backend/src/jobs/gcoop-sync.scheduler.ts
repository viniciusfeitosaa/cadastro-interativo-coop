import { isGcoopEnabled } from '../services/gcoop/gcoop.config';
import { retryGcoopSyncPendentesService } from '../services/gcoop/gcoop.service';

const DEFAULT_INTERVAL_MIN = 30;

export function startGcoopSyncScheduler(): void {
  if (!isGcoopEnabled()) return;

  const raw = (process.env.GCOOP_SYNC_INTERVAL_MINUTES || '').trim();
  const minutes = raw ? parseInt(raw, 10) : DEFAULT_INTERVAL_MIN;
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  const intervalMs = minutes * 60 * 1000;
  console.log(`[gcoop] Agendador de reenvio ativo (a cada ${minutes} min)`);

  const tick = async () => {
    try {
      const { prisma } = await import('../config/database');
      const tenants = await prisma.tenant.findMany({
        where: { ativo: true },
        select: { id: true },
      });
      for (const t of tenants) {
        await retryGcoopSyncPendentesService(t.id);
      }
    } catch (err) {
      console.error('[gcoop] Erro no agendador de sincronização:', err);
    }
  };

  setInterval(() => void tick(), intervalMs);
  setTimeout(() => void tick(), 60_000);
}
