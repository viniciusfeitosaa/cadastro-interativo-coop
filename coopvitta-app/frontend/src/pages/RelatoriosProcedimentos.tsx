import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { adminService, type AdminMedico } from '../services/admin.service';
import procedimentosBase from '../data/procedimentosBase.json';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** Margem fixa da cooperativa sobre a contribuição bruta da linha (1.º + 2.º). Repasse = cobrança da linha × (1 − margem). */
const MARGEM_COOP_PCT = 25;
const REPASSE_FRAC_LINHA = 1 - MARGEM_COOP_PCT / 100;
const defaultRepasse2MedPct = 30;
const STORAGE_KEY = 'relatorioProcedimentosCalc_v1';
const COLS_LANC_KEY = 'relatorioProcedLancColunas_v1';

/** Colunas da tabela de lançamentos (a coluna — excluir é sempre visível). */
type ColLancKey = 'ins' | 'cod1' | 'proc1' | 'v1' | 'rep1' | 'cod2' | 'proc2' | 'v2' | 'rep2' | 'bruto';
type ColResumoKey = 'medico' | 'repasse' | 'recebe';

const defaultColsLanc = (): Record<ColLancKey, boolean> => ({
  ins: true,
  cod1: true,
  proc1: true,
  v1: true,
  rep1: true,
  cod2: true,
  proc2: true,
  v2: true,
  rep2: true,
  bruto: true,
});

const loadColsLanc = (): Record<ColLancKey, boolean> => {
  try {
    const r = localStorage.getItem(COLS_LANC_KEY);
    if (!r) return defaultColsLanc();
    const p = JSON.parse(r) as Record<string, boolean>;
    return { ...defaultColsLanc(), ...p };
  } catch {
    return defaultColsLanc();
  }
};

/** Pesos relativos para `table-layout: fixed` (largura % soma 100 com colunas visíveis). Inclui ações. */
const PESO_COL_LANC: Record<'acoes' | ColLancKey, number> = {
  acoes: 3.4,
  ins: 2.8,
  cod1: 3.6,
  proc1: 16,
  v1: 4.2,
  rep1: 8.5,
  cod2: 3.6,
  proc2: 16,
  v2: 4.2,
  rep2: 8.5,
  bruto: 5.4,
};

/** Peso mínimo da coluna oculta: só o controlo de visibilidade no cabeçalho. */
const PESO_COL_LANC_HEADER_OCULTA = 0.55;

const LANC_COL_ORDER: ColLancKey[] = [
  'ins',
  'cod1',
  'proc1',
  'v1',
  'rep1',
  'cod2',
  'proc2',
  'v2',
  'rep2',
  'bruto',
];

const LANC_TH: { key: ColLancKey; label: string; thTitle?: string; borderL?: boolean }[] = [
  { key: 'ins', label: 'Ins.' },
  { key: 'cod1', label: 'Cód. 1' },
  { key: 'proc1', label: '1.º proced.' },
  { key: 'v1', label: 'Valor 1', thTitle: 'Valor 1' },
  { key: 'rep1', label: '1.º no rep.', thTitle: 'Médico no repasse', borderL: true },
  { key: 'cod2', label: 'Cód. 2' },
  { key: 'proc2', label: '2.º proced.' },
  { key: 'v2', label: 'Valor 2', thTitle: 'Valor 2' },
  { key: 'rep2', label: '2.º no rep.', thTitle: 'Médico no repasse' },
  { key: 'bruto', label: 'Contrib.' },
];

const RESUMO_TH: { key: ColResumoKey; label: string; align?: 'left' | 'center' | 'right' }[] = [
  { key: 'medico', label: 'Médico', align: 'left' },
  { key: 'repasse', label: 'Repasse', align: 'center' },
  { key: 'recebe', label: 'Valor exato a receber', align: 'right' },
];

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

const textoSeguroPdf = (s: string) =>
  String(s)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2013|\u2014|\u2212/g, '-');

type ProcedimentoBase = (typeof procedimentosBase)[number];

type RascunhoProfsT = {
  profissional1Nome: string;
  profissional1Crm: string;
  profissional2Nome: string;
  profissional2Crm: string;
  incluirProfissional1: boolean;
  incluirProfissional2: boolean;
};

type LinhaProcedimento = {
  id: string;
  refBaseId: string | null;
  dataProcedimento: string;
  nomePaciente: string;
  prontuario: string;
  instrumento: string;
  codigo1: string;
  nome1: string;
  valorPrimeiro: string;
  codigo2: string;
  nome2: string;
  valorSegundo: string;
  /**
   * Quem recebe o repasse **nesta** linha, gravado no lançamento.
   * Ausente em dados legados: usa a identificação geral do mês (`DadosMes`).
   */
  quemRepasse?: RascunhoProfsT;
};

type DadosMes = {
  concluido: boolean;
  deflatorPct: string;
  custoAdmPct: string;
  repasse2MedPct: string;
  /** Incluir o 1.º profissional na divisão do pool (repasse) */
  incluirProfissional1: boolean;
  /** Incluir o 2.º profissional na divisão do pool (repasse) */
  incluirProfissional2: boolean;
  /** Nome (ou como identificar) o 1.º profissional do repasse */
  profissional1Nome: string;
  /** CRM/UF do 1.º; opcional */
  profissional1Crm: string;
  profissional2Nome: string;
  profissional2Crm: string;
  /** Legado: migrado → incluirProfissional2 */
  segundoMedico?: boolean;
  /** Tabela "Detalhe do cálculo" visível (padrão: true) */
  mostrarDetalheCalculo?: boolean;
  procedimentos: LinhaProcedimento[];
};

const pickRascunhoProfs = (d: DadosMes): RascunhoProfsT => ({
  profissional1Nome: d.profissional1Nome,
  profissional1Crm: d.profissional1Crm,
  profissional2Nome: d.profissional2Nome,
  profissional2Crm: d.profissional2Crm,
  incluirProfissional1: d.incluirProfissional1,
  incluirProfissional2: d.incluirProfissional2,
});

const mesesNomes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'] as const;

