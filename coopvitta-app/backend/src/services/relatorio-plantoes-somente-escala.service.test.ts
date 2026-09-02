import { prisma } from '../config/database';
import { escolherValorPlantaoRow, listPlantoesSomenteEscalaRelatorioService } from './relatorio-plantoes-somente-escala.service';

jest.mock('../config/database', () => ({
  prisma: {
    escalaEquipe: { findMany: jest.fn() },
    escalaPlantao: { findMany: jest.fn() },
    tipoPlantao: { findMany: jest.fn() },
    valorPlantao: { findMany: jest.fn() },
    adicionalPlantaoData: { findMany: jest.fn() },
    escalaMedico: { findMany: jest.fn() },
  },
}));

const mockEscalaEquipe = prisma.escalaEquipe.findMany as jest.Mock;
const mockPlantao = prisma.escalaPlantao.findMany as jest.Mock;
const mockTipo = prisma.tipoPlantao.findMany as jest.Mock;
const mockValor = prisma.valorPlantao.findMany as jest.Mock;
const mockAdicional = prisma.adicionalPlantaoData.findMany as jest.Mock;
const mockAloc = prisma.escalaMedico.findMany as jest.Mock;

describe('escolherValorPlantaoRow', () => {
  const rows = [
    { contratoAtivoId: 'c1', subgrupoId: 'sg', equipeId: null, gradeId: 'g1' },
    { contratoAtivoId: 'c1', subgrupoId: 'sg', equipeId: 'eq1', gradeId: 'g1' },
  ];
  it('prefere valor da equipe', () => {
    expect(
      escolherValorPlantaoRow(rows, {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg',
        equipeId: 'eq1',
        gradeId: 'g1',
      })?.equipeId
    ).toBe('eq1');
  });
  it('cai no padrão do subgrupo', () => {
    expect(
      escolherValorPlantaoRow(rows, {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg',
        equipeId: 'eq-outra',
        gradeId: 'g1',
      })?.equipeId
    ).toBeNull();
  });
});

