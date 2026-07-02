import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import bcrypt from 'bcryptjs';
import iconv from 'iconv-lite';
import env from '../src/config/env';
import { normalizeCRM } from '../src/utils/validation.util';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('viva@2026', 10);

// Corrige mojibake (encoding errado) e preserva acentos
function cleanString(str: string | null): string | null {
  if (!str) return null;

  let value = str.trim().replace(/\s+/g, ' ');

  // Caractere de substituição ou mojibake = encoding errado
  if (value.includes('\uFFFD') || /Ã§|Ã£|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã¢|Ãª|Ã´/.test(value)) {
    try {
      value = iconv.decode(Buffer.from(value, 'latin1'), 'utf8');
    } catch {
      // Se falhar, mantém o valor
    }
  }

  return value.trim() || null;
}

// Detecta encoding (CSV do Excel no Brasil costuma ser Latin1)
function detectEncoding(filePath: string): 'utf8' | 'latin1' {
  const buffer = fs.readFileSync(filePath);
  const sample = buffer.length > 65535 ? buffer.subarray(0, 65535) : buffer;
  const asUtf8 = sample.toString('utf8');

  // \uFFFD = byte inválido em UTF-8 (CSV em Latin1)
  if (asUtf8.includes('\uFFFD')) {
    return 'latin1';
  }

  return 'utf8';
}

async function main() {
  // Novo arquivo ajustado pelo usuário
  const csvFilePath = path.resolve(__dirname, '../../Viva Serviços em Saúde LTDA_Listagem_do_Corpo_Clinico (1).csv');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ Arquivo não encontrado: ${csvFilePath}`);
    return;
  }

  // CSV do Excel no Brasil costuma ser Windows-1252 (Latin1); forçar para acentos corretos
  const encoding: 'utf8' | 'latin1' = detectEncoding(csvFilePath);
  const useEncoding = encoding === 'utf8' ? 'utf8' : 'win1252';
  console.log(`🚀 Iniciando importação do arquivo (${useEncoding.toUpperCase()})...`);

  const parser = fs
    .createReadStream(csvFilePath)
    .pipe(iconv.decodeStream(useEncoding))
    .pipe(parse({
      delimiter: ';',
      from_line: 7,
      skip_empty_lines: true,
      trim: true
    }));

  let count = 0;
  let errors = 0;

  const tenant = await prisma.tenant.findFirst({
    where: {
      slug: env.TENANT_DEFAULT_SLUG,
      ativo: true,
    },
  });

  if (!tenant) {
    console.error(`❌ Tenant padrão não encontrado: ${env.TENANT_DEFAULT_SLUG}`);
    return;
  }

  for await (const record of parser) {
    try {
      const nome = cleanString(record[0]);
      const vinculoRaw = record[4]; // Coluna Vínculo (PJ ou vazio)
      const vinculo = vinculoRaw?.trim().toUpperCase() === 'PJ' ? 'PJ' : null;
      const crm = normalizeCRM(record[7] || '');
      const especialidade = cleanString(record[8]);
      const email = record[9]?.toLowerCase().trim() || null;
      const celular = record[10];
      const cpfRaw = record[21];

      const cpf = cpfRaw.replace(/\D/g, '');

      if (cpf.length !== 11 || !crm || !nome) {
        errors++;
        continue;
      }

      // O upsert garante que se o CPF já existir, ele substitui os dados (update)
      await prisma.medico.upsert({
        where: {
          tenantId_cpf: {
            tenantId: tenant.id,
            cpf,
          },
        },
        update: {
          nomeCompleto: nome.length > 255 ? nome.slice(0, 255) : nome,
          crm: crm,
          especialidades: especialidade ? [especialidade.length > 100 ? especialidade.slice(0, 100) : especialidade] : ['Clínica Médica'],
          vinculo: vinculo ?? undefined,
          email: email && email.length > 255 ? email.slice(0, 255) : email || undefined,
          telefone: celular && celular.length > 20 ? celular.slice(0, 20) : celular,
        },
        create: {
          tenantId: tenant.id,
          cpf,
          profissao: 'Médico',
          crm,
          nomeCompleto: nome.length > 255 ? nome.slice(0, 255) : nome,
          especialidades: especialidade ? [especialidade.length > 100 ? especialidade.slice(0, 100) : especialidade] : ['Clínica Médica'],
          vinculo: vinculo ?? null,
          email: email && email.length > 255 ? email.slice(0, 255) : email || null,
          telefone: celular && celular.length > 20 ? celular.slice(0, 20) : celular,
          senhaHash: DEFAULT_PASSWORD_HASH,
          ativo: true
        }
      });

      count++;
      if (count % 500 === 0) console.log(`⏳ ${count} registros processados...`);
    } catch (err) {
      console.error(`❌ Erro ao processar linha:`, err);
      errors++;
    }
  }

  console.log(`\n✅ Importação concluída com sucesso!`);
  console.log(`📊 Total processado/atualizado: ${count}`);
  console.log(`❌ Linhas ignoradas/erros: ${errors}`);
  if (errors > 0) {
    console.log(`   (Ignorado = linha sem CPF válido com 11 dígitos, sem CRM ou sem nome)`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
