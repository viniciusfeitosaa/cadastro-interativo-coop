import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { adminService, AcessoModuloItem } from '../services/admin.service';
import { fixMojibake, formatCRM } from '../utils/validation.util';
import {
  DOCUMENTO_LABEL_BY_FIELD,
  DOCUMENTOS_PERFIL_FIELDS,
  DOCUMENTO_TIPO_BY_FIELD,
  DocumentoPerfilField,
} from '../constants/documentosPerfil';
import { MODULO_LABEL, ModuloSistema } from '../constants/modulos';
import { ESPECIALIDADES_MEDICAS } from '../constants/profissoesEspecialidades';

type TabPerfil = 'pessoais' | 'bancarios' | 'documentos' | 'conta';

const Perfil = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [activeTab, setActiveTab] = useState<TabPerfil>('pessoais');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documentosSelecionados, setDocumentosSelecionados] = useState<
    Partial<Record<DocumentoPerfilField, File>>
  >({});
  const [savingAcessos, setSavingAcessos] = useState(false);
  const [acessosDraft, setAcessosDraft] = useState<AcessoModuloItem[]>([]);
  /** idle = fechado; confirm = aviso inicial; credentials = senha + EXCLUIR */
  const [deleteFlowStep, setDeleteFlowStep] = useState<'idle' | 'confirm' | 'credentials'>('idle');
  const [deleteSenha, setDeleteSenha] = useState('');
  const [deleteConfirmacao, setDeleteConfirmacao] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const closeDeleteFlow = () => {
    setDeleteFlowStep('idle');
    setDeleteSenha('');
    setDeleteConfirmacao('');
  };
  const [form, setForm] = useState<{
    especialidades: string[];
    telefone: string;
    estadoCivil: string;
    enderecoResidencial: string;
    dadosBancarios: string;
    chavePix: string;
  }>({
    especialidades: [],
    telefone: '',
    estadoCivil: '',
    enderecoResidencial: '',
    dadosBancarios: '',
    chavePix: '',
  });
  const [buscaEspecialidade, setBuscaEspecialidade] = useState('');

  const { data: perfilMedico, isLoading } = useQuery({
    queryKey: ['medico', 'perfil', 'pagina-perfil', user?.id],
    queryFn: async () => {
      const response = await medicoService.getPerfil();
      return response.data;
    },
    enabled: !!user && !isMaster,
  });

  const { data: acessosResp, isLoading: loadingAcessos } = useQuery({
    queryKey: ['admin', 'acessos-modulos', user?.id],
    queryFn: () => adminService.getMatrizAcessosModulos(),
    enabled: !!user && isMaster,
  });

  useEffect(() => {
    if (!acessosResp?.data) return;
    setAcessosDraft([...(acessosResp.data.master || []), ...(acessosResp.data.medico || [])]);
  }, [acessosResp]);

  useEffect(() => {
    if (!perfilMedico) return;
    setForm((prev) => ({
      ...prev,
      especialidades: perfilMedico.especialidades ?? [],
      telefone: perfilMedico.telefone ?? '',
      estadoCivil: perfilMedico.estadoCivil ?? '',
      enderecoResidencial: perfilMedico.enderecoResidencial ?? '',
      dadosBancarios: perfilMedico.dadosBancarios ?? '',
      chavePix: perfilMedico.chavePix ?? '',
    }));
  }, [perfilMedico]);

  const perfil = isMaster ? user : perfilMedico || user;
  const perfilMedicoAtual = !isMaster ? perfilMedico : null;
  const telefone = !isMaster && perfil && 'telefone' in perfil ? perfil.telefone : null;

  const handleChange = (field: keyof typeof form, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEspecialidade = (nome: string) => {
    setForm((prev) => ({
      ...prev,
      especialidades: prev.especialidades.includes(nome)
        ? prev.especialidades.filter((x) => x !== nome)
        : [...prev.especialidades, nome],
    }));
  };

  const handleExcluirConta = async () => {
    setDeletingAccount(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await medicoService.deleteConta({
        senha: deleteSenha,
        confirmacao: deleteConfirmacao,
      });
      closeDeleteFlow();
      logout();
      navigate('/login', { state: { accountDeletedMessage: res.message } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Não foi possível excluir a conta.';
      setError(msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSalvar = async () => {
    if (isMaster || !perfilMedico) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await medicoService.updatePerfil({
        especialidades:
          form.especialidades.length > 0
            ? form.especialidades
            : (perfilMedico.especialidades ?? []),
        telefone: form.telefone || perfilMedico.telefone || '',
        estadoCivil: form.estadoCivil || perfilMedico.estadoCivil || '',
        enderecoResidencial: form.enderecoResidencial || perfilMedico.enderecoResidencial || '',
        dadosBancarios: form.dadosBancarios || perfilMedico.dadosBancarios || '',
        chavePix: form.chavePix || perfilMedico.chavePix || '',
        documentos: documentosSelecionados,
      });
      await queryClient.invalidateQueries({ queryKey: ['medico', 'perfil'] });
      setSuccess('Perfil atualizado com sucesso.');
      setDocumentosSelecionados({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const matrizPorModulo = useMemo(() => {
    const map = new Map<ModuloSistema, { master: boolean; medico: boolean }>();
    for (const modulo of Object.keys(MODULO_LABEL) as ModuloSistema[]) {
      map.set(modulo, { master: true, medico: false });
    }
    for (const item of acessosDraft) {
      const row = map.get(item.modulo);
      if (!row) continue;
      if (item.perfil === 'MASTER') row.master = item.permitido;
      if (item.perfil === 'MEDICO') row.medico = item.permitido;
    }
    return map;
  }, [acessosDraft]);

  const updateAcessoItem = (perfil: 'MASTER' | 'MEDICO', modulo: ModuloSistema, permitido: boolean) => {
    setAcessosDraft((prev) => {
      const idx = prev.findIndex((p) => p.perfil === perfil && p.modulo === modulo);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], permitido };
        return copy;
      }
      return [...prev, { perfil, modulo, permitido }];
    });
  };

  const salvarAcessos = async () => {
    setSavingAcessos(true);
    setError(null);
    setSuccess(null);
    try {
      await adminService.salvarMatrizAcessosModulos(acessosDraft);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'acessos-modulos'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'modulos-acesso'] });
      setSuccess('Permissões de módulos atualizadas com sucesso.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível atualizar permissões de módulos.');
    } finally {
      setSavingAcessos(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-coop-200 border-t-coop-600" />
          <p className="text-sm text-coop-700 font-medium">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">
          Configurações
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display leading-tight mb-2">
          Minha Conta
        </h1>
        <p className="text-coop-700 font-serif text-base">
          Informações do seu perfil de acesso na plataforma.
          {!isMaster && (
            <>
              {' '}
              Para excluir sua conta, abra a aba <strong className="font-semibold">Conta e privacidade</strong>.
            </>
          )}
        </p>
      </div>

      {!!error && (
        <div className="card stagger-2 border-l-4 border-red-400 bg-red-50/50 p-4">
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}
      {!!success && (
        <div className="card stagger-2 border-l-4 border-emerald-500 bg-emerald-50/50 p-4">
          <p className="text-xs text-emerald-800 font-medium">{success}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-coop-100/50 border border-coop-200/60 w-fit max-w-full">
        {(
          [
            'pessoais',
            'bancarios',
            'documentos',
            ...(!isMaster ? (['conta'] as const) : []),
          ] as TabPerfil[]
        ).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition ${
              activeTab === tab
                ? 'bg-white text-coop-900 shadow-sm border border-coop-200/60'
                : 'text-coop-600 hover:bg-coop-50/80 hover:text-coop-800'
            }`}
          >
            {tab === 'pessoais' && 'Dados Pessoais'}
            {tab === 'bancarios' && 'Dados Bancários'}
            {tab === 'documentos' && 'Documentos'}
            {tab === 'conta' && 'Conta e privacidade'}
          </button>
        ))}
      </div>

      {activeTab === 'pessoais' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card stagger-2 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Nome completo</p>
                <p className="text-sm font-semibold text-coop-900 mt-1 font-display">
                  {fixMojibake(perfil?.nomeCompleto || '-')}
                </p>
              </div>
              <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">E-mail</p>
                <p className="text-sm font-semibold text-coop-900 mt-1 font-display">
                  {perfil?.email ? fixMojibake(perfil.email) : '-'}
                </p>
              </div>
              {!isMaster && (
                <div className="rounded-xl bg-coop-100/80 border border-coop-200/60 p-4 md:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">
                    Identificação profissional
                  </p>
                  <p className="text-xs text-coop-800 mt-1 font-serif">
                    <span className="font-semibold">Profissão:</span>{' '}
                    {perfil && 'profissao' in perfil ? fixMojibake(perfil.profissao) : 'Médico'}
                  </p>
                  {(perfil && 'especialidades' in perfil && (perfil.especialidades?.length ?? 0) > 0) && (
                    <p className="text-sm text-coop-800 mt-0.5 font-serif">
                      <span className="font-semibold">Especialidades:</span>{' '}
                      {fixMojibake((perfil.especialidades ?? []).join(', '))}
                    </p>
                  )}
                </div>
              )}
              {!isMaster && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">CRM</p>
                  <p className="text-sm font-semibold text-coop-900 mt-1 font-display">
                    {formatCRM(perfil?.crm || '') || '-'}
                  </p>
                </div>
              )}
              {!isMaster && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4 md:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">
                    Atualizar especialidades (várias permitidas)
                  </p>
                  <input
                    type="text"
                    placeholder="Buscar especialidade..."
                    className="input mt-2"
                    value={buscaEspecialidade}
                    onChange={(e) => setBuscaEspecialidade(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-coop-200/60 p-2 mt-2 space-y-1 bg-white/50">
                    {ESPECIALIDADES_MEDICAS.filter((e) =>
                      e.toLowerCase().includes(buscaEspecialidade.toLowerCase())
                    ).map((esp) => (
                      <label
                        key={esp}
                        className="flex items-center gap-2 cursor-pointer hover:bg-coop-50/80 p-2 rounded-lg transition"
                      >
                        <input
                          type="checkbox"
                          checked={form.especialidades.includes(esp)}
                          onChange={() => toggleEspecialidade(esp)}
                          className="rounded border-coop-600 text-coop-600"
                        />
                        <span className="text-xs text-coop-900 font-serif">{esp}</span>
                      </label>
                    ))}
                  </div>
                  {form.especialidades.length > 0 && (
                    <p className="mt-2 text-[10px] text-coop-600 font-serif">
                      Selecionadas: {form.especialidades.join(', ')}
                    </p>
                  )}
                </div>
              )}
              {!isMaster && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Telefone</p>
                  <input
                    className="input mt-2"
                    value={form.telefone || telefone || ''}
                    onChange={(e) => handleChange('telefone', e.target.value)}
                  />
                </div>
              )}
              {!isMaster && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Vínculo</p>
                  <p className="text-sm font-semibold text-coop-900 mt-1">
                    {perfil?.vinculo ? fixMojibake(perfil.vinculo) : 'Associado'}
                  </p>
                </div>
              )}
              {!isMaster && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Estado civil</p>
                  <input
                    className="input mt-2"
                    value={form.estadoCivil || perfilMedicoAtual?.estadoCivil || ''}
                    onChange={(e) => handleChange('estadoCivil', e.target.value)}
                  />
                </div>
              )}
              {!isMaster && (
                <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4 md:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Endereço residencial</p>
                  <textarea
                    className="input mt-2 min-h-[84px]"
                    value={form.enderecoResidencial || perfilMedicoAtual?.enderecoResidencial || ''}
                    onChange={(e) => handleChange('enderecoResidencial', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="card stagger-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">Acesso</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-coop-50/60 border border-coop-200/50 px-4 py-3">
                <span className="text-xs font-medium text-coop-700">Perfil</span>
                <span className="text-xs font-semibold text-coop-900 font-display">
                  {isMaster ? 'Master' : 'Profissional'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-coop-50/60 border border-coop-200/50 px-4 py-3">
                <span className="text-xs font-medium text-coop-700">Status</span>
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
                  Ativo
                </span>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-coop-50/80 border border-coop-200/50 p-4">
              <p className="text-xs text-coop-700 font-serif">
                {isMaster
                  ? 'Como usuário Master, você pode gerenciar médicos, contratos, escalas e relatórios.'
                  : 'Se precisar atualizar dados cadastrais, solicite ao administrador Master.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bancarios' && (
        <div className="card stagger-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">Dados Bancários</h3>
          {isMaster ? (
            <p className="text-xs text-coop-600 font-serif">Disponível apenas para perfil profissional.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4 md:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Dados bancários</p>
                <textarea
                  className="input mt-2 min-h-[84px]"
                  value={form.dadosBancarios || perfilMedicoAtual?.dadosBancarios || ''}
                  onChange={(e) => handleChange('dadosBancarios', e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-coop-50/80 border border-coop-200/50 p-4 md:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-coop-600">Chave PIX</p>
                <input
                  className="input mt-2"
                  value={form.chavePix || perfilMedicoAtual?.chavePix || ''}
                  onChange={(e) => handleChange('chavePix', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documentos' && (
        <div className="card stagger-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-coop-600 mb-4 font-display">Documentos</h3>
          {isMaster ? (
            <p className="text-xs text-coop-600 font-serif">Disponível apenas para perfil profissional.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOCUMENTOS_PERFIL_FIELDS.map((field) => {
                const existing = perfilMedicoAtual?.documentos?.find((doc) => {
                  return doc.tipo === DOCUMENTO_TIPO_BY_FIELD[field];
                });
                return (
                  <div key={field} className="rounded-xl bg-coop-50/50 border border-coop-200/50 p-4 hover:bg-coop-50/70 transition">
                    <p className="text-xs font-semibold text-coop-900 font-display">{DOCUMENTO_LABEL_BY_FIELD[field]}</p>
                    <p className="text-[10px] text-coop-600 mt-1 mb-2 font-serif">
                      {existing?.nomeArquivo ? `Atual: ${existing.nomeArquivo}` : 'Ainda não anexado'}
                    </p>
                    {existing?.id && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          className="btn-sm btn-secondary inline-flex items-center gap-1.5"
                          onClick={() => medicoService.openDocumentoPerfil(existing.id, existing.nomeArquivo)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-secondary inline-flex items-center gap-1.5"
                          onClick={() => medicoService.openDocumentoPerfil(existing.id, existing.nomeArquivo)}
                        >
                          Baixar
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      className="input text-sm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setDocumentosSelecionados((prev) => ({ ...prev, [field]: file }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isMaster && (
        <div className="flex justify-end">
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={handleSalvar}
            type="button"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {!isMaster && activeTab === 'conta' && (
        <div className="card stagger-3 border-l-4 border-red-400 bg-red-50/40">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-800 mb-2 font-display">
            Excluir conta permanentemente
          </h3>
          <p className="text-sm text-coop-800 font-serif leading-relaxed mb-2">
            Conforme as diretrizes da App Store, você pode remover sua conta e os dados pessoais
            associados (perfil, documentos enviados, registros de ponto, etc.).
          </p>
          <p className="text-sm text-coop-800 font-serif leading-relaxed mb-4">
            Esta ação é <strong className="font-semibold">irreversível</strong>. Para voltar a usar o
            app, será necessário um novo cadastro.
          </p>
          <button
            type="button"
            className="btn text-sm border border-red-300 bg-white text-red-800 hover:bg-red-50 w-full sm:w-auto"
            onClick={() => setDeleteFlowStep('confirm')}
          >
            Excluir minha conta
          </button>
        </div>
      )}

      {isMaster && (
        <div className="card stagger-2 border-l-4 border-l-coop-500">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-coop-600 mb-2 font-display">Administração de Acesso por Módulo</h3>
          <p className="text-sm text-coop-700 mb-4 font-serif">
            Defina quais perfis têm acesso a cada módulo do sistema.
          </p>

          {loadingAcessos ? (
            <div className="flex items-center gap-3 py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-coop-200 border-t-coop-600" />
              <p className="text-xs text-coop-600">Carregando permissões...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-coop-200/60 overflow-hidden">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-coop-700 bg-coop-50/80 border-b border-coop-200/60">
                    <th className="py-2.5 px-4 font-semibold text-xs">Módulo</th>
                    <th className="py-2.5 px-4 font-semibold text-xs">Master</th>
                    <th className="py-2.5 px-4 font-semibold text-xs">Médico</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(MODULO_LABEL) as ModuloSistema[]).map((modulo) => {
                    const row = matrizPorModulo.get(modulo);
                    const masterChecked = row?.master ?? true;
                    const medicoChecked = row?.medico ?? false;
                    const masterLocked =
                      modulo === 'DASHBOARD' || modulo === 'CONFIGURACOES' || modulo === 'PERFIL';
                    return (
                      <tr key={modulo} className="border-b border-coop-200/40 last:border-b-0 hover:bg-coop-50/40 transition">
                        <td className="py-2.5 px-4 font-medium text-coop-900 font-serif text-xs">{MODULO_LABEL[modulo]}</td>
                        <td className="py-2.5 px-4">
                          <input
                            type="checkbox"
                            checked={masterChecked}
                            disabled={masterLocked}
                            onChange={(e) => updateAcessoItem('MASTER', modulo, e.target.checked)}
                            className="rounded border-coop-600 text-coop-600"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="checkbox"
                            checked={medicoChecked}
                            onChange={(e) => updateAcessoItem('MEDICO', modulo, e.target.checked)}
                            className="rounded border-coop-600 text-coop-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button className="btn btn-primary" disabled={savingAcessos} type="button" onClick={salvarAcessos}>
              {savingAcessos ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      )}

      {deleteFlowStep !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coop-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="excluir-conta-titulo"
        >
          <div className="card max-w-md w-full shadow-2xl border border-red-200/80">
            {deleteFlowStep === 'confirm' ? (
              <>
                <h2 id="excluir-conta-titulo" className="text-base font-bold text-red-900 font-display mb-2">
                  Excluir sua conta?
                </h2>
                <p className="text-sm text-coop-800 font-serif leading-relaxed mb-4">
                  Você está prestes a excluir permanentemente sua conta e todos os dados associados.
                  Esta ação não pode ser desfeita.
                </p>
                <p className="text-xs text-coop-600 font-serif mb-6">
                  Se foi um clique acidental, toque em <strong className="font-semibold">Cancelar</strong>.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <button
                    type="button"
                    className="btn text-sm border border-coop-300 bg-white text-coop-800"
                    onClick={closeDeleteFlow}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn text-sm bg-red-700 text-white hover:bg-red-800 border border-red-800"
                    onClick={() => {
                      setDeleteSenha('');
                      setDeleteConfirmacao('');
                      setDeleteFlowStep('credentials');
                    }}
                  >
                    Confirmar exclusão
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="excluir-conta-titulo" className="text-base font-bold text-red-900 font-display mb-2">
                  Confirmar exclusão da conta
                </h2>
                <p className="text-xs text-coop-700 font-serif leading-relaxed mb-4">
                  Para concluir, digite sua senha e <strong className="font-semibold">EXCLUIR</strong>.
                </p>
                <label className="block text-xs font-semibold text-coop-800 mb-1">Senha</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm mb-3"
                  value={deleteSenha}
                  onChange={(e) => setDeleteSenha(e.target.value)}
                  autoComplete="current-password"
                />
                <label className="block text-xs font-semibold text-coop-800 mb-1">
                  Digite EXCLUIR para confirmar
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm mb-4 uppercase"
                  value={deleteConfirmacao}
                  onChange={(e) => setDeleteConfirmacao(e.target.value)}
                  placeholder="EXCLUIR"
                  autoComplete="off"
                />
                <div className="flex flex-col sm:flex-row gap-2 justify-end">
                  <button
                    type="button"
                    className="btn text-sm border border-coop-300 bg-white text-coop-800"
                    disabled={deletingAccount}
                    onClick={closeDeleteFlow}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn text-sm bg-red-700 text-white hover:bg-red-800 border border-red-800"
                    disabled={
                      deletingAccount ||
                      !deleteSenha.trim() ||
                      deleteConfirmacao.trim().toUpperCase() !== 'EXCLUIR'
                    }
                    onClick={() => void handleExcluirConta()}
                  >
                    {deletingAccount ? 'Excluindo...' : 'Excluir permanentemente'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfil;
