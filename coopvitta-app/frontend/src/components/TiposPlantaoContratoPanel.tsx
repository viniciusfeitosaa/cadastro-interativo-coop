import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService, type TipoPlantaoConfig } from '../services/admin.service';

type Props = {
  contratoAtivoId: string;
  /** Classes extras no card raiz (ex.: sem borda no drawer). */
  className?: string;
  compact?: boolean;
  /** Sem EDITAR: lista tipos, oculta criar/editar/excluir. */
  readOnly?: boolean;
};

function sortTipos(arr: TipoPlantaoConfig[]): TipoPlantaoConfig[] {
  const inicioMin = (t: TipoPlantaoConfig) => {
    const p = t.horaInicio?.slice(0, 5).split(':').map((x) => parseInt(x, 10)) ?? [0, 0];
    const h = Number.isFinite(p[0]) ? p[0] : 0;
    const m = Number.isFinite(p[1]) ? p[1] : 0;
    return h * 60 + m;
  };
  return [...arr].sort((a, b) => {
    const d = inicioMin(a) - inicioMin(b);
    if (d !== 0) return d;
    return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
  });
}

/**
 * CRUD de tipos de plantão por contrato (horários da grade / calendário / ponto).
 * Usado na página Escalas; valores R$/h continuam em Valores Hora/Plantão.
 */
