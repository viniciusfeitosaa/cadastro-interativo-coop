/**
 * Mapeia associado COOPVITTA → payload candidato para partner-registration.
 * O contrato oficial ainda não foi publicado pelo Onvio; campos são os mais
 * comuns do cadastro e devem ser ajustados quando o Swagger chegar.
 */
export type OnvioPartnerPayload = Record<string, unknown>;

type MedicoOnvioSource = {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  profissao: string;
  crm: string | null;
  especialidades: string[];
  estadoCivil: string | null;
  enderecoResidencial: string | null;
  dadosBancarios: string | null;
  chavePix: string | null;
  dadosGcoopJson: unknown;
};

export function mapMedicoToOnvioPartnerPayload(m: MedicoOnvioSource): OnvioPartnerPayload {
  const wizard =
    m.dadosGcoopJson && typeof m.dadosGcoopJson === 'object'
      ? (m.dadosGcoopJson as Record<string, unknown>)
      : {};

  return {
    source: 'COOPVITTA',
    sourceId: m.id,
    name: m.nomeCompleto,
    cpf: m.cpf,
    email: m.email,
    phone: m.telefone,
    profession: m.profissao,
    professionalId: m.crm,
    specialties: m.especialidades,
    maritalStatus: m.estadoCivil,
    addressSummary: m.enderecoResidencial,
    bankSummary: m.dadosBancarios,
    pixKey: m.chavePix,
    wizardSnapshot: wizard,
  };
}

/** Texto para colar manualmente no Client Center enquanto não há API. */
export function formatMedicoOnvioClipboard(m: MedicoOnvioSource): string {
  const lines = [
    `Nome: ${m.nomeCompleto}`,
    `CPF: ${m.cpf}`,
    `E-mail: ${m.email || ''}`,
    `Telefone: ${m.telefone || ''}`,
    `Profissão: ${m.profissao}`,
    `Registro: ${m.crm || ''}`,
    `Especialidades: ${(m.especialidades || []).join(', ')}`,
    `Estado civil: ${m.estadoCivil || ''}`,
    `Endereço: ${m.enderecoResidencial || ''}`,
    `Dados bancários: ${m.dadosBancarios || ''}`,
    `Pix: ${m.chavePix || ''}`,
  ];
  return lines.join('\n');
}
