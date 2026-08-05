/**
 * Parser e normalização de colagem (Excel/Forms/TSV) → payload de importação em lote.
 * Cabeçalhos no formato "Nome Completo do Proponente", etc.
 */

export type ImportPreviewRow = {
  index: number;
  raw: Record<string, string>;
  payload: ImportLotePayloadRow | null;
  errors: string[];
};

export type ImportLotePayloadRow = {
  nomeCompleto: string;
  email: string;
  cpf: string;
  profissao: string;
  telefone?: string;
  estadoCivil?: string;
  enderecoResidencial?: string;
  dadosBancarios?: string;
  chavePix?: string;
  crm?: string;
  especialidades?: string[];
  aceitouTermos?: boolean;
  dadosGcoop: Record<string, unknown>;
};

/** Alias normalizado do cabeçalho → campo wizard */
const HEADER_ALIASES: Array<{ field: string; matchers: string[] }> = [
  { field: 'nomeCompleto', matchers: ['nome completo do proponente', 'nome completo', 'nome'] },
  { field: 'email', matchers: ['e-mail do proponente', 'email do proponente', 'e-mail', 'email'] },
  { field: 'cpf', matchers: ['cpf do proponente', 'cpf'] },
  { field: 'pis', matchers: ['numero do pis', 'número do pis', 'pis do proponente', 'pis'] },
  { field: 'rg', matchers: ['rg do proponente', 'rg'] },
  {
    field: 'rgDataExpedicao',
    matchers: ['data de expedicao do rg', 'data de expedição do rg', 'data expedicao rg'],
  },
  {
    field: 'rgOrgaoExpedicao',
    matchers: ['orgao de expedicao do rg', 'órgão de expedição do rg', 'orgao expedicao'],
  },
  {
    field: 'rgUfOrgao',
    matchers: ['uf do orgao de expedicao', 'uf do órgão de expedição', 'uf orgao'],
  },
  {
    field: 'tituloEleitor',
    matchers: ['numero do titulo de eleitor', 'número do título de eleitor', 'titulo de eleitor', 'título de eleitor'],
  },
  { field: 'dataNascimento', matchers: ['data de nascimento', 'nascimento'] },
  { field: 'sexo', matchers: ['sexo'] },
  { field: 'estadoCivil', matchers: ['estado civil'] },
  { field: 'regimeComunhao', matchers: ['regime de comunhao', 'regime de comunhão', 'regime'] },
  { field: 'tipoSanguineo', matchers: ['tipo sanguineo', 'tipo sanguíneo'] },
  { field: 'grauInstrucao', matchers: ['grau de instrucao', 'grau de instrução', 'grau'] },
  { field: 'nacionalidade', matchers: ['nacionalidade'] },
  {
    field: 'estadoNaturalidade',
    matchers: ['estado da naturalidade', 'uf naturalidade'],
  },
  {
    field: 'cidadeNaturalidade',
    matchers: ['cidade da naturalidade', 'cidade naturalidade'],
  },
  { field: 'nomePai', matchers: ['nome do pai'] },
  { field: 'nomeMae', matchers: ['nome da mae', 'nome da mãe'] },
  { field: 'cep', matchers: ['cep'] },
  { field: 'rua', matchers: ['rua', 'logradouro'] },
  { field: 'numero', matchers: ['numero', 'número'] },
  { field: 'bairro', matchers: ['bairro'] },
  { field: 'estado', matchers: ['estado'] },
  { field: 'cidade', matchers: ['cidade'] },
  { field: 'complemento', matchers: ['complemento'] },
  { field: 'dddResidencial', matchers: ['ddd residencial'] },
  { field: 'telefoneResidencial', matchers: ['telefone residencial'] },
  { field: 'dddCelular', matchers: ['ddd celular'] },
  { field: 'telefoneCelular', matchers: ['telefone celular'] },
  { field: 'conselhoClasse', matchers: ['conselho de classe', 'conselho'] },
  {
    field: 'numeroConselho',
    matchers: ['numero no conselho', 'número no conselho', 'numero do conselho'],
  },
  {
    field: 'categoriaProfissional',
    matchers: ['categoria profissional', 'categoria'],
  },
  {
    field: 'especialidadeProfissional',
    matchers: ['especialidade profissional', 'especialidade'],
  },
  { field: 'banco', matchers: ['banco'] },
  { field: 'agencia', matchers: ['agencia', 'agência'] },
  { field: 'conta', matchers: ['conta'] },
  { field: 'digitoConta', matchers: ['digito da conta', 'dígito da conta', 'digito', 'dígito'] },
  {
    field: 'termoConsentimento',
    matchers: ['termo de consentimento', 'termo', 'consentimento'],
  },
];