export function TiposPlantaoContratoPanel({
  contratoAtivoId,
  className = '',
  compact = false,
  readOnly = false,
}: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoHi, setNovoTipoHi] = useState('08:00');
  const [novoTipoHf, setNovoTipoHf] = useState('20:00');
  const [novoTipoCruza, setNovoTipoCruza] = useState(false);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [excluindoTipoId, setExcluindoTipoId] = useState<string | null>(null);
  const [excluirTipoModal, setExcluirTipoModal] = useState<{ id: string; nome: string } | null>(null);
  const [editarTipoModal, setEditarTipoModal] = useState<TipoPlantaoConfig | null>(null);
  const [salvandoEdicaoTipo, setSalvandoEdicaoTipo] = useState(false);

  const { data: tiposResp, isLoading: loadingTipos } = useQuery({
    queryKey: ['admin', 'tipos-plantao', contratoAtivoId],
    queryFn: () => adminService.listTiposPlantao(contratoAtivoId),
    enabled: !!contratoAtivoId,
  });

  const tiposPlantao = useMemo(() => sortTipos(tiposResp?.data ?? []), [tiposResp?.data]);

  if (!contratoAtivoId) {
    return (
      <div className={`card ${className}`.trim()}>
        <h3 className="text-lg font-bold text-coop-900 mb-2">Tipos de plantão</h3>
        <p className="text-sm text-coop-700 font-serif">
          Selecione um contrato (ou uma equipe com escala) para gerenciar os tipos de plantão.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`card ${compact ? 'border-0 shadow-none p-0' : ''} ${className}`.trim()}>
        <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-coop-900 mb-2`}>
          Tipos de plantão (contrato)
        </h3>
        <p className="text-sm text-coop-700 mb-4">
          Cada tipo tem nome e faixa de horário (usada na grade, calendário, troca e ponto). O horário define-se ao
          criar o tipo; depois só o <span className="font-semibold text-coop-800">nome</span> pode ser alterado. A
          lista ordena-se automaticamente pelo <span className="font-semibold text-coop-800">início</span> do plantão.
          Os padrões MT/SN são criados na primeira carga.
        </p>
        {error && (
          <p className="text-sm text-red-600 font-medium mb-3" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 font-medium mb-3" role="status">
            {success}
          </p>
        )}
        {loadingTipos ? (
          <p className="text-sm text-gray-600">Carregando tipos...</p>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {tiposPlantao.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-coop-200 bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-coop-900">{t.nome}</p>
                    <p className="text-xs text-coop-600">
                      {t.horaInicio.slice(0, 5)} – {t.horaFim.slice(0, 5)}
                      {t.cruzaMeiaNoite ? ' (cruza meia-noite)' : ''}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary text-sm py-1.5 px-3"
                        disabled={excluindoTipoId === t.id || salvandoEdicaoTipo}
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          setEditarTipoModal({ ...t });
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary text-sm py-1.5 px-3"
                        disabled={excluindoTipoId === t.id || salvandoEdicaoTipo}
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          setExcluirTipoModal({ id: t.id, nome: t.nome });
                        }}
                      >
                        {excluindoTipoId === t.id ? '…' : 'Excluir'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
            <div className="p-4 rounded-xl border border-dashed border-coop-300 bg-coop-50/40 space-y-3">
              <p className="text-sm font-semibold text-coop-800">Novo tipo</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-xs font-semibold text-coop-800 mb-1">Nome</label>
                  <input
                    className="input w-full"
                    placeholder="Ex.: Plantão vespertino"
                    value={novoTipoNome}
                    onChange={(e) => setNovoTipoNome(e.target.value)}
                  />
                </div>
                <div className="min-w-[8.75rem]">
                  <label className="block text-xs font-semibold text-coop-800 mb-1">Início</label>
                  <input
                    type="time"
                    step={60}
                    className="input-time"
                    value={novoTipoHi}
                    onChange={(e) => setNovoTipoHi(e.target.value)}
                  />
                </div>
                <div className="min-w-[8.75rem]">
                  <label className="block text-xs font-semibold text-coop-800 mb-1">Fim</label>
                  <input
                    type="time"
                    step={60}
                    className="input-time"
                    value={novoTipoHf}
                    onChange={(e) => setNovoTipoHf(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-coop-800 cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={novoTipoCruza}
                    onChange={(e) => setNovoTipoCruza(e.target.checked)}
                  />
                  Cruza meia-noite
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={criandoTipo || !novoTipoNome.trim()}
                  onClick={async () => {
                    setCriandoTipo(true);
                    setError(null);
                    setSuccess(null);
                    try {
                      await adminService.createTipoPlantao({
                        contratoAtivoId,
                        nome: novoTipoNome.trim(),
                        horaInicio: novoTipoHi.length === 5 ? novoTipoHi : `${novoTipoHi}:00`.slice(0, 5),
                        horaFim: novoTipoHf.length === 5 ? novoTipoHf : `${novoTipoHf}:00`.slice(0, 5),
                        cruzaMeiaNoite: novoTipoCruza,
                      });
                      setNovoTipoNome('');
                      setNovoTipoCruza(false);
                      await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                      setSuccess('Tipo de plantão criado.');
                    } catch (err: any) {
                      setError(err.response?.data?.error || 'Erro ao criar tipo');
                    } finally {
                      setCriandoTipo(false);
                    }
                  }}
                >
                  {criandoTipo ? 'Salvando...' : 'Adicionar tipo'}
                </button>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {editarTipoModal && !readOnly && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !salvandoEdicaoTipo && setEditarTipoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 border border-coop-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tipo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="editar-tipo-titulo" className="text-lg font-bold text-coop-900 font-display">
              Editar tipo de plantão
            </h3>
            <p className="text-xs text-coop-600">
              O identificador na escala (ligação aos plantões) não muda. Só o nome de exibição é editável; horários
              permanecem os definidos na criação do tipo.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-coop-800 mb-1">Nome</label>
                <input
                  className="input w-full"
                  value={editarTipoModal.nome}
                  onChange={(e) => setEditarTipoModal((m) => (m ? { ...m, nome: e.target.value } : m))}
                />
              </div>
              <div className="rounded-lg border border-coop-200 bg-coop-50/50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-coop-600 mb-1">Horário (fixo)</p>
                <p className="text-sm text-coop-900">
                  {editarTipoModal.horaInicio.slice(0, 5)} – {editarTipoModal.horaFim.slice(0, 5)}
                  {editarTipoModal.cruzaMeiaNoite ? ' (cruza meia-noite)' : ''}
                </p>
                <p className="text-[11px] text-coop-600 mt-1">
                  Para mudar início/fim ou “cruza meia-noite”, exclua este tipo e crie outro (sem plantões na escala
                  usando este tipo).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={salvandoEdicaoTipo}
                onClick={() => setEditarTipoModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={salvandoEdicaoTipo || !editarTipoModal.nome.trim()}
                onClick={async () => {
                  const m = editarTipoModal;
                  setSalvandoEdicaoTipo(true);
                  setError(null);
                  setSuccess(null);
                  try {
                    await adminService.updateTipoPlantao(m.id, {
                      nome: m.nome.trim(),
                    });
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                    setEditarTipoModal(null);
                    setSuccess('Tipo atualizado.');
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Não foi possível salvar');
                  } finally {
                    setSalvandoEdicaoTipo(false);
                  }
                }}
              >
                {salvandoEdicaoTipo ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluirTipoModal && !readOnly && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !excluindoTipoId && setExcluirTipoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 border border-coop-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excluir-tipo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="excluir-tipo-titulo" className="text-lg font-bold text-coop-900 font-display">
              Excluir tipo de plantão?
            </h3>
            <p className="text-sm text-coop-700 leading-relaxed">
              O tipo <span className="font-semibold text-coop-900">{excluirTipoModal.nome}</span> será removido
              permanentemente. Valores por subgrupo e adicionais por data deste tipo serão apagados junto. A exclusão
              só é bloqueada se ainda existir <span className="font-semibold">plantão agendado na escala</span> usando
              este tipo.
            </p>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!excluindoTipoId}
                onClick={() => setExcluirTipoModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-700 disabled:opacity-60"
                disabled={!!excluindoTipoId}
                onClick={async () => {
                  const id = excluirTipoModal.id;
                  setExcluindoTipoId(id);
                  setError(null);
                  try {
                    await adminService.deleteTipoPlantao(id);
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'valores-plantao', contratoAtivoId] });
                    setSuccess('Tipo removido.');
                    setExcluirTipoModal(null);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Não foi possível excluir');
                  } finally {
                    setExcluindoTipoId(null);
                  }
                }}
              >
                {excluindoTipoId ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
