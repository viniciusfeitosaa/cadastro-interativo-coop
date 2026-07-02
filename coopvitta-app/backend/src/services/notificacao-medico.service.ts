import { prisma } from '../config/database';

export const TIPO_NOTIFICACAO = {
  EQUIPE_VINCULO: 'EQUIPE_VINCULO',
  SUBGRUPO_VINCULO: 'SUBGRUPO_VINCULO',
  ESCALA_NOVA: 'ESCALA_NOVA',
  ESCALA_EQUIPE_VINCULO: 'ESCALA_EQUIPE_VINCULO',
  TROCA_PLANTAO_SOLICITADA: 'TROCA_PLANTAO_SOLICITADA',
  BOAS_VINDAS: 'BOAS_VINDAS',
} as const;

/** Após marcada como lida, a notificação é removida do banco após este período (menos linhas, consultas mais leves). */
export const RETENCAO_MS_NOTIFICACAO_LIDA = 24 * 60 * 60 * 1000;

async function removerNotificacoesLidasExpiradas(tenantId: string, medicoId: string) {
  const limite = new Date(Date.now() - RETENCAO_MS_NOTIFICACAO_LIDA);
  await prisma.notificacaoMedico.deleteMany({
    where: {
      tenantId,
      medicoId,
      lidaEm: { not: null, lt: limite },
    },
  });
}

export async function notificarBoasVindasMedico(tenantId: string, medicoId: string, nomeCompleto: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true },
  });
  const marca = tenant?.nome?.trim() || 'COOPVITTA';
  const primeiro = nomeCompleto.trim().split(/\s+/)[0] || 'Profissional';

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.BOAS_VINDAS,
      titulo: `Bem-vindo à ${marca}`,
      corpo: `Olá, ${primeiro}! Sua conta está ativa. Use o painel para ponto eletrônico, documentos e informações da sua escala. Estamos felizes em tê-lo(a) na equipe.`,
      metadata: { origem: 'cadastro' as const },
    },
  });
}

export async function notificarMedicoVinculoEquipe(
  tenantId: string,
  medicoId: string,
  equipeNome: string,
  equipeId: string
) {
  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.EQUIPE_VINCULO,
      titulo: 'Você entrou em uma equipe',
      corpo: `Você foi adicionado à equipe "${equipeNome}".`,
      metadata: { equipeId, equipeNome },
    },
  });
}

export async function notificarMedicoVinculoSubgrupo(
  tenantId: string,
  medicoId: string,
  subgrupoNome: string,
  subgrupoId: string
) {
  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.SUBGRUPO_VINCULO,
      titulo: 'Novo vínculo de subgrupo',
      corpo: `Você foi vinculado ao subgrupo "${subgrupoNome}".`,
      metadata: { subgrupoId, subgrupoNome },
    },
  });
}

export async function notificarMedicosNovaEscala(
  tenantId: string,
  contratoAtivoId: string,
  escala: { id: string; nome: string },
  contratoNome: string
) {
  const vinculos = await prisma.contratoEquipe.findMany({
    where: { tenantId, contratoAtivoId },
    select: { equipeId: true },
  });
  const equipeIds = vinculos.map((v) => v.equipeId);
  if (equipeIds.length === 0) return;

  const membros = await prisma.equipeMedico.findMany({
    where: { tenantId, equipeId: { in: equipeIds } },
    select: { medicoId: true },
  });
  const medicoIds = [...new Set(membros.map((m) => m.medicoId))];
  if (medicoIds.length === 0) return;

  const titulo = 'Nova escala disponível';
  const corpo = `A escala "${escala.nome}" foi cadastrada no contrato "${contratoNome}". Confira em Escalas quando precisar.`;

  await prisma.notificacaoMedico.createMany({
    data: medicoIds.map((medicoId) => ({
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.ESCALA_NOVA,
      titulo,
      corpo,
      metadata: { escalaId: escala.id, contratoAtivoId, escalaNome: escala.nome },
    })),
  });
}

