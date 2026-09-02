import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MODULO_LABEL, type ModuloSistema, type NivelAcessoModulo } from '../constants/modulos';
import { useAuth } from '../context/AuthContext';
import { notify } from '../lib/notificationEmitter';
import {
  adminService,
  type CreatePerfilAcessoPayload,
  type PerfilAcessoItem,
  type UpdateUsuarioStaffPayload,
  type UsuarioStaffItem,
} from '../services/admin.service';
import { authService, isAdminPleno as isAdminPlenoFromPerms } from '../services/auth.service';

type Aba = 'perfis' | 'usuarios';

const MODULOS_GRADE = Object.keys(MODULO_LABEL) as ModuloSistema[];
const NIVEIS: NivelAcessoModulo[] = ['OFF', 'VER', 'EDITAR'];
const NIVEL_LABEL: Record<NivelAcessoModulo, string> = {
  OFF: 'Off',
  VER: 'Ver',
  EDITAR: 'Editar',
};

const emptyGrade = (): Record<ModuloSistema, NivelAcessoModulo> => {
  const g = {} as Record<ModuloSistema, NivelAcessoModulo>;
  for (const m of MODULOS_GRADE) g[m] = m === 'PERFIL' ? 'VER' : 'OFF';
  return g;
};

const gradeFromPerfil = (perfil: PerfilAcessoItem | null): Record<ModuloSistema, NivelAcessoModulo> => {
  const g = emptyGrade();
  for (const row of perfil?.modulos ?? []) {
    if (row.modulo in g) g[row.modulo] = row.nivel;
  }
  if (g.PERFIL === 'OFF') g.PERFIL = 'VER';
  if (g.CONFIGURACOES === 'EDITAR') g.CONFIGURACOES = 'VER';
  return g;
};

const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