const UF_BY_NAME: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normHeader(s: string): string {
  return stripAccents(String(s || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function onlyDigits(s: string): string {
  return String(s || '').replace(/\D/g, '');
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cols.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
}

/** CSV/TSV com aspas e quebras de linha em células. */
export function parseTableText(text: string): string[][] {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  // Detecção de delimitador pela primeira linha “simples”
  const firstNl = raw.indexOf('\n');
  const probe = firstNl >= 0 ? raw.slice(0, firstNl) : raw;
  let delimiter = '\t';
  if ((probe.match(/\t/g) || []).length >= 2) delimiter = '\t';
  else if ((probe.match(/;/g) || []).length >= 5) delimiter = ';';
  else if ((probe.match(/,/g) || []).length >= 5) delimiter = ',';
  else delimiter = '\t';

  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  const flush = () => {
    const line = cur;
    cur = '';
    if (!line.trim()) return;
    rows.push(parseDelimitedLine(line, delimiter));
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        cur += ch;
      }
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && raw[i + 1] === '\n') i++;
      flush();
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) flush();

  // Fallback: se só 1 coluna e linha com muitos espaços, tenta 2+ espaços
  if (rows.length && rows.every((r) => r.length === 1) && rows[0][0].includes('  ')) {
    return rows.map((r) =>
      r[0]
        .split(/\s{2,}/)
        .map((c) => c.trim())
        .filter(Boolean)
    );
  }

  return rows;
}

function matchHeaderField(headerCell: string): string | null {
  const n = normHeader(headerCell);
  if (!n) return null;
  // Termo LGPD longo
  if (n.includes('termo de consentimento') || n.includes('lgpd') || n.startsWith('voce autoriza')) {
    return 'termoConsentimento';
  }
  // prefer longest/most specific matcher first
  let best: { field: string; len: number } | null = null;
  for (const { field, matchers } of HEADER_ALIASES) {
    for (const m of matchers) {
      if (n === m || n.startsWith(m) || n.includes(m)) {
        if (!best || m.length > best.len) best = { field, len: m.length };
      }
    }
  }
  return best?.field ?? null;
}

function toIsoDate(value: string): string {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) {
    const d = br[1].padStart(2, '0');
    const m = br[2].padStart(2, '0');
    return `${br[3]}-${m}-${d}`;
  }
  return s;
}

function toUf(value: string): string {
  const s = stripAccents(value).trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const key = s.toLowerCase().replace(/\s+/g, ' ');
  return UF_BY_NAME[key] || s.slice(0, 2).toUpperCase();
}

function mapSexo(value: string): string {
  const n = normHeader(value);
  if (n.startsWith('masc')) return 'masculino';
  if (n.startsWith('fem')) return 'feminino';
  if (n.includes('nao informar') || n.includes('prefiro')) return 'prefiro-nao-informar';
  return 'outro';
}

function mapEstadoCivil(value: string): string {
  const n = normHeader(value);
  if (n.startsWith('casad')) return 'casado';
  if (n.startsWith('solteir')) return 'solteiro';
  if (n.startsWith('divorci')) return 'divorciado';
  if (n.startsWith('viuv')) return 'viuvo';
  if (n.includes('uniao') || n.includes('estavel')) return 'uniao-estavel';
  return value.trim();
}

function mapEstadoCivilLabel(value: string): string {
  const key = mapEstadoCivil(value);
  const labels: Record<string, string> = {
    solteiro: 'Solteiro(a)',
    casado: 'Casado(a)',
    divorciado: 'Divorciado(a)',
    viuvo: 'Viúvo(a)',
    'uniao-estavel': 'União estável',
  };
  return labels[key] || value.trim();
}

function mapRegime(value: string): string {
  const n = normHeader(value);
  if (!n) return '';
  if (n.includes('parcial')) return 'comunhao-parcial';
  if (n.includes('universal')) return 'comunhao-universal';
  if (n.includes('separacao') || n.includes('total')) return 'separacao-total';
  if (n.includes('participacao') || n.includes('aquestos')) return 'participacao-final';
  return value.trim();
}

