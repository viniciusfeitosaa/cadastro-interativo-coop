import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { STATUS_INTERESSE_LABEL } from '../../constants/vagas';
import { notify } from '../../lib/notificationEmitter';
import { medicoService, type CandidatoInteresseItem } from '../../services/medico.service';
import { whatsappHrefFromTelefone } from '../../utils/whatsapp';

type Props = {
  open: boolean;
  onClose: () => void;
  vagaId: string | null;
  titulo: string;
};

const CandidatosVagaModal = ({ open, onClose, vagaId, titulo }: Props) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['medico', 'vagas', vagaId, 'candidatos'],
    queryFn: () => medicoService.getCandidatosVaga(vagaId!),
    enabled: open && !!vagaId,
  });

  const items: CandidatoInteresseItem[] = data?.data?.items ?? [];

  const patchMut = useMutation({
    mutationFn: ({ candidatoId, status }: { candidatoId: string; status: 'ACEITO' | 'RECUSADO' }) =>
      medicoService.patchStatusCandidatoVaga(vagaId!, candidatoId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas', vagaId, 'candidatos'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas-publicadas'] });
      notify({ kind: 'success', message: 'Status atualizado.' });
    },
    onError: (err: unknown) => {
      let msg = 'Não foi possível atualizar.';
      if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const d = err.response.data as { error?: string };
        if (typeof d.error === 'string') msg = d.error;
      }
      notify({ kind: 'error', message: msg });
    },
  });

  if (!open) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40" aria-label="Fechar" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(100%-1.5rem,640px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-coop-200 bg-white shadow-2xl flex flex-col">
        <div className="flex-none border-b border-coop-100 px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-coop-950 font-display">Candidatos</h3>
            <p className="text-xs text-coop-600 font-serif mt-0.5">{titulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-coop-700 hover:bg-coop-100"
          >
            Fechar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <p className="text-sm text-coop-700 font-serif">Carregando…</p>}
          {error && <p className="text-sm text-red-700">Não foi possível carregar candidatos.</p>}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-coop-700 font-serif">Nenhum interesse registrado ainda.</p>
          )}
          <ul className="space-y-3">
            {items.map((row) => {
              const wa = row.candidato.whatsappHref || whatsappHrefFromTelefone(row.candidato.telefone);
              return (
                <li
                  key={row.interesseId}
                  className="rounded-xl border border-coop-100 bg-coop-50/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-coop-950 font-display">{row.candidato.nomeCompleto}</p>
                      <p className="text-coop-700 font-serif text-xs mt-0.5">
                        {row.candidato.profissao}
                        {row.candidato.crm ? ` · CRM ${row.candidato.crm}` : ''}
                      </p>
                      {row.candidato.especialidades?.length > 0 && (
                        <p className="text-xs text-coop-600 mt-1">{row.candidato.especialidades.join(', ')}</p>
                      )}
                      {row.candidato.email && (
                        <p className="text-xs text-coop-700 mt-1">{row.candidato.email}</p>
                      )}
                      {row.candidato.telefone && <p className="text-xs text-coop-700">{row.candidato.telefone}</p>}
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-coop-800 ring-1 ring-coop-200">
                      {STATUS_INTERESSE_LABEL[row.status] ?? row.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                      >
                        Conversar no WhatsApp
                      </a>
                    )}
                    {row.status === 'PENDENTE' && (
                      <>
                        <button
                          type="button"
                          disabled={patchMut.isPending}
                          onClick={() => patchMut.mutate({ candidatoId: row.candidato.id, status: 'ACEITO' })}
                          className="rounded-lg bg-coop-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-coop-800 disabled:opacity-50"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          disabled={patchMut.isPending}
                          onClick={() => patchMut.mutate({ candidatoId: row.candidato.id, status: 'RECUSADO' })}
                          className="rounded-lg border border-coop-300 px-3 py-1.5 text-xs font-semibold text-coop-900 hover:bg-coop-100 disabled:opacity-50"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-coop-500 mt-2">
                    Interesse em {new Date(row.criadoEm).toLocaleString('pt-BR')}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
};

export default CandidatosVagaModal;