export async function notificarMedicosEquipeNaEscala(
  tenantId: string,
  escalaId: string,
  escalaNome: string,
  equipeId: string,
  equipeNome: string
) {
  const membros = await prisma.equipeMedico.findMany({
    where: { tenantId, equipeId },
    select: { medicoId: true },
  });
  const medicoIds = [...new Set(membros.map((m) => m.medicoId))];
  if (medicoIds.length === 0) return;

  const titulo = 'Sua equipe na escala';
  const corpo = `A equipe "${equipeNome}" passou a integrar a escala "${escalaNome}".`;

  await prisma.notificacaoMedico.createMany({
    data: medicoIds.map((medicoId) => ({
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.ESCALA_EQUIPE_VINCULO,
      titulo,
      corpo,
      metadata: { escalaId, equipeId, escalaNome, equipeNome },
    })),
  });
}

/** Notifica colega e solicitante ao pedir troca de plantão (sem alterar a escala no banco). */
export async function notificarTrocaPlantaoSolicitada(
  tenantId: string,
  input: {
    /** ID da linha em `solicitacoes_troca_plantao` (auditoria / rastreio). */
    solicitacaoId?: string;
    medicoSolicitanteId: string;
    medicoDestinoId: string;
    solicitanteNome: string;
    destinoNome: string;
    plantaoId: string;
    escalaId: string;
    escalaNome: string;
    dataPlantaoIso: string;
    gradeLabel: string;
    /** Permuta: plantão do colega que o solicitante assume em troca. */
    contrapartidaPlantaoId?: string;
    dataContrapartidaIso?: string;
    gradeLabelContrapartida?: string;
  }
) {
  const {
    solicitacaoId,
    medicoSolicitanteId,
    medicoDestinoId,
    solicitanteNome,
    destinoNome,
    plantaoId,
    escalaId,
    escalaNome,
    dataPlantaoIso,
    gradeLabel,
    contrapartidaPlantaoId,
    dataContrapartidaIso,
    gradeLabelContrapartida,
  } = input;

  const fmt = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const dataFmt = fmt(dataPlantaoIso);
  const ehPermuta =
    contrapartidaPlantaoId &&
    dataContrapartidaIso &&
    gradeLabelContrapartida != null &&
    gradeLabelContrapartida !== '';

  const corpoDestino = ehPermuta
    ? `${solicitanteNome} propõe permutar plantões na escala "${escalaNome}": você assumiria o plantão dele no dia ${dataFmt} (${gradeLabel}) e ele(a) assumiria o seu plantão do dia ${fmt(dataContrapartidaIso!)} (${gradeLabelContrapartida}). Responda no app (aceitar ou recusar).`
    : `${solicitanteNome} solicitou trocar o plantão do dia ${dataFmt} (${gradeLabel}) na escala "${escalaNome}". Confira com a pessoa ou a coordenação para alinhar a troca.`;

  const corpoSolicitante = ehPermuta
    ? `Pedido enviado: você oferece trocar seu plantão de ${dataFmt} (${gradeLabel}) pelo plantão de ${destinoNome} em ${fmt(dataContrapartidaIso!)} (${gradeLabelContrapartida}), escala "${escalaNome}". Aguardando resposta.`
    : `Seu pedido de troca de plantão com ${destinoNome} foi registrado (${escalaNome}, ${dataFmt}, ${gradeLabel}). O profissional foi notificado.`;

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoDestinoId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: ehPermuta ? 'Pedido de permuta de plantão' : 'Pedido de troca de plantão',
      corpo: corpoDestino,
      metadata: {
        ...(solicitacaoId ? { solicitacaoId } : {}),
        plantaoId,
        ...(contrapartidaPlantaoId ? { contrapartidaPlantaoId } : {}),
        escalaId,
        medicoSolicitanteId,
        medicoDestinoId,
        papel: 'destino',
      },
    },
  });

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoSolicitanteId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: ehPermuta ? 'Permuta de plantão enviada' : 'Solicitação de troca enviada',
      corpo: corpoSolicitante,
      metadata: {
        ...(solicitacaoId ? { solicitacaoId } : {}),
        plantaoId,
        ...(contrapartidaPlantaoId ? { contrapartidaPlantaoId } : {}),
        escalaId,
        medicoSolicitanteId,
        medicoDestinoId,
        papel: 'solicitante',
      },
    },
  });
}

