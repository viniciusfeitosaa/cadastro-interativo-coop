import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService, DocumentoEnviado } from '../services/admin.service';
import { fixMojibake } from '../utils/validation.util';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

const EnvioDocumentos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [medicoSearch, setMedicoSearch] = useState('');
  const [medicoDropdownOpen, setMedicoDropdownOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterMedicoId, setFilterMedicoId] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: medicosResp } = useQuery({
    queryKey: ['admin', 'medicos', 'all'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 5000, ativo: true }),
    enabled: !!user && isMaster,
  });

  const { data: docsResp, isLoading: loadingDocs } = useQuery({
    queryKey: ['admin', 'documentos-enviados', filterMedicoId],
    queryFn: () => adminService.listDocumentosEnviados(filterMedicoId || undefined),
    enabled: !!user && isMaster,
  });

  const medicos = medicosResp?.data ?? [];
  const documentos: DocumentoEnviado[] = docsResp?.data ?? [];

  const medicosFiltered = medicoSearch.trim()
    ? medicos.filter((m) => {
        const q = medicoSearch.trim().toLowerCase();
        return (
          (m.nomeCompleto ?? '').toLowerCase().includes(q) ||
          (m.crm ?? '').toLowerCase().includes(q) ||
          (m.email ?? '').toLowerCase().includes(q)
        );
      })
    : medicos;

  const selectedMedico = medicoId ? medicos.find((m) => m.id === medicoId) : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) {
      setArquivo(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError(`Arquivo muito grande. Máximo ${formatBytes(MAX_FILE_SIZE)}.`);
      setArquivo(null);
      e.target.value = '';
      return;
    }
    setArquivo(f);
  };

  const handleEnviar = async () => {
    if (!arquivo || !medicoId) {
      setError('Selecione um arquivo e um profissional.');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      await adminService.uploadDocumentoEnviado(arquivo, medicoId, titulo.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'documentos-enviados'] });
      setArquivo(null);
      setTitulo('');
      setMedicoId('');
      setMedicoSearch('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess('Documento enviado com sucesso.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao enviar documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleExcluir = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await adminService.deleteDocumentoEnviado(id);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'documentos-enviados'] });
      setSuccess('Documento removido.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-coop-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-coop-500">
        <h2 className="text-2xl font-bold text-coop-900 mb-1">Envio de Documentos</h2>
        <p className="text-gray-600 mb-6">
          Envie um arquivo e associe a um profissional. O documento ficará disponível na tela inicial do profissional.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Área de upload e associação */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-coop-800 mb-1">Arquivo</label>
              <div
                className="border-2 border-dashed border-coop-200 rounded-xl p-6 text-center hover:border-coop-400 transition cursor-pointer bg-coop-50/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                />
                {arquivo ? (
                  <>
                    <p className="text-coop-900 font-medium">{fixMojibake(arquivo.name)}</p>
                    <p className="text-sm text-coop-600 mt-1">{formatBytes(arquivo.size)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-coop-700">Clique ou arraste um arquivo aqui</p>
                    <p className="text-sm text-coop-600 mt-1">PDF, Word, Excel ou imagem (máx. 15 MB)</p>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-coop-800 mb-1">Título (opcional)</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ex.: Contrato de prestação de serviços"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-coop-800 mb-1">Enviar para o profissional</label>
              <div className="relative">
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Pesquisar por nome, CRM ou e-mail..."
                  value={
                    medicoDropdownOpen ? medicoSearch : selectedMedico ? fixMojibake(selectedMedico.nomeCompleto) : medicoSearch
                  }
                  onChange={(e) => {
                    setMedicoSearch(e.target.value);
                    setMedicoDropdownOpen(true);
                    if (!e.target.value) setMedicoId('');
                  }}
                  onFocus={() => setMedicoDropdownOpen(true)}
                />
                {medicoDropdownOpen && (
                  <ul className="absolute z-10 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-coop-200 bg-white shadow-lg py-1">
                    {medicosFiltered.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-gray-500">Nenhum profissional encontrado</li>
                    ) : (
                      medicosFiltered.map((m) => (
                        <li
                          key={m.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-coop-100 text-coop-900"
                          onClick={() => {
                            setMedicoId(m.id);
                            setMedicoSearch('');
                            setMedicoDropdownOpen(false);
                          }}
                        >
                          {fixMojibake(m.nomeCompleto)} {m.crm ? `(${m.crm})` : ''}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={handleEnviar}
              disabled={!arquivo || !medicoId || uploading}
            >
              {uploading ? 'Enviando...' : 'Enviar documento para o profissional'}
            </button>
          </div>

          {/* Lista de documentos enviados */}
          <div>
            <h3 className="text-lg font-bold text-coop-900 mb-3">Documentos enviados</h3>
            <div className="mb-2">
              <label className="block text-xs text-coop-600 mb-1">Filtrar por profissional</label>
              <select
                className="input w-full max-w-xs"
                value={filterMedicoId}
                onChange={(e) => setFilterMedicoId(e.target.value)}
              >
                <option value="">Todos</option>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {fixMojibake(m.nomeCompleto)}
                  </option>
                ))}
              </select>
            </div>
            {loadingDocs ? (
              <p className="text-coop-600">Carregando...</p>
            ) : documentos.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum documento enviado ainda.</p>
            ) : (
              <div className="border border-coop-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-coop-100 text-coop-800">
                    <tr>
                      <th className="text-left px-3 py-2">Documento</th>
                      <th className="text-left px-3 py-2">Profissional</th>
                      <th className="text-left px-3 py-2">Enviado</th>
                      <th className="text-left px-3 py-2">Ciência / assinatura</th>
                      <th className="w-20 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((doc) => (
                      <tr key={doc.id} className="border-t border-coop-100">
                        <td className="px-3 py-2">
                          <span className="font-medium text-coop-900">
                            {doc.titulo || fixMojibake(doc.nomeArquivo)}
                          </span>
                          {doc.titulo && (
                            <span className="block text-xs text-gray-500">{doc.nomeArquivo}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-coop-800">
                          {doc.medico ? fixMojibake(doc.medico.nomeCompleto) : '-'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{formatDate(doc.createdAt)}</td>
                        <td className="px-3 py-2 text-coop-800">
                          {doc.aceitoEm ? (
                            <span className="text-green-800 font-medium">{formatDate(doc.aceitoEm)}</span>
                          ) : (
                            <span className="text-amber-700">Pendente</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-800 text-xs font-semibold"
                            onClick={() => handleExcluir(doc.id)}
                            disabled={deletingId === doc.id}
                          >
                            {deletingId === doc.id ? 'Removendo...' : 'Remover'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvioDocumentos;
