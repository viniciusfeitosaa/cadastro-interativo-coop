import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { DOCUMENTOS_PERFIL_FIELDS } from '../constants/documentos.const';

/** Por ficheiro (PDF/imagem escaneada). Alinhar com frontend `CADASTRO_MAX_BYTES_PER_FILE`. */
const PERFIL_UPLOAD_MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Campos de texto no multipart (endereço, dados bancários, etc.) — evita falso “file too large” em texto longo. */
const PERFIL_UPLOAD_MAX_FIELD_BYTES = 8 * 1024 * 1024;

type MulterErr = Error & { code?: string };

function multerErrorToMessage(err: MulterErr): string {
  const maxMb = Math.round(PERFIL_UPLOAD_MAX_FILE_BYTES / (1024 * 1024));
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return `Um dos ficheiros excede ${maxMb} MB. Comprima o PDF ou reduza a resolução da imagem e tente novamente.`;
    case 'LIMIT_FIELD_VALUE':
      return 'Um dos campos de texto do formulário é demasiado grande. Encurte endereço ou dados bancários, ou envie documentos em anexo em vez de colar textos muito longos.';
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_PART_COUNT':
      return 'Número de partes no envio excedeu o limite. Tente com menos ficheiros de uma vez.';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Campo de ficheiro não reconhecido. Atualize a página e use apenas os anexos pedidos no formulário.';
    default:
      return err.message || 'Erro no upload dos arquivos';
  }
}

const uploadBaseDir = path.resolve(process.cwd(), 'uploads', 'medicos');
if (!fs.existsSync(uploadBaseDir)) {
  fs.mkdirSync(uploadBaseDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadBaseDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname || 'arquivo', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sanitizedBase || 'arquivo'}-${unique}${ext}`);
  },
});

export const uploadPerfilDocumentos = multer({
  storage,
  limits: {
    fileSize: PERFIL_UPLOAD_MAX_FILE_BYTES,
    fieldSize: PERFIL_UPLOAD_MAX_FIELD_BYTES,
    files: 12,
  },
});

/** Campos opcionais do cadastro público (mesmos tipos do perfil). */
export const registerPublicUploadFields = DOCUMENTOS_PERFIL_FIELDS.map((name) => ({ name, maxCount: 1 }));

/** Só processa multipart em `/auth/register`; JSON continua sem multer. */
export function maybeRegisterPublicUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('multipart/form-data')) {
    next();
    return;
  }
  uploadPerfilDocumentos.fields(registerPublicUploadFields)(req, res, (err: unknown) => {
    if (err) {
      const msg =
        err instanceof Error && typeof (err as MulterErr).code === 'string'
          ? multerErrorToMessage(err as MulterErr)
          : err instanceof Error
            ? err.message
            : 'Erro no upload dos arquivos';
      res.status(400).json({ success: false, error: msg });
      return;
    }
    next();
  });
}

const uploadDocEnviadoDir = path.resolve(process.cwd(), 'uploads', 'documentos-enviados');
if (!fs.existsSync(uploadDocEnviadoDir)) {
  fs.mkdirSync(uploadDocEnviadoDir, { recursive: true });
}

const storageDocEnviado = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDocEnviadoDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname || 'documento', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sanitizedBase || 'documento'}-${unique}${ext}`);
  },
});

export const uploadDocumentoEnviado = multer({
  storage: storageDocEnviado,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

const uploadPontoCheckinDir = path.resolve(process.cwd(), 'uploads', 'ponto-checkin');
if (!fs.existsSync(uploadPontoCheckinDir)) {
  fs.mkdirSync(uploadPontoCheckinDir, { recursive: true });
}

const storagePontoCheckin = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    const tenantId = (req as any).user?.tenantId || 'unknown';
    const dir = path.join(uploadPontoCheckinDir, tenantId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `checkin-${unique}${safeExt}`);
  },
});

const imageMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadPontoCheckin = multer({
  storage: storagePontoCheckin,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (imageMime.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'));
    }
  },
});

/** Multer single('foto') com resposta JSON em erro (tipo/tamanho). */
export const uploadPontoCheckinMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  uploadPontoCheckin.single('foto')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : 'Erro no upload da foto';
      res.status(400).json({ success: false, error: msg });
      return;
    }
    next();
  });
};