function mapGrau(value: string): string {
  const n = normHeader(value);
  if (n.includes('doutor')) return 'doutorado';
  if (n.includes('mestrado')) return 'mestrado';
  if (n.includes('pos') || n.includes('especializ')) return 'pos-graduacao';
  if (n.includes('superior incompleto')) return 'superior-incompleto';
  if (n.includes('superior')) return 'superior-completo';
  if (n.includes('medio incompleto') || n.includes('medio incomple')) return 'medio-incompleto';
  if (n.includes('medio')) return 'medio-completo';
  if (n.includes('fundamental incompleto')) return 'fundamental-incompleto';
  if (n.includes('fundamental')) return 'fundamental-completo';
  return value.trim();
}

function mapConselho(value: string): string {
  const n = normHeader(value).replace(/\s+/g, '');
  const known = ['coren', 'crm', 'crefito', 'crn', 'crf', 'crp', 'crfa', 'cress', 'cro', 'crbm'];
  for (const k of known) {
    if (n === k || n.includes(k)) return k;
  }
  if (n.startsWith('outro') || n === 'inexiste' || n === 'inexist') return 'outro';
  return value.trim().toLowerCase() || 'outro';
}

function mapBancoCode(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length >= 3) return digits.slice(0, 3);
  const n = normHeader(value);
  if (n.includes('brasil') || n.includes('bb')) return '001';
  if (n.includes('santander')) return '033';
  if (n.includes('caixa')) return '104';
  if (n.includes('bradesco')) return '237';
  if (n.includes('itau')) return '341';
  if (n.includes('nubank')) return '260';
  if (n.includes('inter')) return '077';
  return value.trim();
}

function mapProfissao(value: string): string {
  const n = normHeader(value);
  if (n.includes('dentista') || n.includes('cirurgiao')) return 'Cirurgião-Dentista';
  if (n.includes('medico') || n === 'medicina') return 'Médico';
  if (n.includes('enfermeiro') || n === 'enfermagem') return 'Enfermeiro';
  if (n.includes('tecnico') && n.includes('enferm')) return 'Técnico em Enfermagem';
  if (n.includes('fisioter')) return 'Fisioterapeuta';
  if (n.includes('nutri')) return 'Nutricionista';
  if (n.includes('farmac')) return 'Farmacêutico';
  if (n.includes('psicolog')) return 'Psicólogo';
  if (n.includes('fono')) return 'Fonoaudiólogo';
  if (n.includes('assistente social') || n.includes('servico social')) return 'Serviço Social';
  const t = value.trim();
  return t.slice(0, 80) || 'Profissional da saúde';
}

function mapTermo(value: string): boolean {
  const n = normHeader(value);
  if (!n) return true; // import admin assume aceite se vazio
  if (['sim', 's', 'yes', 'y', 'true', '1', 'aceito', 'concordo'].includes(n)) return true;
  if (['nao', 'n', 'no', 'false', '0'].includes(n)) return false;
  return n.includes('sim') || n.includes('autorizo') || n.includes('aceito');
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.map(normHeader).join(' | ');
  return (
    (joined.includes('cpf') && joined.includes('nome')) ||
    joined.includes('nome completo do proponente') ||
    joined.includes('e-mail do proponente') ||
    joined.includes('email do proponente')
  );
}

