import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { adminService } from '../../services/admin.service';
import { parseImportPaste, type ImportPreviewRow } from './importCadastroLote';

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: (summary: { criados: number; falhas: number }) => void;
};

export default function ImportCadastroLoteModal({ open, onClose, onDone }: Props) {
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState<{
    rows: ImportPreviewRow[];
    parseError?: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    criados: number;
    falhas: number;
    resultados: Array<{ index: number; ok: boolean; nomeCompleto?: string; error?: string; cpf?: string }>;
  } | null>(null);

  const preview = useMemo(() => {
    if (!parsed) return null;
    const valid = parsed.rows.filter((r) => r.payload && r.errors.length === 0);
    const invalid = parsed.rows.filter((r) => r.errors.length > 0);
    return { valid, invalid, total: parsed.rows.length };
  }, [parsed]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const rows = (parsed?.rows || [])
        .map((r) => r.payload)
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (!rows.length) throw new Error('Nenhuma linha válida para importar');
      return adminService.importCadastrosPendentesLote(rows);
    },
    onSuccess: (resp) => {
      const data = resp.data;
      setImportResult({
        criados: data.criados,
        falhas: data.falhas,
        resultados: data.resultados,
      });
      onDone({ criados: data.criados, falhas: data.falhas });
    },
  });

  if (!open) return null;

  const handleParse = () => {
    setImportResult(null);
    const result = parseImportPaste(paste);
    setParsed({ rows: result.rows, parseError: result.parseError });
  };

  const handleClose = () => {
    setPaste('');
    setParsed(null);
    setImportResult(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="import-lote-titulo"
      >
        <h2 id="import-lote-titulo" className="text-lg font-bold text-coop-900 font-display mb-1">
          Importar lista de cadastros
        </h2>
        <p className="text-sm text-coop-700 font-serif mb-4">
          Cole a tabela completa (cabeçalho + linhas) copiada do Excel ou do formulário. Cada linha válida entra como{' '}
          <strong>pendente de análise</strong>, sem documentos anexos. Confirme antes de gravar.
        </p>

        <label className="block text-xs font-semibold text-coop-800 mb-1" htmlFor="import-paste">
          Lista colada
        </label>
        <textarea
          id="import-paste"
          className="input w-full min-h-[140px] text-xs font-mono"
          placeholder="Cole aqui (inclua a linha de cabeçalho: Nome Completo do Proponente, E-mail, CPF, …)"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          disabled={importMutation.isPending}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={handleParse} disabled={!paste.trim()}>
            Identificar linhas
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={handleClose}>
            Fechar
          </button>
        </div>

        {parsed?.parseError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {parsed.parseError}
          </div>
        )}

        {preview && !parsed?.parseError && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-coop-800">
              <strong>{preview.total}</strong> linha(s) · <strong className="text-green-800">{preview.valid.length}</strong>{' '}
              pronta(s) · <strong className="text-red-800">{preview.invalid.length}</strong> com erro de validação
            </p>

            {preview.valid.length > 0 && (
              <div className="overflow-x-auto border border-coop-100 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-coop-50 text-left">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Nome</th>
                      <th className="px-2 py-1.5">E-mail</th>
                      <th className="px-2 py-1.5">CPF</th>
                      <th className="px-2 py-1.5">Profissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.map((r) => (
                      <tr key={r.index} className="border-t border-coop-50">
                        <td className="px-2 py-1.5">{r.index}</td>
                        <td className="px-2 py-1.5 font-medium">{r.payload?.nomeCompleto}</td>
                        <td className="px-2 py-1.5">{r.payload?.email}</td>
                        <td className="px-2 py-1.5 font-mono">{r.payload?.cpf}</td>
                        <td className="px-2 py-1.5">{r.payload?.profissao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.invalid.length > 0 && (
              <ul className="text-xs text-red-800 space-y-1 max-h-32 overflow-y-auto">
                {preview.invalid.map((r) => (
                  <li key={r.index}>
                    Linha {r.index}
                    {r.raw.nomeCompleto ? ` (${r.raw.nomeCompleto})` : ''}: {r.errors.join('; ')}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="btn-primary text-sm"
              disabled={preview.valid.length === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending
                ? 'Importando…'
                : `Confirmar e criar ${preview.valid.length} pendente(s)`}
            </button>

            {importMutation.isError && (
              <p className="text-sm text-red-700">
                {(importMutation.error as { response?: { data?: { error?: string } }; message?: string })?.response
                  ?.data?.error ||
                  (importMutation.error as Error)?.message ||
                  'Falha na importação'}
              </p>
            )}
          </div>
        )}

        {importResult && (
          <div className="mt-4 rounded-lg border border-coop-200 bg-coop-50 px-3 py-3 text-sm">
            <p className="font-semibold text-coop-900 mb-2">
              Resultado: {importResult.criados} criado(s), {importResult.falhas} falha(s)
            </p>
            <ul className="max-h-40 overflow-y-auto text-xs space-y-1">
              {importResult.resultados.map((r) => (
                <li key={r.index} className={r.ok ? 'text-green-800' : 'text-red-800'}>
                  {r.ok ? '✓' : '✗'} Linha {r.index}
                  {r.nomeCompleto ? ` — ${r.nomeCompleto}` : ''}
                  {r.ok ? ' importado' : `: ${r.error || 'erro'}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
