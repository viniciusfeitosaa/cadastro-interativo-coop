import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { BrandLogo } from '../components/brand/BrandLogo';

const schema = z
  .object({
    novaSenha: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type FormData = z.infer<typeof schema>;

const RedefinirSenha = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) {
      setError('Link inválido. Solicite uma nova redefinição de senha.');
    }
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.redefinirSenha(token, data.novaSenha);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao redefinir senha.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-coop-950 py-12 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl shadow-2xl text-center">
          <BrandLogo className="h-20 w-auto mx-auto mb-4" linkToSite />
          <p className="text-red-600 mb-4">{error}</p>
          <Link to="/esqueci-senha" className="font-semibold text-coop-800 hover:text-coop-600">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-coop-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-24 w-auto mb-6" linkToSite />
          <h1 className="text-xl font-bold text-coop-900">Nova senha</h1>
          <p className="text-sm text-gray-600 mt-1 text-center">
            Digite e confirme sua nova senha.
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
              Senha alterada com sucesso. Faça login com a nova senha.
            </div>
            <Link
              to="/login"
              className="btn btn-primary w-full py-4 text-center rounded-xl block"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="novaSenha" className="block text-sm font-semibold text-coop-800 mb-1">
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="novaSenha"
                  type={showNovaSenha ? 'text' : 'password'}
                  {...register('novaSenha')}
                  className="input pr-10"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNovaSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-gray-700 focus:outline-none" title={showNovaSenha ? 'Ocultar senha' : 'Mostrar senha'} tabIndex={-1}>
                  {showNovaSenha ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {errors.novaSenha && (
                <p className="mt-1 text-sm text-red-600">{errors.novaSenha.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="block text-sm font-semibold text-coop-800 mb-1">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  id="confirmarSenha"
                  type={showConfirmarSenha ? 'text' : 'password'}
                  {...register('confirmarSenha')}
                  className="input pr-10"
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirmarSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-gray-700 focus:outline-none" title={showConfirmarSenha ? 'Ocultar senha' : 'Mostrar senha'} tabIndex={-1}>
                  {showConfirmarSenha ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {errors.confirmarSenha && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmarSenha.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-600">
          <Link to="/login" className="font-semibold text-coop-800 hover:text-coop-600">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RedefinirSenha;