const PerfisEquipe = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>('perfis');

  const { data: modulosResp, isLoading: modulosLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });
  const pleno = isAdminPlenoFromPerms(modulosResp?.data);

  const perfisQuery = useQuery({
    queryKey: ['admin', 'perfis-acesso'],
    queryFn: async () => (await adminService.listPerfisAcesso()).data ?? [],
    enabled: pleno,
  });

  const usuariosQuery = useQuery({
    queryKey: ['admin', 'usuarios-staff'],
    queryFn: async () => (await adminService.listUsuariosStaff()).data ?? [],
    enabled: pleno,
  });

  const perfis = perfisQuery.data ?? [];
  const usuarios = usuariosQuery.data ?? [];

  // --- Perfil form ---
  const [perfilModal, setPerfilModal] = useState<'create' | PerfilAcessoItem | null>(null);
  const [perfilNome, setPerfilNome] = useState('');
  const [perfilDescricao, setPerfilDescricao] = useState('');
  const [perfilAtivo, setPerfilAtivo] = useState(true);
  const [perfilGrade, setPerfilGrade] = useState(emptyGrade);

  useEffect(() => {
    if (!perfilModal) return;
    if (perfilModal === 'create') {
      setPerfilNome('');
      setPerfilDescricao('');
      setPerfilAtivo(true);
      setPerfilGrade(emptyGrade());
      return;
    }
    setPerfilNome(perfilModal.nome);
    setPerfilDescricao(perfilModal.descricao ?? '');
    setPerfilAtivo(perfilModal.ativo);
    setPerfilGrade(gradeFromPerfil(perfilModal));
  }, [perfilModal]);

  const savePerfilMutation = useMutation({
    mutationFn: async () => {
      const modulos = MODULOS_GRADE.map((modulo) => ({ modulo, nivel: perfilGrade[modulo] }));
      const payload: CreatePerfilAcessoPayload = {
        nome: perfilNome.trim(),
        descricao: perfilDescricao.trim() || null,
        ativo: perfilAtivo,
        modulos,
      };
      if (perfilModal === 'create') return adminService.createPerfilAcesso(payload);
      if (perfilModal && typeof perfilModal === 'object') {
        return adminService.updatePerfilAcesso(perfilModal.id, payload);
      }
      throw new Error('Formulário de perfil inválido');
    },
    onSuccess: async () => {
      notify({
        kind: 'success',
        title: 'Perfis',
        message: perfilModal === 'create' ? 'Perfil criado.' : 'Perfil atualizado.',
      });
      setPerfilModal(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'perfis-acesso'] });
    },
    onError: (err) => {
      notify({ kind: 'warning', title: 'Perfis', message: apiError(err, 'Não foi possível salvar o perfil.') });
    },
  });

  // --- Usuário form ---
  const [usuarioModal, setUsuarioModal] = useState<'create' | UsuarioStaffItem | null>(null);
  const [uNome, setUNome] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uSenha, setUSenha] = useState('');
  const [uPerfilId, setUPerfilId] = useState('');
  const [uAtivo, setUAtivo] = useState(true);
  const [uPromoverPleno, setUPromoverPleno] = useState(false);

  const perfisAtivos = useMemo(() => perfis.filter((p) => p.ativo), [perfis]);

  useEffect(() => {
    if (!usuarioModal) return;
    if (usuarioModal === 'create') {
      setUNome('');
      setUEmail('');
      setUSenha('');
      setUPerfilId(perfisAtivos[0]?.id ?? '');
      setUAtivo(true);
      setUPromoverPleno(false);
      return;
    }
    setUNome(usuarioModal.nome);
    setUEmail(usuarioModal.email);
    setUSenha('');
    setUPerfilId(usuarioModal.perfilAcessoId ?? '');
    setUAtivo(usuarioModal.ativo);
    setUPromoverPleno(usuarioModal.perfilAcessoId == null);
  }, [usuarioModal, perfisAtivos]);

  const saveUsuarioMutation = useMutation({
    mutationFn: async () => {
      if (usuarioModal === 'create') {
        if (!uPerfilId) throw new Error('Selecione um perfil');
        return adminService.createUsuarioStaff({
          nome: uNome.trim(),
          email: uEmail.trim(),
          senha: uSenha,
          perfilAcessoId: uPerfilId,
          ativo: uAtivo,
        });
      }
      if (usuarioModal && typeof usuarioModal === 'object') {
        const payload: UpdateUsuarioStaffPayload = {
          nome: uNome.trim(),
          ativo: uAtivo,
        };
        if (uSenha.trim()) payload.senha = uSenha.trim();
        if (uPromoverPleno) {
          payload.perfilAcessoId = null;
        } else {
          if (!uPerfilId) throw new Error('Selecione um perfil');
          payload.perfilAcessoId = uPerfilId;
        }
        return adminService.updateUsuarioStaff(usuarioModal.id, payload);
      }
      throw new Error('Formulário de usuário inválido');
    },
    onSuccess: async () => {
      notify({
        kind: 'success',
        title: 'Usuários',
        message: usuarioModal === 'create' ? 'Usuário criado.' : 'Usuário atualizado.',
      });
      setUsuarioModal(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios-staff'] });
    },
    onError: (err) => {
      notify({
        kind: 'warning',
        title: 'Usuários',
        message: apiError(err, err instanceof Error ? err.message : 'Não foi possível salvar o usuário.'),
      });
    },
  });

  if (modulosLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-coop-600" />
      </div>
    );
  }

  if (!pleno) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-coop-700 font-serif">
          Apenas administradores plenos podem gerenciar perfis de acesso e usuários da equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-coop-600 mb-2 font-display">
          Administração
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-coop-900 font-display leading-tight mb-2">
          Perfis e equipe
        </h1>
        <p className="text-coop-700 font-serif text-base">
          Crie perfis com níveis Off/Ver/Editar por módulo e vincule usuários staff.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-coop-200/80 bg-coop-50/40 p-1.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'perfis'}
          onClick={() => setAba('perfis')}
          className={`flex-1 min-w-[120px] rounded-xl px-3 py-2.5 text-sm font-semibold font-display transition ${
            aba === 'perfis'
              ? 'bg-white text-coop-950 shadow-sm ring-1 ring-coop-200'
              : 'text-coop-700 hover:bg-white/60'
          }`}
        >
          Perfis
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'usuarios'}
          onClick={() => setAba('usuarios')}
          className={`flex-1 min-w-[120px] rounded-xl px-3 py-2.5 text-sm font-semibold font-display transition ${
            aba === 'usuarios'
              ? 'bg-white text-coop-950 shadow-sm ring-1 ring-coop-200'
              : 'text-coop-700 hover:bg-white/60'
          }`}
        >
          Usuários
        </button>
      </div>

      {aba === 'perfis' && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={() => setPerfilModal('create')}>
              Novo perfil
            </button>
          </div>
          {perfisQuery.isLoading ? (
            <p className="text-sm text-coop-600">Carregando perfis…</p>
          ) : perfis.length === 0 ? (
            <div className="card text-sm text-coop-700 font-serif">Nenhum perfil cadastrado ainda.</div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-coop-100 text-left text-xs uppercase tracking-wide text-coop-600">
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Usuários</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {perfis.map((p) => (
                    <tr key={p.id} className="border-b border-coop-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-coop-900">{p.nome}</div>
                        {p.descricao ? (
                          <div className="text-xs text-coop-600 mt-0.5 line-clamp-1">{p.descricao}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{p._count?.usuarios ?? 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn btn-secondary text-xs px-3 py-1.5"
                          onClick={() => setPerfilModal(p)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {aba === 'usuarios' && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setUsuarioModal('create')}
              disabled={perfisAtivos.length === 0}
              title={perfisAtivos.length === 0 ? 'Crie um perfil ativo antes' : undefined}
            >
              Novo usuário
            </button>
          </div>
          {usuariosQuery.isLoading ? (
            <p className="text-sm text-coop-600">Carregando usuários…</p>
          ) : usuarios.length === 0 ? (
            <div className="card text-sm text-coop-700 font-serif">Nenhum usuário master neste tenant.</div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-coop-100 text-left text-xs uppercase tracking-wide text-coop-600">
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Perfil</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-coop-50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-coop-900">{u.nome}</td>
                      <td className="px-4 py-3 text-coop-700">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.perfilAcessoId == null ? (
                          <span className="inline-flex rounded-full bg-coop-100 text-coop-900 px-2 py-0.5 text-xs font-semibold">
                            Administrador
                          </span>
                        ) : (
                          <span className="text-coop-800">{u.perfilAcesso?.nome ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn btn-secondary text-xs px-3 py-1.5"
                          onClick={() => setUsuarioModal(u)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {perfilModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perfil-modal-title"
          onClick={() => setPerfilModal(null)}
        >
          <div
            className="card w-full max-w-2xl my-4 sm:my-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="perfil-modal-title" className="text-base font-bold text-coop-900 font-display">
              {perfilModal === 'create' ? 'Novo perfil' : 'Editar perfil'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-coop-800 mb-1">Nome</label>
                <input
                  className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm"
                  value={perfilNome}
                  onChange={(e) => setPerfilNome(e.target.value)}
                  required
                  maxLength={120}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-coop-800 mb-1">Descrição</label>
                <textarea
                  className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm min-h-[72px]"
                  value={perfilDescricao}
                  onChange={(e) => setPerfilDescricao(e.target.value)}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-coop-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={perfilAtivo}
                  onChange={(e) => setPerfilAtivo(e.target.checked)}
                />
                Perfil ativo
              </label>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-coop-600 mb-2">
                Nível por módulo
              </p>
              <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-coop-100 divide-y divide-coop-50">
                {MODULOS_GRADE.map((modulo) => {
                  const niveis =
                    modulo === 'CONFIGURACOES'
                      ? (['OFF', 'VER'] as NivelAcessoModulo[])
                      : modulo === 'PERFIL'
                        ? (['VER', 'EDITAR'] as NivelAcessoModulo[])
                        : NIVEIS;
                  return (
                    <div
                      key={modulo}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="text-sm text-coop-900">{MODULO_LABEL[modulo]}</span>
                      <select
                        className="rounded-lg border border-coop-200 bg-white px-2 py-1.5 text-sm"
                        value={perfilGrade[modulo]}
                        onChange={(e) =>
                          setPerfilGrade((prev) => ({
                            ...prev,
                            [modulo]: e.target.value as NivelAcessoModulo,
                          }))
                        }
                      >
                        {niveis.map((n) => (
                          <option key={n} value={n}>
                            {NIVEL_LABEL[n]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setPerfilModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savePerfilMutation.isPending || !perfilNome.trim()}
                onClick={() => savePerfilMutation.mutate()}
              >
                {savePerfilMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {usuarioModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="usuario-modal-title"
          onClick={() => setUsuarioModal(null)}
        >
          <div
            className="card w-full max-w-lg my-4 sm:my-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="usuario-modal-title" className="text-base font-bold text-coop-900 font-display">
              {usuarioModal === 'create' ? 'Novo usuário' : 'Editar usuário'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-coop-800 mb-1">Nome</label>
                <input
                  className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm"
                  value={uNome}
                  onChange={(e) => setUNome(e.target.value)}
                  required
                />
              </div>
              {usuarioModal === 'create' ? (
                <div>
                  <label className="block text-xs font-semibold text-coop-800 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm"
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-coop-800 mb-1">E-mail</label>
                  <input
                    className="w-full rounded-xl border border-coop-200 bg-coop-50 px-3 py-2 text-sm text-coop-700"
                    value={uEmail}
                    disabled
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-coop-800 mb-1">
                  {usuarioModal === 'create' ? 'Senha inicial' : 'Nova senha (opcional)'}
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm"
                  value={uSenha}
                  onChange={(e) => setUSenha(e.target.value)}
                  required={usuarioModal === 'create'}
                  autoComplete="new-password"
                />
              </div>
              {usuarioModal !== 'create' && (
                <label className="inline-flex items-center gap-2 text-sm text-coop-800">
                  <input
                    type="checkbox"
                    checked={uPromoverPleno}
                    onChange={(e) => setUPromoverPleno(e.target.checked)}
                  />
                  Administrador pleno (sem perfil restrito)
                </label>
              )}
              {!uPromoverPleno && (
                <div>
                  <label className="block text-xs font-semibold text-coop-800 mb-1">Perfil</label>
                  <select
                    className="w-full rounded-xl border border-coop-200 bg-white px-3 py-2 text-sm"
                    value={uPerfilId}
                    onChange={(e) => setUPerfilId(e.target.value)}
                    required
                  >
                    <option value="">Selecione…</option>
                    {perfis
                      .filter((p) => p.ativo || p.id === uPerfilId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                          {!p.ativo ? ' (inativo)' : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-sm text-coop-800">
                <input type="checkbox" checked={uAtivo} onChange={(e) => setUAtivo(e.target.checked)} />
                Usuário ativo
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setUsuarioModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  saveUsuarioMutation.isPending ||
                  !uNome.trim() ||
                  (usuarioModal === 'create' && (!uEmail.trim() || !uSenha))
                }
                onClick={() => saveUsuarioMutation.mutate()}
              >
                {saveUsuarioMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerfisEquipe;
