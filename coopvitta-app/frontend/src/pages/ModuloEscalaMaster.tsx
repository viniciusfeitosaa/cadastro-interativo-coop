import ValoresPlantao from './ValoresPlantao';

const ModuloEscalaMaster = () => (
  <ValoresPlantao
    modo="somente_escala"
    titulo="Módulo Escala"
    descricao="Escolha contrato, subgrupo e equipe do estilo Somente escala. Configure os tipos de plantão e os valores por tipo (repasse/cobrança por dia) para uso no relatório financeiro."
    exibirLocalizacaoPonto={false}
  />
);

export default ModuloEscalaMaster;
