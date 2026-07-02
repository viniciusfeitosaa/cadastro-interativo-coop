import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { notify } from '../../lib/notificationEmitter';
import { medicoService, type MinhaVagaPublicadaItem } from '../../services/medico.service';

type Props = {
  onVerCandidatos: (vagaId: string, titulo: string) => void;
};

function formatData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MinhasPublicacoesPanel = ({ onVerCandidatos }: Props) => {
  const queryClient = useQueryClient();
  const [excluirModal, setExcluirModal] = useState<{ id: string; titulo: string } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['medico', 'vagas-publicadas'],
    queryFn: () => medicoService.listMinhasPublicadasVagas(),
  });

  const items: MinhaVagaPublicadaItem[] = data?.data?.items ?? [];

  const delMut = useMutation({
    mutationFn: (id: string) => medicoService.deleteVaga(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas-publicadas'] });
      queryClient.invalidateQueries({ queryKey: ['medico', 'vagas'] });
      notify({ kind: 'success', message: 'Vaga excluída.' });
    },
    onError: (err: unknown) => {
      let msg = 'Não foi possível excluir.';
      if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const d = err.response.data as { error?: string };
        if (typeof d.error === 'string') msg = d.error;
      }
      notify({ kind: 'error', message: msg });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-6">
        <div className="h-9 w-9 rounded-xl border-2 border-coop-200 border-t-coop-700 animate-spin" />
        <p className="text-sm text-coop-700 font-serif">Carregando…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-coop-700 font-serif py-4">
        Você ainda não publicou vagas. Use a aba <strong>Anunciar</strong>.
      </p>
    );
  }

  const tituloLista = (v: MinhaVagaPublicadaItem) => `${v.tipoAtendimento} — ${v.setor}`;

  return (
    <>
      <ul className="space-y-3">
        {items.map((v) => (
          <li
            key={v.id}
            className="rounded-2xl border border-coop-100 bg-white p-4 flex flex-wrap items-start justify-between gap-3"
          >
            <div>
              <p className="font-bold text-coop-950 font-display">{v.tipoAtendimento}</p>
              <p className="text-sm text-coop-700 font-serif">{v.setor}</p>
              <p className="text-xs text-coop-600 mt-1">
                Publicada em {formatData(v.createdAt)} · {v.ativa ? 'Ativa' : 'Expirada'}{' '}
                {v.ativa ? `(até ${formatData(v.expiresAt)})` : ''}
              </p>
              <p className="text-xs text-coop-700 mt-2">
                Interesses: {v.totalInteresses} · Pendentes: {v.pendentes}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onVerCandidatos(v.id, tituloLista(v))}
                className="rounded-xl bg-coop-900 px-4 py-2 text-xs font-semibold text-white hover:bg-coop-800"
              >
                Candidatos
              </button>
              <button
                type="button"
                onClick={() => setExcluirModal({ id: v.id, titulo: tituloLista(v) })}
                disabled={delMut.isPending}
                className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {excluirModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !delMut.isPending && setExcluirModal(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-coop-100"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="excluir-vaga-titulo"
          >
            <h3 id="excluir-vaga-titulo" className="text-lg font-bold text-coop-900 font-display mb-2">
              Excluir vaga publicada?
            </h3>
            <p className="text-sm text-coop-700 font-serif mb-1">
              <span className="font-semibold text-coop-900">{excluirModal.titulo}</span>
            </p>
            <p className="text-sm text-coop-600 mb-5">
              A vaga deixará de aparecer para outros profissionais. Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setExcluirModal(null)}
                disabled={delMut.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary bg-red-600 hover:bg-red-700"
                disabled={delMut.isPending}
                onClick={() => {
                  delMut.mutate(excluirModal.id, {
                    onSuccess: () => setExcluirModal(null),
                  });
                }}
              >
                {delMut.isPending ? 'Excluindo…' : 'Excluir vaga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MinhasPublicacoesPanel;
