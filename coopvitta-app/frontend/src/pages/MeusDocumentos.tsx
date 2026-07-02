import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { fixMojibake } from '../utils/validation.util';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

const MeusDocumentos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [cienciaErro, setCienciaErro] = useState<string | null>(null);

  const { data: docsResp, isLoading } = useQuery({
    queryKey: ['medico', 'documentos-enviados', user?.id],
    queryFn: () => medicoService.listDocumentosEnviados(),
    enabled: !!user && !isMaster,
  });

  const confirmarCienciaMutation = useMutation({
    mutationFn: (id: string) => medicoService.confirmarCienciaDocumentoEnviado(id),
    onSuccess: () => {
      setCienciaErro(null);
      queryClient.invalidateQueries({ queryKey: ['medico', 'documentos-enviados'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'dashboard', user?.id] });
    },
    onError: (err: unknown) => {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setCienciaErro(msg || 'Não foi possível registrar a ciência.');
    },
  });

  const documentos = docsResp?.data ?? [];

  if (isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-coop-700 font-serif">Documentos enviados para você estão na área do profissional. Use o perfil Master apenas para envio em Envio de Documentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">
          Área do profissional
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display leading-tight mb-2">
          Meus Documentos
        </h1>
        <p className="text-coop-700 font-serif text-base">
          Abra o ficheiro com <strong className="font-semibold text-coop-800">Visualizar</strong> e, depois de ler,
          use <strong className="font-semibold text-coop-800">Registar ciência</strong> para que a equipa saiba que
          tomou conhecimento (assinatura eletrónica simplificada).
        </p>
      </div>

      {/* Lista de documentos */}
      <div className="card stagger-2 border-l-4 border-l-coop-500 bg-gradient-to-br from-white to-coop-50/30">
        {cienciaErro && (
          <p className="text-sm text-red-600 mb-3 px-1" role="alert">
            {cienciaErro}
          </p>
        )}
        {isLoading ? (
          <div className="flex items-center gap-3 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-coop-200 border-t-coop-600" />
            <p className="text-sm text-coop-700 font-medium">Carregando...</p>
          </div>
        ) : documentos.length === 0 ? (
          <div className="py-12 text-center">
            <span className="inline-flex w-14 h-14 rounded-2xl bg-coop-100/80 items-center justify-center text-coop-500 mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <p className="text-sm text-coop-600 font-serif">Nenhum documento enviado para você ainda.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {documentos.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 rounded-xl bg-coop-50/50 border border-coop-200/40"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-coop-200/50 flex items-center justify-center text-coop-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-coop-900 truncate font-display text-sm">
                      {doc.titulo ? fixMojibake(doc.titulo) : fixMojibake(doc.nomeArquivo)}
                    </p>
                    {doc.titulo && (
                      <p className="text-[10px] text-coop-600 truncate mt-0.5">{fixMojibake(doc.nomeArquivo)}</p>
                    )}
                    <p className="text-[10px] text-coop-600 mt-1">
                      {formatBytes(doc.tamanhoBytes)} · {formatDate(doc.createdAt)}
                      {doc.aceitoEm && (
                        <span className="text-green-800 font-medium"> · Ciência: {formatDate(doc.aceitoEm)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                  <button
                    type="button"
                    className="btn-sm btn-primary"
                    onClick={() => medicoService.openDocumentoEnviado(doc.id, doc.nomeArquivo)}
                  >
                    Visualizar
                  </button>
                  {doc.aceitoEm ? (
                    <span className="text-xs font-medium text-green-800 px-2 py-1 rounded-lg bg-green-100/80">
                      Ciência registada
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      disabled={confirmarCienciaMutation.isPending}
                      onClick={() => confirmarCienciaMutation.mutate(doc.id)}
                    >
                      {confirmarCienciaMutation.isPending ? 'A registar…' : 'Registar ciência'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MeusDocumentos;
