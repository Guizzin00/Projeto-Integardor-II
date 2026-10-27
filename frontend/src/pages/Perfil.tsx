/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { SubmissaoDetalhesModal, SubmissaoDetalhes } from '../components/SubmissaoDetalhesModal';
import { useUI } from '../components/UIProvider';

export function Perfil() {
  const { avisar, confirmar } = useUI();
  const { user } = useAuth();
  const location = useLocation();
  
  const isProfessor = user?.role === 'professor';
  const isEmpresa = user?.role === 'empresa' || user?.role === 'cliente';
  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador';
  const isAluno = !isProfessor && !isEmpresa && !isAdmin && !isCoordenador;

  const [activeTab, setActiveTab] = useState<'inscricoes' | 'propostas' | 'meusprojetos' | 'recomendacoes'>('meusprojetos');
  
  const [minhasCandidaturas, setMinhasCandidaturas] = useState<any[]>([]);
  const [minhasSubmissoes, setMinhasSubmissoes] = useState<any[]>([]);
  const [meusProjetos, setMeusProjetos] = useState<any[]>([]);
  const [recomendacoes, setRecomendacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Contagem de candidaturas pendentes que exigem ação do usuário
  const pendingCandsCount = useMemo(() => {
    return meusProjetos.reduce((acc, p) => {
      const pCands = (p.candidaturas || []).filter((c: any) => c.status === 'PENDENTE').length;
      return acc + pCands;
    }, 0);
  }, [meusProjetos]);

  // Filtros locais para a lista de candidaturas
  const [searchCand, setSearchCand] = useState('');
  const [statusFilterCand, setStatusFilterCand] = useState('TODOS');

  // Filtros locais para propostas
  const [searchSubm, setSearchSubm] = useState('');
  const [submissaoAberta, setSubmissaoAberta] = useState<SubmissaoDetalhes | null>(null);

  const fetchPerfil = async () => {
    try {
      const response = await api.get('/perfil');
      if (response.data.status === 'success') {
        setMinhasCandidaturas(response.data.data.minhas_candidaturas || []);
        setMinhasSubmissoes(response.data.data.minhas_submissoes || []);
        setMeusProjetos(response.data.data.meus_projetos || []);
        setRecomendacoes(response.data.data.recomendacoes || []);
      }
    } catch (error) {
      console.error("Erro ao carregar o perfil", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerfil();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'meus-projetos' || tabParam === 'meusprojetos' || tabParam === 'projetos') {
      setActiveTab('meusprojetos');
    } else if (tabParam === 'inscricoes' || tabParam === 'candidaturas') {
      setActiveTab('inscricoes');
    } else if (tabParam === 'propostas' || tabParam === 'submissoes') {
      setActiveTab('propostas');
    } else if (tabParam === 'recomendacoes') {
      setActiveTab('recomendacoes');
    } else {
      if (isProfessor) {
        setActiveTab('meusprojetos');
      } else if (isEmpresa) {
        setActiveTab('propostas');
      } else {
        setActiveTab('meusprojetos');
      }
    }
  }, [location.search, user?.role]);

  const handleCancelarCandidatura = async (candId: number) => {
    if (!await confirmar('Tem certeza de que deseja cancelar esta candidatura acadêmica?')) return;
    try {
      const res = await api.post(`/perfil/candidatura/${candId}/cancelar`);
      if (res.data.status === 'success' || res.status === 200) {
        setMinhasCandidaturas(prev => prev.filter(c => c.id !== candId));
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao cancelar candidatura.');
    }
  };

  const handleExcluirSubmissao = async (subId: number) => {
    if (!await confirmar('Tem certeza de que deseja excluir permanentemente esta proposta de projeto?')) return;
    try {
      const res = await api.post(`/submissao/${subId}/excluir`);
      if (res.data.status === 'success' || res.status === 200) {
        setMinhasSubmissoes(prev => prev.filter(s => s.id !== subId));
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao excluir proposta.');
    }
  };

  const handleAcaoCandidato = async (candId: number, acao: 'aprovar' | 'rejeitar' | 'reavaliar', projId: number) => {
    try {
      const res = await api.post(`/perfil/candidatura/${candId}/${acao}`);
      if (res.data.status === 'success' && res.data.new_status) {
        setMeusProjetos(prev => prev.map(p => {
          if (p.id !== projId) return p;
          const newCands = (p.candidaturas || []).map((c: any) => c.id === candId ? { ...c, status: res.data.new_status } : c);
          return { ...p, candidaturas: newCands };
        }));
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || `Erro ao ${acao} candidatura.`);
    }
  };

  // Projetos ativos em que o aluno foi aprovado (com acesso direto a Workspace)
  const projetosAtivosAluno = useMemo(() => {
    return minhasCandidaturas.filter(c => c.status === 'APROVADA');
  }, [minhasCandidaturas]);

  // Candidaturas filtradas por busca e status
  const candidaturasFiltradas = useMemo(() => {
    return minhasCandidaturas.filter(cand => {
      const matchBusca = (cand.projeto || '').toLowerCase().includes(searchCand.toLowerCase()) ||
                         (cand.motivo || '').toLowerCase().includes(searchCand.toLowerCase());
      const matchStatus = statusFilterCand === 'TODOS' || cand.status === statusFilterCand;
      return matchBusca && matchStatus;
    });
  }, [minhasCandidaturas, searchCand, statusFilterCand]);

  // Submissões filtradas por busca
  const submissoesFiltradas = useMemo(() => {
    return minhasSubmissoes.filter(subm => {
      return (subm.nome_projeto || '').toLowerCase().includes(searchSubm.toLowerCase()) ||
             (subm.categoria || '').toLowerCase().includes(searchSubm.toLowerCase());
    });
  }, [minhasSubmissoes, searchSubm]);

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    admin: 'Administrador Geral',
    coordenador: 'Coordenador Acadêmico',
    professor: 'Professor Orientador',
    empresa: 'Empresa Parceira / Cliente Externo',
    cliente: 'Cliente / Product Owner Externo',
    lider: 'Líder de Equipe / Scrum Master',
    aluno: 'Discente / Membro Acadêmico',
    user: 'Discente / Membro Acadêmico'
  };

  const roleBadges: Record<string, string> = {
    professor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    empresa: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    cliente: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    coordenador: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    admin: 'bg-purple-primary/10 text-purple-primary border border-purple-primary/20',
    lider: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    aluno: 'bg-purple-primary/10 text-purple-primary border border-purple-primary/20',
    user: 'bg-purple-primary/10 text-purple-primary border border-purple-primary/20'
  };

  // Contagem de alunos orientandos para o professor
  const totalOrientandos = useMemo(() => {
    return meusProjetos.reduce((total, p) => {
      const aprovados = (p.candidaturas || []).filter((c: any) => c.status === 'APROVADA').length;
      return total + aprovados;
    }, 0);
  }, [meusProjetos]);

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col justify-center items-center py-24 text-text-primary">
        <div className="animate-spin rounded-full h-11 w-11 border-2 border-purple-primary border-t-transparent mx-auto mb-3"></div>
        <p className="text-xs uppercase tracking-wider font-semibold text-text-secondary m-0">
          Carregando informações institucionais...
        </p>
      </div>
    );
  }

  return (
    <div className="w-[92%] max-w-[1240px] mx-auto my-8 space-y-6">
      
      {/* 1. CABEÇALHO INSTITUCIONAL CONTEXTUAL */}
      <div className="bg-bg-surface border border-border-color rounded-2xl p-6 sm:p-7 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-purple-primary text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0 border border-purple-hover/20">
              {user.username.charAt(0).toUpperCase()}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary m-0 tracking-tight">
                  {user.username}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${roleBadges[user.role] || 'bg-purple-primary/10 text-purple-primary'}`}>
                  {roleLabels[user.role] || 'Discente / Membro Acadêmico'}
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-text-secondary m-0">
                {user.email || 'E-mail institucional não informado'}
              </p>

              <p className="text-xs text-text-secondary/90 m-0 max-w-2xl pt-0.5">
                {isAdmin && (user.bio || 'Gestão administrativa, homologação institucional e supervisão geral da plataforma SisCPTI.')}
                {isCoordenador && (user.bio || 'Coordenação acadêmica, designação de orientadores e avaliação de propostas do SisCPTI.')}
                {isProfessor && 'Acompanhe as equipes orientadas, valide entregas no Kanban e conduza o desenvolvimento dos alunos.'}
                {isEmpresa && 'Cadastre problemas reais do mercado, valide protótipos funcionais e acompanhe as entregas dos MVPs.'}
                {isAluno && (user.bio || 'Estudante participando de projetos práticos e integradores do UniCEUB.')}
              </p>

              {isAluno && user.interesses && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {user.interesses.split(',').map((i: string) => i.trim()).filter(Boolean).map((i: string) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-purple-primary/10 text-purple-primary text-[11px] font-semibold">
                      {i}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-stretch sm:self-auto shrink-0 flex-wrap">
            <Link 
              to="/perfil/editar" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-bg-primary hover:bg-bg-surface border border-border-color hover:border-purple-primary text-text-primary hover:text-purple-primary rounded-xl text-xs sm:text-sm font-semibold transition-colors no-underline shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Editar Perfil</span>
            </Link>

            {isAdmin ? (
              <Link 
                to="/admin" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-primary hover:bg-purple-hover text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors no-underline shadow-sm"
              >
                <span>⚙️ Painel Administrativo</span>
              </Link>
            ) : isCoordenador ? (
              <Link 
                to="/coordenador" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-primary hover:bg-purple-hover text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors no-underline shadow-sm"
              >
                <span>📋 Painel da Coordenação</span>
              </Link>
            ) : (
              <Link 
                to="/submissao" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-primary hover:bg-purple-hover text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors no-underline shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>
                  {isEmpresa ? 'Submeter Demanda' : isProfessor ? 'Propor Projeto' : 'Nova Proposta'}
                </span>
              </Link>
            )}
          </div>

        </div>
      </div>

      {(isAdmin || isCoordenador) ? (
        <div className="bg-bg-surface border border-border-color rounded-2xl p-6 shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-text-primary m-0 mb-1">
            Acesso Rápido à Gestão Institucional
          </h2>
          <p className="text-xs text-text-secondary m-0 mb-5">
            {isAdmin
              ? 'O perfil de Administrador atua exclusivamente na governança e gerenciamento da plataforma, sem vínculo como participante de equipes.'
              : 'Acesse as ferramentas de coordenação acadêmica para acompanhar propostas, orientadores e homologações.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isAdmin && (
              <>
                <Link to="/admin?tab=projetos" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-primary">📁 Gerenciar Projetos</span>
                  <span className="text-xs text-text-secondary">Criar, editar status, atribuir orientadores ou excluir projetos do catálogo.</span>
                </Link>
                <Link to="/admin?tab=submissoes" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-primary">📋 Avaliar Propostas</span>
                  <span className="text-xs text-text-secondary">Analisar, aprovar ou recusar propostas de projetos submetidas.</span>
                </Link>
                <Link to="/admin?tab=candidaturas" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-primary">🎓 Candidaturas de Alunos</span>
                  <span className="text-xs text-text-secondary">Supervisionar e gerenciar inscrições de discentes nos projetos.</span>
                </Link>
                <Link to="/admin?tab=usuarios" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-primary">👥 Contas e Usuários</span>
                  <span className="text-xs text-text-secondary">Administrar usuários, papéis institucionais e credenciais.</span>
                </Link>
                <Link to="/admin?tab=aprovacoes" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-primary">✅ Homologação de Contas</span>
                  <span className="text-xs text-text-secondary">Validar solicitações de cadastro de professores e empresas parceiras.</span>
                </Link>
                <Link to="/admin/logs" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-primary">🛡️ Logs de Auditoria</span>
                  <span className="text-xs text-text-secondary">Consultar o histórico de atividades e eventos de segurança do sistema.</span>
                </Link>
              </>
            )}
            <Link to="/coordenador" className="p-4 rounded-xl bg-bg-primary border border-border-color hover:border-purple-primary transition-colors no-underline flex flex-col gap-1">
              <span className="text-sm font-bold text-text-primary">📊 Painel da Coordenação</span>
              <span className="text-xs text-text-secondary">Indicadores acadêmicos, designação de professores orientadores e relatórios.</span>
            </Link>
          </div>
        </div>
      ) : (
      <>
      {/* 2. CARDS DE INDICADORES (KPIS CONTEXTUAIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
              {isProfessor ? 'Projetos sob Orientação' : isEmpresa ? 'Demandas / Propostas' : 'Projetos em Andamento'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-purple-primary tracking-tight">
                {isProfessor ? meusProjetos.length : isEmpresa ? minhasSubmissoes.length : (projetosAtivosAluno.length + meusProjetos.length)}
              </span>
              <span className="text-xs text-text-secondary">
                {isProfessor ? 'equipes ativas' : isEmpresa ? 'submissões registradas' : 'com acesso a Workspace'}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-primary/10 text-purple-primary flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
              {isProfessor ? 'Propostas Acadêmicas' : isEmpresa ? 'Projetos Parceiros' : 'Minhas Candidaturas'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {isProfessor ? minhasSubmissoes.length : isEmpresa ? meusProjetos.length : minhasCandidaturas.length}
              </span>
              <span className="text-xs text-text-secondary">
                {isProfessor 
                  ? `(${minhasSubmissoes.filter(s => s.status === 'APROVADA').length} validadas)`
                  : isEmpresa 
                  ? 'em desenvolvimento' 
                  : `(${minhasCandidaturas.filter(c => c.status === 'APROVADA').length} aprovadas)`}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-bg-surface border border-border-color rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
              {isProfessor ? 'Alunos sob Tutoria' : isEmpresa ? 'Propostas Validadas' : 'Propostas de Projeto'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {isProfessor ? totalOrientandos : isEmpresa ? minhasSubmissoes.filter(s => s.status === 'APROVADA').length : minhasSubmissoes.length}
              </span>
              <span className="text-xs text-text-secondary">
                {isProfessor ? 'discentes orientandos' : isEmpresa ? 'aprovadas pelo UniCEUB' : `(${minhasSubmissoes.filter(s => s.status === 'APROVADA').length} validadas)`}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>

      </div>

      {/* 3. WORKSPACES DE ACESSO RÁPIDO */}
      <div className="bg-bg-surface border border-border-color rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-color">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary m-0">
              {isProfessor ? 'Workspaces sob Minha Orientação' : isEmpresa ? 'Workspaces dos Projetos Parceiros' : 'Workspaces das Minhas Equipes'}
            </h2>
            <p className="text-xs text-text-secondary m-0 mt-0.5">
              {isProfessor && 'Acompanhe as entregas no Kanban, participe do chat e valide os marcos das equipes orientadas.'}
              {isEmpresa && 'Acompanhe as entregas das sprints, converse no chat e valide a evolução dos protótipos.'}
              {isAluno && 'Salas de trabalho colaborativas com chat, kanban de tarefas e entregas de projeto.'}
            </p>
          </div>
          <Link 
            to="/projetos" 
            className="text-xs font-semibold text-purple-primary hover:text-purple-hover hover:underline inline-flex items-center gap-1"
          >
            <span>Explorar caderno de projetos</span>
            <span>→</span>
          </Link>
        </div>

        {projetosAtivosAluno.length === 0 && meusProjetos.length === 0 ? (
          <div className="p-8 text-center bg-bg-primary rounded-xl border border-dashed border-border-color">
            <svg className="w-10 h-10 text-text-secondary/50 mx-auto mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm font-semibold text-text-primary m-0">
              {isProfessor ? 'Você ainda não foi vinculado como orientador de nenhum projeto.' : isEmpresa ? 'Sua empresa ainda não possui projetos ativos em andamento.' : 'Você ainda não está vinculado a nenhum projeto ativo.'}
            </p>
            <p className="text-xs text-text-secondary m-0 mt-1 max-w-md mx-auto">
              {isProfessor && 'A coordenação acadêmica vincula orientadores a projetos aprovados.'}
              {isEmpresa && 'Submeta uma proposta de projeto para que equipes de alunos possam desenvolvê-la.'}
              {isAluno && 'Candidate-se a projetos abertos no caderno de TI para ter acesso ao Workspace, chat e kanban.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Projetos como Membro Aprovado (Alunos) */}
            {projetosAtivosAluno.map(cand => (
              <div 
                key={`aprovado-${cand.id}`} 
                className="bg-bg-primary border border-border-color hover:border-purple-primary/50 rounded-xl p-4 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Membro Integrante
                    </span>
                    <span className="text-[11px] font-semibold text-text-secondary">
                      Inscrição #{cand.id}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-text-primary m-0 mb-1 leading-snug">
                    {cand.projeto}
                  </h3>

                  <p className="text-xs text-text-secondary m-0 mb-4 line-clamp-2">
                    {cand.motivo ? `"${cand.motivo}"` : 'Participação ativa na equipe acadêmica.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border-color flex items-center justify-between gap-2">
                  <Link 
                    to={`/projeto/${cand.projeto_id}`} 
                    className="text-xs text-text-secondary hover:text-purple-primary no-underline font-medium"
                  >
                    Ver detalhes
                  </Link>
                  <Link 
                    to={`/workspace/${cand.projeto_id}`} 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-primary hover:bg-purple-hover text-white rounded-lg text-xs font-bold no-underline transition-colors shadow-sm"
                  >
                    <span>Entrar no Workspace</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}

            {/* Projetos Orientados ou Próprios */}
            {meusProjetos.map(proj => {
              const roleTag = isProfessor 
                ? 'Professor Orientador' 
                : isEmpresa 
                ? 'Empresa Parceira' 
                : proj.owner_username === user.username 
                ? 'Líder / Criador' 
                : 'Integrante';

              const roleBadgeColor = isProfessor
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : isEmpresa
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
                : 'bg-purple-primary/10 text-purple-primary border-purple-primary/20';

              return (
                <div 
                  key={`owner-${proj.id}`} 
                  className="bg-bg-primary border border-border-color hover:border-purple-primary/40 rounded-xl p-4 flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${roleBadgeColor}`}>
                        {roleTag}
                      </span>
                      <span className="text-[11px] font-semibold text-text-secondary">
                        {proj.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-text-primary m-0 mb-1 leading-snug">
                      {proj.titulo}
                    </h3>

                    <p className="text-xs text-text-secondary m-0 mb-4 line-clamp-2">
                      {proj.descricao_curta || 'Projeto registrado no caderno SisCPTI.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border-color flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Link 
                        to={`/projeto/${proj.id}`} 
                        className="text-xs text-text-secondary hover:text-purple-primary no-underline font-medium"
                      >
                        Ver detalhes
                      </Link>
                      {(isProfessor || proj.owner_username === user.username) && (
                        <Link 
                          to={`/projeto/${proj.id}/editar`} 
                          className="text-xs text-purple-primary hover:underline no-underline font-semibold"
                        >
                          Editar projeto
                        </Link>
                      )}
                    </div>
                    <Link 
                      to={`/workspace/${proj.id}`} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold no-underline transition-colors shadow-sm"
                    >
                      <span>Acessar Workspace</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. SEÇÃO DE ABAS DE GESTÃO INSTITUCIONAL */}
      <div className="bg-bg-surface border border-border-color rounded-2xl p-6 shadow-sm">
        
        {/* Barra de Seleção de Abas (Segmented Control) */}
        <div className="flex flex-wrap gap-2 pb-4 mb-6 border-b border-border-color">
          
          {/* Aba de Inscrições: apenas para Alunos */}
          {isAluno && (
            <button 
              type="button"
              onClick={() => setActiveTab('inscricoes')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
                activeTab === 'inscricoes'
                  ? 'bg-purple-primary text-white shadow-sm'
                  : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
              }`}
            >
              <span>Minhas Inscrições</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'inscricoes' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
              }`}>
                {minhasCandidaturas.length}
              </span>
            </button>
          )}

          {/* Aba de Projetos Orientados / Gerenciar */}
          <button 
            type="button"
            onClick={() => setActiveTab('meusprojetos')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
              activeTab === 'meusprojetos'
                ? 'bg-purple-primary text-white shadow-sm'
                : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
            }`}
          >
            <span>
              {isProfessor ? 'Projetos Orientados' : isEmpresa ? 'Projetos Parceiros' : 'Meus Projetos'}
            </span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'meusprojetos' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
            }`}>
              {meusProjetos.length}
            </span>
            {pendingCandsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse" title={`${pendingCandsCount} candidatura(s) pendente(s)`}>
                {pendingCandsCount} pendente{pendingCandsCount > 1 ? 's' : ''}
              </span>
            )}
          </button>

          {/* Aba de Propostas / Demandas */}
          <button 
            type="button"
            onClick={() => setActiveTab('propostas')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
              activeTab === 'propostas'
                ? 'bg-purple-primary text-white shadow-sm'
                : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
            }`}
          >
            <span>
              {isEmpresa ? 'Demandas Submetidas' : isProfessor ? 'Propostas Acadêmicas' : 'Minhas Propostas'}
            </span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'propostas' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
            }`}>
              {minhasSubmissoes.length}
            </span>
          </button>

          {/* Aba de Recomendações: apenas para Alunos */}
          {isAluno && (
            <button 
              type="button"
              onClick={() => setActiveTab('recomendacoes')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
                activeTab === 'recomendacoes'
                  ? 'bg-purple-primary text-white shadow-sm'
                  : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
              }`}
            >
              <span>Vagas Recomendadas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'recomendacoes' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
              }`}>
                {recomendacoes.length}
              </span>
            </button>
          )}

        </div>

        {/* CONTEÚDO DA ABA: INSCRIÇÕES (ALUNOS) */}
        {activeTab === 'inscricoes' && isAluno && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-primary p-4 rounded-xl border border-border-color">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Pesquisar inscrição por projeto ou motivo..."
                  value={searchCand}
                  onChange={(e) => setSearchCand(e.target.value)}
                  className="w-full bg-bg-surface border border-border-color rounded-lg px-3.5 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={statusFilterCand}
                  onChange={(e) => setStatusFilterCand(e.target.value)}
                  className="bg-bg-surface border border-border-color rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="APROVADA">Aprovadas</option>
                  <option value="PENDENTE">Pendentes</option>
                  <option value="REJEITADA">Rejeitadas</option>
                </select>
              </div>
            </div>

            <div className="border border-border-color rounded-xl overflow-hidden bg-bg-surface">
              <table className="w-full border-collapse text-left text-xs text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                    <th className="p-3.5">ID</th>
                    <th className="p-3.5">Projeto Alvo</th>
                    <th className="p-3.5">Situação</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {candidaturasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-secondary italic">
                        Nenhuma candidatura localizada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    candidaturasFiltradas.map(cand => (
                      <tr key={cand.id} className="hover:bg-bg-primary/50 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-text-secondary">#{cand.id}</td>
                        <td className="p-3.5 font-bold text-sm">
                          <Link to={`/projeto/${cand.projeto_id}`} className="text-text-primary hover:text-purple-primary no-underline">
                            {cand.projeto}
                          </Link>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${
                            cand.status === 'APROVADA'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : cand.status === 'REJEITADA'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}>
                            {cand.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {cand.status === 'PENDENTE' && (
                            <button
                              onClick={() => handleCancelarCandidatura(cand.id)}
                              className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-semibold cursor-pointer border border-rose-500/20 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA: MEUS PROJETOS / PROJETOS ORIENTADOS */}
        {activeTab === 'meusprojetos' && (
          <div className="space-y-6">
            {meusProjetos.length === 0 ? (
              <div className="p-8 text-center bg-bg-primary rounded-xl border border-dashed border-border-color text-text-secondary text-xs">
                Nenhum projeto associado no momento.
              </div>
            ) : (
              meusProjetos.map(proj => (
                <div key={proj.id} className="border border-border-color rounded-2xl p-5 bg-bg-primary space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-border-color gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary m-0">
                          {proj.titulo}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-primary/10 text-purple-primary border border-purple-primary/20">
                          {proj.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary m-0 mt-0.5">
                        Categoria: {proj.categoria || 'Geral'} · {proj.professor ? `Orientador: ${proj.professor}` : 'Sem orientador definido'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link 
                        to={`/projeto/${proj.id}`} 
                        className="px-3 py-1.5 bg-bg-surface hover:border-purple-primary border border-border-color text-text-primary rounded-xl text-xs font-semibold no-underline transition-colors"
                      >
                        Ver Detalhes
                      </Link>
                      <Link 
                        to={`/workspace/${proj.id}`} 
                        className="px-3 py-1.5 bg-purple-primary hover:bg-purple-hover text-white rounded-xl text-xs font-semibold no-underline transition-colors shadow-sm flex items-center gap-1"
                      >
                        <span>Abrir Workspace</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>

                  {/* Tabela de Candidatos e Integrantes da Equipe */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary m-0">
                        {isProfessor ? 'Alunos Candidatos e Integrantes da Equipe Orientada:' : 'Candidatos Inscritos:'}
                      </h4>
                      {proj.candidaturas && proj.candidaturas.some((c: any) => c.status === 'PENDENTE') && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Aguardando sua avaliação
                        </span>
                      )}
                    </div>

                    <div className="border border-border-color rounded-xl overflow-x-auto bg-bg-surface">
                      <table className="w-full border-collapse text-left text-xs text-text-primary">
                        <thead>
                          <tr className="bg-bg-primary text-text-secondary border-b border-border-color">
                            <th className="py-2.5 px-3 font-semibold">Candidato</th>
                            <th className="py-2.5 px-3 font-semibold">Motivo</th>
                            <th className="py-2.5 px-3 font-semibold">Experiência</th>
                            <th className="py-2.5 px-3 font-semibold">Status</th>
                            <th className="py-2.5 px-3 text-right font-semibold">Avaliação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color">
                          {(!proj.candidaturas || proj.candidaturas.length === 0) ? (
                            <tr>
                              <td colSpan={5} className="py-5 text-center text-text-secondary italic">
                                Nenhum candidato registrado para este projeto.
                              </td>
                            </tr>
                          ) : (
                            proj.candidaturas.map((cand: any) => (
                              <tr key={cand.id} className="hover:bg-bg-primary/50 transition-colors">
                                <td className="py-2.5 px-3 font-bold align-top">
                                  <div>{cand.username}</div>
                                  {(cand.matricula || cand.email) && (
                                    <div className="text-[10px] text-text-secondary font-normal mt-0.5">
                                      {cand.matricula ? `Matrícula: ${cand.matricula}` : ''}
                                      {cand.matricula && cand.email ? ' • ' : ''}
                                      {cand.email || ''}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-text-secondary align-top max-w-xs">{cand.motivo || '-'}</td>
                                <td className="py-2.5 px-3 text-text-secondary align-top max-w-xs">{cand.experiencia || '-'}</td>
                                <td className="py-2.5 px-3 align-top">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    cand.status === 'APROVADA'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      : cand.status === 'REJEITADA'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  }`}>
                                    {cand.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right align-top">
                                  {cand.status === 'PENDENTE' && (
                                    <div className="flex justify-end gap-1.5">
                                      <button 
                                        onClick={() => handleAcaoCandidato(cand.id, 'aprovar', proj.id)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer border-none shadow-sm transition-colors"
                                        title="Aprovar entrada do candidato"
                                      >
                                        ✓ Aprovar
                                      </button>
                                      <button 
                                        onClick={() => handleAcaoCandidato(cand.id, 'rejeitar', proj.id)}
                                        className="px-2.5 py-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded text-[11px] font-semibold cursor-pointer border border-rose-500/20 transition-colors"
                                        title="Rejeitar candidatura"
                                      >
                                        ✕ Rejeitar
                                      </button>
                                    </div>
                                  )}
                                  {cand.status !== 'PENDENTE' && (
                                    <span className="text-[11px] text-text-secondary italic">Avaliado</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA: PROPOSTAS / DEMANDAS */}
        {activeTab === 'propostas' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-primary p-4 rounded-xl border border-border-color">
              <input 
                type="text" 
                placeholder="Pesquisar por nome de projeto ou categoria..."
                value={searchSubm}
                onChange={(e) => setSearchSubm(e.target.value)}
                className="w-full bg-bg-surface border border-border-color rounded-lg px-3.5 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors"
              />
              <Link 
                to="/submissao" 
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-primary text-white rounded-lg text-xs font-bold no-underline hover:bg-purple-hover transition-colors shadow-sm shrink-0"
              >
                + Nova Proposta
              </Link>
            </div>

            <div className="border border-border-color rounded-xl overflow-hidden bg-bg-surface">
              <table className="w-full border-collapse text-left text-xs text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                    <th className="p-3.5">ID</th>
                    <th className="p-3.5">Nome da Proposta</th>
                    <th className="p-3.5">Categoria</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {submissoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-secondary italic">
                        Nenhuma proposta encontrada.
                      </td>
                    </tr>
                  ) : (
                    submissoesFiltradas.map(subm => (
                      <tr key={subm.id} className="hover:bg-bg-primary/50 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-text-secondary">#{subm.id}</td>
                        <td className="p-3.5 font-bold text-sm text-text-primary">{subm.nome_projeto}</td>
                        <td className="p-3.5 text-text-secondary">{subm.categoria}</td>
                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${
                            subm.status === 'APROVADA'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : subm.status === 'REJEITADA'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}>
                            {subm.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSubmissaoAberta(subm)}
                              className="px-2.5 py-1 bg-purple-primary/10 hover:bg-purple-primary/20 text-purple-primary rounded text-xs font-semibold border border-purple-primary/30 cursor-pointer transition-colors"
                            >
                              Ver detalhes
                            </button>
                            {subm.status === 'EM ANÁLISE' ? (
                              <>
                                <Link 
                                  to={`/submissao/${subm.id}/editar`} 
                                  className="px-2.5 py-1 bg-bg-primary hover:bg-border-color text-text-primary rounded text-xs font-semibold no-underline border border-border-color transition-colors"
                                >
                                  Editar
                                </Link>
                                <button 
                                  type="button"
                                  onClick={() => handleExcluirSubmissao(subm.id)}
                                  className="px-2.5 py-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded text-xs font-semibold border border-rose-500/20 cursor-pointer transition-colors"
                                >
                                  Excluir
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-text-secondary italic">Avaliado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA: RECOMENDAÇÕES (ALUNOS) */}
        {activeTab === 'recomendacoes' && isAluno && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary m-0">
              Oportunidades alinhadas aos seus interesses acadêmicos cadastrados no perfil.
            </p>
            {recomendacoes.length === 0 ? (
              <div className="p-8 text-center bg-bg-primary rounded-xl border border-dashed border-border-color text-text-secondary text-xs">
                Nenhuma recomendação disponível no momento. Edite seu perfil e adicione interesses (ex: React, Python, Mobile) para receber sugestões automáticas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recomendacoes.map(proj => (
                  <div key={proj.id} className="bg-bg-primary border border-border-color rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase bg-purple-primary/10 text-purple-primary px-2 py-0.5 rounded-full inline-block mb-2">
                        {proj.categoria}
                      </span>
                      <h4 className="text-sm font-bold text-text-primary m-0 mb-1">{proj.titulo}</h4>
                      <p className="text-xs text-text-secondary m-0 mb-3 line-clamp-2">{proj.descricao_curta}</p>
                    </div>
                    <Link 
                      to={`/projeto/${proj.id}`} 
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-primary text-white text-xs font-bold rounded-lg no-underline hover:bg-purple-hover transition-colors shadow-sm"
                    >
                      <span>Ver Projeto & Candidatar-se</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      </>
      )}

      <SubmissaoDetalhesModal submissao={submissaoAberta} onClose={() => setSubmissaoAberta(null)} />
    </div>
  );
}
