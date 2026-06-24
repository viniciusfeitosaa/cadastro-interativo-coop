import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const transcriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.cursor',
  'projects',
  'c-Users-vinic-Downloads-GOOPVITTA',
  'agent-transcripts',
  '0d8e1425-9074-4e4d-b938-57f3bfc0032d',
  '0d8e1425-9074-4e4d-b938-57f3bfc0032d.jsonl',
)

const outPath = join(dirname(fileURLToPath(import.meta.url)), 'data', 'import-source.tsv')

const lines = readFileSync(transcriptPath, 'utf-8').split(/\r?\n/)
const userLine = lines.find(
  (l) => l.includes('Coluna 1') && l.includes('Nome Completo do Proponente'),
)

if (!userLine) {
  console.error('Linha com dados não encontrada no transcript')
  process.exit(1)
}

const parsed = JSON.parse(userLine)
const text = parsed.message.content[0].text
const marker = 'Coluna 1\tNome Completo'
const idx = text.indexOf(marker)
if (idx === -1) {
  console.error('Marcador TSV não encontrado')
  process.exit(1)
}

const tsv = text.slice(idx).replace(/<\/user_query>$/, '').trim()
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, tsv, 'utf-8')
console.log(`TSV salvo em ${outPath} (${tsv.length} caracteres)`)
