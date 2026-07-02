import { Queue, Worker, type Job } from 'bullmq';
import type { EmailJobPayload } from './email.types';

let queue: Queue<EmailJobPayload> | null = null;
let worker: Worker<EmailJobPayload> | null = null;

function bullConnection() {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/^redis:\/\//, 'http://'));
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return null;
  }
}

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  switch (job.data.type) {
    case 'cadastro-pos': {
      const { enviarEmailsPosCadastroPublico } = await import('../services/cadastro-publico-email.service');
      await enviarEmailsPosCadastroPublico({
        to: job.data.to,
        nomeCompleto: job.data.nomeCompleto,
        versaoTermos: job.data.versaoTermos,
      });
      break;
    }
    case 'cadastro-aprovado': {
      const { enviarEmailCadastroAprovado } = await import('../services/cadastro-publico-email.service');
      await enviarEmailCadastroAprovado({
        to: job.data.to,
        nomeCompleto: job.data.nomeCompleto,
        nomeInstituicao: job.data.nomeInstituicao,
      });
      break;
    }
    case 'reset-password': {
      const { sendResetPasswordEmailJob } = await import('../services/auth.service');
      await sendResetPasswordEmailJob(job.data.to, job.data.resetLink);
      break;
    }
    default:
      throw new Error(`Job de e-mail desconhecido: ${(job.data as { type: string }).type}`);
  }
}

export function startEmailQueue(): boolean {
  const connection = bullConnection();
  if (!connection) return false;

  queue = new Queue<EmailJobPayload>('coopvitta-emails', { connection });
  worker = new Worker<EmailJobPayload>('coopvitta-emails', processEmailJob, {
    connection,
    concurrency: Math.max(1, parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '2', 10)),
  });

  worker.on('failed', (job, err) => {
    console.error('[email-queue] falha:', job?.id, job?.data?.type, err.message);
  });

  console.log('[email-queue] worker ativo');
  return true;
}

export async function enqueueEmailJob(payload: EmailJobPayload): Promise<boolean> {
  if (!queue) return false;
  await queue.add(payload.type, payload, {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  return true;
}

export async function stopEmailQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
