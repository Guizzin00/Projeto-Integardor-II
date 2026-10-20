import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Projetos } from './pages/Projetos';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Perfil } from './pages/Perfil';
import { ProjetoDetalhes } from './pages/ProjetoDetalhes';
import { Sobre } from './pages/Sobre';
import { Candidatura } from './pages/Candidatura';
import { Submissao } from './pages/Submissao';
import { Workspace } from './pages/Workspace';
import { RecuperarSenha } from './pages/RecuperarSenha';
import { RedefinirSenha } from './pages/RedefinirSenha';
import { VerificarConta } from './pages/VerificarConta';
import { AdminDashboard } from './pages/AdminDashboard';
import { CoordenadorDashboard } from './pages/CoordenadorDashboard';
import { PerfilEditar } from './pages/PerfilEditar';
import { SubmissaoEditar } from './pages/SubmissaoEditar';
import { CandidaturaEditar } from './pages/CandidaturaEditar';
import { AdminForm } from './pages/AdminForm';
import { AdminUserForm } from './pages/AdminUserForm';
import { AdminLogs } from './pages/AdminLogs';
import { ErrorPage } from './pages/ErrorPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function AppLayout() {
  const location = useLocation();
  // Quando estiver na rota de Workspace, oculta Header e Footer globais para criar a experiência tela-cheia
  const isWorkspace = location.pathname.includes('/workspace');

  return (
    <div className={`bg-bg-primary text-text-primary font-sans flex flex-col ${isWorkspace ? 'h-screen w-full overflow-hidden' : 'min-h-screen'}`}>
      {!isWorkspace && <Header />}
      <main className={`flex-1 flex flex-col min-h-0 min-w-0 ${isWorkspace ? 'overflow-hidden' : ''}`}>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/projeto/:id" element={<ProjetoDetalhes />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
          <Route path="/verificar-conta/:token" element={<VerificarConta />} />

          {/* Rotas Autenticadas (Usuários Logados) */}
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="/perfil/editar" element={<ProtectedRoute><PerfilEditar /></ProtectedRoute>} />
          <Route path="/submissao" element={<ProtectedRoute><Submissao /></ProtectedRoute>} />
          <Route path="/submissao/:id/editar" element={<ProtectedRoute><SubmissaoEditar /></ProtectedRoute>} />
          <Route path="/candidatura/:id/editar" element={<ProtectedRoute><CandidaturaEditar /></ProtectedRoute>} />
          <Route path="/projeto/:id/candidatar" element={<ProtectedRoute><Candidatura /></ProtectedRoute>} />
          <Route path="/workspace/:id" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
          <Route path="/projeto/:id/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />

          {/* Rotas Restritas: Coordenação (Coordenador e Admin) */}
          <Route path="/coordenador" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><CoordenadorDashboard /></ProtectedRoute>} />

          {/* Rotas Restritas: Administração (Somente Admin) */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminLogs /></ProtectedRoute>} />
          <Route path="/admin/projeto/novo" element={<ProtectedRoute allowedRoles={['admin']}><AdminForm /></ProtectedRoute>} />
          <Route path="/admin/projeto/:id/editar" element={<ProtectedRoute allowedRoles={['admin']}><AdminForm /></ProtectedRoute>} />
          <Route path="/projeto/:id/editar" element={<ProtectedRoute><AdminForm /></ProtectedRoute>} />
          <Route path="/admin/usuario/novo" element={<ProtectedRoute allowedRoles={['admin']}><AdminUserForm /></ProtectedRoute>} />
          <Route path="/admin/usuario/:id/editar" element={<ProtectedRoute allowedRoles={['admin']}><AdminUserForm /></ProtectedRoute>} />

          {/* Telas de Erro HTTP */}
          <Route path="/401" element={<ErrorPage code={401} />} />
          <Route path="/403" element={<ErrorPage code={403} />} />
          <Route path="/404" element={<ErrorPage code={404} />} />
          <Route path="/500" element={<ErrorPage code={500} />} />
          <Route path="/erro/:code" element={<ErrorPage />} />
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </main>
      {!isWorkspace && <Footer />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;
