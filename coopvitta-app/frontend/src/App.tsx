import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

function MasterOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'MASTER') return <Navigate to="/acesso-negado" replace />;
  return <>{children}</>;
}
import { MasterEscopoProvider } from './context/MasterEscopoContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import AppShell from './components/Layout/AppShell';
import Login from './pages/Login';
import CadastroCoop from './pages/CadastroCoop';
import Dashboard from './pages/Dashboard';
import AcceptInvite from './pages/AcceptInvite';
import Medicos from './pages/Medicos';
import FeaturePlaceholder from './pages/FeaturePlaceholder';
import ContratosAtivos from './pages/ContratosAtivos';
const Escalas = lazy(() => import('./pages/Escalas'));
import SubgruposEquipes from './pages/SubgruposEquipes';
import ValoresPlantao from './pages/ValoresPlantao';
import ValoresPonto from './pages/ValoresPonto';
import PontoEletronico from './pages/PontoEletronico';
import HistoricoPontos from './pages/HistoricoPontos';
import MeuCalendarioPlantoes from './pages/MeuCalendarioPlantoes';
import Relatorios from './pages/Relatorios';
import RelatoriosPontoEletronico from './pages/RelatoriosPontoEletronico';
import RelatoriosProcedimentos from './pages/RelatoriosProcedimentos';
import Perfil from './pages/Perfil';
import EnvioDocumentos from './pages/EnvioDocumentos';
import MeusDocumentos from './pages/MeusDocumentos';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import AcessoNegado from './pages/AcessoNegado';
import Vagas from './pages/Vagas';
import Avaliacao from './pages/Avaliacao';
import ModuloEscalaMaster from './pages/ModuloEscalaMaster';

const PageLoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-coop-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coop-600 mx-auto" />
      <p className="mt-4 text-coop-800">Carregando...</p>
    </div>
  </div>
);

// Redireciona para o dashboard se já estiver autenticado (evita ver login/cadastro)
const LoginGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Só redireciona se estiver autenticado (ex.: redefinir-senha vindo do e-mail)
const AuthOnlyRedirect = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) return <PageLoadingScreen />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LoginGuard>
            <Login />
          </LoginGuard>
        }
      />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/cadastro"
        element={
          <LoginGuard>
            <CadastroCoop />
          </LoginGuard>
        }
      />
      <Route path="/ativar-conta/:token" element={<AcceptInvite />} />
      <Route path="/esqueci-senha" element={<LoginGuard><EsqueciSenha /></LoginGuard>} />
      <Route path="/redefinir-senha" element={<AuthOnlyRedirect><RedefinirSenha /></AuthOnlyRedirect>} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/acesso-negado" element={<AcessoNegado />} />
        <Route path="/medicos" element={<Medicos />} />
        <Route
          path="/escalas"
          element={
            <Suspense fallback={<PageLoadingScreen />}>
              <Escalas />
            </Suspense>
          }
        />
        <Route path="/subgrupos-equipes" element={<SubgruposEquipes />} />
        <Route
          path="/ponto-eletronico"
          element={<PontoEletronico />}
        />
        <Route path="/historico-pontos" element={<HistoricoPontos />} />
        <Route path="/meu-calendario-plantoes" element={<MeuCalendarioPlantoes />} />
        <Route
          path="/atendimentos"
          element={
            <FeaturePlaceholder
              title="Atendimentos"
              description="Área dedicada ao acompanhamento de atendimentos e histórico clínico."
            />
          }
        />
        <Route path="/vagas" element={<Vagas />} />
        <Route
          path="/avaliacao"
          element={
            <MasterOnly>
              <Avaliacao />
            </MasterOnly>
          }
        />
        <Route
          path="/modulo-escala-master"
          element={
            <MasterOnly>
              <ModuloEscalaMaster />
            </MasterOnly>
          }
        />
        <Route
          path="/relatorios"
          element={<Relatorios />}
        />
        <Route
          path="/relatorios-ponto-eletronico"
          element={<RelatoriosPontoEletronico />}
        />
        <Route
          path="/relatorios-procedimentos"
          element={<RelatoriosProcedimentos />}
        />
        <Route
          path="/contratos-ativos"
          element={<ContratosAtivos />}
        />
        <Route
          path="/valores-plantao"
          element={<ValoresPlantao />}
        />
        <Route
          path="/valores-ponto"
          element={<ValoresPonto />}
        />
        <Route
          path="/envio-documentos"
          element={<EnvioDocumentos />}
        />
        <Route
          path="/documentos"
          element={<MeusDocumentos />}
        />
        <Route
          path="/perfil"
          element={<Perfil />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <MasterEscopoProvider>
        <NotificationProvider>
          <BrowserRouter
            basename={(import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <div className="app-safe-root min-h-dvh">
              <AppRoutes />
            </div>
          </BrowserRouter>
        </NotificationProvider>
      </MasterEscopoProvider>
    </AuthProvider>
  );
}

export default App;