export function parseImportPaste(text: string): {
  headers: string[];
  fieldOrder: (string | null)[];
  rows: ImportPreviewRow[];
  parseError?: string;
} {
  const table = parseTableText(text);
  if (!table.length) {
    return { headers: [], fieldOrder: [], rows: [], parseError: 'Nenhum dado colado.' };
  }

  let headerIdx = table.findIndex((r) => isHeaderRow(r));
  if (headerIdx < 0) {
    // Heurística: se a 1ª coluna parece cabeçalho longo de termo / Nome
    headerIdx = 0;
  }

  const headerCells = table[headerIdx];
  const fieldOrder = headerCells.map(matchHeaderField);

  // Precisa mapear ao menos CPF + nome ou email
  const hasCpf = fieldOrder.includes('cpf');
  const hasNome = fieldOrder.includes('nomeCompleto');
  if (!hasCpf || !hasNome) {
    return {
      headers: headerCells,
      fieldOrder,
      rows: [],
      parseError:
        'Não foi possível identificar as colunas. Cole incluindo a linha de cabeçalho (Nome Completo, CPF, E-mail, …). Prefira copiar do Excel (separado por tab).',
    };
  }

  const dataRows = table.slice(headerIdx + 1).filter((r) => r.some((c) => c.trim()));
  const rows: ImportPreviewRow[] = dataRows.map((cells, i) => {
    const raw: Record<string, string> = {};
    fieldOrder.forEach((field, col) => {
      if (!field) return;
      const val = (cells[col] ?? '').trim();
      if (val) raw[field] = val;
    });

    const errors: string[] = [];
    const nomeCompleto = (raw.nomeCompleto || '').trim();
    const email = (raw.email || '').trim().toLowerCase();
    const cpf = onlyDigits(raw.cpf || '');
    if (!nomeCompleto) errors.push('Nome obrigatório');
    if (!email || !email.includes('@')) errors.push('E-mail inválido');
    if (cpf.length !== 11) errors.push('CPF deve ter 11 dígitos');

    const profissao = mapProfissao(raw.categoriaProfissional || '');
    const termOk = mapTermo(raw.termoConsentimento || 'Sim');
    if (!termOk) errors.push('Termo de consentimento não aceito');

    const sexo = mapSexo(raw.sexo || '');
    const estadoCivilKey = mapEstadoCivil(raw.estadoCivil || '');
    const estadoCivilLabel = mapEstadoCivilLabel(raw.estadoCivil || '');
    const ufEnd = toUf(raw.estado || raw.estadoNaturalidade || 'CE');
    const ufNat = toUf(raw.estadoNaturalidade || raw.estado || 'CE');
    const ufOrgao = toUf(raw.rgUfOrgao || ufEnd);

    const dadosGcoop: Record<string, unknown> = {
      nomeCompleto,
      email,
      cpf,
      pis: raw.pis || '',
      rg: raw.rg || '',
      rgDataExpedicao: toIsoDate(raw.rgDataExpedicao || ''),
      rgOrgaoExpedicao: (raw.rgOrgaoExpedicao || 'ssp').toLowerCase(),
      rgUfOrgao: ufOrgao,
      tituloEleitor: onlyDigits(raw.tituloEleitor || ''),
      dataNascimento: toIsoDate(raw.dataNascimento || ''),
      sexo,
      estadoCivil: estadoCivilKey,
      regimeComunhao: mapRegime(raw.regimeComunhao || ''),
      tipoSanguineo: (raw.tipoSanguineo || '').toUpperCase().replace(/\s+/g, ''),
      grauInstrucao: mapGrau(raw.grauInstrucao || ''),
      nacionalidade:
        normHeader(raw.nacionalidade || '').includes('brasil') || !raw.nacionalidade
          ? 'Brasileira'
          : raw.nacionalidade.trim(),
      estadoNaturalidade: ufNat,
      cidadeNaturalidade: (raw.cidadeNaturalidade || '').trim(),
      nomePai: (raw.nomePai || '').trim(),
      nomeMae: (raw.nomeMae || '').trim(),
      cep: onlyDigits(raw.cep || ''),
      rua: (raw.rua || '').trim(),
      numero: (raw.numero || '').trim(),
      bairro: (raw.bairro || '').trim(),
      estado: ufEnd,
      cidade: (raw.cidade || '').trim(),
      complemento: (raw.complemento || '').trim(),
      dddResidencial: onlyDigits(raw.dddResidencial || '').slice(0, 2),
      telefoneResidencial: onlyDigits(raw.telefoneResidencial || ''),
      dddCelular: onlyDigits(raw.dddCelular || '').slice(0, 2),
      telefoneCelular: onlyDigits(raw.telefoneCelular || ''),
      conselhoClasse: mapConselho(raw.conselhoClasse || 'outro'),
      numeroConselho: (raw.numeroConselho || '').trim(),
      categoriaProfissional: 'outro',
      categoriaProfissionalDetalhe: (raw.categoriaProfissional || profissao).trim(),
      especialidadeProfissional: (raw.especialidadeProfissional || '').trim(),
      banco: mapBancoCode(raw.banco || ''),
      agencia: (raw.agencia || '').trim(),
      conta: (raw.conta || '').trim(),
      digitoConta: (raw.digitoConta || '').trim(),
      termoConsentimento: termOk,
    };

    const ddd = String(dadosGcoop.dddCelular || '');
    const tel = String(dadosGcoop.telefoneCelular || '');
    const telefone = ddd && tel ? `(${ddd}) ${tel}` : undefined;

    const payload: ImportLotePayloadRow | null =
      errors.length === 0
        ? {
            nomeCompleto,
            email,
            cpf,
            profissao,
            telefone,
            estadoCivil: estadoCivilLabel,
            crm: (raw.numeroConselho || '').trim() || undefined,
            especialidades: (raw.especialidadeProfissional || '').trim()
              ? [(raw.especialidadeProfissional || '').trim()]
              : undefined,
            aceitouTermos: termOk,
            dadosGcoop,
          }
        : null;

    return { index: i + 1, raw, payload, errors };
  });

  return { headers: headerCells, fieldOrder, rows };
}
