import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { PontoEnderecoMapaBlock } from '../components/PontoEnderecoMapaBlock';
import { usePontoEnderecoMapa } from '../hooks/usePontoEnderecoMapa';
import { adminService, ConfigPontoEletronico } from '../services/admin.service';
import {
  cobrancaFromMargem,
  formatMargemNumber,
  margemFromCobranca,
} from '../utils/margemLucro';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Retorna a quantidade de dias úteis (segunda a sexta) no mês. mes: 1-12 */
function getDiasUteis(ano: number, mes: number): number {
  const primeiro = new Date(ano, mes - 1, 1);
  const ultimo = new Date(ano, mes, 0);
  let count = 0;
  for (let d = new Date(primeiro); d <= ultimo; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    if (diaSemana >= 1 && diaSemana <= 5) count++;
  }
  return count;
}

function formatValor(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '';
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseValorInput(s: string): number | null {
  const v = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
] as const;

const mapaVazioPorDia = (): Record<string, string> =>
  Object.fromEntries(DIAS_SEMANA.map(({ key }) => [key, ''])) as Record<string, string>;

/** Monta mapa numérico seg→dom + primeiro valor não nulo (fallback global no backend). */
function buildMapaValorPorDiaComFallback(draft: Record<string, string>): {
  map: Record<string, number | null>;
  fallbackGlobal: number | null;
} {
  const map: Record<string, number | null> = {};
  let fallbackGlobal: number | null = null;
  for (const { key } of DIAS_SEMANA) {
    const raw = draft[key] ?? '';
    if (raw.trim() === '') {
      map[key] = null;
    } else {
      const n = parseValorInput(raw);
      const rounded = n != null ? Math.round(n * 100) / 100 : null;
      map[key] = rounded;
      if (fallbackGlobal == null && rounded != null) fallbackGlobal = rounded;
    }
  }
  return { map, fallbackGlobal };
}

const ValoresPonto = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const { contratoId, subgrupoId, equipeId, setContratoId, setSubgrupoId, setEquipeId } = useMasterEscopo();
  const [mes, setMes] = useState<number>(() => new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(() => new Date().getFullYear());
  const [draftHoras, setDraftHoras] = useState<string>('');
  const [draftValorPorDia, setDraftValorPorDia] = useState<Record<string, string>>({});
  const [draftMargemPorDia, setDraftMargemPorDia] = useState<Record<string, string>>({});
  const [draftValorCobrancaPorDia, setDraftValorCobrancaPorDia] = useState<Record<string, string>>({});
  const [draftHorarioEntrada, setDraftHorarioEntrada] = useState<string>('');
  const [draftHorarioSaida, setDraftHorarioSaida] = useState<string>('');
  const [draftTolerancia, setDraftTolerancia] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const { data: opcoesResp, isLoading: loadingOpcoes } = useQuery({
    queryKey: ['admin', 'config-ponto', 'opcoes'],
    queryFn: () => adminService.getConfigPontoOpcoes(),
    enabled: !!user && isMaster,
  });

  const opcoes = opcoesResp?.data;
  const contratos = useMemo(() => opcoes?.contratos ?? [], [opcoes]);
  const subgrupos = useMemo(() => opcoes?.subgrupos ?? [], [opcoes]);
  const equipes = useMemo(() => opcoes?.equipes ?? [], [opcoes]);
  const contratoSubgrupos = useMemo(() => opcoes?.contratoSubgrupos ?? [], [opcoes]);

  const allowedSubgrupoIds = useMemo(() => {
    if (!contratoId) return new Set<string>();
    return new Set(
      contratoSubgrupos
        .filter((cs) => cs.contratoAtivoId === contratoId)
        .map((cs) => cs.subgrupoId)
    );
  }, [contratoId, contratoSubgrupos]);

  const subgruposDoContrato = useMemo(() => {
    if (!contratoId) return [];
    return subgrupos
      .filter((s) => s.ativo !== false)
      .filter((s) => allowedSubgrupoIds.has(s.id))
      .filter((s) => !(s.usaEscala && !s.usaPonto));
  }, [allowedSubgrupoIds, contratoId, subgrupos]);

  const contratoIdsSoPonto = useMemo(() => {
    const subById = new Map(subgrupos.map((s: { id: string; usaEscala?: boolean; usaPonto?: boolean }) => [s.id, s]));
    const ids = new Set<string>();
    for (const cs of contratoSubgrupos as { contratoAtivoId: string; subgrupoId: string }[]) {
      const sg = subById.get(cs.subgrupoId) as { usaEscala?: boolean; usaPonto?: boolean } | undefined;
      if (sg?.usaPonto && !sg?.usaEscala) ids.add(cs.contratoAtivoId);
    }
    return ids;
  }, [contratoSubgrupos, subgrupos]);

  const contratosPontoSemEscala = useMemo(
    () => contratos.filter((c: { id: string }) => contratoIdsSoPonto.has(c.id)),
    [contratos, contratoIdsSoPonto]
  );

  const equipesDoSubgrupo = useMemo(
    () => (subgrupoId ? equipes.filter((e) => e.subgrupoId === subgrupoId && e.ativo !== false) : []),
    [equipes, subgrupoId]
  );
  const temContratoESubgrupo = !!contratoId && !!subgrupoId;

  const { data: configResp, isLoading: loadingConfig } = useQuery({
    queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, equipeId || null],
    queryFn: () => adminService.getConfigPonto(contratoId, subgrupoId, equipeId || null),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });

  const config: ConfigPontoEletronico | null = configResp?.data ?? null;
  const geo = usePontoEnderecoMapa(config);

  useEffect(() => {
    if (!temContratoESubgrupo) {
      setDraftValorPorDia({});
      setDraftMargemPorDia({});
      setDraftValorCobrancaPorDia({});
      return;
    }
    if (loadingConfig) return;

    if (!config) {
      const z = mapaVazioPorDia();
      setDraftValorPorDia(z);
      setDraftMargemPorDia({ ...z });
      setDraftValorCobrancaPorDia({ ...z });
      return;
    }

    const rep: Record<string, string> = {};
    const cob: Record<string, string> = {};
    const mar: Record<string, string> = {};
    const baseRep = config.valorHora != null ? parseFloat(String(config.valorHora)) : NaN;
    const baseCob = config.valorHoraCobranca != null ? parseFloat(String(config.valorHoraCobranca)) : NaN;
    for (const { key } of DIAS_SEMANA) {
      const mk = config.valorHoraPorDia?.[key];
      let nRep: number | null = null;
      if (mk != null && String(mk).trim() !== '') {
        const n = Number(mk);
        if (Number.isFinite(n)) nRep = n;
      } else if (Number.isFinite(baseRep)) {
        nRep = baseRep;
      }
      rep[key] = nRep != null ? formatValor(nRep) : '';

      const ck = config.valorHoraCobrancaPorDia?.[key];
      let nCob: number | null = null;
      if (ck != null && String(ck).trim() !== '') {
        const n = Number(ck);
        if (Number.isFinite(n)) nCob = n;
      } else if (Number.isFinite(baseCob)) {
        nCob = baseCob;
      }
      cob[key] = nCob != null ? formatValor(nCob) : '';

      if (nRep != null && nRep > 0 && nCob != null && nCob > 0) {
        const m = margemFromCobranca(nRep, nCob);
        mar[key] = m != null ? formatMargemNumber(m) : '';
      } else {
        mar[key] = '';
      }
    }
    setDraftValorPorDia(rep);
    setDraftMargemPorDia(mar);
    setDraftValorCobrancaPorDia(cob);
  }, [temContratoESubgrupo, loadingConfig, config, contratoId, subgrupoId, equipeId]);

  const horasPrevistasDisplay = draftHoras !== '' ? draftHoras : (config?.horasPrevistasMes != null ? String(config.horasPrevistasMes) : '');
  const horarioEntradaDisplay = draftHorarioEntrada !== '' ? draftHorarioEntrada : (config?.horarioEntrada ?? '');
  const horarioSaidaDisplay = draftHorarioSaida !== '' ? draftHorarioSaida : (config?.horarioSaida ?? '');
  const toleranciaDisplay = draftTolerancia !== '' ? draftTolerancia : (config?.toleranciaMinutos != null ? String(config.toleranciaMinutos) : '');

  const diasUteis = useMemo(() => getDiasUteis(ano, mes), [ano, mes]);

  const onContratoChange = (id: string) => {
    setContratoId(id);
    setDraftHoras('');
    setDraftValorPorDia({});
    setDraftMargemPorDia({});
    setDraftValorCobrancaPorDia({});
    setDraftHorarioEntrada('');
    setDraftHorarioSaida('');
    setDraftTolerancia('');
    geo.resetLocalizacao();
  };

  const onSubgrupoChange = (id: string) => {
    setSubgrupoId(id);
    setDraftHoras('');
    setDraftValorPorDia({});
    setDraftMargemPorDia({});
    setDraftValorCobrancaPorDia({});
    setDraftHorarioEntrada('');
    setDraftHorarioSaida('');
    setDraftTolerancia('');
    geo.resetLocalizacao();
  };

  const onEquipeChange = (id: string) => {
    setEquipeId(id);
    setDraftHoras('');
    setDraftValorPorDia({});
    setDraftMargemPorDia({});
    setDraftValorCobrancaPorDia({});
    setDraftHorarioEntrada('');
    setDraftHorarioSaida('');
    setDraftTolerancia('');
    geo.resetLocalizacao();
  };

  const DIAS_APOS_SEG = ['ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

  const onRepasseDiaChange = (key: string, raw: string) => {
    setDraftValorPorDia((prev) => ({ ...prev, [key]: raw }));
    const rep = parseValorInput(raw);
    const margemRaw = draftMargemPorDia[key] ?? '';
    const margem = parseValorInput(margemRaw);
    if (rep != null && margem != null && margemRaw.trim() !== '') {
      const cob = cobrancaFromMargem(rep, margem);
      if (cob != null) {
        setDraftValorCobrancaPorDia((prev) => ({ ...prev, [key]: formatValor(cob) }));
        return;
      }
    }
    const cobRaw = draftValorCobrancaPorDia[key] ?? '';
    const cob = parseValorInput(cobRaw);
    if (rep != null && cob != null && cobRaw.trim() !== '' && margemRaw.trim() === '') {
      const m = margemFromCobranca(rep, cob);
      setDraftMargemPorDia((prev) => ({ ...prev, [key]: m != null ? formatMargemNumber(m) : '' }));
    }
  };

  const onMargemDiaChange = (key: string, raw: string) => {
    setDraftMargemPorDia((prev) => ({ ...prev, [key]: raw }));
    const margem = parseValorInput(raw);
    const rep = parseValorInput(draftValorPorDia[key] ?? '');
    if (rep == null || margem == null || raw.trim() === '') return;
    const cob = cobrancaFromMargem(rep, margem);
    if (cob != null) {
      setDraftValorCobrancaPorDia((prev) => ({ ...prev, [key]: formatValor(cob) }));
    }
  };

  const onCobrancaDiaChange = (key: string, raw: string) => {
    setDraftValorCobrancaPorDia((prev) => ({ ...prev, [key]: raw }));
    const cob = parseValorInput(raw);
    const rep = parseValorInput(draftValorPorDia[key] ?? '');
    if (rep == null || cob == null || raw.trim() === '') return;
    const m = margemFromCobranca(rep, cob);
    setDraftMargemPorDia((prev) => ({ ...prev, [key]: m != null ? formatMargemNumber(m) : '' }));
  };

  const replicarSegParaRestanteSemana = () => {
    const repSeg = draftValorPorDia.seg ?? '';
    const marSeg = draftMargemPorDia.seg ?? '';
    const repN = parseValorInput(repSeg);
    const marN = parseValorInput(marSeg);
    let cobSeg = draftValorCobrancaPorDia.seg ?? '';
    if (repN != null && marN != null && marSeg.trim() !== '') {
      const cob = cobrancaFromMargem(repN, marN);
      if (cob != null) cobSeg = formatValor(cob);
    }
    setDraftValorPorDia((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const k of DIAS_APOS_SEG) next[k] = repSeg;
      return next;
    });
    setDraftMargemPorDia((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const k of DIAS_APOS_SEG) next[k] = marSeg;
      return next;
    });
    setDraftValorCobrancaPorDia((prev) => {
      const next: Record<string, string> = { ...prev, seg: cobSeg };
      for (const k of DIAS_APOS_SEG) next[k] = cobSeg;
      return next;
    });
  };

  const handleSave = async () => {
    if (!contratoId || !subgrupoId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const horas = draftHoras !== '' ? parseInt(draftHoras, 10) : (config?.horasPrevistasMes ?? null);
      if (horas !== null && (Number.isNaN(horas) || horas < 0)) {
        throw new Error('Horas previstas deve ser um número válido.');
      }

      const gradeRepassePronta = DIAS_SEMANA.every(({ key }) => draftValorPorDia[key] !== undefined);
      const gradeCobrancaPronta = DIAS_SEMANA.every(({ key }) => draftValorCobrancaPorDia[key] !== undefined);

      const { map: mapRepasse, fallbackGlobal: valorRepasseGlobal } = gradeRepassePronta
        ? buildMapaValorPorDiaComFallback(draftValorPorDia)
        : { map: {} as Record<string, number | null>, fallbackGlobal: null as number | null };
      const { map: mapCobranca, fallbackGlobal: valorCobrancaGlobal } = gradeCobrancaPronta
        ? buildMapaValorPorDiaComFallback(draftValorCobrancaPorDia)
        : { map: {} as Record<string, number | null>, fallbackGlobal: null as number | null };

      const valorHora =
        gradeRepassePronta
          ? valorRepasseGlobal
          : config?.valorHora != null
            ? parseFloat(String(config.valorHora))
            : null;
      const valorHoraCobranca =
        gradeCobrancaPronta
          ? valorCobrancaGlobal
          : config?.valorHoraCobranca != null
            ? parseFloat(String(config.valorHoraCobranca))
            : null;

      const horarioEntrada = draftHorarioEntrada !== '' ? draftHorarioEntrada : (config?.horarioEntrada ?? null);
      const horarioSaida = draftHorarioSaida !== '' ? draftHorarioSaida : (config?.horarioSaida ?? null);
      const tolerancia = draftTolerancia !== '' ? parseInt(draftTolerancia, 10) : (config?.toleranciaMinutos ?? null);
      const toleranciaMinutos = tolerancia != null && !Number.isNaN(tolerancia) && tolerancia >= 0 ? tolerancia : null;

      const lat =
        geo.draftLatitude !== ''
          ? parseFloat(geo.draftLatitude.replace(',', '.'))
          : config?.latitude != null && config?.latitude !== ''
            ? parseFloat(String(config.latitude))
            : null;
      const lng =
        geo.draftLongitude !== ''
          ? parseFloat(geo.draftLongitude.replace(',', '.'))
          : config?.longitude != null && config?.longitude !== ''
            ? parseFloat(String(config.longitude))
            : null;
      const raio =
        geo.draftRaioMetros !== '' ? parseInt(geo.draftRaioMetros, 10) : (config?.raioMetros ?? null);
      const raioMetros = raio != null && !Number.isNaN(raio) && raio >= 0 ? raio : null;

      const enderecoPonto =
        geo.draftEndereco.trim() !== ''
          ? geo.draftEndereco.trim() || null
          : config?.enderecoPonto?.trim() || null;

      await adminService.setConfigPonto(contratoId, subgrupoId, equipeId || null, {
        horasPrevistasMes: horas ?? null,
        valorHora,
        valorHoraCobranca,
        ...(gradeRepassePronta ? { valorHoraPorDia: mapRepasse } : {}),
        ...(gradeCobrancaPronta ? { valorHoraCobrancaPorDia: mapCobranca } : {}),
        horarioEntrada: horarioEntrada || null,
        horarioSaida: horarioSaida || null,
        toleranciaMinutos,
        latitude: lat != null && !Number.isNaN(lat) ? lat : null,
        longitude: lng != null && !Number.isNaN(lng) ? lng : null,
        raioMetros,
        enderecoPonto,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, equipeId || null] });
      setDraftHoras('');
      setDraftHorarioEntrada('');
      setDraftHorarioSaida('');
      setDraftTolerancia('');
      geo.limparRascunhoCoordenadasRaio();
      setSuccess('Configuração salva com sucesso.');
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-coop-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode configurar valores e horas do ponto eletrônico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">Horas e valor – Ponto Eletrônico</h2>
        <p className="text-gray-600">
          Por <strong>Contrato</strong>, <strong>Subgrupo</strong> e <strong>Equipe</strong>, defina as <strong>horas previstas no mês</strong> e os <strong>valores por hora</strong> (repasse ao profissional e cobrança). Se não escolher equipe, a configuração vale para todo o subgrupo. Use a seção &quot;Dias úteis do mês&quot; para consultar quantos dias úteis tem cada mês.
        </p>
      </div>

      {error && (
        <div className="card border-l-4 border-red-400">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="card border-l-4 border-green-400">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-4">Contrato, subgrupo e equipe</h3>
        {loadingOpcoes ? (
          <p className="text-sm text-gray-600">Carregando opções...</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-coop-800 mb-1">Contrato</label>
              <select
                className="input w-full"
                value={contratoId}
                onChange={(e) => onContratoChange(e.target.value)}
              >
                <option value="">Selecione o contrato</option>
                {contratosPontoSemEscala.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-coop-800 mb-1">Subgrupo</label>
              <select
                className="input w-full"
                value={subgrupoId}
                onChange={(e) => onSubgrupoChange(e.target.value)}
                disabled={!contratoId}
              >
                <option value="">{contratoId ? 'Selecione o subgrupo' : 'Selecione o contrato primeiro'}</option>
                {subgruposDoContrato.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="block text-sm font-semibold text-coop-800 mb-1">Equipe</label>
              <select
                className="input w-full"
                value={equipeId}
                onChange={(e) => onEquipeChange(e.target.value)}
                disabled={!subgrupoId}
              >
                <option value="">Subgrupo (todas as equipes)</option>
                {equipesDoSubgrupo.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-coop-900 mb-2">Dias úteis do mês</h3>
        <p className="text-sm text-gray-600 mb-4">
          Quantidade de dias úteis (segunda a sexta) no mês selecionado. Ex.: fevereiro de 2026 possui 20 dias úteis.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-semibold text-coop-800 mb-1">Mês</label>
            <select
              className="input w-[180px]"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {MESES.map((nome, i) => (
                <option key={i} value={i + 1}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-coop-800 mb-1">Ano</label>
            <select
              className="input w-[120px]"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-coop-100 border border-coop-200">
            <span className="text-coop-900 font-semibold">
              {MESES[mes - 1]} de {ano}: <strong className="text-coop-800">{diasUteis} dias úteis</strong>
            </span>
          </div>
        </div>
      </div>

      {temContratoESubgrupo && (
        <div className="card">
          <h3 className="text-lg font-bold text-coop-900 mb-4">Horas previstas e valores por hora</h3>
          {loadingConfig ? (
            <p className="text-sm text-gray-600">Carregando configuração...</p>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 mb-3">
                Contratos <strong>só ponto</strong> (sem escala): defina <strong>repasse</strong> e <strong>cobrança</strong> por dia da semana (Seg–Dom). No{' '}
                <strong>Relatório de Horas</strong>, cada batida <strong>sem escala</strong> usa o valor do <strong>dia do check-in</strong>. Dia em branco usa o
                primeiro valor preenchido da semana (seg → dom) como fallback no sistema.
              </p>
              <div className="p-4 rounded-xl border border-coop-200 bg-white space-y-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[200px]">
                    <label className="block text-sm font-semibold text-coop-800 mb-1">Horas previstas no mês</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-full max-w-[180px]"
                      placeholder="Ex: 160"
                      value={horasPrevistasDisplay}
                      onChange={(e) => setDraftHoras(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t border-coop-100 pt-4">
                  <h4 className="text-base font-bold text-coop-900 mb-1">Valor hora por dia (ponto sem escala)</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Preencha repasse, margem % e cobrança por dia. A margem é sobre o valor cobrado (ex.: 100 + 25% →
                    133,33). Configurações antigas com um único valor aparecem repetidas em todos os dias até você
                    ajustar.
                  </p>

                  <div className="p-4 rounded-xl border border-coop-200 bg-white space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-coop-900">
                        Semana (seg–dom){' '}
                        <span className="font-normal text-coop-600">(ponto sem escala)</span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Margem de lucro sobre a cobrança. Ex.: repasse 100 e margem 25% → cobrança 133,33. Editar a
                        cobrança recalcula a margem. Use → na segunda para copiar repasse + margem (e cobrança) para
                        ter–dom.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {DIAS_SEMANA.map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex flex-col gap-2 p-4 rounded-xl border border-coop-200 bg-coop-50/30"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-coop-900">{label}</p>
                            {key === 'seg' ? (
                              <button
                                type="button"
                                className="btn btn-secondary shrink-0 px-2 min-w-[2.25rem]"
                                title="Replicar repasse, margem e cobrança da segunda para ter–dom"
                                onClick={replicarSegParaRestanteSemana}
                              >
                                →
                              </button>
                            ) : null}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-coop-800 mb-1">Repasse (R$/h)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input w-full"
                              placeholder="Ex: 100,00"
                              value={draftValorPorDia[key] ?? ''}
                              onChange={(e) => onRepasseDiaChange(key, e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-coop-800 mb-1">Margem (%)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input w-full"
                              placeholder="Ex: 25"
                              value={draftMargemPorDia[key] ?? ''}
                              onChange={(e) => onMargemDiaChange(key, e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-coop-800 mb-1">Cobrança (R$/h)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input w-full"
                              placeholder="Ex: 133,33"
                              value={draftValorCobrancaPorDia[key] ?? ''}
                              onChange={(e) => onCobrancaDiaChange(key, e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar semana (seg–dom)'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-coop-200 pt-4">
                <h4 className="text-base font-bold text-coop-900 mb-2">Horário de entrada e saída</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Defina o horário exato de chegada e saída da equipe. A <strong>tolerância</strong> (em minutos) vale para os dois: o profissional pode bater ponto de entrada entre (entrada − tolerância) e (entrada + tolerância), e de saída entre (saída − tolerância) e (saída + tolerância). Após o fim da tolerância, atrasos são registrados apenas a título de organização, sem penalidade.
                </p>
                <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-coop-200 bg-coop-50/30">
                  <div className="min-w-[140px]">
                    <label className="block text-sm font-semibold text-coop-800 mb-1">Horário de entrada</label>
                    <input
                      type="time"
                      className="input w-full max-w-[140px]"
                      value={horarioEntradaDisplay}
                      onChange={(e) => setDraftHorarioEntrada(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[140px]">
                    <label className="block text-sm font-semibold text-coop-800 mb-1">Horário de saída</label>
                    <input
                      type="time"
                      className="input w-full max-w-[140px]"
                      value={horarioSaidaDisplay}
                      onChange={(e) => setDraftHorarioSaida(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[160px]">
                    <label className="block text-sm font-semibold text-coop-800 mb-1">Tolerância (min)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      className="input w-full max-w-[100px]"
                      placeholder="Ex: 15"
                      value={toleranciaDisplay}
                      onChange={(e) => setDraftTolerancia(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`btn ${saved ? 'bg-green-600 hover:bg-green-700 border-green-700' : 'btn-primary'}`}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>

              <div className="border-t border-coop-200 pt-4">
                <PontoEnderecoMapaBlock
                  geo={geo}
                  title="Localização do ponto (opcional)"
                  intro={
                    <p className="text-sm text-gray-600 mb-4">
                      Digite um <strong>endereço qualquer</strong> e use <strong>Pesquisar no mapa</strong> (ou{' '}
                      <strong>Enter</strong>) para ver o local no mapa. Enquanto digita, aparecem sugestões; ao escolher
                      uma, o mapa também atualiza. Você pode clicar no mapa ou arrastar o marcador. Com local definido,
                      o profissional precisa estar dentro do <strong>raio</strong> (metros) para bater o ponto. Deixe
                      coordenadas em branco para não exigir geolocalização.
                    </p>
                  }
                />
                <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-coop-200 bg-coop-50/30 mt-3">
                  <div className="min-w-[140px]">
                    <label className="block text-sm font-semibold text-coop-800 mb-1">Raio (metros)</label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      step={10}
                      className="input w-full max-w-[120px]"
                      placeholder="Ex: 200"
                      value={geo.raioMetrosDisplay}
                      onChange={(e) => geo.setDraftRaioMetros(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`btn ${saved ? 'bg-green-600 hover:bg-green-700 border-green-700' : 'btn-primary'}`}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-coop-600 mt-4">
            Estas informações podem ser usadas em relatórios e cálculos de produtividade por subgrupo ou por equipe. Os horários e a tolerância definem a janela em que o check-in e o checkout são aceitos e o registro de atrasos (sem penalidade). A localização e o raio, quando definidos, restringem onde o profissional pode bater ponto.
          </p>
        </div>
      )}
    </div>
  );
};

export default ValoresPonto;
