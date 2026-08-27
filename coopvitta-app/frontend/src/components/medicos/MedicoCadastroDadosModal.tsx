import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DOCUMENTO_LABEL_BY_FIELD,
  DOCUMENTO_TIPO_BY_FIELD,
  type DocumentoPerfilField,
} from '../../constants/documentosPerfil';
import { FIELD_GROUPS, FIELD_LABELS } from '../../features/cadastro-coop/data/fieldLabels';
import { adminService, type MedicoCadastroDetalhe } from '../../services/admin.service';
import { fixMojibake } from '../../utils/validation.util';

function labelDocumentoTipo(tipo: string): string {
  const entry = Object.entries(DOCUMENTO_TIPO_BY_FIELD).find(([, v]) => v === tipo);
  if (entry) return DOCUMENTO_LABEL_BY_FIELD[entry[0] as DocumentoPerfilField];
  return tipo;
}

function formatWizardValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'termoConsentimento') return value === true ? 'Aceito' : 'Não aceito';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function triggerBlobDownload(blob: Blob, nomeArquivo: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo || 'documento';
  a.click();
  window.URL.revokeObjectURL(url);
}

type Props = {
  medicoId: string;
  medicoLabel: string;
  open: boolean;
  onClose: () => void;
};

function OnvioActions({ medicoId }: { medicoId: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const prepQuery = useQuery({
    queryKey: ['admin', 'medico-onvio-prep', medicoId],
    queryFn: async () => {
      const r = await adminService.getMedicoOnvioPrep(medicoId);
      return r.data;
    },
  });

  const prep = prepQuery.data;

  const copyDados = async () => {
    if (!prep?.clipboardText) return;
    try {
      await navigator.clipboard.writeText(prep.clipboardText);
      setFeedback('Dados copiados. Cole no formulário do Onvio.');
    } catch {
      setFeedback('Não foi possível copiar. Selecione o texto manualmente se necessário.');
    }
  };

  return (
    <div className="rounded-xl border border-coop-200/70 bg-coop-50/40 p-4 space-y-3">
      <h4 className="text-sm font-bold text-coop-900 font-display">Onvio</h4>
      {prepQuery.isLoading && <p className="text-xs text-coop-700">Carregando…</p>}
      {prep && (
        <div className="flex flex-wrap gap-2">
          <a
            className="btn text-sm border border-coop-300 bg-white text-coop-800"
            href={prep.partnerRegistrationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir Onvio
          </a>
          <button
            type="button"
            className="btn text-sm border border-coop-300 bg-white text-coop-800"
            onClick={() => void copyDados()}
          >
            Copiar dados
          </button>
        </div>
      )}
      {feedback && <p className="text-xs text-coop-800 whitespace-pre-wrap">{feedback}</p>}
    </div>
  );
}

function DadosContent({ d, medicoId }: { d: MedicoCadastroDetalhe; medicoId: string }) {
  const wizard = (d.dadosGcoopJson && typeof d.dadosGcoopJson === 'object' ? d.dadosGcoopJson : {}) as Record<
    string,
    unknown
  >;

  const downloadDoc = async (documentoId: string, nomeArquivo: string) => {
    const blob = await adminService.downloadMedicoCadastroDocumento(medicoId, documentoId);
    triggerBlobDownload(blob, nomeArquivo);
  };

  return (
    <div className="space-y-6">
      <OnvioActions medicoId={medicoId} />

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-coop-600 font-medium">CPF</dt>
          <dd className="text-coop-900 font-mono">{d.cpf}</dd>
        </div>
        <div>
          <dt className="text-coop-600 font-medium">Telefone</dt>
          <dd className="text-coop-900">{d.telefone || '—'}</dd>
        </div>
        <div>
          <dt className="text-coop-600 font-medium">Profissão / CRM</dt>
          <dd className="text-coop-900">
            {fixMojibake(d.profissao)}
            {d.crm ? ` · ${d.crm}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-coop-600 font-medium">Vínculo</dt>
          <dd className="text-coop-900">{d.vinculo || '—'}</dd>
        </div>
        <div>
          <dt className="text-coop-600 font-medium">Status cadastro</dt>
          <dd className="text-coop-900">{d.statusCadastro}</dd>
        </div>
        <div>
          <dt className="text-coop-600 font-medium">Ativo na plataforma</dt>
          <dd className="text-coop-900">{d.ativo ? 'Sim' : 'Não'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-coop-600 font-medium">Especialidades</dt>
          <dd className="text-coop-900">{(d.especialidades || []).join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-coop-600 font-medium">Estado civil</dt>
          <dd className="text-coop-900">{d.estadoCivil || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-coop-600 font-medium">Endereço (resumo)</dt>
          <dd className="text-coop-900 whitespace-pre-wrap">{d.enderecoResidencial || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-coop-600 font-medium">Dados bancários (resumo)</dt>
          <dd className="text-coop-900 whitespace-pre-wrap">{d.dadosBancarios || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-coop-600 font-medium">Chave Pix</dt>
          <dd className="text-coop-900">{d.chavePix || '—'}</dd>
        </div>
        {d.gcoopSyncStatus && (
          <div className="sm:col-span-2">
            <dt className="text-coop-600 font-medium">Sincronização Gcoop</dt>
            <dd className="text-coop-900">
              {d.gcoopSyncStatus}
              {d.gcoopSincronizadoEm
                ? ` · ${new Date(d.gcoopSincronizadoEm).toLocaleString('pt-BR')}`
                : ''}
              {d.gcoopSyncErro ? (
                <span className="block text-amber-800 text-xs mt-1">{d.gcoopSyncErro}</span>
              ) : null}
            </dd>
          </div>
        )}
        {d.onvioSyncStatus && (
          <div className="sm:col-span-2">
            <dt className="text-coop-600 font-medium">Sincronização Onvio</dt>
            <dd className="text-coop-900">
              {d.onvioSyncStatus}
              {d.onvioExternalId ? ` · ${d.onvioExternalId}` : ''}
              {d.onvioSincronizadoEm
                ? ` · ${new Date(d.onvioSincronizadoEm).toLocaleString('pt-BR')}`
                : ''}
              {d.onvioSyncErro ? (
                <span className="block text-amber-800 text-xs mt-1">{d.onvioSyncErro}</span>
              ) : null}
            </dd>
          </div>
        )}
      </dl>

      {Object.keys(wizard).length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-coop-900 font-display">Formulário de pré-cadastro</h4>
          {FIELD_GROUPS.map((group) => {
            const rows = group.fields
              .map((field) => {
                const value = wizard[field];
                if (value == null || value === '') return null;
                return { field, label: FIELD_LABELS[field] || field, display: formatWizardValue(field, value) };
              })
              .filter(Boolean) as { field: string; label: string; display: string }[];
            if (!rows.length) return null;
            return (
              <div key={group.title} className="rounded-xl border border-coop-200/70 bg-coop-50/30 p-4">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-coop-600 font-display mb-3">
                  {group.title}
                </h5>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {rows.map((row) => (
                    <div key={row.field}>
                      <dt className="text-coop-600 font-medium">{row.label}</dt>
                      <dd className="text-coop-900 break-words">{row.display}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h4 className="text-sm font-bold text-coop-900 font-display mb-2">Documentos anexados</h4>
        {!d.documentos?.length && (
          <p className="text-sm text-coop-700 font-serif">Nenhum ficheiro anexado no cadastro.</p>
        )}
        <ul className="space-y-2">
          {d.documentos?.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-coop-200/80 bg-coop-50/40 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-coop-900">{labelDocumentoTipo(doc.tipo)}</p>
                <p className="text-xs text-coop-700">{doc.nomeArquivo}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-coop-700 hover:text-coop-900 underline"
                onClick={() => downloadDoc(doc.id, doc.nomeArquivo)}
              >
                Descarregar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MedicoCadastroDadosModal({ medicoId, medicoLabel, open, onClose }: Props) {
  const detailQuery = useQuery({
    queryKey: ['admin', 'medico-cadastro-detalhe', medicoId],
    queryFn: async () => {
      const r = await adminService.getMedicoCadastroDetalhe(medicoId);
      return r.data;
    },
    enabled: open && !!medicoId,
  });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/40 overflow-y-auto sm:overflow-hidden flex items-start sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="card w-full sm:max-w-4xl border border-coop-200/70 shadow-2xl overflow-hidden flex flex-col rounded-none sm:rounded-2xl h-[100svh] sm:h-auto sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none bg-white/95 backdrop-blur-sm border-b border-coop-100 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-coop-900 font-display">Dados do cadastro</h3>
            <p className="text-xs text-coop-600 font-serif truncate">{fixMojibake(medicoLabel)}</p>
          </div>
          <button
            type="button"
            className="btn text-sm border border-coop-300 bg-white text-coop-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5">
          {detailQuery.isLoading && <p className="text-sm text-coop-700">Carregando dados…</p>}
          {detailQuery.isError && (
            <p className="text-sm text-red-700">Não foi possível carregar os dados deste cadastro.</p>
          )}
          {detailQuery.data && <DadosContent d={detailQuery.data} medicoId={medicoId} />}
        </div>
      </div>
    </div>,
    document.body
  );
}
