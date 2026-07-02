import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { medicoService, type VagaPublicadaItem } from '../services/medico.service';
import AnunciarVagaWizard from '../components/vagas/AnunciarVagaWizard';
import VagaCardDisponivel from '../components/vagas/VagaCardDisponivel';
import MinhasPublicacoesPanel from '../components/vagas/MinhasPublicacoesPanel';
import CandidatosVagaModal from '../components/vagas/CandidatosVagaModal';

function formatCentavosBRL(centavos: number | null): string {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Vagas = () => {
  const { user } = useAuth();
  const isMedico = user?.role === 'MEDICO';
  const [aba, setAba] = useState<'disponiveis' | 'publicadas' | 'anunciar'>('disponiveis');
  const [modalCandidatos, setModalCandidatos] = useState<{ vagaId: string; titulo: string } | null>(null);

  const { data: modulosResp, isLoading: modulosLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user && isMedico,
  });

  const mapModulos = modulosResp?.data?.map;
  const vagasDesabilitado = modulosResp && mapModulos ? mapModulos.VAGAS === false : false;

  const { data: vagasResp, isLoading: vagasLoading } = useQuery({
    queryKey: ['medico', 'vagas'],
    queryFn: () => medicoService.listVagas(),
    enabled: !!user && isMedico && !modulosLoading && !vagasDesabilitado,
  });

  if (!isMedico) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-coop-700 font-serif">
          A área de vagas é exclusiva para profissionais com perfil médico.
        </p>
      </div>
    );
  }

  if (!modulosLoading && vagasDesabilitado) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-coop-900 mb-2 font-display">Acesso ao módulo</h2>
        <p className="text-sm text-coop-700 font-serif">
          O módulo Vagas não está habilitado para o seu perfil neste tenant. Peça ao administrador para ativar o módulo
          em Configurações ou em Minha Conta.
        </p>
      </div>
    );
  }

  const mensagem = vagasResp?.data?.mensagem;
  const itens: VagaPublicadaItem[] = vagasResp?.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-coop-950 font-display tracking-tight">Vagas</h1>
        <p className="mt-1 text-sm text-coop-700 font-serif max-w-2xl">
          Veja oportunidades, demonstre interesse, gerencie suas publicações e candidatos.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-coop-200/80 bg-coop-50/40 p-1.5">
        <button
          type="button"
          onClick={() => setAba('disponiveis')}
          className={`flex-1 min-w-[120px] rounded-xl px-3 py-2.5 text-sm font-semibold font-display transition ${
            aba === 'disponiveis' ? 'bg-white text-coop-950 shadow-sm ring-1 ring-coop-200' : 'text-coop-700 hover:bg-white/60'
          }`}
        >
          Disponíveis
        </button>
        <button
          type="button"
          onClick={() => setAba('publicadas')}
          className={`flex-1 min-w-[120px] rounded-xl px-3 py-2.5 text-sm font-semibold font-display transition ${
            aba === 'publicadas' ? 'bg-white text-coop-950 shadow-sm ring-1 ring-coop-200' : 'text-coop-700 hover:bg-white/60'
          }`}
        >
          Minhas publicações
        </button>
        <button
          type="button"
          onClick={() => setAba('anunciar')}
          className={`flex-1 min-w-[120px] rounded-xl px-3 py-2.5 text-sm font-semibold font-display transition ${
            aba === 'anunciar' ? 'bg-white text-coop-950 shadow-sm ring-1 ring-coop-200' : 'text-coop-700 hover:bg-white/60'
          }`}
        >
          Anunciar
        </button>
      </div>

      {aba === 'disponiveis' && (
        <div className="card border-l-4 border-coop-600 shadow-sm">
          {modulosLoading || vagasLoading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="h-9 w-9 rounded-xl border-2 border-coop-200 border-t-coop-700 animate-spin" />
              <p className="text-sm text-coop-700 font-serif">Carregando…</p>
            </div>
          ) : (
            <>
              {mensagem && (
                <p className="text-sm text-coop-800 font-serif leading-relaxed mb-4">{mensagem}</p>
              )}
              {itens.length === 0 ? null : (
                <ul className="space-y-4">
                  {itens.map((v) => (
                    <VagaCardDisponivel
                      key={v.id}
                      v={v}
                      formatCentavosBRL={formatCentavosBRL}
                      formatDataHora={formatDataHora}
                      onGerenciarCandidatos={() =>
                        setModalCandidatos({
                          vagaId: v.id,
                          titulo: `${v.tipoAtendimento} — ${v.setor}`,
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {aba === 'publicadas' && (
        <div className="card border-l-4 border-amber-600/90 shadow-sm">
          <h2 className="text-lg font-bold text-coop-950 font-display mb-2">Minhas publicações</h2>
          <p className="text-sm text-coop-700 font-serif mb-4">
            Vagas que você criou, interesses recebidos e opção de aceitar ou recusar candidatos.
          </p>
          <MinhasPublicacoesPanel
            onVerCandidatos={(vagaId, titulo) => setModalCandidatos({ vagaId, titulo })}
          />
        </div>
      )}

      {aba === 'anunciar' && (
        <div className="card border-l-4 border-emerald-700/80 shadow-sm">
          <h2 className="text-lg font-bold text-coop-950 font-display mb-1">Publicar vaga</h2>
          <p className="text-sm text-coop-700 font-serif mb-6">
            Preencha os dados, confirme sua responsabilidade pelo setor e publique.
          </p>
          <AnunciarVagaWizard onPublicado={() => setAba('publicadas')} />
        </div>
      )}

      <CandidatosVagaModal
        open={!!modalCandidatos}
        vagaId={modalCandidatos?.vagaId ?? null}
        titulo={modalCandidatos?.titulo ?? ''}
        onClose={() => setModalCandidatos(null)}
      />
    </div>
  );
};

export default Vagas;
