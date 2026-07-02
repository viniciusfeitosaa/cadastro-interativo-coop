import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService, ContratoAtivo } from '../services/admin.service';

interface FormState {
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  permiteTrocaPlantao: boolean;
}

const emptyForm: FormState = {
  nome: '',
  descricao: '',
  dataInicio: '',
  dataFim: '',
  ativo: true,
  permiteTrocaPlantao: true,
};

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

function ModalAssociarContrato({
  contrato,
  onClose,
  onRefresh: _onRefresh,
}: {
  contrato: ContratoAtivo;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [addSubgrupoId, setAddSubgrupoId] = useState('');
  const [addEquipeId, setAddEquipeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'subgrupos'],
    queryFn: () => adminService.listSubgrupos(),
  });
  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'equipes'],
    queryFn: () => adminService.listEquipes({}),
  });
  const { data: linkSubgruposResp, isLoading: loadSub } = useQuery({
    queryKey: ['admin', 'contrato-subgrupos', contrato.id],
    queryFn: () => adminService.listContratoSubgrupos(contrato.id),
    enabled: !!contrato.id,
  });
  const { data: linkEquipesResp, isLoading: loadEqu } = useQuery({
    queryKey: ['admin', 'contrato-equipes', contrato.id],
    queryFn: () => adminService.listContratoEquipes(contrato.id),
    enabled: !!contrato.id,
  });

  const subgrupos = useMemo(() => subgruposResp?.data ?? [], [subgruposResp?.data]);
  const equipes = useMemo(() => equipesResp?.data ?? [], [equipesResp?.data]);
  const linkSubgrupos = useMemo(() => linkSubgruposResp?.data ?? [], [linkSubgruposResp?.data]);
  const linkEquipes = useMemo(() => linkEquipesResp?.data ?? [], [linkEquipesResp?.data]);
  const linkedSubgrupoIds = useMemo(() => linkSubgrupos.map((l) => l.subgrupo.id), [linkSubgrupos]);
  const linkedEquipeIds = useMemo(() => linkEquipes.map((l) => l.equipe.id), [linkEquipes]);
  const subgruposDisponiveis = useMemo(
    () => subgrupos.filter((s) => s.ativo !== false && !linkedSubgrupoIds.includes(s.id)),
    [subgrupos, linkedSubgrupoIds]
  );
  const equipesDisponiveis = useMemo(
    () => equipes.filter((e) => e.ativo !== false && !linkedEquipeIds.includes(e.id)),
    [equipes, linkedEquipeIds]
  );

  const handleAddSubgrupo = async () => {
    if (!addSubgrupoId) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminService.addContratoSubgrupo(contrato.id, addSubgrupoId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contrato-subgrupos', contrato.id] });
      setAddSubgrupoId('');
    } catch (err: any) {
      setMsg(err.response?.data?.error || err.message || 'Erro ao associar subgrupo');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSubgrupo = async (subgrupoId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await adminService.removeContratoSubgrupo(contrato.id, subgrupoId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contrato-subgrupos', contrato.id] });
    } catch (err: any) {
      setMsg(err.response?.data?.error || err.message || 'Erro ao desassociar subgrupo');
    } finally {
      setBusy(false);
    }
  };

  const handleAddEquipe = async () => {
    if (!addEquipeId) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminService.addContratoEquipe(contrato.id, addEquipeId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contrato-equipes', contrato.id] });
      setAddEquipeId('');
    } catch (err: any) {
      setMsg(err.response?.data?.error || err.message || 'Erro ao associar equipe');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveEquipe = async (equipeId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await adminService.removeContratoEquipe(contrato.id, equipeId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'contrato-equipes', contrato.id] });
    } catch (err: any) {
      setMsg(err.response?.data?.error || err.message || 'Erro ao desassociar equipe');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-coop-900">
            Associar subgrupos e equipes – {contrato.nome}
          </h3>
          <button type="button" className="text-gray-500 hover:text-coop-800" onClick={onClose}>
            ✕
          </button>
        </div>
        {msg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {msg}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-coop-800 mb-2">Subgrupos deste contrato</h4>
            {loadSub ? (
              <p className="text-sm text-gray-600">Carregando...</p>
            ) : (
              <>
                <ul className="list-disc list-inside text-sm text-coop-900 mb-2">
                  {linkSubgrupos.length === 0 ? (
                    <li className="text-gray-500">Nenhum subgrupo associado</li>
                  ) : (
                    linkSubgrupos.map((l) => (
                      <li key={l.id} className="flex items-center gap-2">
                        <span>{l.subgrupo.nome}</span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline text-xs disabled:opacity-50"
                          disabled={busy}
                          onClick={() => handleRemoveSubgrupo(l.subgrupo.id)}
                        >
                          Remover
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {subgruposDisponiveis.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      className="input flex-1 text-sm"
                      value={addSubgrupoId}
                      onChange={(e) => setAddSubgrupoId(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Adicionar subgrupo...</option>
                      {subgruposDisponiveis.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !addSubgrupoId}
                      onClick={handleAddSubgrupo}
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-coop-800 mb-2">Equipes deste contrato</h4>
            {loadEqu ? (
              <p className="text-sm text-gray-600">Carregando...</p>
            ) : (
              <>
                <ul className="list-disc list-inside text-sm text-coop-900 mb-2">
                  {linkEquipes.length === 0 ? (
                    <li className="text-gray-500">Nenhuma equipe associada</li>
                  ) : (
                    linkEquipes.map((l) => (
                      <li key={l.id} className="flex items-center gap-2">
                        <span>{l.equipe.nome}{l.equipe.subgrupo ? ` (${l.equipe.subgrupo.nome})` : ''}</span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline text-xs disabled:opacity-50"
                          disabled={busy}
                          onClick={() => handleRemoveEquipe(l.equipe.id)}
                        >
                          Remover
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {equipesDisponiveis.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      className="input flex-1 text-sm"
                      value={addEquipeId}
                      onChange={(e) => setAddEquipeId(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Adicionar equipe...</option>
                      {equipesDisponiveis.map((e) => (
                        <option key={e.id} value={e.id}>{e.nome}{e.subgrupo ? ` (${e.subgrupo.nome})` : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !addEquipeId}
                      onClick={handleAddEquipe}
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const ContratosAtivos = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contratoAssociar, setContratoAssociar] = useState<ContratoAtivo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'contratos-ativos', search],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 100, search: search || undefined }),
  });

  const contratos = useMemo(() => data?.data || [], [data]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (contrato: ContratoAtivo) => {
    setEditingId(contrato.id);
    setForm({
      nome: contrato.nome,
      descricao: contrato.descricao || '',
      dataInicio: toDateInput(contrato.dataInicio),
      dataFim: toDateInput(contrato.dataFim),
      ativo: contrato.ativo,
      permiteTrocaPlantao: !!contrato.permiteTrocaPlantao,
    });
    setError(null);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'contratos-ativos'] });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim || null,
        ativo: form.ativo,
        permiteTrocaPlantao: form.permiteTrocaPlantao,
      };

      if (!payload.nome || !payload.dataInicio) {
        throw new Error('Preencha nome e data de início.');
      }

      if (editingId) {
        await adminService.updateContratoAtivo(editingId, payload);
      } else {
        await adminService.createContratoAtivo(payload);
      }

      resetForm();
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Não foi possível salvar o contrato.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contrato: ContratoAtivo) => {
    const ok = window.confirm(`Excluir o contrato "${contrato.nome}"?`);
    if (!ok) return;

    try {
      await adminService.deleteContratoAtivo(contrato.id);
      if (editingId === contrato.id) {
        resetForm();
      }
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível excluir o contrato.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">Contratos Ativos</h2>
        <p className="text-gray-600">Adicione, edite e exclua contratos vinculados ao seu tenant.</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-4">
          {editingId ? 'Editar contrato' : 'Novo contrato'}
        </h3>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
          <input
            className="input"
            placeholder="Nome do contrato"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={form.dataInicio}
            onChange={(e) => setForm((prev) => ({ ...prev, dataInicio: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={form.dataFim}
            onChange={(e) => setForm((prev) => ({ ...prev, dataFim: e.target.value }))}
          />
          <div className="md:col-span-2 rounded-lg border border-coop-100 bg-coop-50/50 px-3 py-2 text-xs text-coop-800">
            <p className="font-semibold text-coop-900 mb-1">Estilo de produção (escala / ponto)</p>
            <p>
              Configure por <strong>subgrupo</strong> em <strong>Subgrupos e Equipes</strong> ao selecionar o subgrupo
              (escalas + ponto, só escala ou só ponto). Cada subgrupo do mesmo contrato pode ter uma combinação diferente.
            </p>
          </div>
          <div className="md:col-span-2 space-y-2">
            <p className="text-sm font-semibold text-coop-800">Troca de plantão</p>
            <p className="text-xs text-gray-600">
              Permite que profissionais da mesma equipe solicitem troca de plantão entre si (quando a escala estiver habilitada no app do médico).
            </p>
            <label className="flex items-center gap-2 text-sm text-coop-900">
              <input
                type="checkbox"
                checked={form.permiteTrocaPlantao}
                onChange={(e) => setForm((prev) => ({ ...prev, permiteTrocaPlantao: e.target.checked }))}
              />
              Permitir troca de plantão neste contrato
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-coop-900">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
            />
            Contrato ativo
          </label>
          <textarea
            className="input md:col-span-2 min-h-[90px]"
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
          />

          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}

          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar contrato'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-coop-900">Lista de contratos</h3>
          <input
            className="input max-w-xs"
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-600">Carregando contratos...</p>
        ) : contratos.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum contrato encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-coop-700 border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Início</th>
                  <th className="py-2 pr-4">Fim</th>
                  <th className="py-2 pr-4">Produção</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((contrato) => (
                  <tr key={contrato.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">
                      <p className="font-semibold text-coop-900">{contrato.nome}</p>
                      {contrato.descricao && <p className="text-xs text-gray-600">{contrato.descricao}</p>}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{toDateInput(contrato.dataInicio)}</td>
                    <td className="py-2 pr-4 text-gray-700">{toDateInput(contrato.dataFim) || '-'}</td>
                    <td className="py-2 pr-4">
                      <span className="text-xs text-coop-700">Por subgrupo</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          contrato.ativo
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {contrato.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-secondary" onClick={() => setContratoAssociar(contrato)}>
                          Associar
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleEdit(contrato)}>
                          Editar
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleDelete(contrato)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {contratoAssociar && (
        <ModalAssociarContrato
          contrato={contratoAssociar}
          onClose={() => setContratoAssociar(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
};

export default ContratosAtivos;
