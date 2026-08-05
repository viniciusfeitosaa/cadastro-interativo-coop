import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import {
  adminService,
  type CadastroPendenteDetalhe,
  type CadastroPendenteListItem,
} from '../services/admin.service';
import {
  DOCUMENTO_LABEL_BY_FIELD,
  DOCUMENTO_TIPO_BY_FIELD,
  type DocumentoPerfilField,
} from '../constants/documentosPerfil';
import ImportCadastroLoteModal from '../features/avaliacao/ImportCadastroLoteModal';

function labelDocumentoTipo(tipo: string): string {
  const entry = Object.entries(DOCUMENTO_TIPO_BY_FIELD).find(([, v]) => v === tipo);
  if (entry) return DOCUMENTO_LABEL_BY_FIELD[entry[0] as DocumentoPerfilField];
  return tipo;
}

function triggerBlobDownload(blob: Blob, nomeArquivo: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo || 'documento';
  a.click();
  window.URL.revokeObjectURL(url);
}

const Avaliacao = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [filterNome, setFilterNome] = useState('');
  const [filterProfissao, setFilterProfissao] = useState('');
  const [filterEspecialidade, setFilterEspecialidade] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'aprovar' | 'rejeitar';
    medicoId: string;
    nome: string;
  } | null>(null);
  const [resultDialog, setResultDialog] = useState<{
    title: string;
    message: string;
    variant: 'success' | 'warning' | 'neutral';
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: modulosResp, isLoading: modulosLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const mapModulos = modulosResp?.data?.map;
  const moduloDesabilitado = modulosResp && mapModulos ? mapModulos.AVALIACAO === false : false;

  const gcoopSyncQuery = useQuery({
    queryKey: ['admin', 'gcoop-sync-pendentes', user?.tenantId],
    queryFn: async () => {
      const r = await adminService.listGcoopSyncPendentes();
      return r.data ?? [];
    },
    enabled: !!user && user.role === 'MASTER' && !moduloDesabilitado,
  });

  const retryGcoopMutation = useMutation({
    mutationFn: (medicoId: string) => adminService.retryGcoopSync(medicoId),
    onSuccess: async () => {
      setActionError(null);
      setActionInfo('Reenvio ao Gcoop processado.');
      await gcoopSyncQuery.refetch();
    },
    onError: () => setActionError('Falha ao reenviar para o Gcoop.'),
  });

  const retryAllGcoopMutation = useMutation({
    mutationFn: () => adminService.retryAllGcoopSync(),
    onSuccess: async () => {
      setActionError(null);
      setActionInfo('Reenvio em lote ao Gcoop processado.');
      await gcoopSyncQuery.refetch();
    },
    onError: () => setActionError('Falha no reenvio em lote ao Gcoop.'),
  });

  const listQuery = useQuery({
    queryKey: [
      'admin',
      'cadastros-pendentes',
      user?.tenantId,
      filterNome,
      filterProfissao,
      filterEspecialidade,
    ],
    queryFn: async () => {
      const r = await adminService.listCadastrosPendentes({
        nome: filterNome || undefined,
        profissao: filterProfissao || undefined,
        especialidade: filterEspecialidade || undefined,
      });
      return (r.data ?? []) as CadastroPendenteListItem[];
    },
    enabled: !!user && user.role === 'MASTER' && !moduloDesabilitado,
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'cadastro-pendente-detalhe', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const r = await adminService.getCadastroPendenteDetalhe(selectedId);
      return r.data as CadastroPendenteDetalhe;
    },
    enabled: !!selectedId && user?.role === 'MASTER' && !moduloDesabilitado,
    retry: (_failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      return status !== 404;
    },
  });

  const clearDetalhePendente = async (medicoId: string) => {
    const detalheKey = ['admin', 'cadastro-pendente-detalhe', medicoId] as const;
    await queryClient.cancelQueries({ queryKey: detalheKey });
    queryClient.removeQueries({ queryKey: detalheKey });
    setSelectedId((current) => (current === medicoId ? null : current));
  };

  const refreshFilaPendentes = async () => {
    if (user?.tenantId) {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'cadastros-pendentes', user.tenantId],
      });
    }
    if (user?.tenantId) {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'gcoop-sync-pendentes', user.tenantId],
      });
    }
  };

  const aprovarMutation = useMutation({
    mutationFn: ({ medicoId }: { medicoId: string; nome: string }) =>
      adminService.aprovarCadastroPendente(medicoId),
    onSuccess: async (resp, { medicoId, nome }) => {
      setActionError(null);
      setConfirmDialog(null);
      const gcoop = (resp as { data?: { gcoopSync?: { ok?: boolean; status?: string; skipped?: boolean } } })?.data
        ?.gcoopSync;
      if (gcoop && gcoop.ok === false && gcoop.status === 'PENDENTE_SYNC') {
        setActionInfo(
          'Cadastro aprovado localmente. O envio ao Gcoop ficou pendente — use a secção abaixo para reenviar quando o serviço estiver disponível.'
        );
        setResultDialog({
          title: 'Cadastro aprovado',
          message: `${nome} foi aprovado na plataforma COOPVITTA. O envio ao Gcoop ficou pendente — você pode reenviar na secção de sincronização abaixo. O profissional deve acessar a área do cooperado no Gcoop após a sincronização.`,
          variant: 'warning',
        });
      } else if (gcoop?.ok && !gcoop.skipped) {
        setActionInfo(null);
        setResultDialog({
          title: 'Cadastro aprovado',
          message: `${nome} foi aprovado e sincronizado com o Gcoop. O profissional pode acessar a área do cooperado com o e-mail cadastrado.`,
          variant: 'success',
        });
      } else {
        setActionInfo(null);
        setResultDialog({
          title: 'Cadastro aprovado',
          message: `${nome} foi aprovado com sucesso. O profissional receberá um e-mail com o link da área do cooperado no Gcoop.`,
          variant: 'success',
        });
      }
      await clearDetalhePendente(medicoId);
      await refreshFilaPendentes();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setConfirmDialog(null);
      setActionError(err.response?.data?.error || 'Não foi possível aprovar.');
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: ({ medicoId }: { medicoId: string; nome: string }) =>
      adminService.rejeitarCadastroPendente(medicoId),
    onSuccess: async (_resp, { medicoId, nome }) => {
      setActionError(null);
      setConfirmDialog(null);
      setResultDialog({
        title: 'Cadastro rejeitado',
        message: `O pré-cadastro de ${nome} foi rejeitado. O acesso permanece bloqueado.`,
        variant: 'neutral',
      });
      await clearDetalhePendente(medicoId);
      await refreshFilaPendentes();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setConfirmDialog(null);
      setActionError(err.response?.data?.error || 'Não foi possível rejeitar.');
    },
  });

  const actionPending = aprovarMutation.isPending || rejeitarMutation.isPending;

  const downloadDoc = async (medicoId: string, docId: string, nomeArquivo: string) => {
    try {
      const blob = await adminService.downloadCadastroPendenteDocumento(medicoId, docId);
      triggerBlobDownload(blob, nomeArquivo);
    } catch {
      setActionError('Falha ao baixar o documento.');
    }
  };

  if (modulosLoading) {
    return (
      <div className="card">
        <p className="text-sm text-coop-700 font-serif">Carregando permissões…</p>
      </div>
    );
  }

  if (moduloDesabilitado) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso ao módulo</h2>
        <p className="text-sm text-coop-700 font-serif">
          O módulo Avaliação não está habilitado para o seu perfil neste tenant. Um administrador pode ativá-lo em{' '}
          <strong>Minha Conta</strong> (matriz de acessos).
        </p>
      </div>
    );
  }

  if (user?.role !== 'MASTER') {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-coop-700 font-serif">A fila de cadastros públicos é exclusiva do administrador.</p>
      </div>
    );
  }

  const d = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero border-l-4 border-l-coop-500 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">Cadastros</p>
        <h1 className="text-2xl md:text-3xl font-bold text-coop-950 font-display tracking-tight mb-2">Avaliação</h1>
        <p className="text-coop-800 font-serif max-w-2xl">
          Profissionais que se cadastraram pela página pública aparecem aqui até serem aprovados ou rejeitados. Abra um
          registo para ver dados e ficheiros enviados. Também pode importar uma lista colada (Excel/formulário) de uma
          só vez.
        </p>
        <div className="mt-4">
          <button type="button" className="btn-primary text-sm" onClick={() => setImportOpen(true)}>
            Importar lista (colar)
          </button>
        </div>
      </div>

      <ImportCadastroLoteModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={async ({ criados, falhas }) => {
          setActionError(null);
          setActionInfo(
            criados > 0
              ? `${criados} cadastro(s) importado(s) como pendente de análise${falhas ? ` (${falhas} falha(s))` : ''}.`
              : falhas
                ? `Nenhum cadastro importado (${falhas} falha(s)).`
                : null
          );
          await queryClient.invalidateQueries({ queryKey: ['admin', 'cadastros-pendentes'] });
          await listQuery.refetch();
        }}
      />

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      )}

      {actionInfo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{actionInfo}</div>
      )}

      {(gcoopSyncQuery.data?.length ?? 0) > 0 && (
        <div className="card border-l-4 border-l-amber-500">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold text-coop-900 font-display">Sincronização Gcoop pendente</h2>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={retryAllGcoopMutation.isPending}
              onClick={() => retryAllGcoopMutation.mutate()}
            >
              Reenviar todos
            </button>
          </div>
          <p className="text-xs text-coop-700 font-serif mb-3">
            Cadastros aprovados localmente que ainda não foram enviados ao Gcoop (ou falharam por indisponibilidade).
          </p>
          <ul className="divide-y divide-coop-100">
            {gcoopSyncQuery.data!.map((row) => (
              <li key={row.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-coop-900">{row.nomeCompleto}</p>
                  <p className="text-xs text-coop-600">
                    {row.gcoopSyncStatus === 'PENDENTE_SYNC' ? 'Pendente de sincronização' : 'Erro no envio'}
                    {row.gcoopSyncErro ? ` — ${row.gcoopSyncErro}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={retryGcoopMutation.isPending}
                  onClick={() => retryGcoopMutation.mutate(row.id)}
                >
                  Reenviar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 card overflow-hidden">
          <h2 className="text-sm font-bold text-coop-900 font-display mb-3">Pendentes de análise</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="input text-sm"
              placeholder="Filtrar por nome"
              value={filterNome}
              onChange={(e) => setFilterNome(e.target.value)}
            />
            <input
              type="text"
              className="input text-sm"
              placeholder="Filtrar por profissão"
              value={filterProfissao}
              onChange={(e) => setFilterProfissao(e.target.value)}
            />
            <input
              type="text"
              className="input text-sm"
              placeholder="Filtrar por especialidade"
              value={filterEspecialidade}
              onChange={(e) => setFilterEspecialidade(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => {
                setFilterNome('');
                setFilterProfissao('');
                setFilterEspecialidade('');
              }}
            >
              Limpar
            </button>
          </div>
          {listQuery.isLoading && <p className="text-sm text-coop-700 font-serif">A carregar…</p>}
          {listQuery.isError && (
            <p className="text-sm text-red-700 font-serif">Não foi possível carregar a lista. Verifique a sessão e a API.</p>
          )}
          {!listQuery.isLoading && !listQuery.data?.length && (
            <p className="text-sm text-coop-700 font-serif">Nenhum cadastro aguardando análise.</p>
          )}
          <ul className="divide-y divide-coop-100 max-h-[520px] overflow-y-auto -mx-4 sm:-mx-6">
            {(listQuery.data || []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setSelectedId(row.id);
                  }}
                  className={`w-full text-left px-4 py-3 sm:px-6 transition hover:bg-coop-50 ${
                    selectedId === row.id ? 'bg-coop-50 border-l-4 border-l-coop-600' : ''
                  }`}
                >
                  <p className="font-semibold text-coop-900 text-sm">{row.nomeCompleto}</p>
                  <p className="text-xs text-coop-700 mt-0.5">{row.email}</p>
                  <p className="text-xs text-coop-600 mt-1">
                    {row.profissao}
                    {row.crm ? ` · ${row.crm}` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="xl:col-span-3 card min-h-[320px]">
          {!selectedId && <p className="text-sm text-coop-700 font-serif">Selecione um profissional à esquerda.</p>}
          {selectedId && detailQuery.isLoading && <p className="text-sm text-coop-700 font-serif">A carregar detalhe…</p>}
          {selectedId && detailQuery.isError && (
            <p className="text-sm text-red-700 font-serif">Não foi possível carregar este cadastro (pode já ter sido processado).</p>
          )}
          {d && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-coop-950 font-display">{d.nomeCompleto}</h2>
                  <p className="text-sm text-coop-800 font-serif mt-1">{d.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary text-sm py-2 px-4 rounded-lg disabled:opacity-50"
                    disabled={actionPending}
                    onClick={() =>
                      setConfirmDialog({ type: 'aprovar', medicoId: d.id, nome: d.nomeCompleto })
                    }
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm py-2 px-4 rounded-lg border-red-200 text-red-800 hover:bg-red-50 disabled:opacity-50"
                    disabled={actionPending}
                    onClick={() =>
                      setConfirmDialog({ type: 'rejeitar', medicoId: d.id, nome: d.nomeCompleto })
                    }
                  >
                    Rejeitar
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-coop-600 font-medium">CPF</dt>
                  <dd className="text-coop-900 font-mono">{d.cpf}</dd>
                </div>
                <div>
                  <dt className="text-coop-600 font-medium">Telefone</dt>
                  <dd className="text-coop-900">{d.telefone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-coop-600 font-medium">Profissão / CRM</dt>
                  <dd className="text-coop-900">
                    {d.profissao}
                    {d.crm ? ` · ${d.crm}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-coop-600 font-medium">Vínculo</dt>
                  <dd className="text-coop-900">{d.vinculo || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-coop-600 font-medium">Especialidades</dt>
                  <dd className="text-coop-900">{(d.especialidades || []).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="text-coop-600 font-medium">Estado civil</dt>
                  <dd className="text-coop-900">{d.estadoCivil || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-coop-600 font-medium">Endereço</dt>
                  <dd className="text-coop-900 whitespace-pre-wrap">{d.enderecoResidencial || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-coop-600 font-medium">Dados bancários (texto)</dt>
                  <dd className="text-coop-900 whitespace-pre-wrap">{d.dadosBancarios || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-coop-600 font-medium">Chave Pix</dt>
                  <dd className="text-coop-900">{d.chavePix || '—'}</dd>
                </div>
              </dl>

              <div>
                <h3 className="text-sm font-bold text-coop-900 font-display mb-2">Documentos enviados</h3>
                {!d.documentos?.length && <p className="text-sm text-coop-700 font-serif">Nenhum ficheiro anexado no cadastro.</p>}
                <ul className="space-y-2">
                  {d.documentos?.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-coop-200/80 bg-coop-50/40 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-coop-900">{labelDocumentoTipo(doc.tipo)}</p>
                        <p className="text-xs text-coop-700">{doc.nomeArquivo}</p>
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-coop-700 hover:text-coop-900 underline"
                        onClick={() => downloadDoc(d.id, doc.id, doc.nomeArquivo)}
                      >
                        Descarregar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
          onClick={() => !actionPending && setConfirmDialog(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div
              className={`px-6 py-5 border-b ${
                confirmDialog.type === 'aprovar'
                  ? 'bg-gradient-to-r from-coop-50 to-white border-coop-100'
                  : 'bg-gradient-to-r from-red-50 to-white border-red-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    confirmDialog.type === 'aprovar' ? 'bg-coop-100 text-coop-700' : 'bg-red-100 text-red-700'
                  }`}
                  aria-hidden="true"
                >
                  {confirmDialog.type === 'aprovar' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 id="confirm-dialog-title" className="text-lg font-semibold text-coop-950 font-display">
                    {confirmDialog.type === 'aprovar' ? 'Aprovar cadastro' : 'Rejeitar cadastro'}
                  </h3>
                  <p className="text-sm text-coop-700 font-serif mt-1">{confirmDialog.nome}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              {confirmDialog.type === 'aprovar' ? (
                <>
                  <p className="text-sm text-coop-800 font-serif leading-relaxed">
                    Confirma a aprovação deste pré-cadastro? O profissional será ativado internamente,
                    receberá um e-mail com o link da área do cooperado no Gcoop e os dados serão enviados
                    ao webservice de pré-cadastro.
                  </p>
                </>
              ) : (
                <p className="text-sm text-coop-800 font-serif leading-relaxed">
                  Confirma a rejeição deste pré-cadastro? O acesso permanecerá bloqueado e nenhum dado será enviado
                  ao Gcoop.
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-coop-50/60 border-t border-coop-100 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm py-2 px-4 rounded-lg"
                disabled={actionPending}
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn text-sm py-2 px-4 rounded-lg disabled:opacity-60 ${
                  confirmDialog.type === 'aprovar'
                    ? 'btn-primary'
                    : 'bg-red-600 text-white hover:bg-red-700 border border-red-600'
                }`}
                disabled={actionPending}
                onClick={() => {
                  if (confirmDialog.type === 'aprovar') {
                    aprovarMutation.mutate({
                      medicoId: confirmDialog.medicoId,
                      nome: confirmDialog.nome,
                    });
                  } else {
                    rejeitarMutation.mutate({
                      medicoId: confirmDialog.medicoId,
                      nome: confirmDialog.nome,
                    });
                  }
                }}
              >
                {actionPending
                  ? 'Processando…'
                  : confirmDialog.type === 'aprovar'
                    ? 'Confirmar aprovação'
                    : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resultDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
          onClick={() => setResultDialog(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-dialog-title"
          >
            <div
              className={`px-6 py-5 border-b ${
                resultDialog.variant === 'success'
                  ? 'bg-gradient-to-r from-emerald-50 to-white border-emerald-100'
                  : resultDialog.variant === 'warning'
                    ? 'bg-gradient-to-r from-amber-50 to-white border-amber-100'
                    : 'bg-gradient-to-r from-coop-50 to-white border-coop-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    resultDialog.variant === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : resultDialog.variant === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-coop-100 text-coop-700'
                  }`}
                  aria-hidden="true"
                >
                  {resultDialog.variant === 'success' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : resultDialog.variant === 'warning' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4M12 17h.01" />
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 id="result-dialog-title" className="text-lg font-semibold text-coop-950 font-display">
                    {resultDialog.title}
                  </h3>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-coop-800 font-serif leading-relaxed">{resultDialog.message}</p>
            </div>
            <div className="px-6 py-4 bg-coop-50/60 border-t border-coop-100 flex justify-end">
              <button
                type="button"
                className="btn btn-primary text-sm py-2 px-4 rounded-lg"
                onClick={() => setResultDialog(null)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Avaliacao;
