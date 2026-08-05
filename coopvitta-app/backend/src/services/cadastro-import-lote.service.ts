import crypto from 'crypto';
import { Prisma, StatusCadastroMedico } from '@prisma/client';
import { prisma } from '../config/database';
import { TERMOS_CADASTRO_VERSAO } from '../constants/termos-cadastro.const';
import { hashPassword } from '../utils/password.util';
import { validateCPF } from '../utils/validation.util';
import { createAuditLog } from './auditoria.service';
import { sanitizeDadosGcoopForStorage } from './gcoop/gcoop.service';

export interface CadastroImportLoteRowInput {
  /** Snapshot wizard (campos Gcoop + formulário). */
  dadosGcoop: Record<string, unknown>;
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
}

export interface CadastroImportLoteItemResult {
  index: number;
  ok: boolean;
  nomeCompleto?: string;
  email?: string;
  cpf?: string;
  medicoId?: string;
  error?: string;
}

function onlyDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function trimStr(v: unknown): string {
  return String(v ?? '').trim();
}

function montarEnderecoFromWizard(w: Record<string, unknown>): string | undefined {
  const cep = onlyDigits(w.cep);
  const cepFmt = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : trimStr(w.cep);
  const linhas = [
    cepFmt ? `CEP: ${cepFmt}` : null,
    trimStr(w.rua) ? `Logradouro: ${trimStr(w.rua)}` : null,
    trimStr(w.numero) ? `Número: ${trimStr(w.numero)}` : null,
    trimStr(w.complemento) ? `Complemento: ${trimStr(w.complemento)}` : null,
    trimStr(w.bairro) ? `Bairro: ${trimStr(w.bairro)}` : null,
    trimStr(w.cidade) || trimStr(w.estado)
      ? `Cidade/UF: ${trimStr(w.cidade)} / ${trimStr(w.estado).toUpperCase()}`
      : null,
  ].filter(Boolean) as string[];
  return linhas.length ? linhas.join('\n') : undefined;
}

function montarDadosBancariosFromWizard(w: Record<string, unknown>): string | undefined {
  const conta = [trimStr(w.conta), trimStr(w.digitoConta)].filter(Boolean).join('-');
  const linhas = [
    conta ? `Conta: ${conta}` : null,
    trimStr(w.agencia) ? `Agência: ${trimStr(w.agencia)}` : null,
    trimStr(w.banco) ? `Banco: ${trimStr(w.banco)}` : null,
  ].filter(Boolean) as string[];
  return linhas.length ? linhas.join('\n') : undefined;
}

function montarTelefoneFromWizard(w: Record<string, unknown>): string | undefined {
  const ddd = onlyDigits(w.dddCelular).slice(0, 2);
  const tel = onlyDigits(w.telefoneCelular);
  if (!ddd || !tel) return undefined;
  return `(${ddd}) ${tel}`;
}

/**
 * Importa várias linhas de pré-cadastro como PENDENTE_ANALISE (sem documentos).
 * Usado pela Avaliação (colagem em lote). Não dispara e-mail de confirmação.
 */