/** Permuta aberta a todos os colegas da equipe na escala; o primeiro a aceitar fecha a troca. */
export async function notificarTrocaPlantaoAbertaEquipe(
  tenantId: string,
  input: {
    solicitacaoId: string;
    medicoSolicitanteId: string;
    colegaMedicoIds: string[];
    solicitanteNome: string;
    plantaoId: string;
    escalaId: string;
    escalaNome: string;
    dataPlantaoIso: string;
    gradeLabel: string;
  }
) {
  const {
    solicitacaoId,
    medicoSolicitanteId,
    colegaMedicoIds,
    solicitanteNome,
    plantaoId,
    escalaId,
    escalaNome,
    dataPlantaoIso,
    gradeLabel,
  } = input;

  const dataFmt = new Date(dataPlantaoIso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const corpoColega = `${solicitanteNome} abriu permuta com a equipe na escala "${escalaNome}": plantão dele no dia ${dataFmt} (${gradeLabel}). O primeiro a aceitar escolhe qual plantão seu permuta. Abra o painel para responder.`;

  if (colegaMedicoIds.length > 0) {
    await prisma.notificacaoMedico.createMany({
      data: colegaMedicoIds.map((medicoId) => ({
        tenantId,
        medicoId,
        tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
        titulo: 'Permuta aberta à equipe',
        corpo: corpoColega,
        metadata: {
          solicitacaoId,
          plantaoId,
          escalaId,
          medicoSolicitanteId,
          papel: 'destino_equipe' as const,
          paraEquipeInteira: true,
        },
      })),
    });
  }

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoSolicitanteId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: 'Pedido enviado à equipe',
      corpo: `Seu pedido de permuta (${escalaNome}, ${dataFmt}) foi enviado à equipe. O primeiro colega a aceitar fecha a troca.`,
      metadata: {
        solicitacaoId,
        plantaoId,
        escalaId,
        medicoSolicitanteId,
        papel: 'solicitante_equipe' as const,
        paraEquipeInteira: true,
      },
    },
  });
}

/** Cessão direta a um colega: o aceitante assume o plantão do solicitante (sem contrapartida). */
export async function notificarCederPlantaoParaColega(
  tenantId: string,
  input: {
    solicitacaoId: string;
    medicoSolicitanteId: string;
    medicoDestinoId: string;
    solicitanteNome: string;
    destinoNome: string;
    plantaoId: string;
    escalaId: string;
    escalaNome: string;
    dataPlantaoIso: string;
    gradeLabel: string;
  }
) {
  const {
    solicitacaoId,
    medicoSolicitanteId,
    medicoDestinoId,
    solicitanteNome,
    destinoNome,
    plantaoId,
    escalaId,
    escalaNome,
    dataPlantaoIso,
    gradeLabel,
  } = input;

  const dataFmt = new Date(dataPlantaoIso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const corpoDestino = `${solicitanteNome} está cedendo a você o plantão do dia ${dataFmt} (${gradeLabel}) na escala "${escalaNome}". Responda no app (aceitar ou recusar).`;

  const corpoSolicitante = `Pedido de cessão enviado: você cede seu plantão de ${dataFmt} (${gradeLabel}) para ${destinoNome}, escala "${escalaNome}". Aguardando resposta.`;

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoDestinoId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: 'Cessão de plantão',
      corpo: corpoDestino,
      metadata: {
        solicitacaoId,
        plantaoId,
        escalaId,
        medicoSolicitanteId,
        medicoDestinoId,
        papel: 'destino' as const,
        tipoSolicitacao: 'CEDER' as const,
      },
    },
  });

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoSolicitanteId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: 'Cessão enviada',
      corpo: corpoSolicitante,
      metadata: {
        solicitacaoId,
        plantaoId,
        escalaId,
        medicoSolicitanteId,
        medicoDestinoId,
        papel: 'solicitante' as const,
        tipoSolicitacao: 'CEDER' as const,
      },
    },
  });
}

