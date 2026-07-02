import { authService } from '../../../services/auth.service';
import type { FormData } from '../schemas/formSchema';
import { mapCadastroFiles, mapCadastroToRegisterPayload } from './mapRegisterPayload';

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (err instanceof Error && err.message !== 'Request failed') return err.message;
  return 'Erro ao enviar cadastro. Tente novamente.';
}

export async function submitCadastroRegister(values: FormData): Promise<void> {
  const payload = mapCadastroToRegisterPayload(values);
  const files = mapCadastroFiles(values);

  try {
    await authService.register(payload, files);
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}
