import { authService } from '../../../services/auth.service';
import type { FormData } from '../schemas/formSchema';
import { compressRegisterFiles } from './compressRegisterFiles';
import { mapCadastroFiles, mapCadastroToRegisterPayload } from './mapRegisterPayload';

export type SubmitCadastroProgress = {
  phase: 'preparing' | 'uploading';
  /** 0–100 durante upload; undefined em preparing */
  percent?: number;
};

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: string; message?: string } } }).response
      ?.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (err instanceof Error) {
    const msg = err.message || '';
    const lower = msg.toLowerCase();
    if (
      lower === 'failed to fetch' ||
      lower.includes('networkerror') ||
      lower.includes('network request failed') ||
      lower.includes('load failed') ||
      lower.includes('network error')
    ) {
      return 'Não foi possível enviar o cadastro (falha de rede ou tempo esgotado). Verifique a conexão, use Wi‑Fi se possível e tente novamente. Se o problema continuar, reduza o tamanho dos anexos (PDF/fotos).';
    }
    if (msg !== 'Request failed') return msg;
  }
  return 'Erro ao enviar cadastro. Tente novamente.';
}

export async function submitCadastroRegister(
  values: FormData,
  onProgress?: (p: SubmitCadastroProgress) => void
): Promise<void> {
  const payload = mapCadastroToRegisterPayload(values);
  const rawFiles = mapCadastroFiles(values);

  try {
    onProgress?.({ phase: 'preparing' });
    const files = await compressRegisterFiles(rawFiles);
    await authService.register(payload, files, {
      onProgress: (percent) => onProgress?.({ phase: 'uploading', percent }),
    });
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
