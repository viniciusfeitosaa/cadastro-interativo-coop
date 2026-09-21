import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { formularioAdminService, publicFormUrl } from '../services/formulario.service';
import { useState } from 'react';

export default function Formularios() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: modulosResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });
  const mapModulos = modulosResp?.data?.map;
  const mapNiveis = modulosResp?.data?.mapNiveis;
  const moduloOff = modulosResp && mapModulos ? mapModulos.FORMULARIOS === false : false;
  const canEdit =
    user?.role === 'MASTER' || mapNiveis?.FORMULARIOS === 'EDITAR' || mapNiveis?.FORMULARIOS === undefined;

  const listQuery = useQuery({
    queryKey: ['admin', 'formularios', user?.tenantId],
    queryFn: async () => (await formularioAdminService.list()).data ?? [],
    enabled: !!user && !moduloOff,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      formularioAdminService.patch(id, { ativo }),
    onSuccess: async () => {
      setError(null);
      setInfo('Formulário atualizado.');
      await qc.invalidateQueries({ queryKey: ['admin', 'formularios'] });
    },
    onError: () => setError('Falha ao atualizar formulário.'),
  });

  if (moduloOff) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso ao módulo</h2>
        <p className="text-sm text-coop-700">O módulo Formulários não está habilitado para o seu perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-coop-950 font-display">Formulários</h1>
        <p className="text-sm text-coop-700 mt-1">Links públicos e respostas das inscrições.</p>
      </div>
      {info ? <p className="text-sm text-emerald-800">{info}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {listQuery.isLoading && <p className="text-sm text-coop-700">Carregando…</p>}
      <ul className="space-y-3">
        {(listQuery.data || []).map((f) => {
          const url = publicFormUrl(f.slug);
          return (
            <li key={f.id} className="rounded-xl border border-coop-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-coop-900">{f.titulo}</p>
                  <p className="text-xs text-coop-600 mt-0.5">
                    {f._count.respostas} resposta(s) · {f.ativo ? 'Ativo' : 'Inativo'}
                  </p>
                  <p className="text-xs text-coop-700 mt-1 break-all">{url}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold px-2.5 py-1 rounded-md border border-coop-300 text-coop-800 hover:bg-coop-50"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        setInfo('Link copiado.');
                      } catch {
                        setError('Não foi possível copiar o link.');
                      }
                    }}
                  >
                    Copiar link
                  </button>
                  <Link
                    to={`/formularios/${f.id}`}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md bg-coop-700 text-white hover:bg-coop-800"
                  >
                    Ver respostas
                  </Link>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={patchMutation.isPending}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                      onClick={() => patchMutation.mutate({ id: f.id, ativo: !f.ativo })}
                    >
                      {f.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
