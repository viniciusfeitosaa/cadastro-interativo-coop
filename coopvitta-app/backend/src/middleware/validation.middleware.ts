import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto.const';
import { validateCPF, validateCRM } from '../utils/validation.util';
import {
  normalizeRegistroConselhoParaProfissao,
  profissaoExigeRegistroConselho,
} from '../utils/profissao-registro.util';

const UUID_ANY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isEscalaIdOuPontoSemEscala(val: string) {
  return typeof val === 'string' && (val === PONTO_SEM_ESCALA_ESCALA_ID || UUID_ANY_RE.test(val));
}

const escalaIdPontoBody = body('escalaId')
  .notEmpty()
  .custom((val: string) => isEscalaIdOuPontoSemEscala(val))
  .withMessage('escalaId inválido');

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const list = errors.array();
    const isRegister = (req.originalUrl || '').includes('/auth/register');
    if (isRegister) {
      console.error('[auth/register] validation-errors:', {
        bodyKeys: Object.keys(req.body || {}),
        bodyPreview: Object.fromEntries(
          Object.entries(req.body || {}).map(([k, v]) => [k, typeof v === 'string' ? String(v).slice(0, 120) : v])
        ),
        errorCount: list.length,
        errors: list,
      });
    }
    const error =
      list
        .map((e) => ('msg' in e && typeof e.msg === 'string' ? e.msg : null))
        .filter(Boolean)
        .join(' · ') || 'Dados inválidos';
    return res.status(400).json({
      success: false,
      error,
      errors: list,
    });
  }
  return next();
};

/**
 * Validação de login médico (CPF + CRM)
 */
export const validateMedicoLogin = [
  body('cpf')
    .notEmpty()
    .withMessage('CPF é obrigatório')
    .custom((value) => {
      if (!validateCPF(value)) {
        throw new Error('CPF inválido');
      }
      return true;
    }),
  body('crm')
    .notEmpty()
    .withMessage('CRM é obrigatório')
    .custom((value) => {
      if (!validateCRM(value)) {
        throw new Error('CRM inválido');
      }
      return true;
    }),
  handleValidationErrors,
];

/**
 * Mantém compatibilidade do endpoint antigo /login
 */
export const validateLogin = validateMedicoLogin;

/**
 * Validação de login por e-mail/senha (master e médico)
 */
