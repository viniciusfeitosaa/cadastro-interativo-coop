import type { StatusInteresseVaga } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { whatsappHrefFromTelefone } from '../utils/whatsapp.util';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDiasVaga(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw Object.assign(new Error('diasVaga deve ser um array'), { statusCode: 400 });
  }
  const out: string[] = [];
  for (const d of raw) {
    if (typeof d !== 'string' || !DATE_ONLY_RE.test(d)) {
      throw Object.assign(new Error('Cada dia em diasVaga deve ser YYYY-MM-DD'), { statusCode: 400 });
    }
    out.push(d);
  }
  const unique = [...new Set(out)].sort();
  if (unique.length === 0) {
    throw Object.assign(new Error('Informe ao menos um dia da vaga'), { statusCode: 400 });
  }
  return unique;
}

function expiresAtFromPrazoDias(prazoDias: number): Date {
  const now = new Date();
  const exp = new Date(now.getTime() + prazoDias * 24 * 60 * 60 * 1000);
  return exp;
}

export type CreateVagaInput = {
  tipoAtendimento: string;
  setor: string;
  valorACombinar: boolean;
  valorCentavos: number | null;
  valorLiquidoBruto: 'LIQUIDO' | 'BRUTO' | null;
  pagamento: 'A_VISTA' | 'COMBINAR';
  quantidadeVagas: number;
  prazoPublicacaoDias: number;
  categoriaProfissional: string;
  diasVaga: unknown;
  descricao: string;
  confirmacaoResponsavel: boolean;
};

function mapVagaListItem(
  v: {
    id: string;
    medicoPublicadorId: string;
    tipoAtendimento: string;
    setor: string;
    valorACombinar: boolean;
    valorCentavos: number | null;
    valorLiquidoBruto: string | null;
    pagamento: string;
    quantidadeVagas: number;
    prazoPublicacaoDias: number;
    categoriaProfissional: string;
    diasVaga: unknown;
    descricao: string;
    createdAt: Date;
    expiresAt: Date;
    medico: { id: string; nomeCompleto: string; crm: string | null };
    interesses: { id: string; status: StatusInteresseVaga }[];
    _count: { interesses: number };
  },
  medicoId: string
) {
  const meu = v.interesses[0];
  return {
    id: v.id,
    medicoPublicadorId: v.medicoPublicadorId,
    tipoAtendimento: v.tipoAtendimento,
    setor: v.setor,
    valorACombinar: v.valorACombinar,
    valorCentavos: v.valorCentavos,
    valorLiquidoBruto: v.valorLiquidoBruto,
    pagamento: v.pagamento,
    quantidadeVagas: v.quantidadeVagas,
    prazoPublicacaoDias: v.prazoPublicacaoDias,
    categoriaProfissional: v.categoriaProfissional,
    diasVaga: v.diasVaga as string[],
    descricao: v.descricao,
    createdAt: v.createdAt.toISOString(),
    expiresAt: v.expiresAt.toISOString(),
    publicador: {
      id: v.medico.id,
      nomeCompleto: v.medico.nomeCompleto,
      crm: v.medico.crm,
    },
    souPublicador: v.medicoPublicadorId === medicoId,
    meuInteresse: meu ? { id: meu.id, status: meu.status } : null,
    totalInteresses: v._count.interesses,
  };
}

