import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CATEGORIAS_PROFISSIONAL, PAGAMENTO_LABEL, PAGAMENTO_VAGA, TIPOS_ATENDIMENTO_SUGESTOES } from '../../constants/vagas';
import { notify } from '../../lib/notificationEmitter';
import { medicoService, type CreateVagaPayload } from '../../services/medico.service';
import MiniCalendarioDias from './MiniCalendarioDias';

function reaisParaCentavos(input: string): number | null {
  const t = input.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function formatCentavosBRL(centavos: number | null): string {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Step = 1 | 2;

type Props = {
  onPublicado: () => void;
};

const AnunciarVagaWizard = ({ onPublicado }: Props) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);

  const [tipoSelect, setTipoSelect] = useState<string>(TIPOS_ATENDIMENTO_SUGESTOES[0]);
  const [tipoOutro, setTipoOutro] = useState('');
  const [setor, setSetor] = useState('');
  const [valorACombinar, setValorACombinar] = useState(true);
  const [valorReaisStr, setValorReaisStr] = useState('');
  const [valorLiquidoBruto, setValorLiquidoBruto] = useState<'LIQUIDO' | 'BRUTO'>('LIQUIDO');
  const [pagamento, setPagamento] = useState<'A_VISTA' | 'COMBINAR'>('A_VISTA');
  const [quantidadeVagas, setQuantidadeVagas] = useState(1);
  const [prazoPublicacaoDias, setPrazoPublicacaoDias] = useState(30);
  const [categoriaProfissional] = useState('MEDICO');
  const [diasVaga, setDiasVaga] = useState<string[]>([]);
  const [descricao, setDescricao] = useState('');
  const [declaroResponsavel, setDeclaroResponsavel] = useState(false);

  const tipoAtendimentoFinal =
    tipoSelect === 'Outro' ? tipoOutro.trim() || 'Outro' : tipoSelect;

  const validarPasso1 = (): string | null => {
    if (!setor.trim()) return 'Informe o setor da unidade de saúde.';
    if (!valorACombinar) {
      const c = reaisParaCentavos(valorReaisStr);
      if (c == null || c <= 0) return 'Informe um valor válido em reais ou marque "Valor a combinar".';
    }
    if (diasVaga.length < 1) return 'Selecione ao menos um dia no calendário.';
    if (!descricao.trim()) return 'Preencha a descrição da vaga.';
    if (tipoSelect === 'Outro' && !tipoOutro.trim()) return 'Descreva o tipo de atendimento.';
    return null;
  };

  const mutation = useMutation({
    mutationFn: (payload: CreateVagaPayload) => medicoService.createVaga(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas-publicadas'] });
      notify({ kind: 'success', message: 'Vaga publicada com sucesso.' });
      setDeclaroResponsavel(false);
      setStep(1);
      setSetor('');
      setDescricao('');
      setDiasVaga([]);
      setValorReaisStr('');
      setQuantidadeVagas(1);
      onPublicado();
    },
    onError: (err: unknown) => {
      let msg = 'Não foi possível publicar a vaga.';
      if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const d = err.response.data as { error?: string; errors?: { msg?: string }[] };
        if (typeof d.error === 'string') msg = d.error;
        else if (Array.isArray(d.errors) && d.errors.length > 0) {
          msg = d.errors.map((e) => e.msg).filter(Boolean).join(' · ') || msg;
        }
      }
      notify({ kind: 'error', message: msg });
    },
  });

  const avancar = () => {
    const err = validarPasso1();
    if (err) {
      notify({ kind: 'error', message: err });
      return;
    }
    setStep(2);
  };

  const confirmar = () => {
    if (!declaroResponsavel) {
      notify({ kind: 'error', message: 'Marque a declaração de responsabilidade para continuar.' });
      return;
    }
    const valorCentavos = valorACombinar ? null : reaisParaCentavos(valorReaisStr);
    if (!valorACombinar && (valorCentavos == null || valorCentavos <= 0)) {
      notify({ kind: 'error', message: 'Valor inválido.' });
      return;
    }

    const payload: CreateVagaPayload = {
      tipoAtendimento: tipoAtendimentoFinal,
      setor: setor.trim(),
      valorACombinar,
      valorCentavos,
      valorLiquidoBruto: valorACombinar ? null : valorLiquidoBruto,
      pagamento,
      quantidadeVagas,
      prazoPublicacaoDias,
      categoriaProfissional,
      diasVaga,
      descricao: descricao.trim(),
      confirmacaoResponsavel: true,
    };
    mutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-coop-700 font-serif">
        <span
          className={`rounded-full px-3 py-1 font-display font-semibold ${
            step === 1 ? 'bg-coop-900 text-white' : 'bg-coop-100 text-coop-800'
          }`}
        >
          1 · Dados da vaga
        </span>
        <span className="text-coop-400">→</span>
        <span
          className={`rounded-full px-3 py-1 font-display font-semibold ${
            step === 2 ? 'bg-coop-900 text-white' : 'bg-coop-100 text-coop-800'
          }`}
        >
          2 · Confirmação
        </span>
      </div>

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-coop-900 font-display mb-1.5">
                Tipo de atendimento
              </label>
              <select
                value={tipoSelect}
                onChange={(e) => setTipoSelect(e.target.value)}
                className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2.5 text-sm text-coop-900 focus:border-coop-600 focus:outline-none focus:ring-2 focus:ring-coop-600/20"
              >
                {TIPOS_ATENDIMENTO_SUGESTOES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {tipoSelect === 'Outro' && (
                <input
                  type="text"
                  value={tipoOutro}
                  onChange={(e) => setTipoOutro(e.target.value)}
                  placeholder="Descreva o tipo"
                  className="mt-2 w-full rounded-xl border border-coop-200 px-3 py-2.5 text-sm"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-coop-900 font-display mb-1.5">
                Setor (unidade de saúde)
              </label>
              <input
                type="text"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                placeholder="Ex.: Pediatria, Centro de imagem…"
                className="w-full rounded-xl border border-coop-200 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-coop-900 font-display mb-2">Valor</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="valor"
                    checked={valorACombinar}
                    onChange={() => setValorACombinar(true)}
                    className="text-coop-900"
                  />
                  Valor a combinar
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="valor"
                    checked={!valorACombinar}
                    onChange={() => setValorACombinar(false)}
                    className="text-coop-900"
                  />
                  Informar valor
                </label>
              </div>
              {!valorACombinar && (
                <div className="mt-3 space-y-2 rounded-xl border border-coop-100 bg-coop-50/50 p-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorReaisStr}
                    onChange={(e) => setValorReaisStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-coop-200 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="liq"
                        checked={valorLiquidoBruto === 'LIQUIDO'}
                        onChange={() => setValorLiquidoBruto('LIQUIDO')}
                      />
                      Líquido
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="liq"
                        checked={valorLiquidoBruto === 'BRUTO'}
                        onChange={() => setValorLiquidoBruto('BRUTO')}
                      />
                      Bruto
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-coop-900 font-display mb-2">Dia do pagamento</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pag"
                    checked={pagamento === PAGAMENTO_VAGA.A_VISTA}
                    onChange={() => setPagamento(PAGAMENTO_VAGA.A_VISTA)}
                  />
                  {PAGAMENTO_LABEL.A_VISTA}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pag"
                    checked={pagamento === PAGAMENTO_VAGA.COMBINAR}
                    onChange={() => setPagamento(PAGAMENTO_VAGA.COMBINAR)}
                  />
                  {PAGAMENTO_LABEL.COMBINAR}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-coop-900 font-display mb-1.5">
                  Quantidade de vagas
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={quantidadeVagas}
                  onChange={(e) => setQuantidadeVagas(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-coop-200 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-coop-900 font-display mb-1.5">
                  Prazo da publicação (dias ativos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={prazoPublicacaoDias}
                  onChange={(e) =>
                    setPrazoPublicacaoDias(Math.min(365, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="w-full rounded-xl border border-coop-200 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-coop-900 font-display mb-1.5">
                Categoria do profissional
              </label>
              <select
                value={categoriaProfissional}
                disabled
                className="w-full rounded-xl border border-coop-200 bg-coop-50 px-3 py-2.5 text-sm text-coop-800"
              >
                {CATEGORIAS_PROFISSIONAL.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <MiniCalendarioDias selected={diasVaga} onChange={setDiasVaga} />
            <div>
              <label className="block text-sm font-semibold text-coop-900 font-display mb-1.5">
                Descrição da vaga
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={6}
                placeholder="Requisitos, turno, observações…"
                className="w-full rounded-xl border border-coop-200 px-3 py-2.5 text-sm font-serif resize-y min-h-[120px]"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-2xl border border-coop-200 bg-gradient-to-br from-white to-coop-50/40 p-5 space-y-4">
          <h3 className="text-lg font-bold text-coop-950 font-display">Resumo</h3>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-coop-600 font-serif">Tipo de atendimento</dt>
              <dd className="font-medium text-coop-900 text-right">{tipoAtendimentoFinal}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-coop-600 font-serif">Setor</dt>
              <dd className="font-medium text-coop-900 text-right">{setor || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-coop-600 font-serif">Valor</dt>
              <dd className="font-medium text-coop-900 text-right">
                {valorACombinar
                  ? 'A combinar'
                  : `${formatCentavosBRL(reaisParaCentavos(valorReaisStr))} (${valorLiquidoBruto === 'LIQUIDO' ? 'Líquido' : 'Bruto'})`}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-coop-600 font-serif">Pagamento</dt>
              <dd className="font-medium text-coop-900 text-right">{PAGAMENTO_LABEL[pagamento]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-coop-600 font-serif">Vagas / Prazo do anúncio</dt>
              <dd className="font-medium text-coop-900 text-right">
                {quantidadeVagas} · {prazoPublicacaoDias} dias
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-coop-600 font-serif">Dias da cobertura</dt>
              <dd className="font-medium text-coop-900 text-right max-w-[60%]">
                {diasVaga.join(', ')}
              </dd>
            </div>
            <div>
              <dt className="text-coop-600 font-serif mb-1">Descrição</dt>
              <dd className="text-coop-900 font-serif whitespace-pre-wrap rounded-lg bg-white/80 p-3 border border-coop-100">
                {descricao}
              </dd>
            </div>
          </dl>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <input
              type="checkbox"
              checked={declaroResponsavel}
              onChange={(e) => setDeclaroResponsavel(e.target.checked)}
              className="mt-1 rounded border-coop-300 text-coop-900"
            />
            <span className="text-sm text-coop-900 font-serif leading-relaxed">
              Declaro que sou o(a) responsável pelo setor informado nesta unidade de saúde e que as informações prestadas
              são verdadeiras, podendo responder por elas perante a instituição e os profissionais interessados.
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-xl border border-coop-200 px-5 py-2.5 text-sm font-semibold text-coop-800 hover:bg-coop-50 font-display"
          >
            Voltar
          </button>
        )}
        {step === 1 && (
          <button
            type="button"
            onClick={avancar}
            className="rounded-xl bg-coop-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-coop-800 font-display"
          >
            Continuar para confirmação
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={confirmar}
            className="rounded-xl bg-coop-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-coop-800 disabled:opacity-60 font-display"
          >
            {mutation.isPending ? 'Publicando…' : 'Confirmar publicação da vaga'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AnunciarVagaWizard;
