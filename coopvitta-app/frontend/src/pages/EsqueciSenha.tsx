import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { BrandLogo } from '../components/brand/BrandLogo';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});

type FormData = z.infer<typeof schema>;

const EsqueciSenha = () => {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setResetLink(null);
    try {
      const res = await authService.esqueciSenha(data.email);
      setMessage(res.message);
      if (res.resetLink) setResetLink(res.resetLink);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-coop-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-24 w-auto mb-6" linkToSite />
          <h1 className="text-xl font-bold text-coop-900">Esqueci minha senha</h1>
          <p className="text-sm text-gray-600 mt-1 text-center">
            Informe o e-mail da sua conta para receber o link de redefinição.
          </p>
        </div>

        {!sent ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-coop-800 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="input"
                placeholder="seuemail@dominio.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
              {message}
            </div>
            {resetLink && (
              <div className="bg-coop-50 border border-coop-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-coop-700 mb-2">
                  Em ambiente de desenvolvimento, use o link abaixo:
                </p>
                <a
                  href={resetLink}
                  className="text-sm text-coop-800 underline break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resetLink}
                </a>
              </div>
            )}
          </div>
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

export default EsqueciSenha;
