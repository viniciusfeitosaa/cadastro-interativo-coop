/**
 * Importa cadastros a partir de TSV exportado (Google Forms / planilha).
 * Links do Google Drive são ignorados — apenas dados textuais são importados.
 *
 * Uso: node import-registrations.js [caminho-do-arquivo.tsv]
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { insertCadastro, listCadastros } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultPath = join(__dirname, 'data', 'import-source.tsv')

const COL = {
  timestamp: 0,
  nomeCompleto: 1,
  email: 2,
  cpf: 3,
  pis: 4,
  rg: 5,
  rgDataExpedicao: 6,
  rgOrgaoExpedicao: 7,
  rgUfOrgao: 8,
  tituloEleitor: 9,
  dataNascimento: 10,
  sexo: 11,
  estadoCivil: 12,
  regimeComunhao: 13,
  tipoSanguineo: 14,
  grauInstrucao: 15,
  nacionalidade: 16,
  estadoNaturalidade: 17,
  cidadeNaturalidade: 18,
  nomePai: 19,
  nomeMae: 20,
  cep: 21,
  rua: 22,
  numero: 23,
  bairro: 24,
  estado: 25,
  cidade: 26,
  complemento: 27,
  dddResidencial: 28,
  telefoneResidencial: 29,
  dddCelular: 30,
  telefoneCelular: 31,
  conselhoClasse: 32,
  numeroConselho: 33,
  categoriaProfissional: 34,
  especialidadeProfissional: 35,
  banco: 36,
  agencia: 37,
  conta: 38,
  digitoConta: 39,
  termoConsentimento: 40,
  // 41-54: colunas de anexos (ignoradas)
  categoriaDetalhe: 55,
  emailAlt: 56,
  pix: 57,
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function clean(value) {
  const s = String(value ?? '').trim()
  return s === '' || /^n[aã]o(\s+tem)?$/i.test(s) || s === '-' || s === '.' ? '' : s
}

function parseDateBr(value) {
  const s = clean(value)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return s
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseTimestampBr(value) {
  const s = clean(value)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, d, mo, y, h, mi, se] = m
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(se),
  )
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeCpf(value) {
  const digits = onlyDigits(value)
  if (digits.length === 11) return digits
  if (digits.length > 11) return digits.slice(0, 11)
  return digits
}

function normalizeSexo(value) {
  const s = clean(value).toLowerCase()
  if (s.startsWith('fem')) return 'feminino'
  if (s.startsWith('masc')) return 'masculino'
  if (s.includes('prefiro')) return 'prefiro-nao-informar'
  if (s) return 'outro'
  return ''
}

function normalizeEstadoCivil(value) {
  const s = clean(value).toLowerCase()
  if (s.includes('solteir')) return 'solteiro'
  if (s.includes('casad')) return 'casado'
  if (s.includes('divorciad')) return 'divorciado'
  if (s.includes('viúv') || s.includes('viuv')) return 'viuvo'
  if (s.includes('união') || s.includes('uniao') || s.includes('estável') || s.includes('estavel'))
    return 'uniao-estavel'
  return ''
}

function normalizeRegime(value) {
  const s = clean(value).toLowerCase()
  if (!s) return ''
  if (s.includes('universal') || s.includes('total de bens') || s.includes('comunhão total'))
    return 'comunhao-universal'
  if (s.includes('separa') || s.includes('separacao')) return 'separacao-total'
  if (s.includes('particip')) return 'participacao-final'
  if (s.includes('parcial') || s.includes('comunhão') || s.includes('comunhao') || s.includes('bens'))
    return 'comunhao-parcial'
  return ''
}

function normalizeTipoSanguineo(value) {
  let s = clean(value).toUpperCase().replace(/\s+/g, '')
  s = s.replace('POSITIVO', '+').replace('NEGATIVO', '-')
  s = s.replace('O+', 'O+').replace('A+', 'A+').replace('B+', 'B+').replace('AB+', 'AB+')
  const valid = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  for (const v of valid) {
    if (s.includes(v.replace('+', '')) && s.includes('+')) {
      const key = v
      if (valid.includes(key)) return key
    }
  }
  if (valid.includes(s)) return s
  const compact = s.replace(/[^ABO+-]/g, '')
  return valid.includes(compact) ? compact : clean(value)
}

function normalizeGrauInstrucao(value) {
  const s = clean(value).toLowerCase()
  if (!s) return ''
  if (s.includes('doutor')) return 'doutorado'
  if (s.includes('mestr')) return 'mestrado'
  if (s.includes('pós') || s.includes('pos-')) return 'pos-graduacao'
  if (s.includes('superior')) return 'superior-completo'
  if (s.includes('técnico') || s.includes('tecnico')) return 'medio-completo'
  if (s.includes('médio') || s.includes('medio')) return 'medio-completo'
  if (s.includes('fundamental')) return 'fundamental-completo'
  return ''
}

function normalizeConselho(value) {
  const s = clean(value).toUpperCase()
  if (s.includes('COREN')) return 'coren'
  if (s.includes('CRM')) return 'crm'
  if (s.includes('CREFITO')) return 'crefito'
  if (s.includes('CRN')) return 'crn'
  if (s.includes('CRF') && !s.includes('CREFITO')) return 'crf'
  if (s.includes('CRP')) return 'crp'
  if (s.includes('CRFA') || s.includes('CRO')) return 'crfa'
  if (s) return 'outro'
  return ''
}

function inferCategoriaProfissional(text) {
  const s = clean(text).toLowerCase()
  if (!s) return 'outro'
  if (s.includes('enfermeir') && !s.includes('técnic') && !s.includes('tecnic'))
    return 'enfermagem'
  if (s.includes('médic') || s.includes('medic') || s.includes('cirurgião dentista'))
    return 'medicina'
  if (s.includes('fisioter')) return 'fisioterapia'
  if (s.includes('nutri')) return 'nutricao'
  if (s.includes('farmác') || s.includes('farmace')) return 'farmacia'
  if (s.includes('psicólog') || s.includes('psicolog')) return 'psicologia'
  if (s.includes('fonoaud')) return 'fonoaudiologia'
  if (
    s.includes('técnic') ||
    s.includes('tecnic') ||
    s.includes('enfermagem') ||
    s.includes('socorrista') ||
    s.includes('condutor')
  )
    return 'tecnico-enfermagem'
  return 'outro'
}

function normalizeUf(value) {
  const s = clean(value).toUpperCase()
  if (s.length === 2) return s
  if (s.includes('CEARÁ') || s.includes('CEARA') || s === 'CE') return 'CE'
  if (s.includes('PERNAMBUCO') || s === 'PE') return 'PE'
  if (s.includes('PIAUÍ') || s.includes('PIAUI') || s === 'PI') return 'PI'
  return s.slice(0, 2)
}

function isDataRow(line) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\t/.test(line)
}

function parseTsvLines(content) {
  const lines = content.split(/\r?\n/)
  return lines.filter((line) => isDataRow(line))
}

function rowToCadastro(cols) {
  const get = (key) => clean(cols[COL[key]] ?? '')

  const cpf = normalizeCpf(cols[COL.cpf])
  const email = get('email') || get('emailAlt')
  const nomeCompleto = get('nomeCompleto')

  if (!nomeCompleto || !cpf || cpf.length < 10) return null

  const catDetalhe = get('categoriaDetalhe') || get('categoriaProfissional') || get('especialidadeProfissional')
  const pix = get('pix')
  const emailFinal =
    email.includes('@') ? email : pix.includes('@') ? pix : email

  const dados = {
    nomeCompleto,
    email: emailFinal,
    cpf,
    pis: onlyDigits(cols[COL.pis]) || cpf,
    dataNascimento: parseDateBr(cols[COL.dataNascimento]),
    sexo: normalizeSexo(cols[COL.sexo]),
    estadoCivil: normalizeEstadoCivil(cols[COL.estadoCivil]),
    regimeComunhao: normalizeRegime(cols[COL.regimeComunhao]),
    tipoSanguineo: normalizeTipoSanguineo(cols[COL.tipoSanguineo]),
    grauInstrucao: normalizeGrauInstrucao(cols[COL.grauInstrucao]),
    nacionalidade: get('nacionalidade') || 'Brasileira',
    estadoNaturalidade: get('estadoNaturalidade'),
    cidadeNaturalidade: get('cidadeNaturalidade'),
    nomePai: get('nomePai'),
    nomeMae: get('nomeMae'),
    rg: onlyDigits(cols[COL.rg]) || clean(cols[COL.rg]),
    rgDataExpedicao: parseDateBr(cols[COL.rgDataExpedicao]),
    rgOrgaoExpedicao: get('rgOrgaoExpedicao'),
    rgUfOrgao: normalizeUf(cols[COL.rgUfOrgao]),
    tituloEleitor: onlyDigits(cols[COL.tituloEleitor]) || clean(cols[COL.tituloEleitor]),
    cep: onlyDigits(cols[COL.cep]),
    rua: get('rua'),
    numero: get('numero'),
    bairro: get('bairro'),
    estado: normalizeUf(cols[COL.estado]),
    cidade: get('cidade'),
    complemento: get('complemento'),
    dddResidencial: onlyDigits(cols[COL.dddResidencial]).slice(0, 2),
    telefoneResidencial: onlyDigits(cols[COL.telefoneResidencial]),
    dddCelular: onlyDigits(cols[COL.dddCelular]).slice(0, 2),
    telefoneCelular: onlyDigits(cols[COL.telefoneCelular]),
    pix: pix.includes('@') ? '' : pix,
    conselhoClasse: normalizeConselho(cols[COL.conselhoClasse]),
    numeroConselho: get('numeroConselho'),
    categoriaProfissional: inferCategoriaProfissional(catDetalhe || cols[COL.categoriaProfissional]),
    categoriaProfissionalDetalhe: catDetalhe,
    especialidadeProfissional: get('especialidadeProfissional'),
    banco: get('banco'),
    agencia: get('agencia'),
    conta: get('conta'),
    digitoConta: get('digitoConta'),
    termoConsentimento: /^sim$/i.test(get('termoConsentimento')),
  }

  const createdAt = parseTimestampBr(cols[COL.timestamp])

  return {
    nomeCompleto,
    email: emailFinal,
    cpf,
    dados,
    arquivos: {},
    createdAt,
  }
}

function main() {
  const filePath = process.argv[2] || defaultPath

  if (!existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`)
    process.exit(1)
  }

  const content = readFileSync(filePath, 'utf-8')
  const dataLines = parseTsvLines(content)

  console.log(`Linhas de dados encontradas: ${dataLines.length}`)

  const seenCpfs = new Set(
    listCadastros().map((c) => String(c.cpf ?? '').replace(/\D/g, '')).filter(Boolean),
  )
  let imported = 0
  let skipped = 0
  let duplicates = 0

  for (const line of dataLines) {
    const cols = line.split('\t')
    const record = rowToCadastro(cols)

    if (!record) {
      skipped++
      continue
    }

    if (seenCpfs.has(record.cpf)) {
      duplicates++
      continue
    }
    seenCpfs.add(record.cpf)

    insertCadastro({
      nomeCompleto: record.nomeCompleto,
      email: record.email,
      cpf: record.cpf,
      dados: record.dados,
      arquivos: record.arquivos,
      createdAt: record.createdAt,
    })
    imported++
  }

  console.log(`Importados: ${imported}`)
  console.log(`Ignorados (dados inválidos): ${skipped}`)
  console.log(`Duplicados (CPF): ${duplicates}`)
}

main()