export const validateEmailLogin = [
  body('email').isEmail().withMessage('E-mail inválido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  handleValidationErrors,
];

/**
 * Validação de login master (email + senha)
 */
export const validateMasterLogin = [
  body('email').isEmail().withMessage('E-mail inválido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  handleValidationErrors,
];

/**
 * Aceite de convite (definição de senha)
 */
export const validateAcceptInvite = [
  body('token').isString().isLength({ min: 20 }).withMessage('Token inválido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('confirmPassword')
    .isString()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('As senhas não coincidem'),
  handleValidationErrors,
];

/**
 * Esqueci minha senha - solicitar link
 */
export const validateEsqueciSenha = [
  body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
  handleValidationErrors,
];

/**
 * Redefinir senha com token
 */
export const validateRedefinirSenha = [
  body('token').isString().isLength({ min: 32 }).withMessage('Token inválido'),
  body('novaSenha')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Nova senha deve ter no mínimo 8 caracteres'),
  body('confirmarSenha')
    .isString()
    .custom((value, { req }) => value === req.body.novaSenha)
    .withMessage('As senhas não coincidem'),
  handleValidationErrors,
];

/**
 * Cadastro público de médico/associado
 */
export const validateRegisterMedico = [
  body('nomeCompleto')
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Nome completo é obrigatório'),
  body('email')
    .isEmail()
    .withMessage('E-mail inválido')
    .normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('confirmPassword')
    .isString()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('As senhas não coincidem'),
  body('cpf')
    .isString()
    .custom((value) => {
      if (!validateCPF(value)) {
        throw new Error('CPF inválido');
      }
      return true;
    }),
  body('profissao')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Profissão é obrigatória')
    .isLength({ max: 80 })
    .withMessage('Profissão inválida'),
  body('crm').custom((value, { req }) => {
    const profissao = (req.body?.profissao || '').trim();
    if (!profissaoExigeRegistroConselho(profissao)) {
      if (value === undefined || value === null || String(value).trim() === '') return true;
      if (typeof value !== 'string') throw new Error('Registro no conselho inválido');
      const n = normalizeRegistroConselhoParaProfissao(profissao, value);
      if (!n) throw new Error('Registro no conselho inválido');
      return true;
    }
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error('Registro no conselho é obrigatório para esta profissão');
    }
    if (typeof value !== 'string') throw new Error('Registro no conselho inválido');
    if (profissao === 'Médico' && !validateCRM(value)) {
      throw new Error('CRM inválido. Use o formato número-UF (ex.: 12345-SP).');
    }
    const n = normalizeRegistroConselhoParaProfissao(profissao, value);
    if (!n) throw new Error('Registro no conselho inválido para esta profissão');
    return true;
  }),
  body('especialidades')
    .optional({ values: 'null' })
    .custom((value, { req }) => {
      if (value === undefined || value === null || value === '') {
        (req as any).body.especialidades = [];
        return true;
      }
      let arr: unknown;
      if (Array.isArray(value)) {
        arr = value;
      } else if (typeof value === 'string') {
        const t = value.trim();
        if (!t) {
          (req as any).body.especialidades = [];
          return true;
        }
        if (t.startsWith('[')) {
          try {
            arr = JSON.parse(t);
          } catch {
            throw new Error('Especialidades inválidas (use uma lista ou JSON array)');
          }
        } else {
          // Multipart com apenas 1 valor costuma chegar como string simples.
          arr = [t];
        }
      } else {
        throw new Error('Especialidades inválidas');
      }
      if (!Array.isArray(arr)) {
        throw new Error('Especialidades deve ser uma lista');
      }
      for (const item of arr) {
        if (typeof item !== 'string' || item.trim().length > 100) {
          throw new Error('Cada especialidade deve ser texto com no máximo 100 caracteres');
        }
      }
      (req as any).body.especialidades = arr.map((e: string) => e.trim()).filter(Boolean);
      return true;
    }),
  body('telefone')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Telefone é obrigatório')
    .isLength({ max: 20 })
    .withMessage('Telefone inválido'),
  body('estadoCivil')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Estado civil inválido'),
  body('enderecoResidencial')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Endereço inválido'),
  body('dadosBancarios')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Dados bancários inválidos'),
  body('chavePix')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Chave Pix inválida'),
  body('aceitouTermos').custom((value) => {
    if (value === true || value === 1) return true;
    if (typeof value === 'string') {
      const t = value.trim().toLowerCase();
      if (t === 'true' || t === '1' || t === 'on' || t === 'yes') return true;
    }
    throw new Error('É necessário aceitar a declaração e os termos de cadastro para concluir o pedido');
  }),
  handleValidationErrors,
];

export const validateUpdatePerfil = [
  body('estadoCivil')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Estado civil inválido'),
  body('enderecoResidencial')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Endereço residencial inválido'),
  body('dadosBancarios')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 3000 })
    .withMessage('Dados bancários inválidos'),
  body('chavePix')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Chave PIX inválida'),
  body('telefone')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Telefone inválido'),
  body('especialidades')
    .optional({ values: 'falsy' })
    .isArray()
    .withMessage('Especialidades deve ser uma lista'),
  body('especialidades.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Cada especialidade deve ter no máximo 100 caracteres'),
  handleValidationErrors,
];

/**
 * Valida parâmetros UUID (ex.: :id em rotas /:id)
 */