/** Lista vagas ativas do tenant com interesse do médico logado e totais. */
export async function listVagasAtivasParaMedico(tenantId: string, medicoId: string) {
  const now = new Date();
  let rows;
  try {
    rows = await prisma.vaga.findMany({
      where: {
        tenantId,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        medico: {
          select: { id: true, nomeCompleto: true, crm: true },
        },
        interesses: {
          where: { candidatoMedicoId: medicoId },
          take: 1,
          select: { id: true, status: true },
        },
        _count: { select: { interesses: true } },
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2021' || String(e?.message || '').includes('does not exist')) {
      console.warn('[Vagas] Tabela `vagas` ausente. Retornando lista vazia.');
      return [];
    }
    throw e;
  }

  return rows.map((v) => mapVagaListItem(v, medicoId));
}

export async function listMinhasVagasPublicadas(tenantId: string, medicoId: string) {
  try {
    const rows = await prisma.vaga.findMany({
      where: { tenantId, medicoPublicadorId: medicoId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { interesses: true } },
      },
    });
    const ids = rows.map((r) => r.id);
    let pendentePorVaga: Record<string, number> = {};
    if (ids.length > 0) {
      const grupos = await prisma.vagaInteresse.groupBy({
        by: ['vagaId'],
        where: {
          tenantId,
          vagaId: { in: ids },
          status: 'PENDENTE',
        },
        _count: { _all: true },
      });
      pendentePorVaga = Object.fromEntries(grupos.map((g) => [g.vagaId, g._count._all]));
    }
    const now = new Date();
    return rows.map((v) => ({
      id: v.id,
      tipoAtendimento: v.tipoAtendimento,
      setor: v.setor,
      expiresAt: v.expiresAt.toISOString(),
      ativa: v.expiresAt > now,
      totalInteresses: v._count.interesses,
      pendentes: pendentePorVaga[v.id] ?? 0,
      createdAt: v.createdAt.toISOString(),
    }));
  } catch (e: any) {
    if (e?.code === 'P2021' || String(e?.message || '').includes('does not exist')) {
      return [];
    }
    throw e;
  }
}

export async function registrarInteresseVaga(tenantId: string, medicoId: string, vagaId: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const vaga = await tx.vaga.findFirst({
      where: { id: vagaId, tenantId, expiresAt: { gt: now } },
      select: { id: true, medicoPublicadorId: true },
    });
    if (!vaga) {
      throw Object.assign(new Error('Vaga não encontrada ou expirada'), { statusCode: 404 });
    }
    if (vaga.medicoPublicadorId === medicoId) {
      throw Object.assign(new Error('Você não pode demonstrar interesse na própria vaga'), { statusCode: 400 });
    }
    try {
      return await tx.vagaInteresse.create({
        data: {
          tenantId,
          vagaId: vaga.id,
          candidatoMedicoId: medicoId,
          status: 'PENDENTE',
        },
        select: { id: true, status: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw Object.assign(new Error('Você já demonstrou interesse nesta vaga'), { statusCode: 409 });
      }
      throw e;
    }
  });
}

export async function removerInteresseVaga(tenantId: string, medicoId: string, vagaId: string) {
  const del = await prisma.vagaInteresse.deleteMany({
    where: { tenantId, vagaId, candidatoMedicoId: medicoId },
  });
  if (del.count === 0) {
    throw Object.assign(new Error('Interesse não encontrado'), { statusCode: 404 });
  }
}

export async function excluirVagaPublicada(tenantId: string, medicoId: string, vagaId: string) {
  const del = await prisma.vaga.deleteMany({
    where: { id: vagaId, tenantId, medicoPublicadorId: medicoId },
  });
  if (del.count === 0) {
    throw Object.assign(new Error('Vaga não encontrada ou você não é o publicador'), { statusCode: 404 });
  }
}

export async function listarCandidatosVaga(tenantId: string, publicadorId: string, vagaId: string) {
  const vaga = await prisma.vaga.findFirst({
    where: { id: vagaId, tenantId, medicoPublicadorId: publicadorId },
    select: { id: true },
  });
  if (!vaga) {
    throw Object.assign(new Error('Vaga não encontrada ou você não é o publicador'), { statusCode: 404 });
  }
  const rows = await prisma.vagaInteresse.findMany({
    where: { tenantId, vagaId },
    orderBy: { createdAt: 'desc' },
    include: {
      candidato: {
        select: {
          id: true,
          nomeCompleto: true,
          crm: true,
          email: true,
          telefone: true,
          especialidades: true,
          profissao: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    interesseId: r.id,
    status: r.status,
    criadoEm: r.createdAt.toISOString(),
    candidato: {
      id: r.candidato.id,
      nomeCompleto: r.candidato.nomeCompleto,
      crm: r.candidato.crm,
      email: r.candidato.email,
      telefone: r.candidato.telefone,
      especialidades: r.candidato.especialidades,
      profissao: r.candidato.profissao,
      whatsappHref: whatsappHrefFromTelefone(r.candidato.telefone),
    },
  }));
}

export async function atualizarStatusInteresseCandidato(
  tenantId: string,
  publicadorId: string,
  vagaId: string,
  candidatoMedicoId: string,
  status: 'ACEITO' | 'RECUSADO'
) {
  return prisma.$transaction(async (tx) => {
    const vaga = await tx.vaga.findFirst({
      where: { id: vagaId, tenantId, medicoPublicadorId: publicadorId },
      select: { id: true },
    });
    if (!vaga) {
      throw Object.assign(new Error('Vaga não encontrada ou você não é o publicador'), { statusCode: 404 });
    }

    const upd = await tx.vagaInteresse.updateMany({
      where: {
        tenantId,
        vagaId: vaga.id,
        candidatoMedicoId,
        status: 'PENDENTE',
      },
      data: { status },
    });

    if (upd.count === 1) {
      const row = await tx.vagaInteresse.findFirst({
        where: { tenantId, vagaId: vaga.id, candidatoMedicoId },
        select: { id: true, status: true },
      });
      if (row) return row;
    }

    const interesse = await tx.vagaInteresse.findFirst({
      where: { tenantId, vagaId: vaga.id, candidatoMedicoId },
      select: { id: true, status: true },
    });
    if (!interesse) {
      throw Object.assign(new Error('Candidato não encontrado nesta vaga'), { statusCode: 404 });
    }
    if (interesse.status !== 'PENDENTE') {
      throw Object.assign(new Error('Este interesse já foi respondido'), { statusCode: 400 });
    }

    throw Object.assign(new Error('Não foi possível atualizar o interesse'), { statusCode: 409 });
  });
}

export async function createVagaMedico(tenantId: string, medicoId: string, input: CreateVagaInput) {
  if (!input.confirmacaoResponsavel) {
    throw Object.assign(new Error('É necessário confirmar que você é responsável pelo setor'), { statusCode: 400 });
  }

  const diasVaga = parseDiasVaga(input.diasVaga);

  let valorCentavos: number | null = input.valorCentavos;
  let valorLiquidoBruto: string | null = input.valorLiquidoBruto;

  if (input.valorACombinar) {
    valorCentavos = null;
    valorLiquidoBruto = null;
  } else {
    if (valorCentavos == null || valorCentavos < 0) {
      throw Object.assign(new Error('Informe o valor em centavos ou marque valor a combinar'), { statusCode: 400 });
    }
    if (valorLiquidoBruto !== 'LIQUIDO' && valorLiquidoBruto !== 'BRUTO') {
      throw Object.assign(new Error('Informe se o valor é líquido ou bruto'), { statusCode: 400 });
    }
  }

  const categoria = input.categoriaProfissional?.trim() || 'MEDICO';
  const expiresAt = expiresAtFromPrazoDias(input.prazoPublicacaoDias);

  let created;
  try {
    created = await prisma.vaga.create({
      data: {
        tenantId,
        medicoPublicadorId: medicoId,
        tipoAtendimento: input.tipoAtendimento.trim(),
        setor: input.setor.trim(),
        valorACombinar: input.valorACombinar,
        valorCentavos,
        valorLiquidoBruto,
        pagamento: input.pagamento,
        quantidadeVagas: input.quantidadeVagas,
        prazoPublicacaoDias: input.prazoPublicacaoDias,
        categoriaProfissional: categoria,
        diasVaga: diasVaga as unknown as Prisma.InputJsonValue,
        descricao: input.descricao.trim(),
        confirmacaoResponsavel: true,
        expiresAt,
      },
      include: {
        medico: { select: { id: true, nomeCompleto: true, crm: true } },
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2021' || String(e?.message || '').includes('does not exist')) {
      throw Object.assign(
        new Error('A tabela `vagas` ainda não existe no banco. Execute a migração `20260328140000_create_vagas` no Supabase.'),
        { statusCode: 503 }
      );
    }
    throw e;
  }

  return {
    id: created.id,
    tipoAtendimento: created.tipoAtendimento,
    setor: created.setor,
    valorACombinar: created.valorACombinar,
    valorCentavos: created.valorCentavos,
    valorLiquidoBruto: created.valorLiquidoBruto,
    pagamento: created.pagamento,
    quantidadeVagas: created.quantidadeVagas,
    prazoPublicacaoDias: created.prazoPublicacaoDias,
    categoriaProfissional: created.categoriaProfissional,
    diasVaga: created.diasVaga as string[],
    descricao: created.descricao,
    createdAt: created.createdAt.toISOString(),
    expiresAt: created.expiresAt.toISOString(),
    publicador: {
      id: created.medico.id,
      nomeCompleto: created.medico.nomeCompleto,
      crm: created.medico.crm,
    },
  };
}
