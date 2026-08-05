try {
  require('dotenv/config');
} catch {
  /* env já injetado pelo Docker */
}

const {
  fetchGcoopDadosIniciais,
  fetchGcoopPreCadastro,
  fetchGcoopCidades,
  postGcoopPreCadastro,
} = require('../dist/services/gcoop/gcoop.client');
const { gcoopPreCadastroExists } = require('../dist/services/gcoop/gcoop.service');
const {
  findGcoopItemIdByLabel,
  findGcoopRacaCorFallbackId,
  findGcoopCidadeId,
} = require('../dist/services/gcoop/gcoop.domain-cache');
const { mapTipoSanguineoId } = require('../dist/services/gcoop/gcoop.mapper');

function gerarCpfValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (nums, peso) => {
    const s = nums.reduce((acc, d, i) => acc + d * (peso - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(n, 10);
  const d2 = dv([...n, d1], 11);
  return [...n, d1, d2].join('');
}

const PDF_STUB = Array.from(
  Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
trailer<</Size 4/Root 1 0 R>>
startxref
100
%%EOF`)
);

async function main() {
  let cpf = (process.argv[2] || '').replace(/\D/g, '');
  if (cpf.length !== 11) cpf = gerarCpfValido();

  console.log('[test-gcoop] CPF de teste:', cpf);

  const dados = await fetchGcoopDadosIniciais();
  const before = await fetchGcoopPreCadastro(cpf);
  if (gcoopPreCadastroExists(before)) {
    console.error('[test-gcoop] CPF já existe no Gcoop — use outro CPF.');
    process.exit(2);
  }

  const cidadesCe = await fetchGcoopCidades('CE');
  const cidadeId = findGcoopCidadeId(cidadesCe, 'Fortaleza') ?? 1347;
  const findId = (list, label) => findGcoopItemIdByLabel(list, label);
  const pis = String(Math.floor(Math.random() * 9e10) + 1e10);

  const payload = {
    ID: 0,
    Nome: 'Cooperado Teste Integração COOPVITTA',
    CPF: cpf,
    PisPasep: pis,
    ID_Sexo: findId(dados.ListaSexo, 'Masculino') ?? 1,
    ID_RacaCor: findGcoopRacaCorFallbackId(dados.ListaRacaCor) ?? 6,
    ID_EstadoCivil: findId(dados.ListaEstadoCivil, 'Solteiro') ?? 2,
    ID_GrauInstrucao: findId(dados.ListaGrauInstrucao, 'Superior Completo') ?? 8,
    DataNascimento: '1990-05-15',
    ID_TipoSanguineo: mapTipoSanguineoId('O+'),
    ID_RegimeComunhao: null,
    ID_Especialidade: findId(dados.ListaEspecialidade, 'Clínica Médica') ?? 6,
    PossuiCursoCooperativismo: false,
    DataRealizacaoCursoCooperativismo: null,
    DataAgendamentoCursoCooperativismo: null,
    ID_Pais: findId(dados.ListaNacionalidade, 'Brasileira') ?? 105,
    Naturalidade: 'CE',
    CidadeNaturalidade: cidadeId,
    RG: '1234567',
    DataExpedicaoRG: '2010-10-20',
    ID_OrgaoExpedidor: findId(dados.ListaOrgaoExpedidor, 'SSP') ?? 11,
    ID_UfOrgaoExpedidor: 'CE',
    NumeroCTPS: null,
    SerieCTPS: null,
    UFCTPS: null,
    TituloEleitor: null,
    NomeMae: 'Maria Teste',
    NomePai: 'Joao Teste',
    Logradouro: 'Rua das Flores',
    Numero: '123',
    CidadeEnderecoID: cidadeId,
    Complemento: 'Ap 101',
    Bairro: 'Centro',
    Cep: '60000000',
    UF_Endereco: 'CE',
    Email: `cooperado.teste.${cpf.slice(-4)}@coopvitta-test.local`,
    DDDTelefoneResidencial: null,
    TelefoneResidencial: null,
    DDDTelefoneCelular: '85',
    TelefoneCelular: '988887777',
    ID_Conselho: findId(dados.ListaConselho, 'CRM') ?? 9,
    Nr_Conselho: '54321-CE',
    ID_Categoria: findId(dados.ListaCategoria, 'BIOMÉDICO') ?? 6,
    DataPreCadastro: new Date().toISOString().slice(0, 10),
    Matricula: null,
    ID_Cooperado: null,
    DocumentosProponentes: [],
    Foto: null,
    CNH: PDF_STUB,
    ComprovanteEndereco: PDF_STUB,
    CarteiraConselho: PDF_STUB,
  };

  console.log('[test-gcoop] Enviando POST...');
  const postResult = await postGcoopPreCadastro(payload);
  console.log('[test-gcoop] POST OK — Gcoop ID:', postResult?.ID ?? '(sem ID na resposta)');

  const after = await fetchGcoopPreCadastro(cpf);
  console.log(
    '[test-gcoop] GetPreCadastro (depois):',
    gcoopPreCadastroExists(after) ? 'ENCONTRADO ✓' : 'não encontrado'
  );
  console.log('\n[test-gcoop] CPF para teste manual de bloqueio:', cpf);
}

main().catch((err) => {
  console.error('[test-gcoop] FALHA:', err?.message || err);
  if (err?.body) console.error('[test-gcoop] body:', JSON.stringify(err.body).slice(0, 800));
  process.exit(1);
});