/** Cessão aberta à equipe: o primeiro a aceitar assume o plantão (sem oferecer contrapartida). */
export async function notificarCederPlantaoAbertaEquipe(
  tenantId: string,
  input: {
    solicitacaoId: string;
    medicoSolicitanteId: string;
    colegaMedicoIds: string[];
    solicitanteNome: string;
    plantaoId: string;
    escalaId: string;
    escalaNome: string;
    dataPlantaoIso: string;
    gradeLabel: string;
  }
) {
  const {
    solicitacaoId,
    medicoSolicitanteId,
    colegaMedicoIds,
    solicitanteNome,
    plantaoId,
    escalaId,
    escalaNome,
    dataPlantaoIso,
    gradeLabel,
  } = input;

  const dataFmt = new Date(dataPlantaoIso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const corpoColega = `${solicitanteNome} cedeu o plantão do dia ${dataFmt} (${gradeLabel}) à equipe na escala "${escalaNome}". O primeiro a aceitar assume esse plantão (sem permuta). Abra o painel para responder.`;

  if (colegaMedicoIds.length > 0) {
    await prisma.notificacaoMedico.createMany({
      data: colegaMedicoIds.map((medicoId) => ({
        tenantId,
        medicoId,
        tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
        titulo: 'Cessão aberta à equipe',
        corpo: corpoColega,
        metadata: {
          solicitacaoId,
          plantaoId,
          escalaId,
          medicoSolicitanteId,
          papel: 'destino_equipe' as const,
          paraEquipeInteira: true,
          tipoSolicitacao: 'CEDER' as const,
        },
      })),
    });
  }

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoSolicitanteId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: 'Cessão enviada à equipe',
      corpo: `Seu pedido de cessão (${escalaNome}, ${dataFmt}) foi enviado à equipe. O primeiro colega a aceitar assume o plantão.`,
      metadata: {
        solicitacaoId,
        plantaoId,
        escalaId,
        medicoSolicitanteId,
        papel: 'solicitante_equipe' as const,
        paraEquipeInteira: true,
        tipoSolicitacao: 'CEDER' as const,
      },
    },
  });
}

export async function listNotificacoesMedicoService(tenantId: string, medicoId: string, limit = 40) {
  await removerNotificacoesLidasExpiradas(tenantId, medicoId);

  return prisma.notificacaoMedico.findMany({
    where: { tenantId, medicoId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      tipo: true,
      titulo: true,
      corpo: true,
      metadata: true,
      lidaEm: true,
      createdAt: true,
    },
  });
}

export async function marcarNotificacaoLidaService(tenantId: string, medicoId: string, notificacaoId: string) {
  await removerNotificacoesLidasExpiradas(tenantId, medicoId);

  const row = await prisma.notificacaoMedico.findFirst({
    where: { id: notificacaoId, tenantId, medicoId },
    select: { id: true },
  });
  if (!row) {
    throw { statusCode: 404, message: 'Notificação não encontrada' };
  }
  await prisma.notificacaoMedico.update({
    where: { id: notificacaoId },
    data: { lidaEm: new Date() },
  });
}

export async function marcarTodasNotificacoesLidasService(tenantId: string, medicoId: string) {
  await removerNotificacoesLidasExpiradas(tenantId, medicoId);

  await prisma.notificacaoMedico.updateMany({
    where: { tenantId, medicoId, lidaEm: null },
    data: { lidaEm: new Date() },
  });
}
