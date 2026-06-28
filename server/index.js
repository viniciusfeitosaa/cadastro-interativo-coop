import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { existsSync, mkdirSync } from 'fs'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'
import { countCadastros, getCadastroById, insertCadastro, listCadastros } from './db.js'
import { isAppvsSyncEnabled, syncCadastroToAppvs } from './syncAppvs.js'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const uploadsDir = join(__dirname, 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const PORT = process.env.PORT || 3001
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'coopvitta2024'
const JWT_SECRET = process.env.JWT_SECRET || 'coopvitta-dev-secret-change-in-production'

const FILE_FIELDS = [
  'certidaoNegativaConselho',
  'carteiraConselho',
  'declaracaoInss',
  'foto3x4',
  'comprovanteResidencia',
  'rgCnh',
  'pisNitPasep',
  'cpfDocumento',
  'cartaoBancario',
  'curriculumVitae',
  'cartaoVacina',
  'certificadoCurso',
  'aph',
]

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    cb(null, `${unique}${extname(file.originalname)}`)
  },
})

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 25 * 1024 * 1024

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
})

const app = express()
app.use(cors())
app.use(express.json())

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  try {
    jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body ?? {}
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha incorreta' })
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' })
  res.json({ token })
})

app.get('/api/admin/me', authMiddleware, (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/cadastros/stats', authMiddleware, (_req, res) => {
  try {
    res.json({ total: countCadastros() })
  } catch (error) {
    console.error('Erro ao contar cadastros:', error)
    res.status(500).json({ error: 'Erro ao carregar cadastros' })
  }
})

app.get('/api/cadastros', authMiddleware, (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : ''
    res.json(listCadastros({ search }))
  } catch (error) {
    console.error('Erro ao listar cadastros:', error)
    res.status(500).json({ error: 'Erro ao carregar cadastros' })
  }
})

app.get('/api/cadastros/:id', authMiddleware, (req, res) => {
  try {
    const cadastro = getCadastroById(Number(req.params.id))
    if (!cadastro) return res.status(404).json({ error: 'Cadastro não encontrado' })
    res.json(cadastro)
  } catch (error) {
    console.error('Erro ao buscar cadastro:', error)
    res.status(500).json({ error: 'Erro ao carregar cadastro' })
  }
})

app.get('/api/cadastros/:id/arquivos/:campo', authMiddleware, (req, res) => {
  const cadastro = getCadastroById(Number(req.params.id))
  if (!cadastro) return res.status(404).json({ error: 'Cadastro não encontrado' })

  const arquivo = cadastro.arquivos[req.params.campo]
  if (!arquivo) return res.status(404).json({ error: 'Arquivo não encontrado' })

  const filePath = join(uploadsDir, arquivo.filename)
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado no servidor' })
  }

  res.download(filePath, arquivo.originalName)
})

app.post(
  '/api/cadastros',
  upload.fields(FILE_FIELDS.map((name) => ({ name, maxCount: 1 }))),
  async (req, res) => {
    try {
      const rawDados = req.body.dados
      if (!rawDados) {
        return res.status(400).json({ error: 'Dados do formulário ausentes' })
      }

      const dados = JSON.parse(rawDados)
      const arquivos = {}

      for (const field of FILE_FIELDS) {
        const file = req.files?.[field]?.[0]
        if (file) {
          arquivos[field] = {
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        }
      }

      let appvsMedicoId = null
      let appvsSyncStatus = isAppvsSyncEnabled() ? 'pending' : 'disabled'
      let appvsMessage = 'Cadastro recebido com sucesso'

      if (isAppvsSyncEnabled()) {
        const sync = await syncCadastroToAppvs(dados, req.files)
        appvsMedicoId = sync.medicoId
        appvsSyncStatus = sync.medicoId ? 'synced' : 'synced_no_id'
        appvsMessage =
          sync.message ||
          'Cadastro recebido com sucesso. Sua conta está em análise; você será notificado quando for aprovada.'
      }

      const id = insertCadastro({
        nomeCompleto: dados.nomeCompleto,
        email: dados.email,
        cpf: dados.cpf,
        dados,
        arquivos,
        appvsMedicoId,
        appvsSyncStatus,
      })

      res.status(201).json({
        id,
        appvsMedicoId,
        appvsSyncEnabled: isAppvsSyncEnabled(),
        message: appvsMessage,
      })
    } catch (error) {
      console.error('Erro ao salvar cadastro:', error)
      const status = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500
      const message =
        status >= 400 && status < 500 && error?.message
          ? error.message
          : 'Erro ao processar cadastro'
      res.status(status).json({ error: message })
    }
  },
)

const webDist = join(__dirname, '../web/dist')
const storageConfigured = Boolean(
  process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
)

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    storageConfigured,
    appvsSyncEnabled: isAppvsSyncEnabled(),
  })
})

if (existsSync(webDist)) {
  app.use(express.static(webDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(webDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API COOPVITTA rodando em http://localhost:${PORT}`)
})
