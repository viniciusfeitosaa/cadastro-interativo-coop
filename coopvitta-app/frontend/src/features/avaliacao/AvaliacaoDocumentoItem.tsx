import { useEffect, useRef, useState } from 'react';
import {
  adminService,
  type CadastroPendenteDocumento,
} from '../../services/admin.service';
import { CADASTRO_MAX_BYTES_PER_FILE } from '../../constants/documentosPerfil';

type RevisaoStatus = NonNullable<CadastroPendenteDocumento['revisaoStatus']>;

function statusBadge(status: RevisaoStatus | undefined) {
  switch (status) {
    case 'OK':
      return {
        label: 'OK',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'SOLICITADO_NOVAMENTE':
      return {
        label: 'Solicitado novamente',
        className: 'bg-amber-100 text-amber-900 border-amber-200',
      };
    default:
      return {
        label: 'Pendente',
        className: 'bg-coop-100 text-coop-800 border-coop-200',
      };
  }
}

function isPreviewableMime(mime: string, nome: string) {
  const m = (mime || '').toLowerCase();
  const n = (nome || '').toLowerCase();
  if (m.startsWith('image/') || m === 'application/pdf') return true;
  if (n.endsWith('.pdf') || /\.(jpe?g|png|gif|webp)$/i.test(n)) return true;
  return false;
}

type Props = {
  medicoId: string;
  label: string;
  doc: CadastroPendenteDocumento;
  onUpdated: (doc: CadastroPendenteDocumento) => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
};

export default function AvaliacaoDocumentoItem({
  medicoId,
  label,
  doc,
  onUpdated,
  onError,
  onInfo,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const badge = statusBadge(doc.revisaoStatus);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const openPreview = async () => {
    if (!isPreviewableMime(doc.mimeType, doc.nomeArquivo)) {
      onError('Pré-visualização disponível apenas para PDF e imagens. Use Descarregar.');
      return;
    }
    setBusy(true);
    try {
      const blob = await adminService.downloadCadastroPendenteDocumento(medicoId, doc.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch {
      onError('Falha ao pré-visualizar o documento.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await adminService.downloadCadastroPendenteDocumento(medicoId, doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nomeArquivo || 'documento';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onError('Falha ao baixar o documento.');
    } finally {
      setBusy(false);
    }
  };

  const marcarOk = async () => {
    setBusy(true);
    try {
      const r = await adminService.marcarDocumentoCadastroPendenteOk(medicoId, doc.id);
      if (r.data) onUpdated(r.data);
      onInfo('Documento marcado como OK.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      onError(err.response?.data?.error || 'Falha ao confirmar o documento.');
    } finally {
      setBusy(false);
    }
  };

  const enviarSolicitacao = async () => {
    const msg = mensagem.trim();
    if (msg.length < 5) {
      onError('Escreva o motivo (mínimo 5 caracteres).');
      return;
    }
    setBusy(true);
    try {
      const r = await adminService.solicitarDocumentoCadastroPendente(medicoId, doc.id, msg);
      if (r.data) onUpdated(r.data);
      setSolicitarOpen(false);
      setMensagem('');
      onInfo('E-mail de solicitação enviado ao profissional.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      onError(err.response?.data?.error || 'Falha ao solicitar o documento por e-mail.');
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > CADASTRO_MAX_BYTES_PER_FILE) {
      onError('Ficheiro demasiado grande (máx. 25 MB).');
      return;
    }
    setBusy(true);
    try {
      const r = await adminService.substituirDocumentoCadastroPendente(medicoId, doc.id, file);
      if (r.data) onUpdated(r.data);
      onInfo('Documento substituído e marcado como OK.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      onError(err.response?.data?.error || 'Falha ao substituir o documento.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPdf =
    (doc.mimeType || '').toLowerCase() === 'application/pdf' ||
    (doc.nomeArquivo || '').toLowerCase().endsWith('.pdf');
  const isImage =
    (doc.mimeType || '').toLowerCase().startsWith('image/') ||
    /\.(jpe?g|png|gif|webp)$/i.test(doc.nomeArquivo || '');

  return (
    <>
      <li className="rounded-lg border border-coop-200/80 bg-coop-50/40 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-coop-900">{label}</p>
            <p className="text-xs text-coop-700 truncate">{doc.nomeArquivo}</p>
            <span
              className={`mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${badge.className}`}
            >
              {badge.label}
            </span>
            {doc.revisaoStatus === 'SOLICITADO_NOVAMENTE' && doc.revisaoMensagem ? (
              <p className="mt-1 text-xs text-amber-900/90 line-clamp-2">{doc.revisaoMensagem}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              disabled={busy}
              className="text-sm font-semibold text-coop-700 hover:text-coop-900 underline disabled:opacity-50"
              onClick={() => void openPreview()}
            >
              Pré-visualizar
            </button>
            <button
              type="button"
              disabled={busy}
              className="text-sm font-semibold text-coop-700 hover:text-coop-900 underline disabled:opacity-50"
              onClick={() => void download()}
            >
              Descarregar
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-coop-200/60 pt-2">
          <button
            type="button"
            disabled={busy || doc.revisaoStatus === 'OK'}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            onClick={() => void marcarOk()}
          >
            Confirmar OK
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-40"
            onClick={() => {
              setMensagem(doc.revisaoMensagem || '');
              setSolicitarOpen(true);
            }}
          >
            Solicitar por e-mail
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-coop-300 bg-white text-coop-800 hover:bg-coop-50 disabled:opacity-40"
            onClick={() => fileInputRef.current?.click()}
          >
            Substituir ficheiro
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => void onFileChosen(e.target.files?.[0])}
          />
        </div>
      </li>

      {previewOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={closePreview}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Pré-visualização: ${label}`}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-coop-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-coop-900 truncate">{label}</p>
                <p className="text-xs text-coop-600 truncate">{doc.nomeArquivo}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-coop-700 hover:text-coop-900"
                onClick={closePreview}
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 min-h-[50vh] bg-coop-50">
              {isPdf ? (
                <iframe title={doc.nomeArquivo} src={previewUrl} className="w-full h-[70vh] border-0" />
              ) : isImage ? (
                <div className="flex items-center justify-center p-4 h-[70vh] overflow-auto">
                  <img src={previewUrl} alt={doc.nomeArquivo} className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <p className="p-6 text-sm text-coop-700">Formato sem pré-visualização. Use Descarregar.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {solicitarOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={() => !busy && setSolicitarOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="solicitar-doc-title"
          >
            <div className="px-5 py-4 border-b border-coop-100">
              <h3 id="solicitar-doc-title" className="text-base font-semibold text-coop-950 font-display">
                Solicitar documento novamente
              </h3>
              <p className="mt-1 text-sm text-coop-700">{label}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block text-sm text-coop-800 font-medium" htmlFor={`msg-${doc.id}`}>
                Mensagem ao profissional (motivo)
              </label>
              <textarea
                id={`msg-${doc.id}`}
                rows={4}
                value={mensagem}
                disabled={busy}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Ex.: o PDF está ilegível / corte a foto / envie a frente e verso…"
                className="w-full rounded-lg border border-coop-200 px-3 py-2 text-sm text-coop-900 focus:outline-none focus:ring-2 focus:ring-coop-400"
              />
              <p className="text-xs text-coop-600">
                Um e-mail será enviado pedindo o reenvio deste anexo, com a mensagem acima.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-coop-100 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                className="text-sm font-semibold px-3 py-1.5 text-coop-700 hover:text-coop-900"
                onClick={() => setSolicitarOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                className="text-sm font-semibold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={() => void enviarSolicitacao()}
              >
                Enviar e-mail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
