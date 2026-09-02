export const isJustificadoSemPonto = (origem?: string | null) => origem === 'JUSTIFICADO_SEM_PONTO';

export const BadgeJustificadoSemPonto = () => (
  <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs font-medium">
    Sem ponto — justificado
  </span>
);

type SituacaoRegistroPontoProps = {
  origem?: string | null;
  atrasado?: boolean;
  minutosAtraso?: number | null;
};

export const SituacaoRegistroPonto = ({ origem, atrasado, minutosAtraso }: SituacaoRegistroPontoProps) => {
  if (isJustificadoSemPonto(origem)) {
    return <BadgeJustificadoSemPonto />;
  }
  if (atrasado) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
        Atrasado ({minutosAtraso ?? 0} min)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
      No horário
    </span>
  );
};

export const situacaoRegistroPontoTexto = ({
  origem,
  atrasado,
  minutosAtraso,
}: SituacaoRegistroPontoProps) => {
  if (isJustificadoSemPonto(origem)) return 'Sem ponto — justificado';
  if (atrasado) return `Atrasado (${minutosAtraso ?? 0} min)`;
  return 'No horário';
};
