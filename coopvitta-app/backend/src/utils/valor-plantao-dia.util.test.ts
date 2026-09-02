import {
  calcularTotaisPlantaoSomenteEscala,
  diaKeyFromDateUtc,
  pickRatePorDia,
  ratesDoCadastroNoDia,
} from './valor-plantao-dia.util';

describe('valor-plantao-dia.util', () => {
  it('diaKeyFromDateUtc usa o dia civil UTC (DATE)', () => {
    expect(diaKeyFromDateUtc(new Date('2026-08-17T00:00:00.000Z'))).toBe('seg');
    expect(diaKeyFromDateUtc(new Date('2026-08-16T00:00:00.000Z'))).toBe('dom');
  });

  it('pickRatePorDia prefere o dia e cai no global', () => {
    expect(pickRatePorDia({ seg: 120, ter: 80 }, 'seg', 50)).toBe(120);
    expect(pickRatePorDia({ seg: 120 }, 'qua', 50)).toBe(50);
    expect(pickRatePorDia({}, 'seg', null)).toBeNull();
  });

  it('100 R$/h × 12h + margem implícita 133,33/h com adicional 10%', () => {
    const r = calcularTotaisPlantaoSomenteEscala({
      horasTurno: 12,
      dia: 'seg',
      cadastro: {
        valorHora: 100,
        valorHoraCobranca: 133.33,
        valorHoraPorDia: { seg: 100 },
        valorHoraCobrancaPorDia: { seg: 133.33 },
      },
      adicionalPercentual: 10,
    });
    expect(r.duracaoMinutos).toBe(720);
    expect(r.valorRepasse).toBe(1320);
    expect(r.valorCobranca).toBe(1759.96);
  });

  it('alocação médico–escala prevalece no repasse', () => {
    const r = calcularTotaisPlantaoSomenteEscala({
      horasTurno: 12,
      dia: 'seg',
      cadastro: { valorHora: 100, valorHoraCobranca: 133.33 },
      valorHoraAlocacao: 90,
    });
    expect(r.valorHoraRepasse).toBe(90);
    expect(r.valorRepasse).toBe(1080);
    expect(r.valorCobranca).toBe(1599.96);
  });

  it('sem cadastro e sem alocação → totais nulos', () => {
    const r = calcularTotaisPlantaoSomenteEscala({
      horasTurno: 12,
      dia: 'seg',
      cadastro: null,
    });
    expect(r.valorRepasse).toBeNull();
    expect(r.valorCobranca).toBeNull();
  });

  it('horasTurno inválidas → totais nulos e 0 minutos', () => {
    const r = calcularTotaisPlantaoSomenteEscala({
      horasTurno: 0,
      dia: 'seg',
      cadastro: { valorHora: 100, valorHoraCobranca: 100 },
    });
    expect(r.duracaoMinutos).toBe(0);
    expect(r.valorRepasse).toBeNull();
    expect(r.valorCobranca).toBeNull();
  });

  it('pickRatePorDia ignora zero e cai no global', () => {
    expect(pickRatePorDia({ seg: 0 }, 'seg', 50)).toBe(50);
  });

  it('ratesDoCadastroNoDia lê JSON por dia', () => {
    const r = ratesDoCadastroNoDia(
      {
        valorHora: 50,
        valorHoraPorDia: { sab: 80 },
        valorHoraCobranca: 70,
      },
      'sab'
    );
    expect(r.repasse).toBe(80);
    expect(r.cobranca).toBe(70);
  });
});