describe('listPlantoesSomenteEscalaRelatorioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignora escalas que usam ponto', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-ponto',
        equipeId: 'eq1',
        escala: { id: 'esc-ponto', nome: 'Com ponto', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: true },
        },
      },
    ]);
    const r = await listPlantoesSomenteEscalaRelatorioService('t1', { contratoAtivoId: 'c1' });
    expect(r.itens).toEqual([]);
    expect(mockPlantao).not.toHaveBeenCalled();
  });

  it('calcula repasse/cobrança de plantão alocado sem ponto', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-se',
        equipeId: 'eq1',
        escala: { id: 'esc-se', nome: 'Só escala', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
    ]);
    mockTipo.mockResolvedValue([]);
    mockValor.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg1',
        equipeId: 'eq1',
        gradeId: 'g-mt',
        valorHora: 100,
        valorHoraCobranca: 133.33,
        valorHoraPorDia: { seg: 100 },
        valorHoraCobrancaPorDia: { seg: 133.33 },
      },
    ]);
    mockAdicional.mockResolvedValue([]);
    mockAloc.mockResolvedValue([]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {
      contratoAtivoId: 'c1',
      dataInicio: '2026-08-01',
      dataFim: '2026-08-31',
    });
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].valorRepasse).toBe(1200);
    expect(r.itens[0].valorCobranca).toBe(1599.96);
    expect(r.itens[0].duracaoMinutos).toBe(720);
    expect(r.totais.plantoes).toBe(1);
    expect(r.totais.repasse).toBe(1200);
  });

  it('aplica adicional percentual no total', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-se',
        equipeId: 'eq1',
        escala: { id: 'esc-se', nome: 'Só escala', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
    ]);
    mockTipo.mockResolvedValue([]);
    mockValor.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg1',
        equipeId: null,
        gradeId: 'g-mt',
        valorHora: 100,
        valorHoraCobranca: 100,
        valorHoraPorDia: null,
        valorHoraCobrancaPorDia: null,
      },
    ]);
    mockAdicional.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        percentual: 25,
      },
    ]);
    mockAloc.mockResolvedValue([]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {});
    expect(r.itens[0].adicionalPercentual).toBe(25);
    expect(r.itens[0].valorRepasse).toBe(1500);
  });

  it('prefere EscalaMedico.valorHora no repasse e mantém cobrança do cadastro', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-se',
        equipeId: 'eq1',
        escala: { id: 'esc-se', nome: 'Só escala', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
    ]);
    mockTipo.mockResolvedValue([]);
    mockValor.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg1',
        equipeId: null,
        gradeId: 'g-mt',
        valorHora: 100,
        valorHoraCobranca: 133.33,
        valorHoraPorDia: null,
        valorHoraCobrancaPorDia: null,
      },
    ]);
    mockAdicional.mockResolvedValue([]);
    mockAloc.mockResolvedValue([{ escalaId: 'esc-se', medicoId: 'm1', valorHora: 90 }]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {});
    expect(r.itens[0].valorHoraRepasse).toBe(90);
    expect(r.itens[0].valorRepasse).toBe(1080);
    expect(r.itens[0].valorCobranca).toBe(1599.96);
  });

  it('ignora escala mista (uma equipe com ponto e outra só escala)', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-mista',
        equipeId: 'eq1',
        escala: { id: 'esc-mista', nome: 'Mista', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg-se',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
      {
        escalaId: 'esc-mista',
        equipeId: 'eq2',
        escala: { id: 'esc-mista', nome: 'Mista', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq2',
          subgrupoId: 'sg-pt',
          subgrupo: { usaEscala: true, usaPonto: true },
        },
      },
    ]);
    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {});
    expect(r.itens).toEqual([]);
    expect(mockPlantao).not.toHaveBeenCalled();
  });

  it('usa duração do tipo quando o snapshot está vazio', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-se',
        equipeId: 'eq1',
        escala: { id: 'esc-se', nome: 'Só escala', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: null,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
    ]);
    mockTipo.mockResolvedValue([
      {
        id: 'g-mt',
        contratoAtivoId: 'c1',
        horaInicio: '07:00',
        horaFim: '19:00',
        cruzaMeiaNoite: false,
      },
    ]);
    mockValor.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg1',
        equipeId: null,
        gradeId: 'g-mt',
        valorHora: 100,
        valorHoraCobranca: 100,
        valorHoraPorDia: null,
        valorHoraCobrancaPorDia: null,
      },
    ]);
    mockAdicional.mockResolvedValue([]);
    mockAloc.mockResolvedValue([]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {});
    expect(r.itens[0].horasTurno).toBe(12);
    expect(r.itens[0].duracaoMinutos).toBe(720);
    expect(r.itens[0].valorRepasse).toBe(1200);
  });

  it('retorna plantão sem valor quando não há cadastro', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-se',
        equipeId: 'eq1',
        escala: { id: 'esc-se', nome: 'Só escala', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
    ]);
    mockTipo.mockResolvedValue([]);
    mockValor.mockResolvedValue([]);
    mockAdicional.mockResolvedValue([]);
    mockAloc.mockResolvedValue([]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {});
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].valorRepasse).toBeNull();
    expect(r.itens[0].valorCobranca).toBeNull();
    expect(r.totais.repasse).toBeNull();
    expect(r.itens[0].resumo).toMatch(/sem valor cadastrado/i);
  });

  it('filtra por subgrupo e soma dois plantões', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-a',
        equipeId: 'eq1',
        escala: { id: 'esc-a', nome: 'A', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
      {
        escalaId: 'esc-b',
        equipeId: 'eq2',
        escala: { id: 'esc-b', nome: 'B', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq2',
          subgrupoId: 'sg2',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-a',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
      {
        id: 'p2',
        data: new Date('2026-08-18T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-a',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dra. Teste' },
      },
    ]);
    mockTipo.mockResolvedValue([]);
    mockValor.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg1',
        equipeId: null,
        gradeId: 'g-mt',
        valorHora: 100,
        valorHoraCobranca: 100,
        valorHoraPorDia: null,
        valorHoraCobrancaPorDia: null,
      },
    ]);
    mockAdicional.mockResolvedValue([]);
    mockAloc.mockResolvedValue([]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', { subgrupoId: 'sg1' });
    expect(mockPlantao).toHaveBeenCalled();
    const where = mockPlantao.mock.calls[0][0].where;
    expect(where.escalaId.in).toEqual(['esc-a']);
    expect(r.itens).toHaveLength(2);
    expect(r.totais.plantoes).toBe(2);
    expect(r.totais.repasse).toBe(2400);
    expect(r.totais.minutos).toBe(1440);
  });

  it('UAT visível: 12h × R$ 75/100 (somente escala, 2 plantões)', async () => {
    mockEscalaEquipe.mockResolvedValue([
      {
        escalaId: 'esc-se',
        equipeId: 'eq1',
        escala: { id: 'esc-se', nome: 'UAT Escala sem ponto', contratoAtivoId: 'c1', ativo: true },
        equipe: {
          id: 'eq1',
          subgrupoId: 'sg1',
          subgrupo: { usaEscala: true, usaPonto: false },
        },
      },
    ]);
    mockPlantao.mockResolvedValue([
      {
        id: 'p1',
        data: new Date('2026-08-17T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dr. Teste Escala' },
      },
      {
        id: 'p2',
        data: new Date('2026-08-18T00:00:00.000Z'),
        gradeId: 'g-mt',
        medicoId: 'm1',
        escalaId: 'esc-se',
        horasTurnoSnapshot: 12,
        medico: { id: 'm1', nomeCompleto: 'Dr. Teste Escala' },
      },
    ]);
    mockTipo.mockResolvedValue([]);
    mockValor.mockResolvedValue([
      {
        contratoAtivoId: 'c1',
        subgrupoId: 'sg1',
        equipeId: 'eq1',
        gradeId: 'g-mt',
        valorHora: 75,
        valorHoraCobranca: 100,
        valorHoraPorDia: { seg: 75, ter: 75 },
        valorHoraCobrancaPorDia: { seg: 100, ter: 100 },
      },
    ]);
    mockAdicional.mockResolvedValue([]);
    mockAloc.mockResolvedValue([]);

    const r = await listPlantoesSomenteEscalaRelatorioService('t1', {});
    expect(r.itens).toHaveLength(2);
    expect(r.totais.repasse).toBe(1800);
    expect(r.totais.cobranca).toBe(2400);
    expect(r.totais.minutos).toBe(1440);
  });
});