const criarId = () => globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}`;

const numBrl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chaveDeBase = (p: ProcedimentoBase) => `${p.instrumento} | ${p.codigo1} | ${p.nome1}`;

const fromBase = (b: ProcedimentoBase): LinhaProcedimento => ({
  id: criarId(),
  refBaseId: b.id,
  dataProcedimento: '',
  nomePaciente: '',
  prontuario: '',
  instrumento: b.instrumento,
  codigo1: b.codigo1,
  nome1: b.nome1,
  valorPrimeiro: numBrl(b.valor1),
  codigo2: b.codigo2,
  nome2: b.nome2,
  valorSegundo: numBrl(b.valor2),
});

const linhaPendenteVazia = (): LinhaProcedimento => ({
  id: criarId(),
  refBaseId: null,
  dataProcedimento: '',
  nomePaciente: '',
  prontuario: '',
  instrumento: '',
  codigo1: '',
  nome1: '',
  valorPrimeiro: '',
  codigo2: '',
  nome2: '',
  valorSegundo: '',
});

const defaultDadosMes = (): DadosMes => ({
  concluido: false,
  deflatorPct: '0',
  custoAdmPct: '0',
  repasse2MedPct: String(defaultRepasse2MedPct),
  incluirProfissional1: true,
  incluirProfissional2: true,
  profissional1Nome: '',
  profissional1Crm: '',
  profissional2Nome: '',
  profissional2Crm: '',
  mostrarDetalheCalculo: true,
  procedimentos: [],
});

/** Carrega dados guardados e aplica campos novos / legado `segundoMedico`. */
const normalizarDadosMes = (s: DadosMes): DadosMes => {
  let p1 = s.incluirProfissional1;
  let p2 = s.incluirProfissional2;
  if (typeof p1 !== 'boolean') p1 = true;
  if (typeof p2 !== 'boolean') {
    if (typeof s.segundoMedico === 'boolean') p2 = s.segundoMedico;
    else p2 = true;
  }
  const r2Med =
    s.repasse2MedPct != null && String(s.repasse2MedPct).trim() !== ''
      ? String(s.repasse2MedPct)
      : String(defaultRepasse2MedPct);
  return {
    ...s,
    incluirProfissional1: p1,
    incluirProfissional2: p2,
    profissional1Nome: s.profissional1Nome ?? '',
    profissional1Crm: s.profissional1Crm ?? '',
    profissional2Nome: s.profissional2Nome ?? '',
    profissional2Crm: s.profissional2Crm ?? '',
    deflatorPct: '0',
    custoAdmPct: '0',
    repasse2MedPct: r2Med,
    mostrarDetalheCalculo: s.mostrarDetalheCalculo !== false,
  };
};

const rotuloQuem = (nome: string, crm: string): string | null => {
  const n = nome.trim();
  const c = crm.trim();
  if (!n && !c) return null;
  if (n && c) return `${n} · CRM ${c}`;
  return n || `CRM ${c}`;
};

const parseNumeroBr = (s: string, fallback: number = 0): number => {
  if (!s || !String(s).trim()) return fallback;
  const raw = String(s)
    .trim()
    .replace(/%/g, '')
    .replace(/R\$/g, '')
    .replace(/\s/g, '');
  if (!raw) return fallback;
  if (raw.includes(',') && raw.includes('.')) {
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || fallback;
  }
  if (raw.includes(',') && !raw.includes('.')) {
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || fallback;
  }
  if (raw.includes('.')) return parseFloat(raw) || fallback;
  return parseFloat(raw) || fallback;
};

const parseBrl = (s: string) => parseNumeroBr(s, 0);
const formatarDataISO = (iso: string): string => {
  if (!iso) return '—';
  const head = iso.includes('T') ? iso.split('T')[0]!.trim() : iso.trim();
  const [y, m, d] = head.split('-');
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
};
const parsePercent = (s: string, fallback: number) => {
  const n = parseNumeroBr(s, NaN);
  return Number.isNaN(n) ? fallback : n;
};

/** Normaliza texto de cabeçalho de planilha (acentos, espaços, underscore). */
const stripHeaderKey = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizarCodigoProcedImport = (s: string) =>
  String(s ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .toUpperCase();

const findProcedimentoBaseImport = (ins: string, c1: string, c2: string): ProcedimentoBase | undefined => {
  const insN = ins.trim().toUpperCase();
  const n1 = normalizarCodigoProcedImport(c1);
  const n2 = normalizarCodigoProcedImport(c2);
  return (
    procedimentosBase.find(
      (b) =>
        b.instrumento.trim().toUpperCase() === insN &&
        normalizarCodigoProcedImport(b.codigo1) === n1 &&
        normalizarCodigoProcedImport(b.codigo2) === n2
    ) ??
    procedimentosBase.find(
      (b) =>
        normalizarCodigoProcedImport(b.codigo1) === n1 && normalizarCodigoProcedImport(b.codigo2) === n2
    )
  );
};

const somaValoresBase = (b: ProcedimentoBase) => (Number(b.valor1) || 0) + (Number(b.valor2) || 0);

/** Palavras vazias para comparação por tokens (Cirurgia vs TUSS). */
const STOPWORDS_PROC = new Set([
  'de',
  'da',
  'do',
  'dos',
  'das',
  'e',
  'ou',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'ao',
  'aos',
  'com',
  'por',
  'a',
  'o',
  'os',
  'as',
]);

/**
 * Alinha texto da coluna «Cirurgia» (hospital) com descrições TUSS da base:
 * TRATAMENTO → TRAT, remove pontos, sinónimos comuns (planalto/pilão, supracondiliana/supracondileana, etc.).
 */
const normalizarNucleoProcedimento = (raw: string): string => {
  let s = stripHeaderKey(raw);
  if (!s) return '';
  s = s.replace(/\btratamento\b/g, 'trat');
  s = s.replace(/\./g, ' ');
  s = s.replace(/\s*\/\s*/g, ' ');
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\btrat cirurgico de fratura\b/g, 'trat cirurgico fratura');
  s = s.replace(/\b(supracondileana|transtrocateriana|transcoterciana) do femur\b/g, '$1 femur');
  const pairs: [RegExp, string][] = [
    [/\bplanalto tibial\b/g, 'pilao tibial'],
    [/\bsupracondiliana\b/g, 'supracondileana'],
    [/\bsupracondiliano\b/g, 'supracondileano'],
    [
      /\bde fratura lesao fisaria ao nivel de joelho\b/g,
      'fratura ao nivel do joelho',
    ],
    [/\bde fratura lesao fisaria ao nivel do joelho\b/g, 'fratura ao nivel do joelho'],
    [/\bfratura lesao fisaria ao nivel de joelho\b/g, 'fratura ao nivel do joelho'],
    [/\blesao fisaria ao nivel de joelho\b/g, 'fratura ao nivel do joelho'],
    [/\bfratura intercondiliana dos condilos do femur\b/g, 'fratura condilos do femur'],
    [/\bintercondiliana dos condilos do femur\b/g, 'fratura condilos do femur'],
    [/\bintercondiliana dos condilos\b/g, 'condilos'],
    [/\bda extremidade metafise dos ossos do antebraco\b/g, 'fratura distal antebraco'],
    [/\bextremidade metafise dos ossos do antebraco\b/g, 'distal antebraco'],
  ];
  for (const [re, to] of pairs) s = s.replace(re, to);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
};

const tokensProcedOverlap = (raw: string): string[] =>
  normalizarNucleoProcedimento(raw)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS_PROC.has(w));

/** Cobertura dos tokens da consulta no candidato (0–1). */
const scoreOverlapProced = (queryRaw: string, candRaw: string): number => {
  const qArr = tokensProcedOverlap(queryRaw);
  if (qArr.length === 0) return 0;
  const cArr = tokensProcedOverlap(candRaw);
  const cset = new Set(cArr);
  let hit = 0;
  for (const w of qArr) {
    if (cset.has(w)) hit += 1;
    else {
      let sub = false;
      for (const c of cArr) {
        if ((c.includes(w) || w.includes(c)) && (w.length >= 5 || c.length >= 5)) {
          sub = true;
          break;
        }
      }
      if (sub) hit += 0.65;
    }
  }
  return hit / qArr.length;
};

const escolherUnicoPorScore = (
  term: string,
  cands: ProcedimentoBase[],
  campo: 'nome1' | 'nome2'
): ProcedimentoBase | undefined => {
  if (cands.length === 0) return undefined;
  if (cands.length === 1) return cands[0];
  let best = cands[0];
  let bestS = scoreOverlapProced(term, best[campo]);
  let nTie = 1;
  for (let i = 1; i < cands.length; i++) {
    const b = cands[i];
    const s = scoreOverlapProced(term, b[campo]);
    if (s > bestS + 1e-6) {
      best = b;
      bestS = s;
      nTie = 1;
    } else if (Math.abs(s - bestS) < 1e-6) nTie++;
  }
  if (nTie === 1 && bestS >= 0.48) return best;
  return undefined;
};

const findProcedimentoBasePorOverlapTokensGlobal = (
  term: string
): { ok: ProcedimentoBase } | { err: 'notfound' | 'ambiguous' } => {
  const scored = procedimentosBase.map((b) => ({
    b,
    s: Math.max(scoreOverlapProced(term, b.nome1), scoreOverlapProced(term, b.nome2)),
  }));
  scored.sort((a, z) => z.s - a.s);
  const top = scored[0];
  if (!top || top.s < 0.52) return { err: 'notfound' };
  const second = scored[1]?.s ?? -1;
  if (second >= top.s - 0.07 && second > 0.48) return { err: 'ambiguous' };
  return { ok: top.b };
};

/**
 * Vários registos podem partilhar o mesmo texto (ex.: mesmo 1.º com 2.º diferentes).
 * Se a planilha trouxer o total de honorários ≈ soma TUSS de um deles, escolhe esse par.
 */
const unicoParPorTotalHonorarios = (cands: ProcedimentoBase[], total: number): ProcedimentoBase | undefined => {
  if (!Number.isFinite(total) || total <= 0 || cands.length < 2) return undefined;
  const tol = 0.06;
  const hits = cands.filter((b) => Math.abs(somaValoresBase(b) - total) <= tol);
  if (hits.length === 1) return hits[0];
  return undefined;
};

/** «Cirurgia» com dois nomes unidos por « / » (1.º e 2.º procedimento na mesma célula). */
const splitNomesProcedimentoPlanilha = (raw: string): string[] =>
  raw
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * Casa par 1.º+2.º na base pelos textos da planilha; o total de honorários desambigua quando há vários pares.
 */
const findProcedimentoBasePorParNomes = (
  nome1Text: string,
  nome2Text: string,
  totalHonorarios?: number
): { ok: ProcedimentoBase } | { err: 'notfound' | 'ambiguous' } => {
  const scorePar = (b: ProcedimentoBase): number => {
    const s1 = scoreOverlapProced(nome1Text, b.nome1);
    const s2 = scoreOverlapProced(nome2Text, b.nome2);
    if (s1 < 0.38 || s2 < 0.38) return -1;
    return (s1 + s2) / 2;
  };

  let ranked = procedimentosBase
    .map((b) => ({ b, s: scorePar(b) }))
    .filter((x) => x.s >= 0)
    .sort((a, z) => z.s - a.s);

  if (ranked.length === 0) {
    const n1 = normalizarNucleoProcedimento(nome1Text);
    const n2 = normalizarNucleoProcedimento(nome2Text);
    if (!n1 || !n2) return { err: 'notfound' };
    ranked = procedimentosBase
      .filter((b) => {
        const bn1 = normalizarNucleoProcedimento(b.nome1);
        const bn2 = normalizarNucleoProcedimento(b.nome2);
        return (bn1.includes(n1) || n1.includes(bn1)) && (bn2.includes(n2) || n2.includes(bn2));
      })
      .map((b) => ({ b, s: 0.55 }));
  }

  const list = ranked.map((x) => x.b);
  if (totalHonorarios != null && Number.isFinite(totalHonorarios) && totalHonorarios > 0) {
    const u = unicoParPorTotalHonorarios(list, totalHonorarios);
    if (u) return { ok: u };
    const sumHit = findProcedimentoBasePorSomaValoresUnica(totalHonorarios);
    if (!('err' in sumHit)) {
      if (list.length === 0) return { ok: sumHit.ok };
      if (list.some((b) => b === sumHit.ok)) return { ok: sumHit.ok };
    }
  }

  if (list.length === 1) return { ok: list[0]! };
  if (ranked.length >= 2 && ranked[0]!.s - ranked[1]!.s >= 0.1) return { ok: ranked[0]!.b };
  if (list.length > 1) return { err: 'ambiguous' };
  return { err: 'notfound' };
};

/** Único registo na base cuja soma TUSS (valor1+valor2) coincide com o total importado (±R$0,02). */
const findProcedimentoBasePorSomaValoresUnica = (
  total: number
): { ok: ProcedimentoBase } | { err: 'notfound' | 'ambiguous' } => {
  if (!Number.isFinite(total) || total <= 0) return { err: 'notfound' };
  const tol = 0.02;
  const hits = procedimentosBase.filter((b) => Math.abs(somaValoresBase(b) - total) <= tol);
  if (hits.length === 0) return { err: 'notfound' };
  if (hits.length === 1) return { ok: hits[0] };
  return { err: 'ambiguous' };
};

/** Localiza na base pelo nome do 1.º (ou 2.º) procedimento — texto da coluna Cirurgia/Procedimento vs. nomes TUSS. */
const findProcedimentoBasePorNomeProcedimento = (
  term: string,
  totalHonorarios?: number
): { ok: ProcedimentoBase } | { err: 'notfound' | 'ambiguous' } => {
  const partes = splitNomesProcedimentoPlanilha(term);
  if (partes.length >= 2) {
    const parHit = findProcedimentoBasePorParNomes(partes[0]!, partes.slice(1).join(' / '), totalHonorarios);
    if (!('err' in parHit)) return parHit;
    if (totalHonorarios != null && Number.isFinite(totalHonorarios) && totalHonorarios > 0) {
      const sumHit = findProcedimentoBasePorSomaValoresUnica(totalHonorarios);
      if (!('err' in sumHit)) return sumHit;
    }
    if (parHit.err === 'ambiguous') return parHit;
  }

  const t = normalizarNucleoProcedimento(term);
  if (!t) return { err: 'notfound' };

  const resolveMulti = (cands: ProcedimentoBase[], campo: 'nome1' | 'nome2'): ProcedimentoBase | undefined => {
    if (cands.length === 0) return undefined;
    if (cands.length === 1) return cands[0];
    const u = totalHonorarios != null ? unicoParPorTotalHonorarios(cands, totalHonorarios) : undefined;
    if (u) return u;
    return escolherUnicoPorScore(term, cands, campo);
  };

  const exact1 = procedimentosBase.filter((b) => normalizarNucleoProcedimento(b.nome1) === t);
  const r1 = resolveMulti(exact1, 'nome1');
  if (r1) return { ok: r1 };
  if (exact1.length > 1) return { err: 'ambiguous' };

  const exact2 = procedimentosBase.filter((b) => normalizarNucleoProcedimento(b.nome2) === t);
  const r2 = resolveMulti(exact2, 'nome2');
  if (r2) return { ok: r2 };
  if (exact2.length > 1) return { err: 'ambiguous' };

  const sub1 = procedimentosBase.filter((b) => {
    const n1 = normalizarNucleoProcedimento(b.nome1);
    return n1.includes(t) || t.includes(n1);
  });
  const r3 = resolveMulti(sub1, 'nome1');
  if (r3) return { ok: r3 };
  if (sub1.length > 1) return { err: 'ambiguous' };

  const sub2 = procedimentosBase.filter((b) => {
    const n2 = normalizarNucleoProcedimento(b.nome2);
    return n2.includes(t) || t.includes(n2);
  });
  const r4 = resolveMulti(sub2, 'nome2');
  if (r4) return { ok: r4 };
  if (sub2.length > 1) return { err: 'ambiguous' };

  return findProcedimentoBasePorOverlapTokensGlobal(term);
};

type XlsxCell = { t?: string; v?: unknown; w?: string; z?: string };

/** Texto de data como o Excel exibe (pt-BR: dd/mm/aaaa ou dd/mm/aa). */
const RE_TEXTO_DATA_PT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;

const excelSerialParaIso = (n: number): string => {
  const whole = Math.trunc(n);
  if (whole < 29500 || whole > 56000) return '';
  const ssf = (XLSX as { SSF?: { parse_date_code?: (v: number) => { y: number; m: number; d: number } } }).SSF;
  const pd = ssf?.parse_date_code?.(n);
  if (pd && pd.y >= 1900 && pd.y <= 2100 && pd.m >= 1 && pd.m <= 12 && pd.d >= 1 && pd.d <= 31) {
    return `${pd.y}-${String(pd.m).padStart(2, '0')}-${String(pd.d).padStart(2, '0')}`;
  }
  return '';
};

/** Número serial típico de data no Excel (1900 system). Independente do locale de exibição. */
const pareceSerialDataExcel = (n: number): boolean => {
  const whole = Math.trunc(n);
  return whole >= 29500 && whole <= 56000;
};

const celulaFormatoDataExcel = (cell: XlsxCell): boolean => {
  const z = (cell.z ?? '').toLowerCase();
  return (
    /(?:dd|mm|yyyy|yy|d\/|m\/)/.test(z) ||
    (z.includes('/') && !z.includes('#') && !z.includes('[$'))
  );
};

const dateObjectParaIsoLocal = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** dd/mm/aaaa — primeiro número = dia, segundo = mês (planilhas hospitalares BR). */
const parseTextoDataDiaPrimeiro = (texto: string): string => {
  const m = RE_TEXTO_DATA_PT.exec(String(texto).trim());
  if (!m) return '';
  let y = parseInt(m[3], 10);
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  return isoDataValida(parseInt(m[1], 10), parseInt(m[2], 10), y);
};

/**
 * Coluna Data no layout hospital: prioriza o texto exibido (dd/mm) porque o serial do Excel
 * pode estar em locale US (ex. 02/03 visível como 2-mar mas serial = fevereiro).
 */
const readDateImportCellHospital = (cell: XlsxCell | undefined): string => {
  if (!cell) return '';
  const w = cell.w != null ? String(cell.w).trim() : '';
  if (w) {
    const isoW = parseTextoDataDiaPrimeiro(w);
    if (isoW) return isoW;
  }
  if (cell.v != null && cell.v !== '') {
    const isoV = parseTextoDataDiaPrimeiro(String(cell.v));
    if (isoV) return isoV;
  }
  if (cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v) && pareceSerialDataExcel(cell.v)) {
    return excelSerialParaIso(cell.v);
  }
  if (cell.t === 'd' && cell.v instanceof Date) {
    return dateObjectParaIsoLocal(cell.v as Date);
  }
  return '';
};

/** Coluna Data (import genérico): serial primeiro, depois texto. */
const readDateImportCell = (cell: XlsxCell | undefined, mesReferencia?: string): unknown => {
  if (!cell) return '';

  if (cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    if (pareceSerialDataExcel(cell.v) || celulaFormatoDataExcel(cell)) {
      const isoSerial = excelSerialParaIso(cell.v);
      if (isoSerial) return isoSerial;
    }
  }
  if (cell.t === 'd' && cell.v instanceof Date) {
    const isoDate = dateObjectParaIsoLocal(cell.v as Date);
    if (isoDate) return isoDate;
  }

  const w = cell.w != null ? String(cell.w).trim() : '';
  if (w) {
    const isoW = parseCelulaDataISO(w, mesReferencia);
    if (isoW) return isoW;
    if (RE_TEXTO_DATA_PT.test(w)) return w;
  }
  if (cell.v != null && cell.v !== '') {
    if (typeof cell.v === 'number' && pareceSerialDataExcel(cell.v)) {
      const iso = excelSerialParaIso(cell.v);
      if (iso) return iso;
    }
    const s = String(cell.v).trim();
    if (RE_TEXTO_DATA_PT.test(s)) return s;
    const iso = parseCelulaDataISO(cell.v, mesReferencia);
    if (iso) return iso;
    return cell.v;
  }
  return w;
};

/** Demais colunas: texto exibido (cell.w); serial de data vira ISO na matriz (fallback sem folha). */
const readImportCellValue = (cell: XlsxCell | undefined): unknown => {
  if (!cell) return '';
  if (cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    if (pareceSerialDataExcel(cell.v) || celulaFormatoDataExcel(cell)) {
      const iso = excelSerialParaIso(cell.v);
      if (iso) return iso;
    }
  }
  if (cell.t === 'd' && cell.v instanceof Date) {
    const iso = dateObjectParaIsoLocal(cell.v as Date);
    if (iso) return iso;
  }
  const w = cell.w != null ? String(cell.w).trim() : '';
  if (w && RE_TEXTO_DATA_PT.test(w)) return w;
  if (w) return w;
  if (cell.v != null && cell.v !== '') return cell.v;
  return '';
};

/** Remove linhas vazias no início (folha com margem ou título acima da tabela). */
const trimLeadingEmptyRows = (aoa: unknown[][]): unknown[][] => {
  let start = 0;
  while (start < aoa.length) {
    const row = aoa[start] ?? [];
    const has = row.some((c) => {
      if (c == null || c === '') return false;
      return String(c).trim() !== '';
    });
    if (has) break;
    start++;
  }
  return start > 0 ? aoa.slice(start) : aoa;
};

/** Remove linhas vazias no fim da folha (o Excel alarga o intervalo e o SheetJS devolve centenas de linhas em branco). */
const trimAoaRemoveTrailingEmptyRows = (aoa: unknown[][]): unknown[][] => {
  if (!aoa?.length) return aoa;
  let end = aoa.length - 1;
  while (end > 0) {
    const row = aoa[end] ?? [];
    const hasCell = row.some((c) => {
      if (c == null || c === '') return false;
      if (typeof c === 'number') return c !== 0;
      return String(c).trim() !== '';
    });
    if (hasCell) break;
    end--;
  }
  return aoa.slice(0, end + 1);
};

/** Linhas que não são cirurgias (subtítulos, totais, repetir cabeçalho). */
const NOME_PROC_IMPORT_IGNORAR = new Set([
  'cirurgia',
  'procedimento',
  'nome do procedimento',
  'nome do paciente',
  'prontuario',
  'total',
  'subtotal',
  'soma',
  'honorarios medicos',
  'honorarios',
]);

const isoDataValida = (day: number, month: number, y: number): string => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const dt = new Date(y, month - 1, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== month - 1 || dt.getDate() !== day) return '';
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Data em ISO (yyyy-mm-dd). `mesReferencia` só desambigua dd/mm vs mm/dd em texto — não descarta datas.
 * O filtro por mês aberto no app é feito em `parsePlanilhaLancamentos`.
 */
const parseCelulaDataISO = (cell: unknown, mesReferencia?: string): string => {
  if (cell == null || cell === '') return '';

  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return dateObjectParaIsoLocal(cell);
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return excelSerialParaIso(cell);
  }
  let s = String(cell).trim();
  if (!s) return '';
  if (s.includes('T')) s = s.split('T')[0]!.trim();
  const mIso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (mIso) {
    const mm = mIso[2].padStart(2, '0');
    const dd = mIso[3].padStart(2, '0');
    return `${mIso[1]}-${mm}-${dd}`;
  }
  const serialTxt = /^(\d{4,5})(\.\d+)?$/.exec(s.replace(/\s/g, ''));
  if (serialTxt) {
    const isoSerial = excelSerialParaIso(parseFloat(serialTxt[0]));
    if (isoSerial) return isoSerial;
  }
  const mBr = RE_TEXTO_DATA_PT.exec(s);
  if (mBr) {
    const a = parseInt(mBr[1], 10);
    const b = parseInt(mBr[2], 10);
    let y = parseInt(mBr[3], 10);
    if (y < 100) y += y >= 50 ? 1900 : 2000;
    const isoBr = isoDataValida(a, b, y);
    const isoUs = isoDataValida(b, a, y);
    if (mesReferencia && isoBr && isoUs && isoBr !== isoUs) {
      if (isoBr.slice(0, 7) === mesReferencia) return isoBr;
      if (isoUs.slice(0, 7) === mesReferencia) return isoUs;
    }
    return isoBr || isoUs || '';
  }
  return '';
};

const LANC_IMPORT_COLS: { id: string; normKeys: string[] }[] = [
  { id: 'data', normKeys: ['data', 'data procedimento', 'data da cirurgia', 'data cirurgia', 'dt cirurgia', 'data atendimento'] },
  { id: 'paciente', normKeys: ['paciente', 'nome do paciente', 'nome paciente', 'nome pac'] },
  { id: 'prontuario', normKeys: ['prontuario', 'pront', 'numero prontuario', 'n prontuario', 'matricula'] },
  {
    id: 'nomeProcedimento',
    normKeys: [
      'procedimento',
      'cirurgia',
      'nome da cirurgia',
      'nome cirurgia',
      'procedimento cirurgico',
      'nome procedimento',
      'nome do procedimento',
      '1 procedimento',
      '1. procedimento',
      'primeiro procedimento',
      'procedimento principal',
      'descricao procedimento',
    ],
  },
  { id: 'instrumento', normKeys: ['ins', 'ins.', 'instrumento'] },
  { id: 'codigo1', normKeys: ['codigo 1', 'cod 1', 'cod. 1', 'cod1', 'codigo1'] },
  { id: 'codigo2', normKeys: ['codigo 2', 'cod 2', 'cod. 2', 'cod2', 'codigo2'] },
  {
    id: 'valor1',
    normKeys: ['valor 1', 'valor1', 'r$ 1', 'rs 1'],
  },
  { id: 'valor2', normKeys: ['valor 2', 'valor2', 'r$ 2', 'rs 2'] },
  {
    id: 'honorariosTotalPar',
    normKeys: [
      'honorarios medicos',
      'honorarios medicos, codigo da proposta aproximado',
      'honorarios medicos codigo da proposta aproximado',
      'honorarios',
      'honorario',
      'valor total procedimento',
      'total honorarios',
      'vl honorarios',
      'valor',
      'vl procedimento',
      'valor procedimento',
      'valor cirurgia',
    ],
  },
  {
    id: 'med1Nome',
    normKeys: [
      'medico 1 nome',
      'nome medico 1',
      'medico 1',
      'cirurgiao principal',
      'cirurgiao',
      'medico principal',
      'medico',
    ],
  },
  { id: 'med1Crm', normKeys: ['medico 1 crm', 'crm medico 1', 'crm 1', 'crm medico', 'crm cirurgiao'] },
  {
    id: 'med2Nome',
    normKeys: [
      'medico 2 nome',
      'nome medico 2',
      'medico 2',
      'medico auxiliar',
      'auxiliar',
      '2 medico',
      'segundo medico',
    ],
  },
  { id: 'med2Crm', normKeys: ['medico 2 crm', 'crm medico 2', 'crm 2', 'crm auxiliar'] },
];

/** Cabeçalho da planilha: igualdade ou inclusão para rótulos longos do hospital. */
const headerNormMatchesColumn = (norm: string, keys: string[]): boolean => {
  if (!norm) return false;
  if (keys.includes(norm)) return true;
  for (const k of keys) {
    if (k.length >= 10 && norm.includes(k)) return true;
    if (norm.length >= 10 && k.includes(norm)) return true;
  }
  return false;
};

const headerNormMatchesAny = (norms: string[], keys: string[]): boolean =>
  norms.some((n) => headerNormMatchesColumn(n, keys));

/** Lê a folha célula a célula (datas pelo tipo Excel, resto pelo texto visível). */
const readSheetToAoa = (sheet: XLSX.WorkSheet): unknown[][] => {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const aoa: unknown[][] = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: unknown[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      row.push(readImportCellValue(sheet[addr] as XlsxCell | undefined));
    }
    aoa.push(row);
  }
  return aoa;
};

/**
 * Só propaga merges na vertical (mesma coluna).
 * Merges horizontais (títulos) copiavam datas para colunas de honorários/valores — causa principal de datas erradas.
 */
const applySheetMergesToAoa = (
  sheet: XLSX.WorkSheet,
  aoa: unknown[][],
  opts?: { skipCols?: Set<number>; aoaRowOffset?: number }
): unknown[][] => {
  const merges = sheet['!merges'];
  if (!merges?.length) return aoa;
  const skipCols = opts?.skipCols ?? new Set<number>();
  const rowOff = opts?.aoaRowOffset ?? 0;
  const out = aoa.map((row) => [...row]);
  for (const m of merges) {
    const sc = m.s.c;
    if (sc !== m.e.c) continue;
    if (skipCols.has(sc)) continue;
    const sr = m.s.r - rowOff;
    const er = m.e.r - rowOff;
    if (er <= sr || sr < 0 || sr >= out.length) continue;
    const v = out[sr]?.[sc];
    if (v == null || v === '') continue;
    for (let r = sr + 1; r <= er && r < out.length; r++) {
      if (!out[r]) out[r] = [];
      if (out[r][sc] == null || out[r][sc] === '') out[r][sc] = v;
    }
  }
  return out;
};

const importColunasObrigatoriasOk = (col: Record<string, number>): boolean => {
  if (col.data === undefined) return false;
  const temTriplo =
    col.instrumento !== undefined && col.codigo1 !== undefined && col.codigo2 !== undefined;
  const temNome = col.nomeProcedimento !== undefined;
  const temHonor = col.honorariosTotalPar !== undefined;
  return temTriplo || temNome || temHonor;
};

/** Planilha hospitalar típica: prontuário | paciente | médico 1 | médico 2 | data | cirurgia | valor. */
const MAP_COLUNAS_HOSPITAL_7: Record<string, number> = {
  prontuario: 0,
  paciente: 1,
  med1Nome: 2,
  med2Nome: 3,
  data: 4,
  nomeProcedimento: 5,
  honorariosTotalPar: 6,
};

const parseBrlCelula = (cell: unknown): number => {
  if (cell == null || cell === '') return NaN;
  if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  const s = String(cell).trim();
  if (!s) return NaN;
  return parseBrl(s);
};

const linhaPareceProntuario = (cell: unknown): boolean => {
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    const n = Math.trunc(cell);
    return n >= 10_000 && n <= 9_999_999;
  }
  return /^\d{5,8}$/.test(String(cell ?? '').trim());
};

const linhaPareceCabecalhoTexto = (row: unknown[]): boolean => {
  const norms = row.map((c) => stripHeaderKey(String(c ?? '')));
  if (headerNormMatchesAny(norms, ['data', 'data da cirurgia', 'data cirurgia', 'data procedimento'])) {
    return true;
  }
  if (headerNormMatchesAny(norms, ['paciente', 'nome do paciente', 'prontuario', 'cirurgia', 'procedimento'])) {
    return true;
  }
  return false;
};

/** Pontua se a linha segue o layout hospital (7 colunas). */
const lerDataIsoNaColuna = (
  row: unknown[],
  sheet: XLSX.WorkSheet | undefined,
  sheetRow: number,
  colIdx: number,
  mesReferencia?: string,
  opts?: { hospital?: boolean }
): string => {
  if (opts?.hospital) {
    if (sheet) {
      const addr = XLSX.utils.encode_cell({ r: sheetRow, c: colIdx });
      const iso = readDateImportCellHospital(sheet[addr] as XlsxCell | undefined);
      if (iso) return iso;
    }
    const raw = row[colIdx];
    if (raw == null || raw === '') return '';
    if (typeof raw === 'string') return parseTextoDataDiaPrimeiro(raw) || parseCelulaDataISO(raw, mesReferencia);
    return parseCelulaDataISO(raw, mesReferencia);
  }

  const lerCol = (c: number): string => {
    if (sheet) {
      const addr = XLSX.utils.encode_cell({ r: sheetRow, c });
      const iso = parseCelulaDataISO(readDateImportCell(sheet[addr] as XlsxCell | undefined, mesReferencia), mesReferencia);
      if (iso) return iso;
    }
    return parseCelulaDataISO(row[c], mesReferencia);
  };

  const iso = lerCol(colIdx);
  if (iso) return iso;

  if (mesReferencia) {
    for (let c = 0; c < Math.min(row.length, 14); c++) {
      if (c === colIdx) continue;
      const alt = lerCol(c);
      if (alt && alt.slice(0, 7) === mesReferencia) return alt;
    }
  }
  return '';
};

/** Conta linhas com data legível na coluna 5 (layout hospital fixo 7 colunas). */
const contarDatasLayoutHospital = (
  aoa: unknown[][],
  sheet: XLSX.WorkSheet | undefined,
  sheetRowOffset: number,
  dataStartRow: number,
  maxRows = 35
): number => {
  const dataIdx = MAP_COLUNAS_HOSPITAL_7.data!;
  let n = 0;
  for (let r = dataStartRow; r < Math.min(dataStartRow + maxRows, aoa.length); r++) {
    const row = aoa[r] ?? [];
    if (!linhaPareceProntuario(row[0])) continue;
    const iso = lerDataIsoNaColuna(row, sheet, sheetRowOffset + r, dataIdx, undefined, { hospital: true });
    if (iso) n += 1;
  }
  return n;
};

const pontuarLinhaLayoutHospital = (
  row: unknown[],
  sheet?: XLSX.WorkSheet,
  sheetRow?: number,
  colMap: Record<string, number> = MAP_COLUNAS_HOSPITAL_7,
  mesReferencia?: string
): number => {
  let score = 0;
  if (linhaPareceProntuario(row[0])) score += 2;
  const pac = String(row[1] ?? '').trim();
  if (pac.length >= 4 && /[a-zA-ZÀ-ÿ]/.test(pac)) score += 2;
  const m1 = String(row[2] ?? '').trim();
  const m2 = String(row[3] ?? '').trim();
  if ((m1.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(m1)) || (m2.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(m2))) score += 1;
  const dataIdx = colMap.data ?? MAP_COLUNAS_HOSPITAL_7.data!;
  const dataIso =
    sheet && sheetRow !== undefined
      ? lerDataIsoNaColuna(row, sheet, sheetRow, dataIdx, mesReferencia, { hospital: true })
      : parseTextoDataDiaPrimeiro(String(row[dataIdx] ?? '')) ||
        parseCelulaDataISO(row[dataIdx], mesReferencia);
  if (dataIso) score += 3;
  const procIdx = colMap.nomeProcedimento ?? MAP_COLUNAS_HOSPITAL_7.nomeProcedimento!;
  const proc = String(row[procIdx] ?? '').trim();
  if (proc.length >= 12) score += 2;
  const honorIdx = colMap.honorariosTotalPar ?? MAP_COLUNAS_HOSPITAL_7.honorariosTotalPar!;
  const honor = parseBrlCelula(row[honorIdx]);
  if (Number.isFinite(honor) && honor >= 80) score += 2;
  return score;
};

type ColunasImportResolvido = {
  col: Record<string, number>;
  headerRow: number;
  dataStartRow: number;
  layoutHospital: boolean;
};

const resolverColunasImportacao = (
  aoa: unknown[][],
  sheet?: XLSX.WorkSheet,
  sheetRowOffset = 0,
  mesReferencia?: string
): ColunasImportResolvido => {
  let bestHospital: { score: number; start: number } | null = null;
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    if (linhaPareceCabecalhoTexto(aoa[r] ?? [])) continue;
    const pts = pontuarLinhaLayoutHospital(aoa[r] ?? [], sheet, sheetRowOffset + r, MAP_COLUNAS_HOSPITAL_7, mesReferencia);
    if (pts >= 9 && (!bestHospital || pts > bestHospital.score)) {
      bestHospital = { score: pts, start: r };
    }
  }
  if (bestHospital) {
    let headerRow = bestHospital.start;
    if (bestHospital.start > 0 && linhaPareceCabecalhoTexto(aoa[bestHospital.start - 1] ?? [])) {
      headerRow = bestHospital.start - 1;
    }
    const datasLidas = contarDatasLayoutHospital(aoa, sheet, sheetRowOffset, bestHospital.start);
    const colFixo = { ...MAP_COLUNAS_HOSPITAL_7 };
    if (datasLidas >= 2) {
      let confirm = 0;
      for (let j = bestHospital.start; j < Math.min(bestHospital.start + 6, aoa.length); j++) {
        if (pontuarLinhaLayoutHospital(aoa[j] ?? [], sheet, sheetRowOffset + j, colFixo, mesReferencia) >= 9)
          confirm += 1;
      }
      if (confirm >= 2) {
        return {
          col: colFixo,
          headerRow,
          dataStartRow: bestHospital.start,
          layoutHospital: true,
        };
      }
    }
    if (bestHospital.score >= 9 && linhaPareceProntuario((aoa[bestHospital.start] ?? [])[0])) {
      return {
        col: colFixo,
        headerRow: headerRow >= 0 ? headerRow : 0,
        dataStartRow: bestHospital.start,
        layoutHospital: true,
      };
    }
  }
  const headerRow = detectHeaderRowIndex(aoa);
  return {
    col: resolveLancImportColumns(aoa[headerRow] ?? []),
    headerRow,
    dataStartRow: headerRow + 1,
    layoutHospital: false,
  };
};

/** Pontua candidato a cabeçalho e valida se as linhas seguintes parecem dados reais. */
const scoreHeaderRowCandidate = (aoa: unknown[][], headerRow: number): number => {
  const headerCells = aoa[headerRow] ?? [];
  if (linhaPareceProntuario(headerCells[0])) return -1;
  const norms = headerCells.map((c) => stripHeaderKey(String(c ?? '')));
  if (!headerNormMatchesAny(norms, ['data', 'data da cirurgia', 'data cirurgia', 'data procedimento'])) {
    return -1;
  }
  const col = resolveLancImportColumns(headerCells);
  if (!importColunasObrigatoriasOk(col)) return -1;

  let score = 0;
  for (const def of LANC_IMPORT_COLS) {
    if (headerNormMatchesAny(norms, def.normKeys)) score += 1;
  }

  let dataHits = 0;
  for (let r = headerRow + 1; r < Math.min(headerRow + 12, aoa.length); r++) {
    const row = aoa[r] ?? [];
    const dataIso = parseCelulaDataISO(row[col.data!]);
    if (!dataIso) continue;
    const nomeProc = col.nomeProcedimento !== undefined ? String(row[col.nomeProcedimento] ?? '').trim() : '';
    const honor =
      col.honorariosTotalPar !== undefined ? String(row[col.honorariosTotalPar] ?? '').trim() : '';
    const ins = col.instrumento !== undefined ? String(row[col.instrumento] ?? '').trim() : '';
    if (nomeProc || honor || ins) dataHits += 1;
  }
  if (dataHits === 0) return -1;
  return score + dataHits * 4;
};

/** Linha de cabeçalho: melhor pontuação entre as primeiras linhas, com validação nas linhas de dados. */
const detectHeaderRowIndex = (aoa: unknown[][]): number => {
  const maxScan = Math.min(aoa.length, 40);
  let bestIdx = 0;
  let bestScore = -1;
  for (let r = 0; r < maxScan; r++) {
    const s = scoreHeaderRowCandidate(aoa, r);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = r;
    }
  }
  return bestScore >= 0 ? bestIdx : 0;
};

/** Corta filas após bloco sem paciente + data válidos (fim da tabela real). */
const trimAoaAfterDataBlock = (
  aoa: unknown[][],
  headerRow: number,
  col: Record<string, number>,
  sheet?: XLSX.WorkSheet,
  sheetRowOffset = 0,
  dataStartRow = headerRow + 1,
  mesReferencia?: string,
  layoutHospital = false
): unknown[][] => {
  const dataIdx = col.data;
  if (dataIdx === undefined) return aoa;
  let lastData = Math.max(dataStartRow - 1, headerRow);
  let emptyRun = 0;
  for (let r = dataStartRow; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const dataIso = lerDataIsoNaColuna(row, sheet, sheetRowOffset + r, dataIdx, mesReferencia, {
      hospital: layoutHospital,
    });
    const paciente = col.paciente !== undefined ? String(row[col.paciente] ?? '').trim() : '';
    const nome =
      col.nomeProcedimento !== undefined ? String(row[col.nomeProcedimento] ?? '').trim() : '';
    const substantive = !!(dataIso && paciente.length >= 3 && nome.length >= 8);
    if (substantive) {
      lastData = r;
      emptyRun = 0;
    } else {
      emptyRun += 1;
      if (emptyRun >= 3) return aoa.slice(0, lastData + 1);
    }
  }
  return aoa;
};

const resolveLancImportColumns = (headerRow: unknown[]): Record<string, number> => {
  const headers = headerRow.map((c, i) => ({ i, norm: stripHeaderKey(String(c ?? '')) }));
  const map: Record<string, number> = {};
  const used = new Set<number>();

  for (const col of LANC_IMPORT_COLS) {
    const hit = headers.find((h) => !used.has(h.i) && h.norm && col.normKeys.includes(h.norm));
    if (hit) {
      map[col.id] = hit.i;
      used.add(hit.i);
    }
  }
  for (const col of LANC_IMPORT_COLS) {
    if (map[col.id] !== undefined) continue;
    const hit = headers.find(
      (h) => !used.has(h.i) && h.norm && headerNormMatchesColumn(h.norm, col.normKeys)
    );
    if (hit) {
      map[col.id] = hit.i;
      used.add(hit.i);
    }
  }
  return map;
};

/** Escolhe a folha com tabela de lançamentos mais provável (não só a primeira). */
const pickImportWorksheet = (
  wb: XLSX.WorkBook
): { sheetName: string; sheet: XLSX.WorkSheet } | null => {
  let best: { sheetName: string; sheet: XLSX.WorkSheet; score: number } | null = null;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet?.['!ref']) continue;
    let aoa = readSheetToAoa(sheet);
    aoa = applySheetMergesToAoa(sheet, aoa);
    aoa = trimLeadingEmptyRows(aoa);
    aoa = trimAoaRemoveTrailingEmptyRows(aoa);
    if (!aoa.length) continue;
    const headerRow = detectHeaderRowIndex(aoa);
    const col = resolveLancImportColumns(aoa[headerRow] ?? []);
    if (!importColunasObrigatoriasOk(col)) continue;
    const headerScore = scoreHeaderRowCandidate(aoa, headerRow);
    if (headerScore < 0) continue;
    let dataRows = 0;
    for (let r = headerRow + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      if (parseCelulaDataISO(row[col.data!])) dataRows += 1;
    }
    const score = headerScore + dataRows;
    if (!best || score > best.score) best = { sheetName, sheet, score };
  }
  if (!best) return null;
  return { sheetName: best.sheetName, sheet: best.sheet };
};

const describeImportColumnMap = (headerRow: unknown[], col: Record<string, number>): string => {
  const labels: string[] = [];
  for (const def of LANC_IMPORT_COLS) {
    const idx = col[def.id];
    if (idx === undefined) continue;
    const raw = String(headerRow[idx] ?? '').trim() || `col. ${idx + 1}`;
    labels.push(`${def.id}←«${raw}»`);
  }
  return labels.join('; ');
};

/** Linha da planilha que não casou com a base TUSS — pode ser concluída na aba manual. */
type ImportLinhaAviso = {
  sheetLine: number;
  draft: LinhaProcedimento;
  mensagens: string[];
};

type ImportPreviewLanc = {
  linhas: LinhaProcedimento[];
  errors: string[];
  avisos: ImportLinhaAviso[];
};

/** Rascunho para preenchimento manual a partir de uma linha da importação com aviso. */
const montarRascunhoLinhaImport = (p: {
  dataIso: string;
  paciente: string;
  prontuario: string;
  nomeProc: string;
  instrumento: string;
  codigo1: string;
  codigo2: string;
  v1s: string;
  v2s: string;
  honorTotalStr: string;
  quemRepasse: RascunhoProfsT;
}): LinhaProcedimento => {
  const draft = linhaPendenteVazia();
  draft.dataProcedimento = p.dataIso;
  draft.nomePaciente = p.paciente;
  draft.prontuario = p.prontuario;
  draft.instrumento = p.instrumento;
  draft.codigo1 = p.codigo1;
  draft.codigo2 = p.codigo2;
  const np = p.nomeProc.trim();
  if (np) {
    const parts = np.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      draft.nome1 = parts[0];
      draft.nome2 = parts.slice(1).join(' / ');
    } else {
      draft.nome1 = np;
    }
  }
  if (p.honorTotalStr.trim() && parseBrl(p.honorTotalStr) > 0) {
    draft.valorPrimeiro = numBrl(parseBrl(p.honorTotalStr));
  } else {
    if (p.v1s.trim()) draft.valorPrimeiro = numBrl(parseBrl(p.v1s));
    if (p.v2s.trim()) draft.valorSegundo = numBrl(parseBrl(p.v2s));
  }
  draft.quemRepasse = { ...p.quemRepasse };
  return draft;
};

type AoaImportacaoPrep = {
  aoa: unknown[][];
  sheetRowOffset: number;
};

/**
 * Conteúdo colado a partir do Excel / Calc: colunas separadas por tab (TSV), linhas por newline.
 */
const parseTsvClipboardParaAoa = (text: string): unknown[][] => {
  const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = s.split('\n');
  const rows: unknown[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line === '' || line === undefined) && rows.length === 0) continue;
    const parts = line.split('\t');
    rows.push(parts.map((c) => String(c).replace(/\u00a0/g, ' ').trim()));
  }
  return rows;
};

/** Sem folha Excel: sem merges; só limpa linhas vazias no início/fim. */
const prepararAoaColagem = (raw: unknown[][]): AoaImportacaoPrep => {
  let aoa = trimLeadingEmptyRows(raw);
  aoa = trimAoaRemoveTrailingEmptyRows(aoa);
  return { aoa, sheetRowOffset: 0 };
};

const prepararAoaImportacao = (sheet: XLSX.WorkSheet, mesReferencia?: string): AoaImportacaoPrep => {
  const ref = sheet['!ref'];
  const rangeStart = ref ? XLSX.utils.decode_range(ref).s.r : 0;
  let aoa = readSheetToAoa(sheet);
  let leading = 0;
  while (leading < aoa.length) {
    const row = aoa[leading] ?? [];
    const has = row.some((c) => {
      if (c == null || c === '') return false;
      return String(c).trim() !== '';
    });
    if (has) break;
    leading++;
  }
  const sheetRowOffset = rangeStart + leading;
  aoa = aoa.slice(leading);
  const skipCols = new Set<number>();
  const probe = resolverColunasImportacao(aoa, sheet, sheetRowOffset, mesReferencia);
  if (probe.layoutHospital && probe.col.data !== undefined) {
    skipCols.add(probe.col.data);
  } else {
    const headerRow = detectHeaderRowIndex(aoa);
    const col = resolveLancImportColumns(aoa[headerRow] ?? []);
    if (col.data !== undefined) skipCols.add(col.data);
    else if (linhaPareceProntuario((aoa[0] ?? [])[0])) skipCols.add(MAP_COLUNAS_HOSPITAL_7.data!);
  }
  aoa = applySheetMergesToAoa(sheet, aoa, { skipCols, aoaRowOffset: sheetRowOffset });
  return { aoa: trimAoaRemoveTrailingEmptyRows(aoa), sheetRowOffset };
};

const cellStrImport = (row: unknown[], col: Record<string, number>, id: string): string => {
  const i = col[id];
  if (i === undefined) return '';
  const v = row[i];
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (id === 'valor1' || id === 'valor2' || id === 'honorariosTotalPar') return numBrl(v);
    if (id === 'prontuario' || id.endsWith('Crm')) {
      if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    }
    return String(v);
  }
  return String(v).trim();
};

/**
 * «Honorários médicos» na planilha hospitalar = valor total do par (1.º + 2.º).
 * Reparte na linha na proporção dos valores da base TUSS, para o total bater com a planilha e o repasse manter o peso 1/2.
 */
const repartirHonorariosTotalPorBase = (total: number, base: ProcedimentoBase): { v1: number; v2: number } => {
  const b1 = Number(base.valor1) || 0;
  const b2 = Number(base.valor2) || 0;
  const sumB = b1 + b2;
  const T = Number.isFinite(total) ? Math.max(0, total) : 0;
  if (sumB <= 1e-9) {
    return { v1: T, v2: 0 };
  }
  const cents = Math.round(T * 100);
  const c1 = Math.round((b1 / sumB) * cents);
  const c2 = cents - c1;
  return { v1: c1 / 100, v2: c2 / 100 };
};

const MODELO_LANC_HEADERS = [
  'Data',
  'Paciente',
  'Prontuario',
  'Procedimento',
  'Honorarios_medicos',
  'Valor_1',
  'Valor_2',
  'Medico_1_nome',
  'Medico_1_crm',
  'Medico_2_nome',
  'Medico_2_crm',
] as const;

const parsePlanilhaLancamentos = (
  aoa: unknown[][],
  sheet?: XLSX.WorkSheet,
  sheetRowOffset = 0,
  mesReferencia?: string
): {
  linhas: LinhaProcedimento[];
  errors: string[];
  avisos: ImportLinhaAviso[];
  headerRow: number;
  layoutHospital: boolean;
} => {
  const errors: string[] = [];
  const avisos: ImportLinhaAviso[] = [];
  if (!aoa?.length) {
    errors.push('Planilha vazia.');
    return { linhas: [], errors, avisos, headerRow: 0, layoutHospital: false };
  }
  const resolved = resolverColunasImportacao(aoa, sheet, sheetRowOffset, mesReferencia);
  const { col, headerRow, dataStartRow, layoutHospital } = resolved;
  if (!layoutHospital && headerRow > 0) {
    errors.push(`Cabeçalho detectado na linha ${headerRow + 1} da folha (não na primeira linha).`);
  }
  if (col.data === undefined) {
    errors.push('Falta coluna «Data» (ou equivalente) no cabeçalho.');
  }
  const temTriploCab =
    col.instrumento !== undefined && col.codigo1 !== undefined && col.codigo2 !== undefined;
  const temNomeProcCab = col.nomeProcedimento !== undefined;
  const temHonorCab = col.honorariosTotalPar !== undefined;
  if (!temTriploCab && !temNomeProcCab && !temHonorCab) {
    errors.push(
      'Falta identificar o procedimento: coluna «Cirurgia»/«Procedimento», ou Ins.+Cód. 1+2, ou coluna com o total de honorários (soma TUSS 1.+2. do par, única na base).'
    );
  }
  if (col.data === undefined || (!temTriploCab && !temNomeProcCab && !temHonorCab)) {
    return { linhas: [], errors, avisos, headerRow, layoutHospital };
  }

  const aoaData = trimAoaAfterDataBlock(
    aoa,
    Math.max(headerRow, 0),
    col,
    sheet,
    sheetRowOffset,
    dataStartRow,
    mesReferencia,
    layoutHospital
  );
  const linhas: LinhaProcedimento[] = [];
  let ignoradasSemData = 0;
  let ignoradasOutroMes = 0;
  const mesesEncontrados = new Set<string>();
  for (let r = dataStartRow; r < aoaData.length; r++) {
    const row = aoaData[r] ?? [];
    if (layoutHospital && !linhaPareceProntuario(row[col.prontuario ?? 0])) continue;

    const dataIso =
      col.data !== undefined
        ? lerDataIsoNaColuna(row, sheet, sheetRowOffset + r, col.data, mesReferencia, {
            hospital: layoutHospital,
          })
        : '';
    const paciente = cellStrImport(row, col, 'paciente');
    const prontuario = cellStrImport(row, col, 'prontuario');
    const nomeProc = cellStrImport(row, col, 'nomeProcedimento');
    const instrumento = cellStrImport(row, col, 'instrumento');
    const codigo1 = cellStrImport(row, col, 'codigo1');
    const codigo2 = cellStrImport(row, col, 'codigo2');
    const v1s = cellStrImport(row, col, 'valor1');
    const v2s = cellStrImport(row, col, 'valor2');
    let honorTotalStr = cellStrImport(row, col, 'honorariosTotalPar');
    if (!honorTotalStr.trim() && nomeProc.includes('/') && !v2s.trim()) {
      const v1Try = v1s.trim();
      if (v1Try && parseBrl(v1Try) > 0) honorTotalStr = v1Try;
    }
    const honorT0Raw = honorTotalStr.trim() === '' ? NaN : parseBrl(honorTotalStr);
    const temHonorParaId = Number.isFinite(honorT0Raw) && honorT0Raw > 0;
    const m1n = cellStrImport(row, col, 'med1Nome');
    const m1c = cellStrImport(row, col, 'med1Crm');
    const m2n = cellStrImport(row, col, 'med2Nome');
    const m2c = cellStrImport(row, col, 'med2Crm');

    const nomeProcKey = stripHeaderKey(nomeProc);
    if (nomeProcKey && NOME_PROC_IMPORT_IGNORAR.has(nomeProcKey)) continue;

    const rawDataCel = row[col.data!];
    if (typeof rawDataCel === 'string') {
      const dk = stripHeaderKey(rawDataCel);
      if (dk === 'data' || dk === 'data da cirurgia' || dk === 'data cirurgia') continue;
    }

    if (!instrumento && !codigo1 && !codigo2 && !dataIso && !paciente && !prontuario && !nomeProc && !temHonorParaId) {
      continue;
    }

    const linhaN = r + 1;
    if (!paciente.trim() || paciente.trim().length < 3) continue;
    if (!dataIso) {
      if (nomeProc.trim() || prontuario) ignoradasSemData += 1;
      continue;
    }
    if (mesReferencia && dataIso.slice(0, 7) !== mesReferencia) {
      ignoradasOutroMes += 1;
      mesesEncontrados.add(dataIso.slice(0, 7));
      continue;
    }

    let rowOk = true;
    const errosLinha: string[] = [];
    const pushErroLinha = (msg: string) => {
      errosLinha.push(msg);
      rowOk = false;
    };

    const temTriploCompleto = !!(instrumento && codigo1 && codigo2);
    const temTriploParcial = !!(instrumento || codigo1 || codigo2) && !temTriploCompleto;
    if (temTriploParcial) {
      pushErroLinha(
        'preencha Ins., Cód. 1 e Cód. 2 em conjunto, ou use a coluna «Procedimento» / «Cirurgia» (nome do 1.º na base).'
      );
    }
    if (!temTriploCompleto && !nomeProc.trim()) {
      pushErroLinha('coluna «Cirurgia»/«Procedimento» em falta.');
    }
    if (!temTriploCompleto && !nomeProc.trim() && !temHonorParaId) {
      rowOk = false;
    }

    let base: ProcedimentoBase | undefined;
    if (temTriploCompleto) {
      base = findProcedimentoBaseImport(instrumento, codigo1, codigo2);
      if (!base) {
        pushErroLinha(`procedimento não encontrado na base (${instrumento} | ${codigo1} | ${codigo2}).`);
      }
    } else if (nomeProc) {
      const honorDisamb = temHonorParaId ? honorT0Raw : undefined;
      const hit = findProcedimentoBasePorNomeProcedimento(nomeProc, honorDisamb);
      if (!('err' in hit)) {
        base = hit.ok;
      } else if (temHonorParaId) {
        const sumHit = findProcedimentoBasePorSomaValoresUnica(honorT0Raw);
        if (!('err' in sumHit)) {
          base = sumHit.ok;
        } else if (hit.err === 'ambiguous') {
          pushErroLinha(
            `várias hipóteses na base para «${nomeProc}» e o total ${honorTotalStr} não coincide com a soma TUSS de um único par. Use Ins.+Cód. 1+2 ou ajuste o texto/total.`
          );
        } else {
          pushErroLinha(
            `não foi possível casar «${nomeProc}» com a base (TUSS usa abreviações, ex.: TRAT.) nem encontrar par com soma = ${honorTotalStr}. Verifique Cirurgia e honorários.`
          );
        }
      } else {
        if (hit.err === 'ambiguous') {
          pushErroLinha(
            `várias hipóteses na base para «${nomeProc}». Use Ins.+Cód. 1+2, o total de honorários (soma TUSS única) ou um texto mais próximo do TUSS (ex.: TRAT. em vez de TRATAMENTO).`
          );
        } else {
          pushErroLinha(
            `não foi possível casar «${nomeProc}» com a base. Experimente o total de honorários (soma 1.+2.) se for único na base, ou Ins.+Cód. 1+2.`
          );
        }
      }
    } else if (temHonorParaId && nomeProc.trim()) {
      const sumHit = findProcedimentoBasePorSomaValoresUnica(honorT0Raw);
      if (!('err' in sumHit)) {
        base = sumHit.ok;
      } else {
        if (sumHit.err === 'ambiguous') {
          pushErroLinha(
            `vários pares na base têm soma TUSS (1.+2.) igual a ${honorTotalStr}. Acrescente «Cirurgia»/códigos para desambiguar.`
          );
        } else {
          pushErroLinha(
            `nenhum par na base com soma TUSS (1.+2.) igual a ${honorTotalStr} (tolerância ±R$0,02).`
          );
        }
      }
    }

    const incl1 = !!(m1n || m1c);
    const incl2 = !!(m2n || m2c);
    if (!incl1 && !incl2) {
      pushErroLinha('indique médico 1 e/ou 2 (nome ou CRM).');
    }
    const quemRepasse: RascunhoProfsT = {
      incluirProfissional1: incl1,
      incluirProfissional2: incl2,
      profissional1Nome: m1n,
      profissional1Crm: m1c,
      profissional2Nome: m2n,
      profissional2Crm: m2c,
    };
    if (!lancarRepassePermitido(quemRepasse)) {
      pushErroLinha('para cada médico indicado preencha nome e/ou CRM (como no formulário manual).');
    }

    if (!rowOk || !base || !dataIso) {
      for (const msg of errosLinha) {
        errors.push(`Linha ${linhaN}: ${msg}`);
      }
      if (!rowOk && dataIso && paciente.trim().length >= 3 && errosLinha.length > 0) {
        avisos.push({
          sheetLine: linhaN,
          draft: montarRascunhoLinhaImport({
            dataIso,
            paciente,
            prontuario,
            nomeProc,
            instrumento,
            codigo1,
            codigo2,
            v1s,
            v2s,
            honorTotalStr,
            quemRepasse,
          }),
          mensagens: errosLinha,
        });
      }
      continue;
    }

    // Texto Cirurgia/Procedimento identifica o registo na base (em geral o 1.º); o par 1.º+2.º completo vem de `fromBase`.
    const linha: LinhaProcedimento = {
      ...fromBase(base),
      dataProcedimento: dataIso,
      nomePaciente: paciente,
      prontuario,
      quemRepasse,
    };
    if (honorTotalStr) {
      const T = parseBrl(honorTotalStr);
      const { v1, v2 } = repartirHonorariosTotalPorBase(T, base);
      linha.valorPrimeiro = numBrl(v1);
      linha.valorSegundo = numBrl(v2);
    } else {
      if (v1s) linha.valorPrimeiro = numBrl(parseBrl(v1s));
      if (v2s) linha.valorSegundo = numBrl(parseBrl(v2s));
    }
    linhas.push(linha);
  }

  if (linhas.length === 0) {
    if (ignoradasSemData > 0) {
      errors.push(
        `${ignoradasSemData} linha(s) com paciente/cirurgia mas sem data legível na coluna ${(col.data ?? 0) + 1}. Confira se a coluna Data no Excel está preenchida (dd/mm/aaaa) ou como data de calendário (não só texto).`
      );
    }
    if (ignoradasOutroMes > 0) {
      const lista = [...mesesEncontrados].sort().join(', ') || '—';
      errors.push(
        `${ignoradasOutroMes} linha(s) com data fora do mês ${mesReferencia ?? 'selecionado'} (encontrado: ${lista}). Ajuste o mês no topo ou as datas na planilha.`
      );
    }
    const colInfo = layoutHospital
      ? 'Layout hospital (fixo): col.1 prontuário, 2 paciente, 3–4 médicos, 5 data, 6 cirurgia, 7 valor.'
      : col.data !== undefined
        ? `Coluna Data detectada: ${col.data + 1}.`
        : 'Coluna Data não detectada.';
    errors.push(colInfo);
    if (ignoradasSemData === 0 && ignoradasOutroMes === 0) {
      errors.push(
        'Nenhuma linha com paciente (≥3 caracteres), data e cirurgia/honorários. Verifique se a primeira linha de dados não é cabeçalho e se o mês no topo coincide com as datas.'
      );
    }
  }

  return { linhas, errors, avisos, headerRow, layoutHospital };
};

const LAYOUT_NOTA_IMPORT_HOSPITAL =
  'Formato da planilha: prontuário, paciente, médicos, data, cirurgia e valor total.';

const estadoUIMaposParseImportacao = (
  linhas: LinhaProcedimento[],
  errors: string[],
  avisos: ImportLinhaAviso[],
  layoutHospital: boolean,
  colMap: string,
  mesChave: string
): { preview: ImportPreviewLanc | null; msg: { tipo: 'ok' | 'aviso' | 'erro'; texto: string } } => {
  const layoutNota = layoutHospital ? LAYOUT_NOTA_IMPORT_HOSPITAL : '';
  if (linhas.length === 0) {
    const baseErro =
      errors.length > 0
        ? errors.slice(0, 25).join('\n') + (errors.length > 25 ? '\n…' : '')
        : `Nenhuma linha válida para o mês ${mesChave}. Confirme o mês no topo da página e se a coluna Data está preenchida (ex.: 02/03/2026).`;
    return {
      preview: null,
      msg: { tipo: 'erro', texto: layoutNota ? `${layoutNota}\n\n${baseErro}` : baseErro },
    };
  }
  const errosReais = errors.filter((e) => !e.startsWith('Layout hospital'));
  const errosGlobais = errosReais.filter((e) => !/^Linha \d+:/.test(e));
  return {
    preview: { linhas, errors, avisos },
    msg: errosReais.length
      ? {
          tipo: 'aviso',
          texto: avisos.length
            ? `${linhas.length} lançamento(s) reconhecido(s). ${avisos.length} linha(s) da planilha precisam de preenchimento manual — use os botões abaixo.${errosGlobais.length ? `\n\n${errosGlobais.join('\n')}` : ''}`
            : `${linhas.length} lançamento(s) reconhecido(s). Revise a pré-visualização — ${errosReais.length} aviso(s):\n${errosReais.slice(0, 12).join('\n')}${errosReais.length > 12 ? '\n…' : ''}`,
        }
      : {
          tipo: 'ok',
          texto: `${linhas.length} lançamento(s) pronto(s) para ${mesChave}. Confirme para gravar.${layoutNota ? `\n\n${layoutNota}` : ''}${colMap && !layoutHospital ? `\n\nColunas: ${colMap}` : ''}`,
        },
  };
};

const loadStore = (): Record<string, DadosMes> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, DadosMes>;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
};

const saveStore = (d: Record<string, DadosMes>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
};

const migrarProcedimentos = (raw: unknown): LinhaProcedimento[] => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return (raw as Record<string, unknown>[]).map((p) => {
    if (p && typeof p === 'object' && 'codigo1' in p) {
      return p as unknown as LinhaProcedimento;
    }
    const o = p as { id: string; nome: string; valorPrimeiro: string; valorSegundo: string };
    return {
      id: o.id || criarId(),
      refBaseId: null,
      dataProcedimento: '',
      nomePaciente: '',
      prontuario: '',
      instrumento: '',
      codigo1: '',
      nome1: o.nome ?? '',
      valorPrimeiro: o.valorPrimeiro ?? '',
      codigo2: '',
      nome2: '',
      valorSegundo: o.valorSegundo ?? '',
    };
  });
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const quemRepasseEfetivo = (l: LinhaProcedimento, mes: DadosMes): RascunhoProfsT => l.quemRepasse ?? pickRascunhoProfs(mes);

/** Repasse da linha = (100% − margem coop.) × bruto; margem = bruto − repasse. Divisão 1.º/2.º com o mesmo peso relativo de antes (2.º = % do 1.º). */
const repassePorLinhaMargemFixa = (bruto: number, r2F: number, q: RascunhoProfsT) => {
  const repasseLinha = round2(bruto * REPASSE_FRAC_LINHA);
  const margemLinha = round2(bruto - repasseLinha);
  const p1 = q.incluirProfissional1;
  const p2 = q.incluirProfissional2;
  let r1 = 0;
  let r2 = 0;
  if (p1 && p2) {
    r1 = round2(repasseLinha / (1 + r2F));
    r2 = round2(repasseLinha - r1);
  } else if (p1) {
    r1 = repasseLinha;
  } else if (p2) {
    r2 = repasseLinha;
  }
  return { margemLinha, repasseLinha, r1, r2 };
};

const lancarRepassePermitido = (q: RascunhoProfsT): boolean => {
  if (!q.incluirProfissional1 && !q.incluirProfissional2) return false;
  if (q.incluirProfissional1 && !rotuloQuem(q.profissional1Nome, q.profissional1Crm)) return false;
  if (q.incluirProfissional2 && !rotuloQuem(q.profissional2Nome, q.profissional2Crm)) return false;
  return true;
};

const rascunhoNomesVazios = (inc: { incluirProfissional1: boolean; incluirProfissional2: boolean }): RascunhoProfsT => ({
  profissional1Nome: '',
  profissional1Crm: '',
  profissional2Nome: '',
  profissional2Crm: '',
  incluirProfissional1: inc.incluirProfissional1,
  incluirProfissional2: inc.incluirProfissional2,
});

/** Só no carregamento do mês: linhas antigas (sem `quemRepasse`) herdam a identificação geral UMA VEZ, não a cada lançamento. */
const enriquecerLinhasComQuemRepasseAusente = (d: DadosMes): { dados: DadosMes; mudou: boolean } => {
  let mudou = false;
  const procedimentos = d.procedimentos.map((p) => {
    if (p.quemRepasse != null) return p;
    mudou = true;
    return { ...p, quemRepasse: pickRascunhoProfs(d) };
  });
  if (!mudou) return { dados: d, mudou: false };
  return { dados: { ...d, procedimentos }, mudou: true };
};

const RelatoriosProcedimentos = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesMM, setMesMM] = useState(() => String(hoje.getMonth() + 1).padStart(2, '0'));
  const mesChave = `${ano}-${mesMM}`;

  const [store, setStore] = useState<Record<string, DadosMes>>(() =>
    typeof window === 'undefined' ? {} : loadStore()
  );
  const [local, setLocal] = useState<DadosMes>(() => defaultDadosMes());
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);

  const [busca, setBusca] = useState('');
  const [abrirSugestoes, setAbrirSugestoes] = useState(false);
  const boxBuscaRef = useRef<HTMLDivElement | null>(null);

  const [modalParams, setModalParams] = useState(false);
  const [modalBaseProcedimentos, setModalBaseProcedimentos] = useState(false);
  const [rascunho, setRascunho] = useState<DadosMes>(() => defaultDadosMes());
  const [rascunhoProfs, setRascunhoProfs] = useState<RascunhoProfsT>(() => pickRascunhoProfs(defaultDadosMes()));
  const [linhaPendente, setLinhaPendente] = useState<LinhaProcedimento | null>(null);
  const [medBusca1, setMedBusca1] = useState('');
  const [medAbrir1, setMedAbrir1] = useState(false);
  const [medBusca2, setMedBusca2] = useState('');
  const [medAbrir2, setMedAbrir2] = useState(false);
  const boxMed1Ref = useRef<HTMLDivElement | null>(null);
  const boxMed2Ref = useRef<HTMLDivElement | null>(null);

  const [colsLanc, setColsLanc] = useState<Record<ColLancKey, boolean>>(() =>
    typeof window === 'undefined' ? defaultColsLanc() : loadColsLanc()
  );
  const [colsResumo, setColsResumo] = useState<Record<ColResumoKey, boolean>>({
    medico: true,
    repasse: true,
    recebe: true,
  });
  const [modoVisualLanc, setModoVisualLanc] = useState<'detalhado' | 'resumo' | 'pacientes'>('detalhado');
  const [modoEntradaLanc, setModoEntradaLanc] = useState<'upload' | 'manual'>('upload');
  const [importMsg, setImportMsg] = useState<{ tipo: 'ok' | 'aviso' | 'erro'; texto: string } | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewLanc | null>(null);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importDragActive, setImportDragActive] = useState(false);
  const xlsxImportRef = useRef<HTMLInputElement>(null);
  const importPasteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(COLS_LANC_KEY, JSON.stringify(colsLanc));
    } catch {
      /* ignore */
    }
  }, [colsLanc]);

  const fetchCorpoClinicoCompleto = useCallback(async (): Promise<AdminMedico[]> => {
    const limit = 2000;
    const all: AdminMedico[] = [];
    let page = 1;
    for (;;) {
      const res = await adminService.listMedicos({ page, limit, ativo: true });
      if (Array.isArray(res.data)) {
        for (const m of res.data) {
          if (m.ativo) all.push(m);
        }
      }
      const totalPages = res.pagination?.totalPages ?? 1;
      if (page >= totalPages) break;
      page += 1;
    }
    all.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR', { sensitivity: 'base' }));
    return all;
  }, []);

  const { data: medicosLista = [], isError: errMedicos, isLoading: carregandoMedicos } = useQuery({
    queryKey: ['admin', 'medicos', 'relatorio-procedimentos', 'all'],
    queryFn: fetchCorpoClinicoCompleto,
    enabled: isMaster,
    staleTime: 60_000,
  });

  const {
    data: remotoMesResp,
  } = useQuery({
    queryKey: ['admin', 'relatorio-procedimentos', 'mes', mesChave],
    queryFn: () => adminService.getRelatorioProcedimentosMes(mesChave),
    enabled: isMaster,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxBuscaRef.current && !boxBuscaRef.current.contains(t)) setAbrirSugestoes(false);
      if (boxMed1Ref.current && !boxMed1Ref.current.contains(t)) setMedAbrir1(false);
      if (boxMed2Ref.current && !boxMed2Ref.current.contains(t)) setMedAbrir2(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const all = loadStore();
    setStore(all);
    const s = all[mesChave];
    if (s) {
      const n = normalizarDadosMes({
        ...s,
        procedimentos: migrarProcedimentos(s.procedimentos),
      });
      const { dados, mudou } = enriquecerLinhasComQuemRepasseAusente(n);
      setLocal(dados);
      setRascunhoProfs(pickRascunhoProfs(dados));
      if (mudou) {
        const grava = { ...all, [mesChave]: dados };
        saveStore(grava);
        setStore(grava);
      }
    } else {
      const d0 = defaultDadosMes();
      setLocal(d0);
      setRascunhoProfs(pickRascunhoProfs(d0));
    }
    setBusca('');
    setLinhaPendente(null);
    setModoEntradaLanc('upload');
    setImportMsg(null);
    setImportPreview(null);
    setImportProcessing(false);
    setImportDragActive(false);
    if (xlsxImportRef.current) xlsxImportRef.current.value = '';
    if (importPasteRef.current) importPasteRef.current.value = '';
  }, [mesChave]);

  // Backend é a fonte de verdade (entre PCs). Se houver dados remotos para o mês, rehidrata o estado local.
  useEffect(() => {
    if (!isMaster) return;
    const resp = remotoMesResp;
    if (!resp || resp.success === false) return;
    if (!resp.data || typeof resp.data !== 'object') return;
    const remotoRaw = resp.data as unknown as DadosMes;
    const remotoNorm = normalizarDadosMes({
      ...remotoRaw,
      procedimentos: migrarProcedimentos((remotoRaw as any).procedimentos),
    });
    const { dados } = enriquecerLinhasComQuemRepasseAusente(remotoNorm);
    setLocal(dados);
    setRascunhoProfs(pickRascunhoProfs(dados));
    setStore((prev) => {
      const next = { ...prev, [mesChave]: dados };
      saveStore(next);
      return next;
    });
  }, [isMaster, remotoMesResp, mesChave]);

  const persist = useCallback(
    (a: DadosMes) => {
      const norm = normalizarDadosMes(a);
      setLocal(norm);
      setStore((prev) => {
        const n = { ...prev, [mesChave]: norm };
        saveStore(n);
        return n;
      });
    },
    [mesChave]
  );

  const baixarModeloLancamentosXlsx = useCallback(() => {
    const exemploComProcedimento = [
      '2026-01-15',
      'Maria Silva',
      '12345',
      'OSTECTOMIA DA CLAVÍCULA OU DA ESCÁPULA',
      '',
      '1201,89',
      '360,57',
      'Nome do médico',
      '12345/CE',
      'Outro médico',
      '67890/CE',
    ];
    const exemploSoTotal = [
      '2026-01-16',
      'José Santos',
      '99999',
      '',
      '801,19',
      '',
      '',
      'Nome do médico',
      '12345/CE',
      'Auxiliar',
      '67890/CE',
    ];
    const ws = XLSX.utils.aoa_to_sheet([
      Array.from(MODELO_LANC_HEADERS),
      exemploComProcedimento,
      exemploSoTotal,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos');
    XLSX.writeFile(wb, 'modelo-lancamentos-procedimentos.xlsx');
  }, []);

  const processarFicheiroLancamentosXlsx = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        setImportPreview(null);
        setImportMsg({ tipo: 'erro', texto: 'Use um ficheiro Excel (.xlsx ou .xls).' });
        return;
      }
      const L = localRef.current;
      if (L.concluido) {
        setImportPreview(null);
        setImportMsg({ tipo: 'erro', texto: 'Mês fechado. Reabra o mês antes de importar.' });
        return;
      }
      setImportMsg(null);
      setImportPreview(null);
      setImportProcessing(true);

      const runParse = (buf: string | ArrayBuffer | null | undefined) => {
        try {
          if (!(buf instanceof ArrayBuffer)) {
            setImportPreview(null);
            setImportMsg({ tipo: 'erro', texto: 'Não foi possível ler o ficheiro.' });
            return;
          }
          // cellDates:false → datas como serial numérico (correto em qualquer locale do Excel)
          const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, cellNF: true });
          const picked = pickImportWorksheet(wb);
          if (!picked) {
            setImportPreview(null);
            setImportMsg({
              tipo: 'erro',
              texto:
                'Não foi possível identificar uma folha com Data e Cirurgia/Procedimento (ou honorários totais). Verifique o cabeçalho.',
            });
            return;
          }
          const { aoa, sheetRowOffset } = prepararAoaImportacao(picked.sheet, mesChave);
          const headerRow = detectHeaderRowIndex(aoa);
          const colMap = describeImportColumnMap(
            aoa[headerRow] ?? [],
            resolveLancImportColumns(aoa[headerRow] ?? [])
          );
          const { linhas, errors, avisos, layoutHospital } = parsePlanilhaLancamentos(
            aoa,
            picked.sheet,
            sheetRowOffset,
            mesChave
          );
          const ui = estadoUIMaposParseImportacao(linhas, errors, avisos, layoutHospital, colMap, mesChave);
          setImportPreview(ui.preview);
          setImportMsg(ui.msg);
        } catch (e) {
          setImportPreview(null);
          setImportMsg({
            tipo: 'erro',
            texto: e instanceof Error ? e.message : 'Erro ao processar a planilha.',
          });
        } finally {
          setImportProcessing(false);
        }
      };

      const reader = new FileReader();
      reader.onload = (ev) => {
        const buf = ev.target?.result;
        // Dois frames livres para pintar o indicador antes do trabalho síncrono (SheetJS).
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => runParse(buf)));
      };
      reader.onerror = () => {
        setImportPreview(null);
        setImportProcessing(false);
        setImportMsg({ tipo: 'erro', texto: 'Falha ao ler o ficheiro.' });
      };
      reader.readAsArrayBuffer(file);
    },
    [mesChave]
  );

  const processarTextoColadoLancamentos = useCallback(() => {
    const L = localRef.current;
    if (L.concluido) {
      setImportPreview(null);
      setImportMsg({ tipo: 'erro', texto: 'Mês fechado. Reabra o mês antes de importar.' });
      return;
    }
    const text = importPasteRef.current?.value?.trim() ?? '';
    if (!text) {
      setImportMsg({
        tipo: 'erro',
        texto: 'Cole na caixa abaixo as células copiadas do Excel (Ctrl+V) e carregue em «Processar texto colado».',
      });
      return;
    }
    setImportMsg(null);
    setImportPreview(null);
    setImportProcessing(true);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        try {
          const raw = parseTsvClipboardParaAoa(text);
          if (!raw.length) {
            setImportPreview(null);
            setImportMsg({
              tipo: 'erro',
              texto: 'Não foi possível ler linhas no texto colado. Copie diretamente do Excel (as células ficam separadas por tab).',
            });
            return;
          }
          const temVariasColunas = raw.some((r) => (r?.length ?? 0) > 1);
          if (!temVariasColunas) {
            setImportPreview(null);
            setImportMsg({
              tipo: 'erro',
              texto:
                'O texto colado tem uma só coluna. Selecione na planilha todas as colunas necessárias (prontuário até valor) e copie de novo.',
            });
            return;
          }
          const { aoa } = prepararAoaColagem(raw);
          const headerRow = detectHeaderRowIndex(aoa);
          const colMap = describeImportColumnMap(
            aoa[headerRow] ?? [],
            resolveLancImportColumns(aoa[headerRow] ?? [])
          );
          const { linhas, errors, avisos, layoutHospital } = parsePlanilhaLancamentos(aoa, undefined, 0, mesChave);
          const ui = estadoUIMaposParseImportacao(linhas, errors, avisos, layoutHospital, colMap, mesChave);
          setImportPreview(ui.preview);
          setImportMsg(ui.msg);
        } catch (e) {
          setImportPreview(null);
          setImportMsg({
            tipo: 'erro',
            texto: e instanceof Error ? e.message : 'Erro ao processar o texto colado.',
          });
        } finally {
          setImportProcessing(false);
        }
      })
    );
  }, [mesChave]);

  const cancelarImportacaoPreview = useCallback(() => {
    setImportPreview(null);
    setImportMsg(null);
    setImportProcessing(false);
    if (importPasteRef.current) importPasteRef.current.value = '';
  }, []);

  const confirmarImportacaoLancamentos = useCallback(() => {
    const prev = importPreview;
    if (!prev?.linhas.length) return;
    const L = localRef.current;
    if (L.concluido) {
      setImportMsg({ tipo: 'erro', texto: 'Mês fechado. Reabra o mês antes de importar.' });
      return;
    }
    persist({
      ...L,
      procedimentos: [...L.procedimentos, ...prev.linhas],
    });
    const n = prev.linhas.length;
    setImportPreview(null);
    setImportMsg({
      tipo: 'ok',
      texto: `${n} lançamento(s) importado(s) no mês.${prev.errors.length ? `\n\nAvisos da importação:\n${prev.errors.slice(0, 15).join('\n')}` : ''}`,
    });
    if (xlsxImportRef.current) xlsxImportRef.current.value = '';
    if (importPasteRef.current) importPasteRef.current.value = '';
    requestAnimationFrame(() => {
      document.getElementById('secao-lancamentos-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [importPreview, persist]);

  const abrirParametros = () => {
    setRascunho(normalizarDadosMes({ ...local, ...rascunhoProfs }));
    setModalParams(true);
  };
  const salvarParametros = () => {
    const salvo = normalizarDadosMes(rascunho);
    persist(salvo);
    setRascunhoProfs(pickRascunhoProfs(salvo));
    setModalParams(false);
  };
  const cancelarParametros = () => setModalParams(false);

  useEffect(() => {
    if (!modalParams) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalParams(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [modalParams]);

  useEffect(() => {
    if (!modalBaseProcedimentos) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalBaseProcedimentos(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [modalBaseProcedimentos]);

  const sugestoes = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (q.length < 2) return [];
    return procedimentosBase
      .filter(
        (b) =>
          chaveDeBase(b).toLowerCase().includes(q) ||
          b.instrumento.toLowerCase().includes(q) ||
          b.nome1.toLowerCase().includes(q) ||
          b.codigo1.toLowerCase().includes(q) ||
          b.nome2.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [busca]);

  const sugestoesMedicos1 = useMemo(() => {
    const t = medBusca1.toLowerCase().trim();
    if (t.length === 0) return medicosLista;
    return medicosLista.filter(
      (m) =>
        m.nomeCompleto.toLowerCase().includes(t) || (m.crm != null && m.crm.toLowerCase().includes(t))
    );
  }, [medBusca1, medicosLista]);
  const sugestoesMedicos2 = useMemo(() => {
    const t = medBusca2.toLowerCase().trim();
    if (t.length === 0) return medicosLista;
    return medicosLista.filter(
      (m) =>
        m.nomeCompleto.toLowerCase().includes(t) || (m.crm != null && m.crm.toLowerCase().includes(t))
    );
  }, [medBusca2, medicosLista]);

  const linhasTotais = useMemo(
    () =>
      [...local.procedimentos]
        .sort((a, b) => {
          const da = (a.dataProcedimento || '').trim();
          const db = (b.dataProcedimento || '').trim();
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        })
        .map((l) => {
          const p1 = parseBrl(l.valorPrimeiro);
          const p2 = parseBrl(l.valorSegundo);
          const bruto = p1 + p2;
          return { ...l, p1, p2, bruto: round2(bruto) };
        }),
    [local.procedimentos]
  );

  const valorBruto = useMemo(
    () => round2(linhasTotais.reduce((a, b) => a + b.bruto, 0)),
    [linhasTotais]
  );

  const r2Pct = useMemo(
    () => parsePercent(local.repasse2MedPct, defaultRepasse2MedPct) / 100,
    [local.repasse2MedPct]
  );

  const { margemRetidaTotal, repasse1, repasse2, repasseTotal } = useMemo(() => {
    if (linhasTotais.length === 0) {
      return {
        margemRetidaTotal: 0,
        repasse1: 0,
        repasse2: 0,
        repasseTotal: 0,
      };
    }
    let sMargem = 0;
    let sR1 = 0;
    let sR2 = 0;
    for (const l of linhasTotais) {
      const q = quemRepasseEfetivo(l, local);
      const r = repassePorLinhaMargemFixa(l.bruto, r2Pct, q);
      sMargem += r.margemLinha;
      sR1 += r.r1;
      sR2 += r.r2;
    }
    const r1a = round2(sR1);
    const r2a = round2(sR2);
    const rTot = round2(r1a + r2a);
    const m = round2(sMargem);
    return {
      margemRetidaTotal: m,
      repasse1: r1a,
      repasse2: r2a,
      repasseTotal: rTot,
    };
  }, [linhasTotais, local, r2Pct]);

  const resumoMedicos = useMemo(() => {
    const mapa = new Map<
      string,
      { medico: string; cobranca: number; recebe: number; repasses: Set<string> }
    >();

    const add = (medico: string, cobranca: number, recebe: number, repasse: string) => {
      const atual = mapa.get(medico);
      if (!atual) {
        mapa.set(medico, {
          medico,
          cobranca,
          recebe,
          repasses: new Set([repasse]),
        });
        return;
      }
      atual.cobranca += cobranca;
      atual.recebe += recebe;
      atual.repasses.add(repasse);
    };

    for (const l of linhasTotais) {
      const q = quemRepasseEfetivo(l, local);
      const r = repassePorLinhaMargemFixa(l.bruto, r2Pct, q);

      if (q.incluirProfissional1) {
        const m1 = rotuloQuem(q.profissional1Nome, q.profissional1Crm);
        if (m1) add(m1, l.bruto, r.r1, '100%');
      }
      if (q.incluirProfissional2) {
        const m2 = rotuloQuem(q.profissional2Nome, q.profissional2Crm);
        if (m2) add(m2, l.bruto, r.r2, `${PCT.format(r2Pct * 100)}%`);
      }
    }

    return Array.from(mapa.values())
      .map((r) => ({
        ...r,
        cobranca: round2(r.cobranca),
        recebe: round2(r.recebe),
        repasseTxt: Array.from(r.repasses).sort().join(' + '),
      }))
      .sort((a, b) => a.medico.localeCompare(b.medico, 'pt-BR', { sensitivity: 'base' }));
  }, [linhasTotais, local, r2Pct]);

  const tabelaPacientes = useMemo(() => {
    const fmtData = (iso: string) => {
      if (!iso) return '—';
      const [y, m, d] = iso.split('-');
      if (!y || !m || !d) return iso;
      return `${d}/${m}/${y}`;
    };
    return linhasTotais.map((l) => {
      const q = quemRepasseEfetivo(l, local);
      const medicoPrincipal = q.incluirProfissional1
        ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—'
        : '—';
      const medicoAuxiliar = q.incluirProfissional2
        ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—'
        : '—';
      return {
        prontuario: l.prontuario?.trim() || '—',
        paciente: l.nomePaciente?.trim() || '—',
        medicoPrincipal,
        medicoAuxiliar,
        dataCirurgia: fmtData(l.dataProcedimento),
      };
    });
  }, [linhasTotais, local]);

  const somaResumoMedicos = useMemo(
    () => round2(resumoMedicos.reduce((acc, r) => acc + r.recebe, 0)),
    [resumoMedicos]
  );
  const timelineMeses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        key: String(i + 1).padStart(2, '0'),
        label: mesesNomes[i] ?? '',
        ch: `${ano}-${String(i + 1).padStart(2, '0')}`,
      })),
    [ano]
  );
  const isDone = (c: string) => !!store[c]?.concluido;

  const salvarRascunhoProfsMês = useCallback(() => {
    persist({ ...localRef.current, ...rascunhoProfs });
  }, [rascunhoProfs, persist]);

  const irPreencherManualDesdeImport = useCallback(
    (aviso: ImportLinhaAviso) => {
      const L = localRef.current;
      if (L.concluido) {
        window.alert('Este mês está concluído. Reabra o mês para lançar manualmente.');
        return;
      }
      const draft = { ...aviso.draft };
      if (aviso.draft.quemRepasse) {
        setRascunhoProfs({ ...aviso.draft.quemRepasse });
      }
      setModoEntradaLanc('manual');
      setLinhaPendente(draft);
      const hint =
        draft.instrumento.trim() ||
        draft.codigo1.trim() ||
        draft.nome1.trim().slice(0, 48) ||
        draft.nome2.trim().slice(0, 48) ||
        '';
      setBusca(hint);
      setAbrirSugestoes(hint.trim().length >= 2);
      requestAnimationFrame(() => {
        document.getElementById('entrada-manual-lanc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    []
  );

  const selecionarProcedimentoBase = (b: ProcedimentoBase) => {
    setLinhaPendente((atual) => {
      const base = fromBase(b);
      if (!atual) return base;
      return {
        ...base,
        id: atual.id,
        dataProcedimento: atual.dataProcedimento ?? '',
        nomePaciente: atual.nomePaciente ?? '',
        prontuario: atual.prontuario ?? '',
        quemRepasse: atual.quemRepasse,
      };
    });
    setBusca('');
    setAbrirSugestoes(false);
  };

  const salvarLinhaPendente = useCallback(() => {
    if (!linhaPendente) return;
    const L = localRef.current;
    if (L.concluido) {
      window.alert(
        'Este mês está marcado como concluído. Reabra o mês (botão abaixo) para incluir ou alterar lançamentos.'
      );
      return;
    }
    if (!lancarRepassePermitido(rascunhoProfs)) {
      window.alert('Indique 1.º e/ou 2.º ativos, nome e CRM de cada ativo, e adicione à tabela.');
      return;
    }
    const comRepasse: LinhaProcedimento = { ...linhaPendente, quemRepasse: { ...rascunhoProfs } };
    const limpo = rascunhoNomesVazios(rascunhoProfs);
    const jaExiste = L.procedimentos.some((p) => p.id === comRepasse.id);
    persist({
      ...L,
      procedimentos: jaExiste
        ? L.procedimentos.map((p) => (p.id === comRepasse.id ? comRepasse : p))
        : [...L.procedimentos, comRepasse],
      profissional1Nome: '',
      profissional1Crm: '',
      profissional2Nome: '',
      profissional2Crm: '',
    });
    setRascunhoProfs(limpo);
    setLinhaPendente(null);
    setBusca('');
    requestAnimationFrame(() => {
      document.getElementById('secao-lancamentos-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [linhaPendente, persist, rascunhoProfs]);

  const remover = (id: string) => {
    const L = localRef.current;
    if (L.concluido) {
      window.alert(
        'Este mês está concluído. Reabra o mês para poder excluir lançamentos.'
      );
      return;
    }
    persist({ ...L, procedimentos: L.procedimentos.filter((l) => l.id !== id) });
  };

  const editar = (id: string) => {
    const L = localRef.current;
    if (L.concluido) {
      window.alert(
        'Este mês está concluído. Reabra o mês para poder editar lançamentos.'
      );
      return;
    }
    const alvo = L.procedimentos.find((l) => l.id === id);
    if (!alvo) return;
    setLinhaPendente({ ...alvo });
    setRascunhoProfs(quemRepasseEfetivo(alvo, L));
    setBusca('');
    setAbrirSugestoes(false);
    requestAnimationFrame(() => {
      document.getElementById('secao-lancamentos-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const lancPesoTotal = useMemo(() => {
    let s = PESO_COL_LANC.acoes;
    (Object.keys(colsLanc) as ColLancKey[]).forEach((k) => {
      s += colsLanc[k] ? PESO_COL_LANC[k] : PESO_COL_LANC_HEADER_OCULTA;
    });
    return s;
  }, [colsLanc]);

  const lancWidthPct = useCallback(
    (k: 'acoes' | ColLancKey) => {
      if (k === 'acoes') {
        return (PESO_COL_LANC.acoes / lancPesoTotal) * 100;
      }
      return (
        ((colsLanc[k as ColLancKey] ? PESO_COL_LANC[k] : PESO_COL_LANC_HEADER_OCULTA) / lancPesoTotal) * 100
      );
    },
    [colsLanc, lancPesoTotal]
  );

  const toggleLancCol = useCallback((key: ColLancKey) => {
    setColsLanc((c) => {
      const next = { ...c, [key]: !c[key] } as typeof c;
      if (!(Object.keys(next) as ColLancKey[]).some((k) => next[k])) {
        return c;
      }
      return next;
    });
  }, []);

  const toggleResumoCol = useCallback((key: ColResumoKey) => {
    setColsResumo((c) => {
      const next = { ...c, [key]: !c[key] } as typeof c;
      if (!(Object.keys(next) as ColResumoKey[]).some((k) => next[k])) return c;
      return next;
    });
  }, []);

  const algumaColLancDado = useMemo(
    () => (Object.keys(colsLanc) as ColLancKey[]).some((k) => colsLanc[k]),
    [colsLanc]
  );
  const algumaColResumoDado = useMemo(
    () => (Object.keys(colsResumo) as ColResumoKey[]).some((k) => colsResumo[k]),
    [colsResumo]
  );
  const podeExportarVisualizacaoAtual = useMemo(() => {
    if (modoVisualLanc === 'detalhado') return algumaColLancDado;
    if (modoVisualLanc === 'resumo') return algumaColResumoDado;
    return tabelaPacientes.length > 0;
  }, [modoVisualLanc, algumaColLancDado, algumaColResumoDado, tabelaPacientes.length]);

  const exportLancamentosExcel = useCallback(() => {
    if (linhasTotais.length === 0) return;
    if (modoVisualLanc === 'pacientes') {
      const rows = tabelaPacientes.map((r) => ({
        Prontuário: r.prontuario,
        'Nome do paciente': r.paciente,
        'Médico principal': r.medicoPrincipal,
        'Médico auxiliar': r.medicoAuxiliar,
        'Data da cirurgia': r.dataCirurgia,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
      XLSX.writeFile(wb, `pacientes-cirurgia_${mesChave}.xlsx`);
      return;
    }
    if (modoVisualLanc === 'resumo') {
      const rows = resumoMedicos.map((r) => {
        const o: Record<string, string> = {};
        if (colsResumo.medico) o['Médico'] = r.medico;
        if (colsResumo.repasse) o['Repasse'] = r.repasseTxt;
        if (colsResumo.recebe) o['Valor exato a receber'] = BRL.format(r.recebe);
        return o;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produção por médico');
      XLSX.writeFile(wb, `producao-por-medico_${mesChave}.xlsx`);
      return;
    }
    const rotMed = (l: (typeof linhasTotais)[0], qual: 1 | 2) => {
      const q = quemRepasseEfetivo(l, local);
      if (qual === 1) {
        return q.incluirProfissional1 ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '' : '';
      }
      return q.incluirProfissional2 ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '' : '';
    };
    const rows: Record<string, string | number>[] = linhasTotais.map((l) => {
      const o: Record<string, string | number> = {};
      if (colsLanc.ins) o['Ins.'] = l.instrumento;
      if (colsLanc.cod1) o['Cód. 1'] = l.codigo1;
      if (colsLanc.proc1) o['1.º procedimento'] = l.nome1;
      if (colsLanc.v1) o['Valor 1'] = l.valorPrimeiro;
      if (colsLanc.rep1) o['1.º no repasse'] = rotMed(l, 1);
      if (colsLanc.cod2) o['Cód. 2'] = l.codigo2;
      if (colsLanc.proc2) o['2.º procedimento'] = l.nome2;
      if (colsLanc.v2) o['Valor 2'] = l.valorSegundo;
      if (colsLanc.rep2) o['2.º no repasse'] = rotMed(l, 2);
      if (colsLanc.bruto) o['Contrib. bruta'] = l.bruto;
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');
    XLSX.writeFile(wb, `lancamentos-procedimentos_${mesChave}.xlsx`);
  }, [linhasTotais, local, mesChave, colsLanc, modoVisualLanc, resumoMedicos, colsResumo, tabelaPacientes]);

  const exportLancamentosPdf = useCallback(() => {
    if (linhasTotais.length === 0) return;
    const cel = (s: string) => textoSeguroPdf(s);
    if (modoVisualLanc === 'pacientes') {
      const head = [[
        cel('Prontuário'),
        cel('Nome do paciente'),
        cel('Médico principal'),
        cel('Médico auxiliar'),
        cel('Data da cirurgia'),
      ]];
      const body = tabelaPacientes.map((r) => [
        cel(r.prontuario),
        cel(r.paciente),
        cel(r.medicoPrincipal),
        cel(r.medicoAuxiliar),
        cel(r.dataCirurgia),
      ]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12);
      doc.text(cel('Pacientes da cirurgia'), 10, 10);
      doc.setFontSize(9);
      doc.text(cel(`Referência: ${mesChave}`), 10, 16);
      autoTable(doc, {
        startY: 20,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak' },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: 10, right: 10 },
      });
      doc.save(`pacientes-cirurgia_${mesChave}.pdf`);
      return;
    }
    if (modoVisualLanc === 'resumo') {
      const head: string[][] = [[]];
      if (colsResumo.medico) head[0].push(cel('Médico'));
      if (colsResumo.repasse) head[0].push(cel('Repasse'));
      if (colsResumo.recebe) head[0].push(cel('Valor exato a receber'));
      const body = resumoMedicos.map((r) => {
        const row: string[] = [];
        if (colsResumo.medico) row.push(cel(r.medico));
        if (colsResumo.repasse) row.push(cel(r.repasseTxt));
        if (colsResumo.recebe) row.push(cel(BRL.format(r.recebe).replace(/\u00a0/g, ' ')));
        return row;
      });
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12);
      doc.text(cel('Produção por médico'), 10, 10);
      doc.setFontSize(9);
      doc.text(cel(`Referência: ${mesChave}`), 10, 16);
      autoTable(doc, {
        startY: 20,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: 10, right: 10 },
      });
      doc.save(`producao-por-medico_${mesChave}.pdf`);
      return;
    }
    const rotMed = (l: (typeof linhasTotais)[0], qual: 1 | 2) => {
      const q = quemRepasseEfetivo(l, local);
      if (qual === 1) {
        return q.incluirProfissional1 ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—' : '—';
      }
      return q.incluirProfissional2 ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—' : '—';
    };
    const head: string[][] = [[]];
    if (colsLanc.ins) head[0].push(cel('Ins.'));
    if (colsLanc.cod1) head[0].push(cel('Cód. 1'));
    if (colsLanc.proc1) head[0].push(cel('1.º proced.'));
    if (colsLanc.v1) head[0].push(cel('Valor 1'));
    if (colsLanc.rep1) head[0].push(cel('1.º repasse'));
    if (colsLanc.cod2) head[0].push(cel('Cód. 2'));
    if (colsLanc.proc2) head[0].push(cel('2.º proced.'));
    if (colsLanc.v2) head[0].push(cel('Valor 2'));
    if (colsLanc.rep2) head[0].push(cel('2.º repasse'));
    if (colsLanc.bruto) head[0].push(cel('Contrib. bruta'));
    const body = linhasTotais.map((l) => {
      const r: string[] = [];
      if (colsLanc.ins) r.push(cel(l.instrumento));
      if (colsLanc.cod1) r.push(cel(l.codigo1));
      if (colsLanc.proc1) r.push(cel(l.nome1));
      if (colsLanc.v1) r.push(cel(l.valorPrimeiro));
      if (colsLanc.rep1) r.push(cel(rotMed(l, 1)));
      if (colsLanc.cod2) r.push(cel(l.codigo2));
      if (colsLanc.proc2) r.push(cel(l.nome2));
      if (colsLanc.v2) r.push(cel(l.valorSegundo));
      if (colsLanc.rep2) r.push(cel(rotMed(l, 2)));
      if (colsLanc.bruto) r.push(cel(BRL.format(l.bruto).replace(/\u00a0/g, ' ')));
      return r;
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(12);
    doc.text(cel('Lançamentos do mês'), 10, 10);
    doc.setFontSize(9);
    doc.text(cel(`Referência: ${mesChave}`), 10, 16);
    autoTable(doc, {
      startY: 20,
      head,
      body,
      styles: { fontSize: 6.5, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      margin: { left: 10, right: 10 },
    });
    doc.save(`lancamentos-procedimentos_${mesChave}.pdf`);
  }, [linhasTotais, local, mesChave, colsLanc, modoVisualLanc, resumoMedicos, colsResumo, tabelaPacientes]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-coop-900">Acesso restrito</h2>
      </div>
    );
  }

  return (
    <div className="max-w-[92rem] mx-auto space-y-5 pb-10 px-2 sm:px-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-coop-900 font-display">Relatório de procedimentos</h1>
        </div>
        <button
          type="button"
          onClick={abrirParametros}
          className="btn btn-primary shrink-0 w-full sm:w-auto hidden"
          aria-hidden
          tabIndex={-1}
        >
          Parâmetros do cálculo
        </button>
      </div>

      <div className="rounded-2xl border border-coop-200/70 bg-white shadow-[var(--card-shadow)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-coop-50/40 border-b border-coop-200/50">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-coop-500 font-display">Mês de referência</span>
          <div className="flex items-center gap-2 text-sm text-coop-800">
            <span className="text-coop-500">Ano</span>
            <select
              className="input w-auto min-w-[96px] py-1 text-sm h-8"
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value, 10) || hoje.getFullYear())}
            >
              {Array.from({ length: 11 }, (_, i) => hoje.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-2 sm:px-3 py-3">
          <div className="relative mx-auto max-w-5xl px-1">
            <div
              className="pointer-events-none absolute left-6 right-6 top-[19px] h-[3px] rounded-full bg-gradient-to-r from-coop-100/30 via-coop-200/90 to-coop-100/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
              aria-hidden
            />
            <div
              role="group"
              aria-label={`Meses de ${ano}`}
              className="relative flex min-w-max sm:min-w-0 w-full items-start justify-between gap-1.5 sm:gap-1 overflow-x-auto pb-2 pt-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(120,140,160,0.35)_transparent]"
            >
            {timelineMeses.map((m) => {
              const at = m.key === mesMM;
              const ok = isDone(m.ch);
              return (
                <button
                  type="button"
                  aria-current={at ? true : undefined}
                  aria-label={`${m.label} de ${ano}${ok ? ', mês concluído' : ', em aberto'}`}
                  key={m.key}
                  onClick={() => setMesMM(m.key)}
                  className={[
                    'group relative shrink-0 flex min-w-[3.35rem] sm:min-w-[3.65rem] flex-col items-center rounded-2xl px-2 py-2',
                    'font-display font-bold transition-all duration-200 ease-out',
                    'outline-none focus-visible:ring-2 focus-visible:ring-coop-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    'active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100',
                    at
                      ? 'bg-gradient-to-b from-white via-white to-coop-50/70 text-coop-950 shadow-[0_6px_20px_-8px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-coop-200/90'
                      : 'text-coop-500 hover:bg-white/70 hover:text-coop-800 hover:shadow-[0_3px_12px_-6px_rgba(15,23,42,0.12)]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="relative z-[1] flex h-[19px] w-[19px] items-center justify-center" title={ok ? 'Concluído' : 'Em aberto'}>
                    {ok ? (
                      <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-[10px] text-white shadow-[0_3px_10px_-2px_rgba(16,185,129,0.65)] ring-[1.5px] ring-white">
                        <svg viewBox="0 0 12 12" className="h-2 w-2" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.2l2.4 2.3L9.6 3.7" />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className={[
                          'h-[19px] w-[19px] rounded-full border-[2.5px] bg-white transition-colors duration-200',
                          at
                            ? 'border-coop-400/95 shadow-[inset_0_1px_3px_rgba(15,23,42,0.07)] ring-2 ring-coop-200/50 ring-offset-2 ring-offset-white'
                            : 'border-slate-300/90 group-hover:border-coop-300/95 group-hover:shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]',
                        ].join(' ')}
                      />
                    )}
                  </span>
                  <span
                    className={[
                      'mt-2 block capitalize leading-none tracking-wide text-[10px] sm:text-[11px]',
                      at ? 'text-coop-900 font-bold' : 'text-coop-500 group-hover:text-coop-800 font-semibold',
                    ].join(' ')}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-coop-200/50 bg-white shadow-[var(--card-shadow)]">
        <div
          className="pointer-events-none h-[3px] shrink-0 bg-gradient-to-r from-coop-600/85 via-teal-500/70 to-emerald-500/55 opacity-95"
          aria-hidden
        />
        <header className="relative border-b border-coop-100/80 bg-gradient-to-br from-white via-coop-50/25 to-teal-50/10 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl min-w-[12rem]">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-teal-700/90">
                Produção deste período
              </p>
              <h2 className="font-display text-base font-bold tracking-tight text-coop-900 sm:text-lg">Quem recebe o repasse</h2>
              <p className="font-serif text-xs leading-relaxed text-coop-600 max-w-md">
                Identifique médicos para o repasse e registe cirurgias por importação (.xlsx) ou lançamento manual.
              </p>
              {errMedicos && (
                <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 mt-2">
                  Não foi possível carregar a lista de médicos. Tente de novo.
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm shrink-0 shadow-[0_4px_16px_-6px_rgba(20,90,72,0.45)]"
              onClick={salvarRascunhoProfsMês}
              disabled={local.concluido}
              title={local.concluido ? 'Mês fechado' : undefined}
            >
              Salvar identificação
            </button>
          </div>
        </header>
        <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <div
            role="tablist"
            aria-label="Forma de lançamento"
            className="inline-flex w-full max-w-full flex-wrap gap-1 rounded-2xl border border-coop-200/50 bg-gradient-to-b from-slate-100/90 to-slate-50/60 p-1 shadow-inner"
          >
            <button
              type="button"
              role="tab"
              aria-selected={modoEntradaLanc === 'upload'}
              disabled={local.concluido}
              onClick={() => {
                setModoEntradaLanc('upload');
                setImportMsg(null);
                setImportPreview(null);
                setImportProcessing(false);
              }}
              className={[
                'min-h-[42px] flex-1 rounded-[12px] px-4 py-2.5 font-display text-xs font-semibold outline-none transition-all duration-200 sm:flex-none sm:min-w-[13rem]',
                'focus-visible:ring-2 focus-visible:ring-coop-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
                modoEntradaLanc === 'upload'
                  ? 'relative bg-white text-coop-950 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.18)] ring-1 ring-coop-200/60'
                  : 'text-coop-600 hover:bg-white/55 hover:text-coop-950',
              ].join(' ')}
            >
              Importar Excel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modoEntradaLanc === 'manual'}
              disabled={local.concluido}
              onClick={() => {
                setModoEntradaLanc('manual');
                setImportMsg(null);
                setImportPreview(null);
                setImportProcessing(false);
              }}
              className={[
                'min-h-[42px] flex-1 rounded-[12px] px-4 py-2.5 font-display text-xs font-semibold outline-none transition-all duration-200 sm:flex-none sm:min-w-[13rem]',
                'focus-visible:ring-2 focus-visible:ring-coop-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
                modoEntradaLanc === 'manual'
                  ? 'relative bg-white text-coop-950 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.18)] ring-1 ring-coop-200/60'
                  : 'text-coop-600 hover:bg-white/55 hover:text-coop-950',
              ].join(' ')}
            >
              Preencher manualmente
            </button>
          </div>

          {modoEntradaLanc === 'upload' && (
            <div className="space-y-5" aria-busy={importProcessing}>
              <div className="relative overflow-hidden rounded-2xl border border-coop-200/40 bg-gradient-to-br from-white via-slate-50/40 to-coop-50/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_40px_-24px_rgba(15,23,42,0.12)]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.5] bg-[radial-gradient(circle_at_center,rgb(148_163_184/0.085)_1.5px,transparent_1.5px)] [background-size:20px_20px]"
                  aria-hidden
                />
                <div className="relative space-y-4 p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                    <div className="flex shrink-0 flex-row items-center gap-3 rounded-xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm ring-1 ring-coop-200/35 sm:flex-col sm:text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-teal-50 to-coop-50 ring-1 ring-teal-200/50">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-7 w-7 text-teal-800/90"
                          aria-hidden
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M7 3.5h10c.83 0 1.5.67 1.5 1.5v14a1 1 0 01-.62.927l-5 2a1 1 0 01-.759 0l-5-2A1 1 0 015 19V5c0-.83.67-1.5 1.5-1.5z"
                          />
                          <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" d="M8 8h4M8 11h8M8 14h5" opacity="0.9" />
                        </svg>
                      </div>
                      <div className="min-w-0 sm:px-0">
                        <p className="font-display text-[11px] font-bold uppercase tracking-wider text-teal-800/95">Hospitalar</p>
                        <p className="font-display text-sm font-bold tracking-tight text-coop-900">Planilha Excel</p>
                        <p className="font-serif text-[10px] leading-tight text-coop-500">.xlsx · .xls · pront.+TUSS</p>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm font-display ring-1 ring-coop-200/50"
                          onClick={baixarModeloLancamentosXlsx}
                        >
                          Descarregar modelo
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm font-display ring-1 ring-coop-200/50"
                          disabled={local.concluido || importProcessing}
                          onClick={() => xlsxImportRef.current?.click()}
                        >
                          Escolher ficheiro…
                        </button>
                        <input
                          ref={xlsxImportRef}
                          type="file"
                          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          className="sr-only"
                          disabled={local.concluido || importProcessing}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) processarFicheiroLancamentosXlsx(f);
                            e.target.value = '';
                          }}
                        />
                      </div>
                      <div className="rounded-xl border border-slate-200/85 bg-gradient-to-b from-white/90 to-slate-50/40 px-3 py-3 ring-1 ring-inset ring-slate-100/90 sm:px-3.5">
                        <label
                          className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800/90"
                          htmlFor="import-paste-tsv"
                        >
                          Ou colar do Excel
                        </label>
                        <p className="mt-1 font-serif text-[11px] leading-snug text-coop-600">
                          Selecione as células na planilha, copie (Ctrl+C) e cole aqui. O conteúdo colado é texto com tab entre colunas — o mesmo dado que no .xlsx.
                        </p>
                        <textarea
                          id="import-paste-tsv"
                          ref={importPasteRef}
                          rows={4}
                          disabled={local.concluido || importProcessing}
                          placeholder="Cole aqui (Ctrl+V) as linhas copiadas…"
                          className="input mt-2 w-full min-h-[4.5rem] resize-y text-xs font-mono leading-relaxed"
                          spellCheck={false}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              processarTextoColadoLancamentos();
                            }
                          }}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm font-display ring-1 ring-coop-200/45"
                            disabled={local.concluido || importProcessing}
                            onClick={processarTextoColadoLancamentos}
                          >
                            Processar texto colado
                          </button>
                          <span className="font-serif text-[10px] text-coop-500">Atalho: Ctrl+Enter</span>
                        </div>
                      </div>
                      {importProcessing && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-br from-white to-teal-50/30 px-4 py-3 shadow-sm ring-1 ring-teal-100/50 sm:px-4"
                >
                  <span
                    className="mt-0.5 inline-block h-8 w-8 shrink-0 rounded-full border-2 border-teal-600 border-t-transparent animate-spin motion-reduce:animate-none motion-reduce:border-solid motion-reduce:border-teal-300"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-display font-semibold text-coop-950">A ler e analisar a planilha…</p>
                    <p className="font-serif text-[11px] text-coop-600 mt-1 leading-snug">
                      Ficheiros grandes levam vários segundos. Este passo faz a leitura do Excel na totalidade antes de mostrar o resultado.
                    </p>
                  </div>
                </div>
              )}
              <div
                role="button"
                aria-disabled={local.concluido || importProcessing}
                tabIndex={
                  local.concluido || importProcessing ? -1 : 0
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!local.concluido && !importProcessing) xlsxImportRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (!local.concluido && !importProcessing) setImportDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!local.concluido && !importProcessing) setImportDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setImportDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setImportDragActive(false);
                  if (local.concluido || importProcessing) return;
                  const f = e.dataTransfer.files?.[0];
                  if (f) processarFicheiroLancamentosXlsx(f);
                }}
                onClick={() => {
                  if (!local.concluido && !importProcessing) xlsxImportRef.current?.click();
                }}
                className={[
                  'group relative overflow-hidden rounded-2xl border-2 border-dashed px-4 py-9 text-center transition-all duration-200',
                  'before:pointer-events-none before:absolute before:inset-x-8 before:top-3 before:border-t before:border-dashed before:border-teal-200/50 before:opacity-0 before:transition-opacity hover:before:opacity-100',
                  local.concluido || importProcessing
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : importDragActive
                      ? 'border-teal-500/90 bg-teal-50/50 text-coop-950 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.35)] cursor-pointer scale-[1.01]'
                      : 'border-coop-200/90 bg-white/90 text-coop-800 hover:border-teal-400/70 hover:bg-gradient-to-br hover:from-white hover:to-teal-50/20 cursor-pointer',
                ].join(' ')}
                >
                {!(local.concluido || importProcessing) ? (
                <span
                  className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100/70 text-teal-800 shadow-inner ring-1 ring-teal-200/60 transition-transform duration-200 group-hover:translate-y-0.5"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v12M12 17l4-4M12 17l-4-4M5 15v2a2 2 0 002 2h10a2 2 0 002-2v-2" opacity="0.85" />
                  </svg>
                </span>
                ) : (
                  <span className="mx-auto mb-3 block h-10 w-10 rounded-xl bg-slate-200/80" aria-hidden />
                )}
                <p className="font-display text-sm font-semibold text-coop-900 tracking-tight">
                  {importProcessing ? 'Aguarde, a processar o ficheiro…' : 'Largue aqui o ficheiro Excel ou clique para selecionar'}
                </p>
                <p className="font-serif text-[11px] text-coop-600 mt-2 max-w-[20rem] mx-auto leading-snug">
                  {importProcessing
                    ? 'Não feche esta página até aparecer mensagem ou pré-visualização.'
                    : 'Cirurgia com dois nomes separados por « / » e valor total — cruza automaticamente com a base TUSS.'}
                </p>
              </div>
                    </div>
                  </div>

              {importPreview && importPreview.linhas.length > 0 && (
                <div className="rounded-lg border border-coop-200 bg-white overflow-hidden shadow-sm">
                  <div className="border-b border-coop-200/80 bg-amber-50/50 px-3 py-2">
                    <p className="text-xs font-display font-bold text-coop-900">
                      Pré-visualização ({importPreview.linhas.length} lançamento
                      {importPreview.linhas.length !== 1 ? 's' : ''}) — ainda não gravado
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-[min(52vh,380px)] overflow-y-auto">
                    <table className="w-full min-w-[960px] border-collapse text-left text-[10px] sm:text-[11px]">
                      <thead className="sticky top-0 z-[1] bg-slate-800 text-white font-display">
                        <tr>
                          <th className="px-1.5 py-1.5 font-medium">#</th>
                          <th className="px-1.5 py-1.5 font-medium">Data</th>
                          <th className="px-1.5 py-1.5 font-medium">Paciente</th>
                          <th className="px-1.5 py-1.5 font-medium">Pront.</th>
                          <th className="px-1.5 py-1.5 font-medium">1.º proced.</th>
                          <th className="px-1.5 py-1.5 font-medium">2.º proced.</th>
                          <th className="px-1.5 py-1.5 font-medium">Ins.</th>
                          <th className="px-1.5 py-1.5 font-medium">Cód. 1</th>
                          <th className="px-1.5 py-1.5 font-medium">Cód. 2</th>
                          <th className="px-1.5 py-1.5 font-medium text-right">V1</th>
                          <th className="px-1.5 py-1.5 font-medium text-right">V2</th>
                          <th className="px-1.5 py-1.5 font-medium">1.º rep.</th>
                          <th className="px-1.5 py-1.5 font-medium">2.º rep.</th>
                          <th className="px-1.5 py-1.5 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.linhas.map((l, i) => {
                          const q = l.quemRepasse!;
                          const m1 = q.incluirProfissional1
                            ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—'
                            : '—';
                          const m2 = q.incluirProfissional2
                            ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—'
                            : '—';
                          const bruto = round2(parseBrl(l.valorPrimeiro) + parseBrl(l.valorSegundo));
                          return (
                            <tr
                              key={l.id}
                              className={i % 2 ? 'bg-coop-50/30' : 'bg-white border-t border-slate-100'}
                            >
                              <td className="px-1.5 py-1 font-semibold text-coop-900">{i + 1}</td>
                              <td className="px-1.5 py-1 text-coop-800">{formatarDataISO(l.dataProcedimento)}</td>
                              <td
                                className="px-1.5 py-1 font-serif text-coop-800 max-w-[7rem] truncate"
                                title={l.nomePaciente || undefined}
                              >
                                {l.nomePaciente || '—'}
                              </td>
                              <td className="px-1.5 py-1 font-mono text-coop-700">{l.prontuario || '—'}</td>
                              <td
                                className="px-1.5 py-1 font-serif text-coop-800 max-w-[10rem] sm:max-w-[14rem] [overflow-wrap:anywhere] align-top"
                                title={l.nome1 || undefined}
                              >
                                {l.nome1 || '—'}
                              </td>
                              <td
                                className="px-1.5 py-1 font-serif text-coop-800 max-w-[10rem] sm:max-w-[14rem] [overflow-wrap:anywhere] align-top"
                                title={l.nome2 || undefined}
                              >
                                {l.nome2 || '—'}
                              </td>
                              <td className="px-1.5 py-1 font-mono">{l.instrumento}</td>
                              <td className="px-1.5 py-1 font-mono [overflow-wrap:anywhere]">{l.codigo1}</td>
                              <td className="px-1.5 py-1 font-mono [overflow-wrap:anywhere]">{l.codigo2}</td>
                              <td className="px-1.5 py-1 text-right tabular-nums">{l.valorPrimeiro}</td>
                              <td className="px-1.5 py-1 text-right tabular-nums">{l.valorSegundo}</td>
                              <td className="px-1.5 py-1 font-serif text-coop-800 max-w-[9rem] [overflow-wrap:anywhere]">
                                {m1}
                              </td>
                              <td className="px-1.5 py-1 font-serif text-coop-800 max-w-[9rem] [overflow-wrap:anywhere]">
                                {m2}
                              </td>
                              <td className="px-1.5 py-1 text-right font-mono font-semibold tabular-nums">
                                {BRL.format(bruto)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-coop-200/70 bg-coop-50/40 px-3 py-2.5">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm font-display"
                      onClick={cancelarImportacaoPreview}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm font-display"
                      disabled={local.concluido}
                      onClick={confirmarImportacaoLancamentos}
                    >
                      Confirmar lançamento
                    </button>
                  </div>
                </div>
              )}

              {importMsg && (
                <div
                  role="status"
                  className={[
                    'rounded-lg border px-3 py-2.5 text-xs font-serif',
                    importMsg.tipo === 'erro'
                      ? 'border-rose-200 bg-rose-50 text-rose-900 whitespace-pre-wrap'
                      : importMsg.tipo === 'aviso'
                        ? 'border-amber-200 bg-amber-50 text-amber-950'
                        : 'border-emerald-200 bg-emerald-50/90 text-emerald-950 whitespace-pre-wrap',
                  ].join(' ')}
                >
                  <p className={importPreview?.avisos?.length ? 'leading-relaxed' : 'whitespace-pre-wrap'}>
                    {importMsg.texto}
                  </p>
                  {importMsg.tipo === 'aviso' && importPreview?.avisos && importPreview.avisos.length > 0 && (
                    <ul className="mt-3 space-y-2.5 border-t border-amber-200/80 pt-3">
                      {importPreview.avisos.map((aviso) => (
                        <li
                          key={aviso.sheetLine}
                          className="rounded-lg border border-amber-300/60 bg-white/70 px-3 py-2.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-display text-[11px] font-bold uppercase tracking-wide text-amber-900/90">
                                Linha {aviso.sheetLine} da planilha
                              </p>
                              <p className="mt-0.5 font-serif text-[11px] text-coop-800 [overflow-wrap:anywhere]">
                                {aviso.draft.nomePaciente || '—'}
                                {aviso.draft.nome1 ? (
                                  <>
                                    {' '}
                                    · <span className="text-coop-700">{aviso.draft.nome1}</span>
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm shrink-0 font-display"
                              disabled={local.concluido}
                              onClick={() => irPreencherManualDesdeImport(aviso)}
                            >
                              Preencher manual
                            </button>
                          </div>
                          <ul className="mt-2 list-disc pl-4 space-y-0.5 font-serif text-[11px] text-amber-950/90 leading-snug">
                            {aviso.mensagens.map((m, i) => (
                              <li key={i} className="[overflow-wrap:anywhere]">
                                {m}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
                </div>
              </div>
            </div>
          )}

          {modoEntradaLanc === 'manual' && (
          <>
          <div
            id="entrada-manual-lanc"
            className="rounded-xl border border-coop-200/70 bg-white/80 p-3 sm:p-3.5 scroll-mt-24"
          >
            <p className="text-[10px] font-semibold uppercase text-coop-500 font-display mb-2">Dados do procedimento</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase text-coop-500 font-display">Data</label>
                <input
                  type="date"
                  className="input w-full h-8 text-xs mt-0.5"
                  value={linhaPendente?.dataProcedimento ?? ''}
                  onChange={(e) =>
                    setLinhaPendente((lp) => ({
                      ...(lp ?? linhaPendenteVazia()),
                      dataProcedimento: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-coop-500 font-display">Paciente</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Nome do paciente"
                  value={linhaPendente?.nomePaciente ?? ''}
                  onChange={(e) =>
                    setLinhaPendente((lp) => ({
                      ...(lp ?? linhaPendenteVazia()),
                      nomePaciente: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-coop-500 font-display">Prontuário</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Número do prontuário"
                  value={linhaPendente?.prontuario ?? ''}
                  onChange={(e) =>
                    setLinhaPendente((lp) => ({
                      ...(lp ?? linhaPendenteVazia()),
                      prontuario: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
          <div
            className={`rounded-xl border p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 ${
              rascunhoProfs.incluirProfissional1 ? 'border-coop-200/80 bg-coop-50/25' : 'border-coop-200/50 bg-stone-50/40'
            }`}
          >
            <label className="inline-flex sm:flex sm:flex-col sm:items-start sm:pt-0.5 items-center gap-2.5 text-sm text-coop-800 font-medium shrink-0">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-coop-300 text-coop-800"
                checked={rascunhoProfs.incluirProfissional1}
                onChange={(e) => {
                  setRascunhoProfs((p) => {
                    const next: RascunhoProfsT = { ...p, incluirProfissional1: e.target.checked };
                    persist({ ...localRef.current, ...next });
                    return next;
                  });
                }}
              />
              <span>1.º</span>
            </label>
            <div className="space-y-2 min-w-0">
              <div ref={boxMed1Ref} className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="text-[10px] font-semibold uppercase text-coop-500 font-display">Buscar no corpo clínico</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Filtrar por nome ou CRM — ou deixe vazio para listar todos"
                  value={medBusca1}
                  onChange={(e) => {
                    setMedBusca1(e.target.value);
                    setMedAbrir1(true);
                  }}
                  onFocus={() => setMedAbrir1(true)}
                />
                {medAbrir1 && (
                  <ul className="absolute z-30 mt-1 w-full min-w-0 max-h-64 overflow-y-auto rounded-lg border border-coop-200 bg-white text-xs shadow-lg">
                    {carregandoMedicos ? (
                      <li className="px-2 py-2.5 text-coop-500">A carregar o corpo clínico…</li>
                    ) : errMedicos ? (
                      <li className="px-2 py-2.5 text-amber-800">Erro ao carregar a lista.</li>
                    ) : sugestoesMedicos1.length === 0 ? (
                      <li className="px-2 py-2.5 text-coop-500">Nenhum profissional{medBusca1.trim() ? ' com este filtro' : ''}.</li>
                    ) : (
                      <>
                        {sugestoesMedicos1.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setRascunhoProfs((p) => {
                                  const next: RascunhoProfsT = {
                                    ...p,
                                    profissional1Nome: m.nomeCompleto,
                                    profissional1Crm: m.crm ?? '',
                                  };
                                  persist({ ...localRef.current, ...next });
                                  return next;
                                });
                                setMedAbrir1(false);
                                setMedBusca1('');
                              }}
                              className="w-full text-left px-2 py-2 hover:bg-coop-50"
                            >
                              {m.nomeCompleto}
                              {m.crm && <span className="text-coop-500"> · {m.crm}</span>}
                            </button>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                )}
              </div>
              {rascunhoProfs.incluirProfissional1 ? (
                (() => {
                  const rot = rotuloQuem(rascunhoProfs.profissional1Nome, rascunhoProfs.profissional1Crm);
                  return rot ? (
                    <div className="mt-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2 text-xs text-coop-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-emerald-800/90 font-display">1.º no próximo lançamento</p>
                        <button
                          type="button"
                          className="text-[10px] font-display font-semibold underline text-emerald-800/90 hover:text-emerald-900"
                          onClick={() => {
                            setRascunhoProfs((p) => {
                              const next: RascunhoProfsT = { ...p, profissional1Nome: '', profissional1Crm: '' };
                              persist({ ...localRef.current, ...next });
                              return next;
                            });
                          }}
                        >
                          Excluir seleção
                        </button>
                      </div>
                      <p className="mt-0.5 font-serif leading-snug">{rot}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800/90 mt-1.5">Selecione o 1.º profissional.</p>
                  );
                })()
              ) : (
                <p className="text-xs text-stone-500 mt-1">1.º: inativo</p>
              )}
            </div>
          </div>
          <div
            className={`rounded-xl border p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 ${
              rascunhoProfs.incluirProfissional2 ? 'border-coop-200/80 bg-coop-50/25' : 'border-coop-200/50 bg-stone-50/40'
            }`}
          >
            <label className="inline-flex sm:flex sm:flex-col sm:items-start sm:pt-0.5 items-center gap-2.5 text-sm text-coop-800 font-medium shrink-0">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-coop-300 text-coop-800"
                checked={rascunhoProfs.incluirProfissional2}
                onChange={(e) => {
                  setRascunhoProfs((p) => {
                    const next: RascunhoProfsT = { ...p, incluirProfissional2: e.target.checked };
                    persist({ ...localRef.current, ...next });
                    return next;
                  });
                }}
              />
              <span>2.º</span>
            </label>
            <div className="space-y-2 min-w-0">
              <div ref={boxMed2Ref} className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="text-[10px] font-semibold uppercase text-coop-500 font-display">Buscar no corpo clínico</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Filtrar por nome ou CRM — ou deixe vazio para listar todos"
                  value={medBusca2}
                  onChange={(e) => {
                    setMedBusca2(e.target.value);
                    setMedAbrir2(true);
                  }}
                  onFocus={() => setMedAbrir2(true)}
                />
                {medAbrir2 && (
                  <ul className="absolute z-30 mt-1 w-full min-w-0 max-h-64 overflow-y-auto rounded-lg border border-coop-200 bg-white text-xs shadow-lg">
                    {carregandoMedicos ? (
                      <li className="px-2 py-2.5 text-coop-500">A carregar o corpo clínico…</li>
                    ) : errMedicos ? (
                      <li className="px-2 py-2.5 text-amber-800">Erro ao carregar a lista.</li>
                    ) : sugestoesMedicos2.length === 0 ? (
                      <li className="px-2 py-2.5 text-coop-500">Nenhum profissional{medBusca2.trim() ? ' com este filtro' : ''}.</li>
                    ) : (
                      <>
                        {sugestoesMedicos2.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setRascunhoProfs((p) => {
                                  const next: RascunhoProfsT = {
                                    ...p,
                                    profissional2Nome: m.nomeCompleto,
                                    profissional2Crm: m.crm ?? '',
                                  };
                                  persist({ ...localRef.current, ...next });
                                  return next;
                                });
                                setMedAbrir2(false);
                                setMedBusca2('');
                              }}
                              className="w-full text-left px-2 py-2 hover:bg-coop-50"
                            >
                              {m.nomeCompleto}
                              {m.crm && <span className="text-coop-500"> · {m.crm}</span>}
                            </button>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                )}
              </div>
              {rascunhoProfs.incluirProfissional2 ? (
                (() => {
                  const rot = rotuloQuem(rascunhoProfs.profissional2Nome, rascunhoProfs.profissional2Crm);
                  return rot ? (
                    <div className="mt-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2 text-xs text-coop-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-emerald-800/90 font-display">2.º no próximo lançamento</p>
                        <button
                          type="button"
                          className="text-[10px] font-display font-semibold underline text-emerald-800/90 hover:text-emerald-900"
                          onClick={() => {
                            setRascunhoProfs((p) => {
                              const next: RascunhoProfsT = { ...p, profissional2Nome: '', profissional2Crm: '' };
                              persist({ ...localRef.current, ...next });
                              return next;
                            });
                          }}
                        >
                          Excluir seleção
                        </button>
                      </div>
                      <p className="mt-0.5 font-serif leading-snug">{rot}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800/90 mt-1.5">Selecione o 2.º profissional.</p>
                  );
                })()
              ) : (
                <p className="text-xs text-stone-500 mt-1">2.º: inativo</p>
              )}
            </div>
          </div>
          </div>
          </>
          )}
        </div>
        {modoEntradaLanc === 'manual' && !rascunhoProfs.incluirProfissional1 && !rascunhoProfs.incluirProfissional2 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl mx-4 sm:mx-5 mb-0 px-4 py-2.5 font-serif">
            Nenhum 1.º/2.º ativo. Ative no mínimo um.
          </p>
        )}
        {modoEntradaLanc === 'manual' && (
        <div
          className="px-4 sm:px-5 py-4 sm:py-5 border-t border-coop-200/50 bg-gradient-to-b from-amber-50/25 to-amber-50/5"
          ref={boxBuscaRef}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-coop-900 font-display">Procedimentos</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm font-display shrink-0"
            onClick={() => setModalBaseProcedimentos(true)}
          >
            Ver base de procedimentos
          </button>
        </div>
        <div className="relative">
          <input
            className="input w-full pl-3 pr-10 h-10 text-sm"
            placeholder="Ex.: C1, clavícula, 04.08.01.010"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAbrirSugestoes(true);
            }}
            onFocus={() => setAbrirSugestoes(true)}
          />
          {busca && (
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 text-coop-500 hover:text-coop-800"
              onClick={() => setBusca('')}
            >
              ×
            </button>
          )}
          {abrirSugestoes && busca.trim().length >= 2 && sugestoes.length > 0 && (
            <ul
              className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-coop-200 bg-white py-1 shadow-lg"
            >
              {sugestoes.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => selecionarProcedimentoBase(b)}
                    className="w-full text-left px-3 py-2.5 text-xs sm:text-sm hover:bg-coop-50 border-b border-coop-100/80 last:border-0"
                  >
                    <span className="font-mono text-amber-900/90 font-medium">{b.instrumento}</span>
                    <span className="text-coop-500 mx-1">|</span>
                    <span className="text-coop-800">
                      {b.nome1.slice(0, 56)}
                      {b.nome1.length > 56 ? '…' : ''}
                      {' '}
                      <span className="text-coop-500">|</span>
                      {' '}
                      {b.nome2.slice(0, 56)}
                      {b.nome2.length > 56 ? '…' : ''}
                    </span>
                    <span className="block text-coop-500 text-[10px] mt-0.5 pl-0 font-serif">{b.codigo1}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {linhaPendente && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-50/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-coop-900 font-display">Pré-visualização</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-coop-500 font-display uppercase">Ins.</p>
                <p className="text-coop-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.instrumento || '—'}</p>
              </div>
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-coop-500 font-display uppercase">Cód. 1</p>
                <p className="text-coop-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.codigo1 || '—'}</p>
              </div>
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5 col-span-2">
                <p className="text-[10px] text-coop-500 font-display uppercase">1.º procedimento</p>
                <p className="text-coop-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.nome1 || '—'}</p>
              </div>
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-coop-500 font-display uppercase">R$ 1</p>
                <p className="text-coop-900 font-mono tabular-nums mt-0.5 text-right">{linhaPendente.valorPrimeiro || '0,00'}</p>
              </div>
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-coop-500 font-display uppercase">Cód. 2</p>
                <p className="text-coop-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.codigo2 || '—'}</p>
              </div>
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5 col-span-2">
                <p className="text-[10px] text-coop-500 font-display uppercase">2.º procedimento</p>
                <p className="text-coop-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.nome2 || '—'}</p>
              </div>
              <div className="rounded-lg border border-coop-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-coop-500 font-display uppercase">R$ 2</p>
                <p className="text-coop-900 font-mono tabular-nums mt-0.5 text-right">{linhaPendente.valorSegundo || '0,00'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-mono text-coop-800">
                Contrib. bruta:{' '}
                {BRL.format(
                  round2(
                    parseBrl(linhaPendente.valorPrimeiro) + parseBrl(linhaPendente.valorSegundo)
                  )
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (linhaPendente) {
                      if (!window.confirm('Descartar esta linha?')) return;
                    }
                    setLinhaPendente(null);
                  }}
                >
                  Descartar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={local.concluido}
                  title={
                    local.concluido
                      ? 'Mês fechado — reabra o mês para gravar na tabela'
                      : undefined
                  }
                  onClick={salvarLinhaPendente}
                >
                  {linhaPendente && local.procedimentos.some((p) => p.id === linhaPendente.id)
                    ? 'Salvar edição'
                    : 'Incluir na tabela de lançamentos'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        )}
      </div>

      <div
        className="rounded-2xl border border-coop-200/60 bg-white overflow-hidden shadow-[var(--card-shadow)]"
        id="secao-lancamentos-mes"
      >
        <div className="px-4 py-3 border-b border-coop-200/50 bg-coop-50/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-coop-900 font-display">Lançamentos do mês</h2>
            {local.concluido && (
              <span
                className="inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white font-display shrink-0"
                title="Mês concluído: edição e exclusão de linhas estão bloqueadas até reabrir."
              >
                Mês fechado
              </span>
            )}
          </div>
        </div>
        {local.concluido && linhasTotais.length > 0 && (
          <p className="px-3 sm:px-4 py-2.5 text-xs leading-snug text-slate-800 bg-slate-100 border-b border-slate-200/90 font-serif">
            <span className="font-display font-semibold">Edição bloqueada.</span> Não é possível editar, excluir nem
            gravar novas linhas neste mês enquanto estiver concluído. Use «Reabrir mês» na secção seguinte para voltar a
            alterar os lançamentos.
          </p>
        )}
        {linhasTotais.length === 0 ? (
          <p className="p-6 text-sm text-coop-600 text-center font-serif">Nada lançado.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-coop-200/50 bg-coop-50/25 text-[11px] sm:text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`btn btn-sm font-display ${
                    modoVisualLanc === 'detalhado' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setModoVisualLanc('detalhado')}
                  aria-pressed={modoVisualLanc === 'detalhado'}
                >
                  Detalhado
                </button>
                <button
                  type="button"
                  className={`btn btn-sm font-display ${
                    modoVisualLanc === 'resumo' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setModoVisualLanc('resumo')}
                  aria-pressed={modoVisualLanc === 'resumo'}
                >
                  Produção por médico
                </button>
                <button
                  type="button"
                  className={`btn btn-sm font-display ${
                    modoVisualLanc === 'pacientes' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setModoVisualLanc('pacientes')}
                  aria-pressed={modoVisualLanc === 'pacientes'}
                >
                  Pacientes
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm font-display"
                  disabled={!podeExportarVisualizacaoAtual}
                  onClick={exportLancamentosExcel}
                  title={!podeExportarVisualizacaoAtual ? 'Sem dados para exportar' : 'Exportar Excel'}
                >
                  Excel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm font-display"
                  disabled={!podeExportarVisualizacaoAtual}
                  onClick={exportLancamentosPdf}
                  title={!podeExportarVisualizacaoAtual ? 'Sem dados para exportar' : 'Exportar PDF'}
                >
                  PDF
                </button>
              </div>
            </div>
            {modoVisualLanc === 'detalhado' && !algumaColLancDado && (
              <p className="px-3 sm:px-4 py-2 text-xs text-amber-800 bg-amber-50/80 border-b border-amber-200/80 font-serif">
                Nenhuma coluna visível. Ative no cabeçalho com o ícone de olho.
              </p>
            )}
            {modoVisualLanc === 'resumo' && !algumaColResumoDado && (
              <p className="px-3 sm:px-4 py-2 text-xs text-amber-800 bg-amber-50/80 border-b border-amber-200/80 font-serif">
                Nenhuma coluna visível. Ative no cabeçalho com o ícone de olho.
              </p>
            )}
            {modoVisualLanc === 'detalhado' ? (
            <div className="w-full min-w-0 max-w-full rounded-b-lg overflow-auto max-h-[68vh] px-1 sm:px-2 pb-1">
              <table
                className="w-full min-w-[1550px] table-fixed border-collapse text-left text-[9px] sm:text-[11px] [word-break:break-word]"
                id="tabela-lancamentos-mes"
              >
                <colgroup>
                  <col style={{ width: `${lancWidthPct('acoes')}%` }} />
                  <col style={{ width: '3.8%' }} />
                  <col style={{ width: '6.8%' }} />
                  {LANC_COL_ORDER.map((k) => (
                    <col key={k} style={{ width: `${lancWidthPct(k)}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-slate-800/95 text-white text-[8px] sm:text-[9px] font-display">
                    <th className="py-1 px-0.5 sm:px-1 align-bottom font-medium">—</th>
                    <th className="py-1 px-0.5 sm:px-1 align-bottom font-medium text-center">#</th>
                    <th className="py-1 px-0.5 sm:px-1 align-bottom font-medium text-center">Data</th>
                    {LANC_TH.map(({ key, label, thTitle, borderL }) => {
                      const vis = colsLanc[key];
                      return (
                        <th
                          key={key}
                          className={[
                            'px-0.5 sm:px-1 align-bottom font-medium min-w-0',
                            'py-1',
                            borderL ? 'border-l border-slate-600/60' : '',
                            (key === 'rep1' || key === 'rep2') && vis ? 'text-left' : '',
                            !vis ? 'text-center bg-slate-700/55 text-slate-300' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={vis ? thTitle ?? label : 'Mostrar coluna'}
                        >
                          <div
                            className={[
                              'flex min-w-0 items-center gap-0.5',
                              vis ? 'justify-between' : 'justify-center',
                            ].join(' ')}
                          >
                            <span
                                className={[
                                  'flex-1 min-w-0 leading-tight [overflow-wrap:anywhere]',
                                vis ? 'text-left' : 'text-center text-slate-300',
                              ].join(' ')}
                            >
                              {label}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLancCol(key);
                              }}
                              className="shrink-0 rounded p-0.5 text-slate-200 transition hover:bg-slate-600/70 hover:text-white"
                              title={vis ? 'Ocultar coluna' : 'Mostrar coluna'}
                              aria-pressed={vis}
                            >
                              {vis ? <IconEye className="h-3 w-3" /> : <IconEyeOff className="h-3 w-3" />}
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {linhasTotais.map((l, i) => (
                    <tr key={l.id} className={i % 2 ? 'bg-coop-50/20' : 'bg-white border-t border-slate-100/90'}>
                      <td className="p-0.5 sm:p-1 align-middle min-w-0">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => editar(l.id)}
                            disabled={local.concluido}
                            className="text-coop-700 text-xs w-7 h-7 rounded hover:bg-coop-50 shrink-0 inline-flex items-center justify-center disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent"
                            title={
                              local.concluido
                                ? 'Mês fechado — reabra o mês para editar'
                                : 'Editar'
                            }
                            aria-label="Editar"
                          >
                            <IconPencil className="h-3 w-3 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(l.id)}
                            disabled={local.concluido}
                            className="text-rose-600 text-xs w-7 h-7 rounded hover:bg-rose-50 shrink-0 inline-flex items-center justify-center disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent"
                            title={
                              local.concluido
                                ? 'Mês fechado — reabra o mês para excluir'
                                : 'Excluir'
                            }
                            aria-label="Excluir"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      <td className="p-0.5 sm:p-1 align-middle min-w-0">
                        <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-center text-[9px] sm:text-[10px] font-semibold text-coop-900 py-0 px-0.5">
                          {i + 1}
                        </div>
                      </td>
                      <td className="p-0.5 sm:p-1 align-middle min-w-0">
                        <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-center text-[9px] sm:text-[10px] text-coop-900 py-0 px-0.5">
                          {formatarDataISO(l.dataProcedimento)}
                        </div>
                      </td>
                      {LANC_COL_ORDER.map((k) => {
                        if (!colsLanc[k]) {
                          return (
                            <td
                              key={k}
                              className="p-0.5 sm:p-1 align-middle min-w-0 bg-slate-100/95 text-slate-400"
                            >
                              <div className="w-full min-h-6 flex items-center justify-center text-[9px] sm:text-[10px] font-display">
                                Oculta
                              </div>
                            </td>
                          );
                        }
                        if (k === 'ins') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-6 flex items-center text-[9px] sm:text-[10px] text-coop-900 py-0 px-0.5 [overflow-wrap:anywhere]">
                                {l.instrumento}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'cod1') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-6 flex items-center text-[9px] sm:text-[10px] text-coop-900 py-0 px-0.5 [overflow-wrap:anywhere]">
                                {l.codigo1}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'proc1') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-top min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-[1.6rem] py-0.5 text-[9px] sm:text-[10px] leading-tight text-coop-900 [overflow-wrap:anywhere]">
                                {l.nome1}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'v1') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-end text-[9px] sm:text-[10px] text-right tabular-nums text-coop-900 py-0 px-0.5">
                                {l.valorPrimeiro}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'rep1') {
                          return (
                            <td
                              key={k}
                              className="p-0.5 sm:p-1 text-[8px] sm:text-[9px] text-coop-800 font-serif border-l border-slate-200/80 align-middle min-w-0 [overflow-wrap:anywhere]"
                            >
                              {(() => {
                                const q = quemRepasseEfetivo(l, local);
                                return q.incluirProfissional1
                                  ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—'
                                  : '—';
                              })()}
                            </td>
                          );
                        }
                        if (k === 'cod2') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-6 flex items-center text-[9px] sm:text-[10px] text-coop-900 py-0 px-0.5 [overflow-wrap:anywhere]">
                                {l.codigo2}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'proc2') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-top min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-[1.6rem] py-0.5 text-[9px] sm:text-[10px] leading-tight text-coop-900 [overflow-wrap:anywhere]">
                                {l.nome2}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'v2') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-end text-[9px] sm:text-[10px] text-right tabular-nums text-coop-900 py-0 px-0.5">
                                {l.valorSegundo}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'rep2') {
                          return (
                            <td
                              key={k}
                              className="p-0.5 sm:p-1 text-[8px] sm:text-[9px] text-coop-800 font-serif align-middle min-w-0 [overflow-wrap:anywhere]"
                            >
                              {(() => {
                                const q = quemRepasseEfetivo(l, local);
                                return q.incluirProfissional2
                                  ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—'
                                  : '—';
                              })()}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={k}
                            className="p-0.5 sm:p-1 font-mono text-[9px] sm:text-[10px] font-bold text-coop-800 tabular-nums text-right align-middle min-w-0"
                          >
                            {BRL.format(l.bruto)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : modoVisualLanc === 'resumo' ? (
              <div className="px-3 sm:px-4 py-3">
                <div className="overflow-x-auto rounded-xl border border-coop-200/60">
                  <table className="min-w-[700px] w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-800/95 text-white font-display text-[10px] sm:text-xs">
                        {RESUMO_TH.map(({ key, label, align }) => {
                          const vis = colsResumo[key];
                          return (
                            <th
                              key={key}
                              className={[
                                'px-3 py-2.5',
                                vis
                                  ? align === 'right'
                                    ? 'text-right'
                                    : align === 'center'
                                      ? 'text-center'
                                      : 'text-left'
                                  : 'text-center bg-slate-700/55 text-slate-300',
                              ].join(' ')}
                              title={vis ? label : 'Mostrar coluna'}
                            >
                              <div
                                className={[
                                  'flex items-center gap-1',
                                  vis ? (align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between') : 'justify-center',
                                ].join(' ')}
                              >
                                <span className={vis ? 'leading-tight' : 'leading-tight text-slate-300'}>{label}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleResumoCol(key);
                                  }}
                                  className="shrink-0 rounded p-0.5 text-slate-200 transition hover:bg-slate-600/70 hover:text-white"
                                  title={vis ? 'Ocultar coluna' : 'Mostrar coluna'}
                                  aria-pressed={vis}
                                >
                                  {vis ? <IconEye className="h-3.5 w-3.5" /> : <IconEyeOff className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="text-coop-800">
                      {resumoMedicos.map((r, i) => (
                        <tr key={r.medico} className={i % 2 ? 'bg-coop-50/25' : 'bg-white border-t border-slate-100/90'}>
                          {colsResumo.medico ? (
                            <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.medico}</td>
                          ) : (
                            <td className="px-3 py-2 text-center font-display text-slate-400 bg-slate-100/95">Oculta</td>
                          )}
                          {colsResumo.repasse ? (
                            <td className="px-3 py-2 text-center font-display font-semibold text-coop-700">{r.repasseTxt}</td>
                          ) : (
                            <td className="px-3 py-2 text-center font-display text-slate-400 bg-slate-100/95">Oculta</td>
                          )}
                          {colsResumo.recebe ? (
                            <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-coop-900">
                              {BRL.format(r.recebe)}
                            </td>
                          ) : (
                            <td className="px-3 py-2 text-center font-display text-slate-400 bg-slate-100/95">Oculta</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="px-3 sm:px-4 py-3">
                <div className="overflow-x-auto rounded-xl border border-coop-200/60">
                  <table className="min-w-[860px] w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-800/95 text-white font-display text-[10px] sm:text-xs">
                        <th className="px-3 py-2.5 text-left">Prontuário</th>
                        <th className="px-3 py-2.5 text-left">Nome do paciente</th>
                        <th className="px-3 py-2.5 text-left">Médico principal</th>
                        <th className="px-3 py-2.5 text-left">Médico auxiliar</th>
                        <th className="px-3 py-2.5 text-left">Data da cirurgia</th>
                      </tr>
                    </thead>
                    <tbody className="text-coop-800">
                      {tabelaPacientes.map((r, i) => (
                        <tr key={`${r.prontuario}-${r.paciente}-${i}`} className={i % 2 ? 'bg-coop-50/25' : 'bg-white border-t border-slate-100/90'}>
                          <td className="px-3 py-2 font-mono tabular-nums">{r.prontuario}</td>
                          <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.paciente}</td>
                          <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.medicoPrincipal}</td>
                          <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.medicoAuxiliar}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">{r.dataCirurgia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        {linhasTotais.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-coop-200/60 bg-coop-50/20">
            {modoVisualLanc === 'pacientes' ? (
              <>
                <span className="text-xs text-coop-500 font-serif">Total de registros</span>
                <span className="text-lg font-bold text-coop-900 font-mono tabular-nums">
                  {tabelaPacientes.length}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-coop-500 font-serif">Soma</span>
                <span className="text-lg font-bold text-coop-900 font-mono tabular-nums">
                  {BRL.format(modoVisualLanc === 'resumo' ? somaResumoMedicos : valorBruto)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { t: 'Valor cobrança', v: BRL.format(valorBruto) },
          { t: `Margem coop. (${MARGEM_COOP_PCT}%)`, v: BRL.format(margemRetidaTotal) },
          { t: `Repasse (${PCT.format(REPASSE_FRAC_LINHA * 100)}%)`, v: BRL.format(repasseTotal) },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-coop-200/50 bg-gradient-to-b from-coop-50/40 to-white p-3">
            <p className="text-[10px] font-semibold uppercase text-coop-500 font-display tracking-wide">{c.t}</p>
            <p className="text-sm sm:text-base font-bold text-coop-900 font-mono tabular-nums mt-0.5">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end">
        <button
          type="button"
          className="text-sm text-coop-800 underline font-display"
          onClick={() => {
            const vis = local.mostrarDetalheCalculo !== false;
            persist({ ...local, mostrarDetalheCalculo: !vis });
          }}
        >
          {local.mostrarDetalheCalculo !== false ? 'Ocultar detalhe do cálculo' : 'Mostrar detalhe do cálculo'}
        </button>
      </div>

      {local.mostrarDetalheCalculo !== false && (
      <div className="rounded-2xl border border-coop-200/50 bg-white overflow-hidden">
        <h2 className="text-sm font-bold text-coop-900 font-display px-4 py-3 border-b border-coop-200/50">Detalhe do cálculo</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-coop-100/50 text-coop-800 text-left text-xs font-display">
                <th className="px-3 py-2.5 w-[28%]">Etapas</th>
                <th className="px-3 py-2.5 w-[50%]">Fórmula</th>
                <th className="px-3 py-2.5 text-right">R$</th>
              </tr>
            </thead>
            <tbody className="text-coop-800 font-serif text-xs sm:text-sm">
              <tr className="border-b border-coop-100">
                <td className="px-3 py-2 font-bold font-display">Valor cobrança</td>
                <td className="px-3 py-2">Soma por linha: 1.º + 2.º (contribuição bruta)</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{BRL.format(valorBruto)}</td>
              </tr>
              <tr className="border-b border-coop-100">
                <td className="px-3 py-2 font-bold font-display">Margem cooperativa</td>
                <td className="px-3 py-2">
                  Por linha: margem = {MARGEM_COOP_PCT}% do bruto; repasse da linha = {PCT.format(REPASSE_FRAC_LINHA * 100)}% do
                  mesmo bruto
                </td>
                <td className="px-3 py-2 text-right font-mono">−{BRL.format(margemRetidaTotal)}</td>
              </tr>
              <tr className="border-b border-coop-100">
                <td className="px-3 py-2 font-bold font-display">Repasse aos médicos</td>
                <td className="px-3 py-2">
                  Soma por linha: {PCT.format(REPASSE_FRAC_LINHA * 100)}% do bruto (valor a dividir entre 1.º e 2.º)
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{BRL.format(repasseTotal)}</td>
              </tr>
              <tr className="border-b border-coop-100">
                <td className="px-3 py-2 font-bold font-display">Rep. 1.º méd.</td>
                <td className="px-3 py-2">
                  Parte do repasse da linha quando incluído. Ver <span className="font-display">Lançamentos do mês</span>.
                </td>
                <td className="px-3 py-2 text-right font-mono">{BRL.format(repasse1)}</td>
              </tr>
              <tr className="border-b border-coop-100">
                <td className="px-3 py-2 font-bold font-display">Rep. 2.º méd.</td>
                <td className="px-3 py-2">
                  Quando há 1.º e 2.º: 2.º recebe até {PCT.format(r2Pct * 100)}% do que couber ao 1.º na mesma linha
                  (parâmetro abaixo).
                </td>
                <td className="px-3 py-2 text-right font-mono">{BRL.format(repasse2)}</td>
              </tr>
              <tr className="bg-coop-50/30">
                <td className="px-3 py-2 font-bold font-display">Repasse total</td>
                <td className="px-3 py-2">Soma dos repasses 1.º + 2.º (equivale ao total «Repasse aos médicos», salvo arredondamentos)</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{BRL.format(repasseTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-coop-200/50 p-4 bg-coop-50/30">
        <p className="text-sm text-coop-800 font-serif font-display font-bold">
          {mesesNomes[Number(mesMM) - 1]} {ano}
        </p>
        <button
          type="button"
          className={`btn w-full sm:w-auto ${local.concluido ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => persist({ ...local, concluido: !local.concluido })}
        >
          {local.concluido ? 'Reabrir mês' : 'Marcar mês como concluído'}
        </button>
      </div>

      {modalParams && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button type="button" className="absolute inset-0 bg-coop-950/50 backdrop-blur-sm" onClick={cancelarParametros} aria-label="Fechar" />
          <div className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl border border-coop-200/70 shadow-2xl max-h-[95dvh] flex flex-col rounded-t-2xl sm:rounded-2xl mt-8 sm:mt-0">
            <div className="px-5 py-3 border-b border-coop-200/60">
              <h2 className="text-lg font-bold text-coop-900 font-display">Parâmetros do cálculo</h2>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-sm text-coop-700 leading-snug">
                O repasse por linha é <strong>{PCT.format(REPASSE_FRAC_LINHA * 100)}% da contribuição bruta</strong> (soma dos
                valores 1.º e 2.º); a cooperativa retém <strong>{MARGEM_COOP_PCT}%</strong>. Não há deflator nem custo
                administrativo no cálculo.
              </p>
              <div>
                <label className="text-sm font-semibold text-coop-800">Rep. 2.º no repasse da linha %</label>
                <input
                  className="input w-full mt-0.5"
                  value={rascunho.repasse2MedPct}
                  onChange={(e) => setRascunho((d) => ({ ...d, repasse2MedPct: e.target.value }))}
                  disabled={!(rascunho.incluirProfissional1 && rascunho.incluirProfissional2)}
                />
              </div>
              <div className="pt-1 border-t border-coop-200/50">
                <p className="text-sm font-semibold text-coop-800">Quem recebe</p>
                <div className="space-y-3">
                  <div
                    className={`rounded-lg border p-2.5 ${
                      rascunho.incluirProfissional1 ? 'border-coop-200/80' : 'border-coop-200/40'
                    }`}
                  >
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-coop-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-coop-300"
                        checked={rascunho.incluirProfissional1}
                        onChange={(e) => setRascunho((d) => ({ ...d, incluirProfissional1: e.target.checked }))}
                      />
                      1.º profissional
                    </label>
                  </div>
                  <div
                    className={`rounded-lg border p-2.5 ${
                      rascunho.incluirProfissional2 ? 'border-coop-200/80' : 'border-coop-200/40'
                    }`}
                  >
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-coop-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-coop-300"
                        checked={rascunho.incluirProfissional2}
                        onChange={(e) => setRascunho((d) => ({ ...d, incluirProfissional2: e.target.checked }))}
                      />
                      2.º profissional
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-coop-200/50 flex flex-wrap justify-end gap-2 bg-coop-50/30">
              <button type="button" className="btn btn-secondary" onClick={cancelarParametros}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={salvarParametros}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalBaseProcedimentos && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-base-procedimentos"
        >
          <button
            type="button"
            className="absolute inset-0 bg-coop-950/50 backdrop-blur-sm"
            onClick={() => setModalBaseProcedimentos(false)}
            aria-label="Fechar"
          />
          <div className="relative z-10 flex h-[min(90dvh,800px)] w-full max-w-6xl flex-col sm:rounded-2xl sm:border sm:border-coop-200/70 sm:shadow-2xl sm:mt-0 mt-8 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-coop-200/60 px-4 py-3 sm:px-5">
              <h2
                id="titulo-base-procedimentos"
                className="text-lg font-bold text-coop-900 font-display"
              >
                Base de procedimentos
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalBaseProcedimentos(false)}
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 sm:px-4 pb-4">
              <table className="w-full min-w-[880px] border-collapse text-left text-xs text-coop-800">
                <thead className="sticky top-0 z-[1] bg-slate-800/95 text-[10px] font-display font-semibold uppercase text-white sm:text-xs">
                  <tr>
                    <th className="px-2 py-2.5 sm:px-3">Instrumento</th>
                    <th className="px-2 py-2.5 sm:px-3">Código 1</th>
                    <th className="px-2 py-2.5 sm:px-3 min-w-[12rem]">1 Procedimento</th>
                    <th className="px-2 py-2.5 sm:px-3 text-right">Valor 1 (R$)</th>
                    <th className="px-2 py-2.5 sm:px-3">Código 2</th>
                    <th className="px-2 py-2.5 sm:px-3 min-w-[12rem]">2 Procedimento</th>
                    <th className="px-2 py-2.5 sm:px-3 text-right">Valor 2 (R$)</th>
                    <th className="px-2 py-2.5 sm:px-3 min-w-[14rem]">Chave Busca</th>
                  </tr>
                </thead>
                <tbody className="font-serif text-[11px] sm:text-sm">
                  {procedimentosBase.map((b, idx) => (
                    <tr
                      key={b.id}
                      className={idx % 2 ? 'bg-coop-50/30' : 'bg-white border-t border-slate-100/90'}
                    >
                      <td className="px-2 py-1.5 sm:px-3 align-top font-mono font-medium text-amber-900/90">
                        {b.instrumento}
                      </td>
                      <td className="px-2 py-1.5 sm:px-3 align-top font-mono [overflow-wrap:anywhere]">{b.codigo1}</td>
                      <td className="px-2 py-1.5 sm:px-3 align-top [overflow-wrap:anywhere]">{b.nome1}</td>
                      <td className="px-2 py-1.5 sm:px-3 text-right font-mono tabular-nums">{BRL.format(b.valor1)}</td>
                      <td className="px-2 py-1.5 sm:px-3 align-top font-mono [overflow-wrap:anywhere]">{b.codigo2}</td>
                      <td className="px-2 py-1.5 sm:px-3 align-top [overflow-wrap:anywhere]">{b.nome2}</td>
                      <td className="px-2 py-1.5 sm:px-3 text-right font-mono tabular-nums">{BRL.format(b.valor2)}</td>
                      <td className="px-2 py-1.5 sm:px-3 text-[10px] sm:text-xs text-coop-600 [overflow-wrap:anywhere]">
                        {chaveDeBase(b)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatoriosProcedimentos;
