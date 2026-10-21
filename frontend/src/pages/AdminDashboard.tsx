import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AprovacoesContasTab } from '../components/AprovacoesContasTab';
import { SubmissaoDetalhesModal, SubmissaoDetalhes } from '../components/SubmissaoDetalhesModal';
import { useUI } from '../components/UIProvider';

export function AdminDashboard() {
  const { avisar, confirmar } = useUI();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'tab-projetos' | 'tab-submissoes' | 'tab-candidaturas' | 'tab-usuarios' | 'tab-aprovacoes'>('tab-projetos');
  const [pendentesCount, setPendentesCount] = useState<number>(0);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [submissoes, setSubmissoes] = useState<any[]>([]);
  const [candidaturas, setCandidaturas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [stats, setStats] = useState<{ status: Record<string, number>; categoria: Record<string, number> }>({ status: {}, categoria: {} });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtros de busca por aba
  const [searchProj, setSearchProj] = useState('');
  const [statusProj, setStatusProj] = useState('TODOS');

  const [searchSubm, setSearchSubm] = useState('');
  const [submissaoAberta, setSubmissaoAberta] = useState<SubmissaoDetalhes | null>(null);
  const [statusSubm, setStatusSubm] = useState('TODOS');

  const [searchCand, setSearchCand] = useState('');
  const [statusCand, setStatusCand] = useState('TODOS');

  const [searchUser, setSearchUser] = useState('');
  const [roleUser, setRoleUser] = useState('TODOS');

  // Menu de exportação
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [dashRes, statsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/stats').catch(() => ({ data: { status: {}, categoria: {} } }))
      ]);

      if (dashRes.data.status === 'success' && dashRes.data.data) {
        setProjetos(dashRes.data.data.projetos || []);
        setSubmissoes(dashRes.data.data.submissoes || []);
        setCandidaturas(dashRes.data.data.candidaturas || []);
        setUsuarios(dashRes.data.data.usuarios || []);
        if (dashRes.data.data.aprovacoes_pendentes_count !== undefined) {
          setPendentesCount(dashRes.data.data.aprovacoes_pendentes_count);
        }
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do painel admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Excluir projeto
  const handleExcluirProjeto = async (id: number) => {
    if (!await confirmar('Atenção: Deseja realmente excluir este projeto e todo o seu histórico permanentemente?')) return;
    try {
      setActionLoading(`proj-${id}`);
      await api.post(`/admin/projeto/${id}/excluir`);
      setProjetos(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao excluir projeto.');
    } finally {
      setActionLoading(null);
    }
  };

  // Ação em Submissão (aprovar / rejeitar)
  const handleAcaoSubmissao = async (id: number, acao: 'aprovar' | 'rejeitar') => {
    try {
      setActionLoading(`sub-${id}`);
      const res = await api.post(`/admin/submissao/${id}/${acao}`);
      if (res.data.status === 'success') {
        setSubmissoes(prev => prev.map(s => s.id === id ? { ...s, status: res.data.new_status } : s));
        if (acao === 'aprovar') {
          const dashRes = await api.get('/admin/dashboard');
          if (dashRes.data.data?.projetos) {
            setProjetos(dashRes.data.data.projetos);
          }
        }
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || `Erro ao ${acao} submissão.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Ação em Candidatura (aprovar / rejeitar)
  const handleAcaoCandidatura = async (id: number, acao: 'aprovar' | 'rejeitar') => {
    try {
      setActionLoading(`cand-${id}`);
      const res = await api.post(`/admin/candidatura/${id}/${acao}`);
      if (res.data.status === 'success') {
        setCandidaturas(prev => prev.map(c => c.id === id ? { ...c, status: res.data.new_status } : c));
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || `Erro ao ${acao} candidatura.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Excluir usuário
  const handleExcluirUsuario = async (id: number) => {
    if (!await confirmar('Tem certeza de que deseja remover esta conta de usuário do sistema?')) return;
    try {
      setActionLoading(`user-${id}`);
      await api.delete(`/admin/usuario/${id}`);
      setUsuarios(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao excluir usuário.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = (endpoint: string) => {
    const baseURL = (api.defaults.baseURL || '').replace(/\/api$/, '');
    window.open(`${baseURL}${endpoint}`, '_blank');
    setExportMenuOpen(false);
  };

  // Dados filtrados
  const projetosFiltrados = useMemo(() => {
    return projetos.filter(p => {
      const matchQuery = !searchProj.trim() || 
        p.titulo?.toLowerCase().includes(searchProj.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(searchProj.toLowerCase()) ||
        String(p.id).includes(searchProj);
      const matchStatus = statusProj === 'TODOS' || p.status?.toUpperCase() === statusProj.toUpperCase();
      return matchQuery && matchStatus;
    });
  }, [projetos, searchProj, statusProj]);

  const submissoesFiltradas = useMemo(() => {
    return submissoes.filter(s => {
      const matchQuery = !searchSubm.trim() ||
        s.nome_projeto?.toLowerCase().includes(searchSubm.toLowerCase()) ||
        s.proponente?.toLowerCase().includes(searchSubm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchSubm.toLowerCase()) ||
        String(s.id).includes(searchSubm);
      const matchStatus = statusSubm === 'TODOS' || s.status?.toUpperCase() === statusSubm.toUpperCase();
      return matchQuery && matchStatus;
    });
  }, [submissoes, searchSubm, statusSubm]);

  const candidaturasFiltradas = useMemo(() => {
    return candidaturas.filter(c => {
      const projNome = c.projeto?.titulo || c.projeto || '';
      const matchQuery = !searchCand.trim() ||
        projNome.toLowerCase().includes(searchCand.toLowerCase()) ||
        c.username?.toLowerCase().includes(searchCand.toLowerCase()) ||
        c.motivo?.toLowerCase().includes(searchCand.toLowerCase());
      const matchStatus = statusCand === 'TODOS' || c.status?.toUpperCase() === statusCand.toUpperCase();
      return matchQuery && matchStatus;
    });
  }, [candidaturas, searchCand, statusCand]);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchQuery = !searchUser.trim() ||
        u.username?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
        String(u.id).includes(searchUser);
      const matchRole = roleUser === 'TODOS' || u.role?.toLowerCase() === roleUser.toLowerCase();
      return matchQuery && matchRole;
    });
  }, [usuarios, searchUser, roleUser]);

  // Contagens para badges
  const submissoesPendentes = useMemo(() => submissoes.filter(s => s.status === 'EM ANÁLISE').length, [submissoes]);
  const candidaturasPendentes = useMemo(() => candidaturas.filter(c => c.status === 'PENDENTE').length, [candidaturas]);

  const categoryEntries = Object.entries(stats.categoria || {});
  const statusEntries = Object.entries(stats.status || {});

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-11 w-11 border-2 border-purple-primary border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm font-medium text-text-secondary">Carregando indicadores administrativos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[92%] max-w-[1280px] mx-auto py-8">
      
      {/* CABEÇALHO INSTITUCIONAL */}
      <div className="bg-bg-surface border border-border-color rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-primary/10 text-purple-primary border border-purple-primary/20">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Painel Executivo de Administração Geral</span>
            </div>
            <h1 className="font-title text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Governança e Ecossistema SisCPTI
            </h1>
            <p className="text-sm text-text-secondary">
              Gestão central de projetos institucionais, submissões, alocações e controle de acessos.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Botão de Logs */}
            <Link 
              to="/admin/logs"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border-color bg-bg-surface text-text-primary hover:bg-bg-primary text-xs font-semibold shadow-sm transition-all"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span>Auditoria e Logs</span>
            </Link>

            {/* Menu Suspenso de Exportação */}
            <div className="relative" ref={exportRef}>
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-primary text-white hover:bg-purple-hover text-xs font-semibold shadow-sm transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Exportar Dados</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-bg-surface border border-border-color shadow-lg py-1.5 z-20">
                  <div className="px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-text-secondary border-b border-border-color">
                    Relatórios Disponíveis
                  </div>
                  <button 
                    onClick={() => handleDownload('/admin/relatorio/pdf')}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-bg-primary flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Relatório Executivo Geral (PDF)</span>
                  </button>
                  <button 
                    onClick={() => handleDownload('/api/admin/exportar/projetos')}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-bg-primary flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-purple-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Projetos Cadastrados (CSV)</span>
                  </button>
                  <button 
                    onClick={() => handleDownload('/api/admin/exportar/submissoes')}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-bg-primary flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Propostas de Projetos (CSV)</span>
                  </button>
                  <button 
                    onClick={() => handleDownload('/api/admin/exportar/candidaturas')}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-bg-primary flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Candidaturas Acadêmicas (CSV)</span>
                  </button>
                  <button 
                    onClick={() => handleDownload('/api/admin/exportar/usuarios')}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-bg-primary flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-purple-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Contas de Usuários (CSV)</span>
                  </button>
                  <button 
                    onClick={() => handleDownload('/api/admin/exportar/satisfacao')}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-bg-primary flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span>Avaliações de Satisfação (CSV)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARDS DE KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Projetos */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Projetos Totais</span>
            <div className="w-8 h-8 rounded-lg bg-purple-primary/10 text-purple-primary flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold font-title text-text-primary tracking-tight">
            {projetos.length}
          </div>
          <p className="text-xs text-text-secondary mt-1">Registrados na base institucional</p>
        </div>

        {/* Card 2: Propostas Pendentes */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Propostas Pendentes</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${submissoesPendentes > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-bg-primary text-text-secondary'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold font-title text-text-primary tracking-tight">
            {submissoesPendentes}
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {submissoesPendentes === 0 ? 'Nenhuma proposta aguardando parecer' : 'Aguardando avaliação da diretoria'}
          </p>
        </div>

        {/* Card 3: Candidaturas */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Candidaturas</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold font-title text-text-primary tracking-tight">
            {candidaturas.length}
          </div>
          <p className="text-xs text-text-secondary mt-1">{candidaturasPendentes} ainda em análise</p>
        </div>

        {/* Card 4: Usuários */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Contas Ativas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold font-title text-text-primary tracking-tight">
            {usuarios.length}
          </div>
          <p className="text-xs text-text-secondary mt-1">Discentes, orientadores e gestores</p>
        </div>
      </div>

      {/* DISTRIBUIÇÃO & ESTATÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Categorias */}
        <div className="bg-bg-surface border border-border-color p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-title text-sm font-bold text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Projetos por Categoria Acadêmica</span>
            </h3>
            <span className="text-xs text-text-secondary">{categoryEntries.length} áreas ativas</span>
          </div>

          <div className="space-y-3.5">
            {categoryEntries.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-4 text-center">Nenhum dado de categoria disponível.</p>
            ) : (
              categoryEntries.map(([cat, count]) => {
                const total = projetos.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-text-primary">
                      <span>{cat}</span>
                      <span className="text-text-secondary">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-bg-primary h-2 rounded-full overflow-hidden border border-border-color">
                      <div 
                        className="bg-purple-primary h-full rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Status */}
        <div className="bg-bg-surface border border-border-color p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-title text-sm font-bold text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Situação Operacional dos Projetos</span>
            </h3>
            <span className="text-xs text-text-secondary">{statusEntries.length} status registrados</span>
          </div>

          <div className="space-y-3.5">
            {statusEntries.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-4 text-center">Nenhum dado de status disponível.</p>
            ) : (
              statusEntries.map(([status, count]) => {
                const total = projetos.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-text-primary">
                      <span>{status}</span>
                      <span className="text-text-secondary">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-bg-primary h-2 rounded-full overflow-hidden border border-border-color">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO EM ABAS (SEGMENTED CONTROL) */}
      <div className="bg-bg-surface p-1.5 rounded-2xl border border-border-color mb-6 flex flex-wrap gap-1 shadow-sm">
        <button 
          onClick={() => setActiveTab('tab-projetos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tab-projetos' 
              ? 'bg-purple-primary text-white shadow-sm' 
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          }`}
        >
          <span>Projetos Cadastrados</span>
          <span className={`px-2 py-0.5 rounded-full text-[0.7rem] ${
            activeTab === 'tab-projetos' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'
          }`}>
            {projetos.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('tab-submissoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tab-submissoes' 
              ? 'bg-purple-primary text-white shadow-sm' 
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          }`}
        >
          <span>Propostas Submetidas</span>
          <span className={`px-2 py-0.5 rounded-full text-[0.7rem] ${
            activeTab === 'tab-submissoes' ? 'bg-white/20 text-white' : submissoesPendentes > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold' : 'bg-bg-primary text-text-secondary'
          }`}>
            {submissoes.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('tab-candidaturas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tab-candidaturas' 
              ? 'bg-purple-primary text-white shadow-sm' 
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          }`}
        >
          <span>Candidaturas</span>
          <span className={`px-2 py-0.5 rounded-full text-[0.7rem] ${
            activeTab === 'tab-candidaturas' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'
          }`}>
            {candidaturas.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('tab-usuarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tab-usuarios' 
              ? 'bg-purple-primary text-white shadow-sm' 
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          }`}
        >
          <span>Usuários e Permissões</span>
          <span className={`px-2 py-0.5 rounded-full text-[0.7rem] ${
            activeTab === 'tab-usuarios' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'
          }`}>
            {usuarios.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('tab-aprovacoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tab-aprovacoes' 
              ? 'bg-purple-primary text-white shadow-sm' 
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
          }`}
        >
          <span>Aprovações de Contas</span>
          <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${
            pendentesCount > 0 
              ? 'bg-amber-500 text-white animate-pulse' 
              : activeTab === 'tab-aprovacoes' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'
          }`}>
            {pendentesCount}
          </span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ABA 1: PROJETOS */}
      {activeTab === 'tab-projetos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 items-center gap-2.5">
              <div className="relative flex-1 max-w-md">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder="Pesquisar por título, categoria ou ID..."
                  value={searchProj}
                  onChange={(e) => setSearchProj(e.target.value)}
                  className="w-full bg-bg-primary border border-border-color rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
                />
              </div>

              <select
                value={statusProj}
                onChange={(e) => setStatusProj(e.target.value)}
                className="bg-bg-primary border border-border-color rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="INSCRICOES_ABERTAS">Inscrições Abertas</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            <button 
              onClick={() => navigate('/admin/projeto/novo')}
              className="inline-flex items-center justify-center gap-2 bg-purple-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-purple-hover transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Novo Projeto</span>
            </button>
          </div>

          <div className="bg-bg-surface rounded-2xl overflow-hidden shadow-sm border border-border-color">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                    <th className="p-4">Identificador</th>
                    <th className="p-4">Título do Projeto</th>
                    <th className="p-4">Área / Categoria</th>
                    <th className="p-4">Situação</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {projetosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-12 text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="font-medium text-xs">Nenhum projeto encontrado com os filtros atuais.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    projetosFiltrados.map(p => {
                      const isAtivo = p.status === 'INSCRICOES_ABERTAS' || p.status === 'EM_ANDAMENTO';
                      const badgeStyle = isAtivo 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                        : p.status === 'CONCLUIDO'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-bg-primary text-text-secondary border border-border-color';

                      return (
                        <tr key={p.id} className="hover:bg-bg-primary/50 transition-colors">
                          <td className="p-4 font-mono text-xs text-text-secondary font-semibold">#{p.id}</td>
                          <td className="p-4">
                            <Link to={`/projeto/${p.id}`} className="font-semibold text-text-primary hover:text-purple-primary transition-colors block text-sm">
                              {p.titulo}
                            </Link>
                            <span className="text-[0.7rem] text-text-secondary">Responsável: {p.owner_username || 'Sistema'}</span>
                          </td>
                          <td className="p-4">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-bg-primary text-text-secondary border border-border-color">
                              {p.categoria || 'Não definida'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${badgeStyle}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link 
                                to={`/admin/projeto/${p.id}/editar`}
                                className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-surface hover:bg-bg-primary text-text-primary text-xs font-semibold transition-colors"
                              >
                                Editar
                              </Link>
                              <button 
                                disabled={actionLoading === `proj-${p.id}`}
                                onClick={() => handleExcluirProjeto(p.id)}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-bg-primary border-t border-border-color text-right text-xs text-text-secondary">
              Exibindo {projetosFiltrados.length} de {projetos.length} projetos
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: SUBMISSÕES / PROPOSTAS */}
      {activeTab === 'tab-submissoes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 items-center gap-2.5">
              <div className="relative flex-1 max-w-md">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder="Pesquisar por projeto, proponente ou e-mail..."
                  value={searchSubm}
                  onChange={(e) => setSearchSubm(e.target.value)}
                  className="w-full bg-bg-primary border border-border-color rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
                />
              </div>

              <select
                value={statusSubm}
                onChange={(e) => setStatusSubm(e.target.value)}
                className="bg-bg-primary border border-border-color rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="EM ANÁLISE">Em Análise</option>
                <option value="APROVADA">Aprovadas</option>
                <option value="REJEITADA">Rejeitadas</option>
              </select>
            </div>
          </div>

          <div className="bg-bg-surface rounded-2xl overflow-hidden shadow-sm border border-border-color">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                    <th className="p-4">ID</th>
                    <th className="p-4">Proposta</th>
                    <th className="p-4">Proponente Responsável</th>
                    <th className="p-4">Situação</th>
                    <th className="p-4 text-right">Julgamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {submissoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-12 text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="font-medium text-xs">Nenhuma proposta encontrada com os critérios informados.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    submissoesFiltradas.map(s => {
                      const badgeClass = s.status === 'APROVADA'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : s.status === 'REJEITADA'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';

                      return (
                        <tr key={s.id} className="hover:bg-bg-primary/50 transition-colors">
                          <td className="p-4 font-mono text-xs text-text-secondary font-semibold">#{s.id}</td>
                          <td className="p-4">
                            <span className="font-bold text-sm text-text-primary block">{s.nome_projeto}</span>
                            <span className="text-[0.7rem] text-text-secondary">{s.categoria}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold block text-text-primary">{s.proponente}</span>
                            <span className="text-[0.7rem] text-text-secondary">{s.email || 'E-mail não informado'}</span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${badgeClass}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSubmissaoAberta(s)}
                              className="px-3 py-1.5 rounded-lg bg-purple-primary/10 hover:bg-purple-primary/20 text-purple-primary border border-purple-primary/30 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Ver detalhes
                            </button>
                            {s.status === 'EM ANÁLISE' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  disabled={actionLoading === `sub-${s.id}`}
                                  onClick={() => handleAcaoSubmissao(s.id, 'aprovar')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                                >
                                  Aprovar
                                </button>
                                <button 
                                  disabled={actionLoading === `sub-${s.id}`}
                                  onClick={() => handleAcaoSubmissao(s.id, 'rejeitar')}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  Rejeitar
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-text-secondary font-medium italic">Parecer Emitido</span>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-bg-primary border-t border-border-color text-right text-xs text-text-secondary">
              Exibindo {submissoesFiltradas.length} de {submissoes.length} propostas
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CANDIDATURAS */}
      {activeTab === 'tab-candidaturas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 items-center gap-2.5">
              <div className="relative flex-1 max-w-md">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder="Pesquisar por projeto ou aluno..."
                  value={searchCand}
                  onChange={(e) => setSearchCand(e.target.value)}
                  className="w-full bg-bg-primary border border-border-color rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
                />
              </div>

              <select
                value={statusCand}
                onChange={(e) => setStatusCand(e.target.value)}
                className="bg-bg-primary border border-border-color rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="APROVADA">Aprovadas</option>
                <option value="REJEITADA">Rejeitadas</option>
              </select>
            </div>
          </div>

          <div className="bg-bg-surface rounded-2xl overflow-hidden shadow-sm border border-border-color">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                    <th className="p-4">ID</th>
                    <th className="p-4">Projeto Requisitado</th>
                    <th className="p-4">Aluno Candidato</th>
                    <th className="p-4">Justificativa & Experiência</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {candidaturasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="font-medium text-xs">Nenhuma candidatura encontrada.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    candidaturasFiltradas.map(c => {
                      const badgeClass = c.status === 'APROVADA'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : c.status === 'REJEITADA'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';

                      return (
                        <tr key={c.id} className="hover:bg-bg-primary/50 transition-colors">
                          <td className="p-4 font-mono text-xs text-text-secondary font-semibold">#{c.id}</td>
                          <td className="p-4 font-bold text-text-primary text-sm">
                            {c.projeto?.titulo || c.projeto || '—'}
                          </td>
                          <td className="p-4 font-semibold text-purple-primary">
                            {c.username}
                          </td>
                          <td className="p-4 text-xs max-w-[280px]">
                            <p className="text-text-primary line-clamp-2 m-0">{c.motivo}</p>
                            {c.experiencia && (
                              <span className="text-[0.7rem] text-text-secondary block mt-1">Exp: {c.experiencia}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${badgeClass}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {c.status === 'PENDENTE' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  disabled={actionLoading === `cand-${c.id}`}
                                  onClick={() => handleAcaoCandidatura(c.id, 'aprovar')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                                >
                                  Aprovar
                                </button>
                                <button 
                                  disabled={actionLoading === `cand-${c.id}`}
                                  onClick={() => handleAcaoCandidatura(c.id, 'rejeitar')}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  Rejeitar
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-text-secondary font-medium italic">Finalizado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-bg-primary border-t border-border-color text-right text-xs text-text-secondary">
              Exibindo {candidaturasFiltradas.length} de {candidaturas.length} candidaturas
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: USUÁRIOS */}
      {activeTab === 'tab-usuarios' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 items-center gap-2.5">
              <div className="relative flex-1 max-w-md">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder="Pesquisar por nome de usuário ou e-mail..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-bg-primary border border-border-color rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
                />
              </div>

              <select
                value={roleUser}
                onChange={(e) => setRoleUser(e.target.value)}
                className="bg-bg-primary border border-border-color rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
              >
                <option value="TODOS">Todos os Papéis</option>
                <option value="admin">Administrador</option>
                <option value="coordenador">Coordenador</option>
                <option value="professor">Professor / Orientador</option>
                <option value="empresa">Empresa Parceira</option>
                <option value="cliente">Cliente / PO Externo</option>
                <option value="aluno">Aluno / Membro</option>
                <option value="lider">Líder de Equipe</option>
              </select>
            </div>

            <button 
              onClick={() => navigate('/admin/usuario/novo')}
              className="inline-flex items-center justify-center gap-2 bg-purple-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-purple-hover transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Novo Usuário</span>
            </button>
          </div>

          <div className="bg-bg-surface rounded-2xl overflow-hidden shadow-sm border border-border-color">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                    <th className="p-4">ID</th>
                    <th className="p-4">Nome de Usuário</th>
                    <th className="p-4">Papel Institucional</th>
                    <th className="p-4">E-mail</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-12 text-text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <p className="font-medium text-xs">Nenhum usuário localizado.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map(u => {
                      const isCurrentUser = u.username === user?.username;
                      const roleBadgeClass = u.role === 'admin'
                        ? 'bg-purple-primary/10 text-purple-primary border border-purple-primary/20'
                        : u.role === 'coordenador'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : u.role === 'professor'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : (u.role === 'empresa' || u.role === 'cliente')
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                        : u.role === 'lider'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        : 'bg-bg-primary text-text-secondary border border-border-color';

                      return (
                        <tr key={u.id} className="hover:bg-bg-primary/50 transition-colors">
                          <td className="p-4 font-mono text-xs text-text-secondary font-semibold">#{u.id}</td>
                          <td className="p-4">
                            <span className="font-bold text-sm text-text-primary">{u.username}</span>
                            {isCurrentUser && (
                              <span className="ml-2 inline-block px-1.5 py-0.2 rounded text-[0.65rem] bg-purple-primary/10 text-purple-primary font-bold">
                                Você
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${roleBadgeClass}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4 text-text-secondary">{u.email || '—'}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link 
                                to={`/admin/usuario/${u.id}/editar`}
                                className="px-3 py-1.5 rounded-lg border border-border-color bg-bg-surface hover:bg-bg-primary text-text-primary text-xs font-semibold transition-colors"
                              >
                                Editar
                              </Link>
                              {!isCurrentUser && (
                                <button 
                                  disabled={actionLoading === `user-${u.id}`}
                                  onClick={() => handleExcluirUsuario(u.id)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  Excluir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-bg-primary border-t border-border-color text-right text-xs text-text-secondary">
              Exibindo {usuariosFiltrados.length} de {usuarios.length} usuários
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: APROVAÇÕES DE CONTAS */}
      {activeTab === 'tab-aprovacoes' && (
        <AprovacoesContasTab onStatusChange={carregarDados} />
      )}

      <SubmissaoDetalhesModal submissao={submissaoAberta} onClose={() => setSubmissaoAberta(null)} />
    </div>
  );
}
