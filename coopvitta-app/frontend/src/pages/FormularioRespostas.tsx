import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import {
  formularioAdminService,
  type FormularioRespostaStatus,
} from '../services/formulario.service';
import { useState } from 'react';

const STATUS_OPTS: FormularioRespostaStatus[] = [
  'NOVA',
  'EM_ANALISE',
  'PRE_SELECIONADA',
  'REJEITADA',
  'ARQUIVADA',
];

const STATUS_LABEL: Record<FormularioRespostaStatus, string> = {
  NOVA: 'Nova',
  EM_ANALISE: 'Em análise',
  PRE_SELECIONADA: 'Pré-selecionada',
  REJEITADA: 'Rejeitada',
  ARQUIVADA: 'Arquivada',
};

export default function FormularioRespostas() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: modulosResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });
  const mapNiveis = modulosResp?.data?.mapNiveis;
  const canEdit =
    user?.role === 'MASTER' || mapNiveis?.FORMULARIOS === 'EDITAR' || mapNiveis?.FORMULARIOS === undefined;

  const formQuery = useQuery({
    queryKey: ['admin', 'formulario', id],
    queryFn: async () => (await formularioAdminService.get(id)).data,
    enabled: !!id && !!user,
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'formulario-respostas', id, q, statusFilter],
    queryFn: async () =>
      (
        await formularioAdminService.listRespostas(id, {
          q: q || undefined,
          status: statusFilter || undefined,
        })
      ).data ?? [],
    enabled: !!id && !!user,
  });

  const statusMutation = useMutation({
    mutationFn: ({ respostaId, status }: { respostaId: string; status: FormularioRespostaStatus }) =>
      formularioAdminService.patchResposta(id, respostaId, status),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin', 'formulario-respostas', id] });
    },
    onError: () => setError('Falha ao atualizar status.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <Link to="/formularios" className="text-xs font-semibold text-coop-700 underline">
            ← Formulários
          </Link>
          <h1 className="text-xl font-bold text-coop-950 font-display mt-1">
            {formQuery.data?.titulo || 'Respostas'}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome ou telefone"
          className="rounded-lg border border-coop-200 px-3 py-1.5 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-coop-200 px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {listQuery.isLoading && <p className="text-sm text-coop-700">Carregando…</p>}

      <ul className="space-y-3">
        {(listQuery.data || []).map((r) => {
          const profissao = r.valores.find((v) => v.campo.chave === 'profissao')?.valorTexto;
          const curriculo = r.valores.find((v) => v.campo.tipo === 'FICHEIRO');
          return (
            <li key={r.id} className="rounded-xl border border-coop-200 bg-white px-4 py-3">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold text-coop-900">{r.remetenteNome}</p>
                  <p className="text-xs text-coop-700">
                    {r.remetenteTelefone}
                    {profissao ? ` · ${profissao}` : ''}
                  </p>
                  <p className="text-xs text-coop-500 mt-1">
                    {new Date(r.createdAt).toLocaleString('pt-BR')} · {STATUS_LABEL[r.status]}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {curriculo?.campo.id ? (
                    <button
                      type="button"
                      className="text-xs font-semibold underline text-coop-700"
                      onClick={() =>
                        void formularioAdminService
                          .downloadFicheiro(
                            id,
                            r.id,
                            curriculo.campo.id!,
                            curriculo.nomeArquivo || 'curriculo.pdf'
                          )
                          .catch(() => setError('Falha ao descarregar currículo.'))
                      }
                    >
                      Descarregar currículo
                    </button>
                  ) : null}
                  {canEdit ? (
                    <select
                      value={r.status}
                      disabled={statusMutation.isPending}
                      onChange={(e) =>
                        statusMutation.mutate({
                          respostaId: r.id,
                          status: e.target.value as FormularioRespostaStatus,
                        })
                      }
                      className="text-xs rounded-md border border-coop-200 px-2 py-1"
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {!listQuery.isLoading && !(listQuery.data || []).length ? (
        <p className="text-sm text-coop-700">Nenhuma resposta ainda.</p>
      ) : null}
    </div>
  );
}
