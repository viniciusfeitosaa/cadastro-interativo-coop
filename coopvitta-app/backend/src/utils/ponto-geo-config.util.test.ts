import {
  normalizarGeoConfig,
  pickGeoConfigParaEscala,
  pickGeoConfigSemEscala,
  type ConfigGeoRow,
  type MedicoEquipeGeoLinha,
} from './ponto-geo-config.util';

describe('normalizarGeoConfig', () => {
  it('retorna null para raio zero ou NaN', () => {
    expect(normalizarGeoConfig({ latitude: 1, longitude: 2, raioMetros: 0 })).toBeNull();
    expect(normalizarGeoConfig({ latitude: 'x', longitude: 2, raioMetros: 10 })).toBeNull();
  });

  it('normaliza números válidos', () => {
    expect(normalizarGeoConfig({ latitude: '-23.5', longitude: '-46.6', raioMetros: 100 })).toEqual({
      latitude: -23.5,
      longitude: -46.6,
      raioMetros: 100,
    });
  });
});

describe('pickGeoConfigParaEscala', () => {
  const candidatos: MedicoEquipeGeoLinha[] = [
    { equipeId: 'e1', subgrupoId: 's1' },
    { equipeId: 'e2', subgrupoId: 's2' },
  ];

  it('prioriza a ordem dos candidatos', () => {
    const configs: ConfigGeoRow[] = [
      {
        equipeId: 'e2',
        subgrupoId: 's2',
        latitude: 2,
        longitude: 2,
        raioMetros: 50,
      },
      {
        equipeId: 'e1',
        subgrupoId: 's1',
        latitude: 1,
        longitude: 1,
        raioMetros: 50,
      },
    ];
    const r = pickGeoConfigParaEscala(candidatos, configs);
    expect(r).toEqual({ latitude: 1, longitude: 1, raioMetros: 50 });
  });

  it('ignora subgrupo ausente e geo inválida', () => {
    const configs: ConfigGeoRow[] = [
      {
        equipeId: 'e1',
        subgrupoId: 's1',
        latitude: 1,
        longitude: 1,
        raioMetros: 0,
      },
      {
        equipeId: 'e2',
        subgrupoId: 's2',
        latitude: 9,
        longitude: 9,
        raioMetros: 10,
      },
    ];
    expect(
      pickGeoConfigParaEscala(
        [
          { equipeId: 'e0', subgrupoId: null },
          { equipeId: 'e1', subgrupoId: 's1' },
          { equipeId: 'e2', subgrupoId: 's2' },
        ],
        configs
      )
    ).toEqual({ latitude: 9, longitude: 9, raioMetros: 10 });
  });
});

describe('pickGeoConfigSemEscala', () => {
  it('segue ordem das equipes do médico', () => {
    const medico: MedicoEquipeGeoLinha[] = [
      { equipeId: 'a', subgrupoId: 'x' },
      { equipeId: 'b', subgrupoId: 'y' },
    ];
    const configs: ConfigGeoRow[] = [
      { equipeId: 'b', subgrupoId: 'y', latitude: 2, longitude: 2, raioMetros: 5 },
      { equipeId: 'a', subgrupoId: 'x', latitude: 1, longitude: 1, raioMetros: 5 },
    ];
    expect(pickGeoConfigSemEscala(medico, configs)).toEqual({
      latitude: 1,
      longitude: 1,
      raioMetros: 5,
    });
  });
});