export const validateUUIDParam = (paramName: string) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} inválido`),
  handleValidationErrors,
];

/**
 * Valida query string UUID (ex.: ?escalaId=...)
 */
export const validateUUIDQuery = (queryName: string) => [
  query(queryName)
    .isUUID()
    .withMessage(`${queryName} inválido`),
  handleValidationErrors,
];

/** Query escalaId em rotas de ponto: UUID de escala ou sentinela "ponto sem escala". */
export const validateEscalaIdQueryPonto = [
  query('escalaId')
    .notEmpty()
    .custom((val: string) => isEscalaIdOuPontoSemEscala(val))
    .withMessage('escalaId inválido'),
  handleValidationErrors,
];

/** POST /ponto/solicitar-troca-plantao */
export const validateSolicitarTrocaPlantao = [
  body('plantaoId').notEmpty().isUUID().withMessage('plantaoId inválido'),
  body('paraEquipeInteira').optional().isBoolean().withMessage('paraEquipeInteira inválido'),
  body('tipoSolicitacao')
    .optional()
    .isIn(['PERMUTA', 'CEDER', 'permuta', 'ceder'])
    .withMessage('tipoSolicitacao inválido (use PERMUTA ou CEDER)'),
  body('medicoDestinoId').optional({ values: 'falsy' }).isUUID().withMessage('medicoDestinoId inválido'),
  body('plantaoContrapartidaId')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('plantaoContrapartidaId inválido'),
  body().custom((_v, { req }) => {
    const pe =
      req.body?.paraEquipeInteira === true ||
      req.body?.paraEquipeInteira === 'true' ||
      req.body?.paraEquipeInteira === 1 ||
      req.body?.paraEquipeInteira === '1';
    const tipoRaw = String(req.body?.tipoSolicitacao ?? 'PERMUTA').toUpperCase();
    const tipo = tipoRaw === 'CEDER' ? 'CEDER' : 'PERMUTA';
    const pcid = req.body?.plantaoContrapartidaId;
    const temPcid = pcid != null && String(pcid).trim() !== '';
    if (pe) {
      if (temPcid) {
        throw new Error('plantaoContrapartidaId não se aplica ao pedido à equipe');
      }
      return true;
    }
    const mid = req.body?.medicoDestinoId;
    const temMid = typeof mid === 'string' && mid.length > 0;
    if (tipo === 'CEDER') {
      if (temPcid) {
        throw new Error('Na cessão a um colega não informe plantaoContrapartidaId');
      }
      if (temMid) return true;
      throw new Error('Na cessão a um colega informe medicoDestinoId');
    }
    if (temMid && temPcid) return true;
    throw new Error(
      'Informe paraEquipeInteira, ou permuta (medicoDestinoId + plantaoContrapartidaId), ou cessão (tipoSolicitacao CEDER + medicoDestinoId)'
    );
  }),
  handleValidationErrors,
];

/** POST /ponto/trocas-plantao/:id/aceitar (body opcional: plantaoContrapartidaId para pedido à equipe) */
export const validateAceitarTrocaPlantao = [
  body('plantaoContrapartidaId')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('plantaoContrapartidaId inválido'),
  handleValidationErrors,
];

/** GET /ponto/plantoes-colega-troca */
export const validatePlantoesColegaTrocaQuery = [
  query('escalaId').notEmpty().isUUID().withMessage('escalaId inválido'),
  query('medicoDestinoId').notEmpty().isUUID().withMessage('medicoDestinoId inválido'),
  handleValidationErrors,
];

/**
 * Check-in: validar tipos e limites básicos.
 * A regra de negócio (geolocalização obrigatória quando há config) está no service.
 */
export const validateCheckin = [
  escalaIdPontoBody,
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  handleValidationErrors,
];

/**
 * Check-in sem foto (câmera indisponível): mesmo corpo que validateCheckin + motivo obrigatório.
 */
export const validateCheckinSemFoto = [
  escalaIdPontoBody,
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  body('motivoSemFoto')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 15, max: 500 })
    .withMessage('motivoSemFoto deve ter entre 15 e 500 caracteres'),
  handleValidationErrors,
];

/** Foto obrigatória após multer (check-in). */
export const requireCheckinFoto = (req: Request, res: Response, next: NextFunction) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'Foto obrigatória para check-in. Envie uma imagem JPEG, PNG ou WebP (máx. 5 MB).',
    });
  }
  return next();
};

/** Check-in multipart: mesmo corpo que validateCheckin; remove arquivo enviado se validação falhar. */
const handleCheckinMultipartValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  return next();
};

export const validateCheckinMultipart = [
  escalaIdPontoBody,
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  handleCheckinMultipartValidationErrors,
];

/**
 * Checkout: valida tipos e limites básicos.
 * A regra de negócio (geolocalização obrigatória quando há config) está no service.
 */
export const validateCheckout = [
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  handleValidationErrors,
];

/**
 * Escala: valida criação e update.
 */
export const validateCreateEscala = [
  body('nome')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('nome inválido'),
  body('contratoAtivoId')
    .notEmpty()
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  body('descricao')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('descricao inválida'),
  body('dataInicio')
    .notEmpty()
    .isISO8601()
    .withMessage('dataInicio inválida'),
  body('dataFim')
    .notEmpty()
    .isISO8601()
    .withMessage('dataFim inválida'),
  body('ativo')
    .optional({ values: 'falsy' })
    .isBoolean()
    .withMessage('ativo deve ser booleano'),
  handleValidationErrors,
];

export const validateUpdateEscala = [
  body('contratoAtivoId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  body('nome')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('nome inválido'),
  body('descricao')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('descricao inválida'),
  body('dataInicio')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('dataInicio inválida'),
  body('dataFim')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('dataFim inválida'),
  body('ativo')
    .optional({ values: 'null' })
    .isBoolean()
    .withMessage('ativo deve ser booleano'),
  handleValidationErrors,
];

/**
 * Escala Plantão (POST /escalas/:id/plantoes)
 */
export const validateCreateEscalaPlantao = [
  body('data')
    .notEmpty()
    .isISO8601()
    .withMessage('data inválida'),
  body('gradeId')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 1, max: 36 })
    .withMessage('gradeId inválido'),
  body('medicoId')
    .notEmpty()
    .isUUID()
    .withMessage('medicoId inválido'),
  body('valorHora')
    .optional({ values: 'null' })
    .isFloat()
    .withMessage('valorHora inválido'),
  handleValidationErrors,
];

/** POST /admin/escalas/:id/plantoes/replicar-mes */
export const validateReplicarPlantoesMes = [
  body('mesOrigem')
    .notEmpty()
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('mesOrigem deve ser YYYY-MM'),
  body('mesDestino')
    .notEmpty()
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('mesDestino deve ser YYYY-MM'),
  handleValidationErrors,
];

/** POST /admin/tipos-plantao */
export const validateCreateTipoPlantao = [
  body('contratoAtivoId').notEmpty().isUUID().withMessage('contratoAtivoId inválido'),
  body('nome').notEmpty().isString().trim().isLength({ min: 1, max: 120 }).withMessage('nome inválido'),
  body('horaInicio')
    .notEmpty()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('horaInicio inválida (use HH:mm)'),
  body('horaFim')
    .notEmpty()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('horaFim inválida (use HH:mm)'),
  body('cruzaMeiaNoite').optional().isBoolean().withMessage('cruzaMeiaNoite deve ser booleano'),
  handleValidationErrors,
];

/** PUT /admin/tipos-plantao/:id */
export const validateUpdateTipoPlantao = [
  body('nome').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('nome inválido'),
  body('horaInicio')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('horaInicio inválida'),
  body('horaFim')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('horaFim inválida'),
  body('cruzaMeiaNoite').optional().isBoolean().withMessage('cruzaMeiaNoite deve ser booleano'),
  handleValidationErrors,
];

/**
 * Escala: alocar médico na escala (POST /escalas/:id/medicos)
 */
export const validateAlocarMedicoEscala = [
  body('medicoId')
    .notEmpty()
    .isUUID()
    .withMessage('medicoId inválido'),
  body('cargo')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('cargo inválido'),
  body('valorHora')
    .optional({ values: 'null' })
    .isFloat()
    .withMessage('valorHora inválido'),
  handleValidationErrors,
];

/**
 * Adicional do plantão por data (PUT /admin/adicionais-plantao)
 */
export const validateUpsertAdicionalPlantao = [
  body('contratoAtivoId')
    .notEmpty()
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  body('data')
    .notEmpty()
    .isISO8601()
    .withMessage('data inválida'),
  body('gradeId')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 1, max: 36 })
    .withMessage('gradeId inválido'),
  body('percentual')
    .notEmpty()
    .isFloat({ min: 0, max: 300 })
    .withMessage('percentual inválido'),
  handleValidationErrors,
];

/**
 * Lista adicionais do plantão (GET /admin/adicionais-plantao)
 */
export const validateListAdicionaisPlantao = [
  query('contratoAtivoId')
    .notEmpty()
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  query('dataInicio')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('dataInicio inválida'),
  query('dataFim')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('dataFim inválida'),
  handleValidationErrors,
];

/** PUT /admin/config-ponto — configurar ponto eletrônico (valores + geo + horários). */
export const validateSetConfigPonto = [
  body('contratoId').notEmpty().isUUID().withMessage('contratoId inválido'),
  body('subgrupoId').notEmpty().isUUID().withMessage('subgrupoId inválido'),
  body('equipeId').optional({ values: 'null' }).isUUID().withMessage('equipeId inválido'),
  body('horasPrevistasMes').optional({ values: 'null' }).isInt({ min: 0, max: 1000 }).withMessage('horasPrevistasMes inválido'),
  body('valorHora').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('valorHora inválido'),
  body('valorHoraCobranca').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('valorHoraCobranca inválido'),
  body('valorHoraPorDia')
    .optional({ values: 'null' })
    .custom((v) => {
      if (v == null) return true;
      if (typeof v !== 'object' || Array.isArray(v)) throw new Error('valorHoraPorDia deve ser um objeto');
      const allowed = new Set(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
      for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
        if (!allowed.has(k)) throw new Error(`Chave inválida em valorHoraPorDia: ${k}`);
        if (raw == null || raw === '') continue;
        const n = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Valor inválido em valorHoraPorDia.${k}`);
      }
      return true;
    }),
  body('valorHoraCobrancaPorDia')
    .optional({ values: 'null' })
    .custom((v) => {
      if (v == null) return true;
      if (typeof v !== 'object' || Array.isArray(v)) throw new Error('valorHoraCobrancaPorDia deve ser um objeto');
      const allowed = new Set(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
      for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
        if (!allowed.has(k)) throw new Error(`Chave inválida em valorHoraCobrancaPorDia: ${k}`);
        if (raw == null || raw === '') continue;
        const n = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Valor inválido em valorHoraCobrancaPorDia.${k}`);
      }
      return true;
    }),
  body('horarioEntrada')
    .optional({ values: 'null' })
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('horarioEntrada inválido (use HH:mm)'),
  body('horarioSaida')
    .optional({ values: 'null' })
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('horarioSaida inválido (use HH:mm)'),
  body('toleranciaMinutos').optional({ values: 'null' }).isInt({ min: 0, max: 120 }).withMessage('toleranciaMinutos inválido'),
  body('latitude').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('latitude inválida'),
  body('longitude').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('longitude inválida'),
  body('raioMetros').optional({ values: 'null' }).isInt({ min: 0, max: 10000 }).withMessage('raioMetros inválido'),
  body('enderecoPonto').optional({ values: 'null' }).isString().isLength({ max: 500 }).withMessage('enderecoPonto inválido'),
  handleValidationErrors,
];

/**
 * Remove adicional do plantão (DELETE /admin/adicionais-plantao)
 */
export const validateRemoverAdicionalPlantao = [
  query('contratoAtivoId')
    .notEmpty()
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  query('data')
    .notEmpty()
    .isISO8601()
    .withMessage('data inválida'),
  query('gradeId')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 1, max: 36 })
    .withMessage('gradeId inválido'),
  handleValidationErrors,
];

/** GET /ponto/meus-plantoes-calendario?ano=&mes= */
export const validateMeusPlantoesCalendarioQuery = [
  query('ano').optional({ values: 'falsy' }).isInt({ min: 2000, max: 2100 }).withMessage('ano inválido'),
  query('mes').optional({ values: 'falsy' }).isInt({ min: 1, max: 12 }).withMessage('mês inválido'),
  query('equipeIds')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('equipeIds inválido')
    .custom((value) => {
      const parts = String(value)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const part of parts) {
        if (!uuidRegex.test(part)) {
          throw new Error('equipeIds inválido');
        }
      }
      return true;
    }),
  handleValidationErrors,
];

/** PATCH /medico/vagas/:vagaId/candidatos/:candidatoMedicoId */
export const validateStatusCandidatoVaga = [
  body('status').isIn(['ACEITO', 'RECUSADO']).withMessage('status deve ser ACEITO ou RECUSADO'),
  handleValidationErrors,
];

/** POST /medico/vagas — publicar vaga */
export const validateCreateVaga = [
  body('tipoAtendimento').trim().notEmpty().isLength({ max: 120 }).withMessage('Tipo de atendimento inválido'),
  body('setor').trim().notEmpty().isLength({ max: 200 }).withMessage('Setor inválido'),
  body('valorACombinar').isBoolean().withMessage('valorACombinar deve ser booleano'),
  body('valorCentavos')
    .optional({ values: 'null' })
    .isInt({ min: 0 })
    .withMessage('Valor inválido'),
  body('valorLiquidoBruto')
    .optional({ values: 'null' })
    .isIn(['LIQUIDO', 'BRUTO'])
    .withMessage('valorLiquidoBruto inválido'),
  body('pagamento').isIn(['A_VISTA', 'COMBINAR']).withMessage('Pagamento inválido'),
  body('quantidadeVagas').isInt({ min: 1, max: 999 }).withMessage('Quantidade de vagas inválida'),
  body('prazoPublicacaoDias').isInt({ min: 1, max: 365 }).withMessage('Prazo de publicação inválido'),
  body('categoriaProfissional').optional().isString().isLength({ min: 1, max: 40 }),
  body('diasVaga')
    .isArray({ min: 1 })
    .withMessage('Selecione ao menos um dia')
    .custom((arr: unknown) => {
      if (!Array.isArray(arr) || arr.length < 1) {
        throw new Error('Selecione ao menos um dia');
      }
      const re = /^\d{4}-\d{2}-\d{2}$/;
      for (const d of arr) {
        if (typeof d !== 'string' || !re.test(d)) {
          throw new Error('Cada dia deve estar no formato YYYY-MM-DD');
        }
      }
      return true;
    }),
  body('descricao').trim().notEmpty().isLength({ max: 8000 }).withMessage('Descrição inválida'),
  body('confirmacaoResponsavel')
    .isBoolean()
    .custom((v) => {
      if (v !== true) {
        throw new Error('É necessário confirmar que você é o responsável pelo setor');
      }
      return true;
    }),
  handleValidationErrors,
];

/** Exclusão permanente da própria conta (associado). */
export const validateDeleteSelfAccount = [
  body('senha').notEmpty().withMessage('Senha é obrigatória para confirmar a exclusão'),
  body('confirmacao')
    .trim()
    .equals('EXCLUIR')
    .withMessage('Digite EXCLUIR (em maiúsculas) para confirmar'),
  handleValidationErrors,
];

export const validateSlugParam = (paramName: string) => [
  param(paramName)
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage(`${paramName} inválido`),
  handleValidationErrors,
];

export const validateCreateBlogComment = [
  body('autorNome').trim().isLength({ min: 2, max: 120 }).withMessage('Nome inválido'),
  body('autorEmail').trim().isEmail().withMessage('E-mail inválido'),
  body('conteudo').trim().isLength({ min: 3, max: 2000 }).withMessage('Comentário inválido'),
  body('consentimentoLgpd')
    .custom((v) => v === true)
    .withMessage('É necessário aceitar a política de privacidade'),
  handleValidationErrors,
];

export const validateCreateBlogPost = [
  body('titulo').trim().isLength({ min: 3, max: 255 }).withMessage('Título inválido'),
  body('categoryId').isUUID().withMessage('Categoria inválida'),
  body('resumo').trim().isLength({ min: 10, max: 320 }).withMessage('Resumo inválido'),
  body('conteudo').trim().isLength({ min: 10 }).withMessage('Conteúdo inválido'),
  body('slug').optional().trim().isLength({ max: 120 }),
  body('capaUrl').optional({ values: 'null' }).trim().isLength({ max: 500 }),
  body('seoTitle').optional({ values: 'null' }).trim().isLength({ max: 255 }),
  body('seoDescription').optional({ values: 'null' }).trim().isLength({ max: 320 }),
  body('status')
    .optional()
    .isIn(['RASCUNHO', 'PUBLICADO', 'ARQUIVADO'])
    .withMessage('Status inválido'),
  handleValidationErrors,
];

export const validateUpdateBlogPost = [
  body('titulo').optional().trim().isLength({ min: 3, max: 255 }),
  body('categoryId').optional().isUUID(),
  body('resumo').optional().trim().isLength({ min: 10, max: 320 }),
  body('conteudo').optional().trim().isLength({ min: 10 }),
  body('slug').optional().trim().isLength({ max: 120 }),
  body('capaUrl').optional({ values: 'null' }).trim().isLength({ max: 500 }),
  body('seoTitle').optional({ values: 'null' }).trim().isLength({ max: 255 }),
  body('seoDescription').optional({ values: 'null' }).trim().isLength({ max: 320 }),
  body('status')
    .optional()
    .isIn(['RASCUNHO', 'PUBLICADO', 'ARQUIVADO'])
    .withMessage('Status inválido'),
  handleValidationErrors,
];

export const validateReplyBlogComment = [
  body('respostaTexto').trim().isLength({ min: 3, max: 2000 }).withMessage('Resposta inválida'),
  handleValidationErrors,
];

export const validateCreateBlogCategory = [
  body('nome').trim().isLength({ min: 2, max: 120 }).withMessage('Nome da categoria inválido'),
  body('slug').optional().trim().isLength({ max: 80 }),
  body('ordem').optional().isInt({ min: 0 }),
  handleValidationErrors,
];