export async function importCadastrosPendentesLoteService(
  tenantId: string,
  masterId: string,
  rows: CadastroImportLoteRowInput[]
): Promise<{
  total: number;
  criados: number;
  falhas: number;
  resultados: CadastroImportLoteItemResult[];
}> {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw { statusCode: 400, message: 'Envie pelo menos uma linha para importar' };
  }
  if (rows.length > 200) {
    throw { statusCode: 400, message: 'Limite de 200 cadastros por importação' };
  }

  const resultados: CadastroImportLoteItemResult[] = [];
  let criados = 0;
  let falhas = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || ({} as CadastroImportLoteRowInput);
    const index = i + 1;
    const nomeCompleto = trimStr(row.nomeCompleto);
    const email = trimStr(row.email).toLowerCase();
    const cpf = onlyDigits(row.cpf);
    const profissao = trimStr(row.profissao) || 'Profissional da saúde';

    try {
      if (!nomeCompleto) throw new Error('Nome completo é obrigatório');
      if (!email || !email.includes('@')) throw new Error('E-mail inválido');
      if (!validateCPF(cpf)) throw new Error('CPF inválido');
      if (row.aceitouTermos === false) throw new Error('Termo de consentimento não aceito');

      const [byCpf, byEmail, byCrm] = await Promise.all([
        prisma.medico.findFirst({ where: { tenantId, cpf }, select: { id: true } }),
        prisma.medico.findFirst({ where: { tenantId, email }, select: { id: true } }),
        row.crm?.trim()
          ? prisma.medico.findFirst({
              where: { tenantId, crm: row.crm.trim() },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (byCpf) throw new Error('Já existe cadastro com este CPF');
      if (byEmail) throw new Error('Já existe cadastro com este e-mail');
      if (byCrm) throw new Error('Já existe cadastro com este número de registro profissional');

      const wizardRaw =
        row.dadosGcoop && typeof row.dadosGcoop === 'object' && !Array.isArray(row.dadosGcoop)
          ? { ...row.dadosGcoop }
          : {};

      wizardRaw.nomeCompleto = nomeCompleto;
      wizardRaw.email = email;
      wizardRaw.cpf = cpf;
      if (wizardRaw.termoConsentimento == null) wizardRaw.termoConsentimento = true;

      const dadosGcoopJson = sanitizeDadosGcoopForStorage(wizardRaw as Record<string, unknown>) as Prisma.InputJsonValue;
      const telefone = trimStr(row.telefone) || montarTelefoneFromWizard(wizardRaw) || '';
      const estadoCivil = trimStr(row.estadoCivil) || trimStr(wizardRaw.estadoCivil) || undefined;
      const enderecoResidencial =
        trimStr(row.enderecoResidencial) || montarEnderecoFromWizard(wizardRaw);
      const dadosBancarios = trimStr(row.dadosBancarios) || montarDadosBancariosFromWizard(wizardRaw);
      const chavePix = trimStr(row.chavePix) || trimStr(wizardRaw.pix) || undefined;
      const crm = trimStr(row.crm) || trimStr(wizardRaw.numeroConselho) || undefined;
      const especialidades =
        Array.isArray(row.especialidades) && row.especialidades.length
          ? row.especialidades.map((e) => String(e).trim()).filter(Boolean)
          : trimStr(wizardRaw.especialidadeProfissional)
            ? [trimStr(wizardRaw.especialidadeProfissional)]
            : [];

      const senhaHash = await hashPassword(crypto.randomBytes(24).toString('base64url'));

      const created = await prisma.$transaction(async (tx) => {
        const medico = await tx.medico.create({
          data: {
            tenantId,
            nomeCompleto,
            email,
            cpf,
            profissao: profissao.slice(0, 80),
            crm: crm || null,
            senhaHash,
            especialidades,
            vinculo: 'Associado',
            telefone: telefone.slice(0, 20) || null,
            estadoCivil: estadoCivil?.slice(0, 60) || null,
            enderecoResidencial: enderecoResidencial || null,
            dadosBancarios: dadosBancarios || null,
            chavePix: chavePix?.slice(0, 120) || null,
            dadosGcoopJson,
            termosCadastroAceitosEm: new Date(),
            termosCadastroVersao: TERMOS_CADASTRO_VERSAO,
            ativo: false,
            statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE,
            inviteTokenHash: null,
            inviteExpiresAt: null,
            inviteAcceptedAt: null,
          },
          select: { id: true, nomeCompleto: true, email: true, cpf: true },
        });

        await createAuditLog(
          {
            acao: 'IMPORT_LOTE_CADASTRO_PENDENTE',
            tenantId,
            masterId,
            medicoId: medico.id,
            detalhes: {
              origem: 'avaliacao_import_lote',
              email: medico.email,
              cpf: medico.cpf,
              linha: index,
            },
          },
          tx
        );

        return medico;
      });

      criados += 1;
      resultados.push({
        index,
        ok: true,
        nomeCompleto: created.nomeCompleto,
        email: created.email || email,
        cpf: created.cpf,
        medicoId: created.id,
      });
    } catch (err) {
      falhas += 1;
      const message = err instanceof Error ? err.message : 'Erro ao importar linha';
      resultados.push({
        index,
        ok: false,
        nomeCompleto: nomeCompleto || undefined,
        email: email || undefined,
        cpf: cpf || undefined,
        error: message,
      });
    }
  }

  return { total: rows.length, criados, falhas, resultados };
}
