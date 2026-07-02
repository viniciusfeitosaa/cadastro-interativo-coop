import { Link } from 'react-router-dom';

const AcessoNegado = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center border-l-4 border-amber-500">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-coop-900 mb-2">Acesso negado</h1>
        <p className="text-gray-600 mb-6">
          Você não tem permissão para acessar esta área. Se acredita que isso é um erro, entre em contato com o administrador.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-coop-600 px-4 py-2 text-sm font-semibold text-white hover:bg-coop-700 transition"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default AcessoNegado;
