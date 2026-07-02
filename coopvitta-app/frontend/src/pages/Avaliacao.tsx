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

  const { data: modulosResp, isLoading: modulosLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const mapModulos = modulosResp?.data?.map;
  const moduloDesabilitado = modulosResp && mapModulos ? mapModulos.AVALIACAO === false : false;

  const listQuery = useQuery({
    queryKey: ['admin', 'cadastros-pendentes', user?.tenantId],
    queryFn: async () => {
      const r = await adminService.listCadastrosPendentes();
      return (r.data ?? []) as CadastroPendenteListItem[];
    },
    enabled: !!user && user.role === 'MASTER' && !moduloDesabilitado,
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'cadastros-pendentes', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const r = await adminService.getCadastroPendenteDetalhe(selectedId);
      return r.data as CadastroPendenteDetalhe;
    },
    enabled: !!selectedId && user?.role === 'MASTER' && !moduloDesabilitado,
  });

  const aprovarMutation = useMutation({
    mutationFn: (medicoId: string) => adminService.aprovarCadastroPendente(medicoId),
    onSuccess: async () => {
      setActionError(null);
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'cadastros-pendentes'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível aprovar.');
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: (medicoId: string) => adminService.rejeitarCadastroPendente(medicoId),
    onSuccess: async () => {
      setActionError(null);
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'cadastros-pendentes'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível rejeitar.');
    },
  });

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
        <p className="text-sm text-coop-700 font-serif">A fila de cadastros públicos é exclusiva do perfil Master.</p>
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
          registo para ver dados e ficheiros enviados.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 card overflow-hidden">
          <h2 className="text-sm font-bold text-coop-900 font-display mb-3">Pendentes de análise</h2>
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
                    disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Aprovar este cadastro? O profissional passará a poder entrar na plataforma.')) {
                        aprovarMutation.mutate(d.id);
                      }
                    }}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm py-2 px-4 rounded-lg border-red-200 text-red-800 hover:bg-red-50 disabled:opacity-50"
                    disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Rejeitar este cadastro? O acesso continuará bloqueado.')) {
                        rejeitarMutation.mutate(d.id);
                      }
                    }}
                  >
                    Rejeitar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm py-2 px-4 rounded-lg shrink-0 border-coop-300 text-coop-900 hover:bg-coop-50"
                    onClick={() => {
                      window.open('https://portal.cfm.org.br/busca-medicos', '_blank');
                    }}
                  >
                    Busca médicos (CFM)
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
    </div>
  );
};

export default Avaliacao;
