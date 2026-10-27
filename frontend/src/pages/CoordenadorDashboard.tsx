/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AprovacoesContasTab } from '../components/AprovacoesContasTab';
import { SubmissaoDetalhesModal, SubmissaoDetalhes } from '../components/SubmissaoDetalhesModal';
import { useUI } from '../components/UIProvider';
import { useListaPaginada } from '../hooks/useListaPaginada';
import { Paginacao } from '../components/Paginacao';

export function CoordenadorDashboard() {
  const { avisar } = useUI();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tab-projetos' | 'tab-submissoes' | 'tab-aprovacoes'>('tab-projetos');
  const [pendentesCount, setPendentesCount] = useState<number>(0);

  const [totais, setTotais] = useState({ projetos: 0, submissoes: 0 });
  const [semOrientador, setSemOrientador] = useState(0);
  const [pendentesSubm, setPendentesSubm] = useState(0);
  const [professores, setProfessores] = useState<any[]>([]);
  const [satisfacao, setSatisfacao] = useState<{
    nota: number;
    nota_organizacao: number;
    nota_orientacao: number;
    nota_aprendizado: number;
    total: number;
  }>({
    nota: 0,
    nota_organizacao: 0,
    nota_orientacao: 0,
    nota_aprendizado: 0,
    total: 0
  });

  const [selectedProfessores, setSelectedProfessores] = useState<Record<number, string>>({});
  const [selectedSubmProf, setSelectedSubmProf] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Filtros locais
  const [searchProj, setSearchProj] = useState('');
  const [onlyWithoutOrientador, setOnlyWithoutOrientador] = useState(false);
  const [searchSubm, setSearchSubm] = useState('');
  const [submissaoAberta, setSubmissaoAberta] = useState<SubmissaoDetalhes | null>(null);
  const [filterSubmStatus, setFilterSubmStatus] = useState('TODOS');

  // Listas paginadas e filtradas no servidor
  const projLista = useListaPaginada<any>('projetos', { q: searchProj, sem_orientador: onlyWithoutOrientador });
  const submLista = useListaPaginada<any>('submissoes', { q: searchSubm, status: filterSubmStatus });
  const projetosFiltrados = projLista.items;
  const submissoesFiltradas = submLista.items;

  // Mantém a seleção de orientadores em sincronia com a página exibida
  useEffect(() => {
    setSelectedProfessores(prev => {
      const mapa = { ...prev };
      projLista.items.forEach((p: any) => {
        if (p.professor_id && mapa[p.id] === undefined) mapa[p.id] = String(p.professor_id);
      });
      return mapa;
    });
  }, [projLista.items]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [coordRes, satRes] = await Promise.all([
        api.get('/coordenador'),
        api.get('/admin/satisfacao').catch(() => ({ data: { nota: 0, nota_organizacao: 0, nota_orientacao: 0, nota_aprendizado: 0, total: 0 } }))
      ]);

      if (coordRes.data.status === 'success') {
        if (coordRes.data.totais) setTotais(coordRes.data.totais);
        setSemOrientador(coordRes.data.projetos_sem_orientador || 0);
        setPendentesSubm(coordRes.data.submissoes_pendentes || 0);
        setProfessores(coordRes.data.professores || []);
        if (coordRes.data.aprovacoes_pendentes_count !== undefined) {
          setPendentesCount(coordRes.data.aprovacoes_pendentes_count);
        }

      }

      if (satRes.data) {
        setSatisfacao(satRes.data);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do coordenador:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarContagens = async () => {
    try {
      const res = await api.get('/coordenador');
      if (res.data.totais) setTotais(res.data.totais);
      setSemOrientador(res.data.projetos_sem_orientador || 0);
      setPendentesSubm(res.data.submissoes_pendentes || 0);
    } catch { /* mantém os números atuais */ }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleAtribuirOrientador = async (projId: number) => {
    const profId = selectedProfessores[projId];
    if (!profId) {
      avisar('Por favor, selecione um professor orientador na lista.');
      return;
    }

    try {
      setSavingId(projId);
      const res = await api.post(`/coordenador/projeto/${projId}/atribuir`, { professor_id: profId });
      if (res.data.status === 'success') {
        setSuccessMessage('Professor orientador atribuído com sucesso!');
        setTimeout(() => setSuccessMessage(''), 4000);
        await projLista.reload();
        carregarContagens();
      } else {
        avisar(res.data.message || 'Erro ao atribuir orientador');
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao atribuir professor.');
    } finally {
      setSavingId(null);
    }
  };

  const handleAcaoSubmissao = async (subId: number, acao: 'aprovar' | 'rejeitar') => {
    try {
      setSavingId(subId);
      const profId = selectedSubmProf[subId];
      const res = await api.post(`/admin/submissao/${subId}/${acao}`, { professor_id: profId });
      if (res.data.status === 'success') {
        setSuccessMessage(`Proposta de projeto ${acao === 'aprovar' ? 'aprovada' : 'rejeitada'} com sucesso!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        projLista.reload();
        submLista.reload();
        carregarContagens();
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || `Erro ao ${acao} submissão.`);
    } finally {
      setSavingId(null);
    }
  };

  const handleDownload = (endpoint: string) => {
    setExportOpen(false);
    const baseURL = (api.defaults.baseURL || '').replace(/\/api$/, '');
    window.open(`${baseURL}${endpoint}`, '_blank');
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col justify-center items-center py-24 text-text-primary">
        <svg className="animate-spin w-10 h-10 text-purple-primary mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-xs uppercase tracking-wider font-semibold text-text-secondary m-0">
          Carregando dados da Coordenação Acadêmica...
        </p>
      </div>
    );
  }

  return (
    <div className="w-[92%] max-w-[1240px] mx-auto my-8 space-y-6">
      
      {/* 1. CABEÇALHO INSTITUCIONAL DO COORDENADOR */}
      <div className="bg-bg-surface border border-border-color rounded-md p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary m-0 tracking-tight">
                Coordenação Acadêmica de TI
              </h1>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-purple-primary/10 text-purple-primary border border-purple-primary/20">
                Gestão Pedagógica
              </span>
            </div>
            <p className="text-xs sm:text-sm text-text-secondary m-0">
              Alocação de docentes orientadores, avaliação de propostas institucionais e métricas de satisfação, {user?.username}.
            </p>
          </div>

          {/* Dropdown de Exportação Consolidado */}
          <div className="relative shrink-0">
            <button 
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-bg-primary hover:bg-bg-surface border border-border-color hover:border-purple-primary text-text-primary hover:text-purple-primary rounded-md text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Exportar Dados</span>
              <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-bg-surface border border-border-color rounded-md shadow-lg py-1 z-50 animate-[fadeIn_0.15s_ease-out]">
                <button 
                  type="button"
                  onClick={() => handleDownload('/admin/relatorio/pdf')}
                  className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-purple-primary/5 hover:text-purple-primary font-medium flex items-center gap-2 border-none bg-transparent cursor-pointer"
                >
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Relatório Oficial em PDF</span>
                </button>
                <button 
                  type="button"
                  onClick={() => handleDownload('/api/admin/exportar/projetos')}
                  className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-purple-primary/5 hover:text-purple-primary font-medium flex items-center gap-2 border-none bg-transparent cursor-pointer"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Planilha de Projetos (CSV)</span>
                </button>
                <button 
                  type="button"
                  onClick={() => handleDownload('/api/admin/exportar/satisfacao')}
                  className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-purple-primary/5 hover:text-purple-primary font-medium flex items-center gap-2 border-none bg-transparent cursor-pointer"
                >
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>Métricas de Satisfação (CSV)</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Feedback visual de sucesso */}
        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-md text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}
      </div>

      {/* 2. CARDS DE STATUS OPERACIONAL (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Alerta Projetos sem Orientador */}
        <div className={`border rounded-md p-5 shadow-sm flex flex-col justify-between ${
          semOrientador > 0 
            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60' 
            : 'bg-bg-surface border-border-color'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Sem Orientador
              </span>
              {semOrientador > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-700 text-white">
                  Atenção
                </span>
              )}
            </div>
            <div className="mt-1">
              <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {semOrientador}
              </span>
              <span className="text-xs text-text-secondary block mt-0.5">
                {semOrientador === 1 ? 'projeto aguarda docente' : 'projetos aguardam docente'}
              </span>
            </div>
          </div>
          {semOrientador > 0 && (
            <button 
              type="button"
              onClick={() => { setActiveTab('tab-projetos'); setOnlyWithoutOrientador(true); }}
              className="mt-3 text-left text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline border-none bg-transparent cursor-pointer p-0"
            >
              Filtrar pendências →
            </button>
          )}
        </div>

        {/* KPI 2: Propostas Aguardando Avaliação */}
        <div className="bg-bg-surface border border-border-color rounded-md p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
              Propostas Pendentes
            </span>
            <div className="mt-1">
              <span className="text-3xl font-extrabold text-purple-primary tracking-tight">
                {pendentesSubm}
              </span>
              <span className="text-xs text-text-secondary block mt-0.5">
                de {totais.submissoes} submissões totais
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setActiveTab('tab-submissoes')}
            className="mt-3 text-left text-xs font-bold text-purple-primary hover:underline border-none bg-transparent cursor-pointer p-0"
          >
            Avaliar propostas →
          </button>
        </div>

        {/* KPI 3: Docentes Cadastrados */}
        <div className="bg-bg-surface border border-border-color rounded-md p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
              Corpo Docente
            </span>
            <div className="mt-1">
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {professores.length}
              </span>
              <span className="text-xs text-text-secondary block mt-0.5">
                professores disponíveis
              </span>
            </div>
          </div>
          <span className="mt-3 text-xs text-text-secondary">
            {totais.projetos} projetos em acompanhamento
          </span>
        </div>

        {/* KPI 4: Satisfação Geral */}
        <div className="bg-bg-surface border border-border-color rounded-md p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
              Índice de Satisfação
            </span>
            <div className="mt-1">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {satisfacao.nota ? Number(satisfacao.nota).toFixed(1) : '5.0'}
              </span>
              <span className="text-xs text-text-secondary block mt-0.5">
                escala de 0.0 a 5.0 ({satisfacao.total || 0} avaliações)
              </span>
            </div>
          </div>
          <span className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Aprovação pedagógica sólida
          </span>
        </div>

      </div>

      {/* 3. ABAS DE GESTÃO: ORIENTADORES E PROPOSTAS */}
      <div className="bg-bg-surface border border-border-color rounded-md p-6 shadow-sm">
        
        {/* Segmented Control */}
        <div className="flex flex-wrap gap-2 pb-4 mb-6 border-b border-border-color">
          
          <button 
            type="button"
            onClick={() => setActiveTab('tab-projetos')}
            className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
              activeTab === 'tab-projetos'
                ? 'bg-purple-primary text-white shadow-sm'
                : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
            }`}
          >
            <span>Alocação de Docentes Orientadores</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'tab-projetos' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
            }`}>
              {totais.projetos}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('tab-submissoes')}
            className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
              activeTab === 'tab-submissoes'
                ? 'bg-purple-primary text-white shadow-sm'
                : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
            }`}
          >
            <span>Propostas Recebidas de Empresas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'tab-submissoes' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
            }`}>
              {totais.submissoes}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('tab-aprovacoes')}
            className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-2 border-none ${
              activeTab === 'tab-aprovacoes'
                ? 'bg-purple-primary text-white shadow-sm'
                : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-primary/80'
            }`}
          >
            <span>Aprovações de Contas (Professor / Empresa)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              pendentesCount > 0 
                ? 'bg-amber-700 text-white animate-pulse'
                : activeTab === 'tab-aprovacoes' ? 'bg-white/20 text-white' : 'bg-border-color text-text-secondary'
            }`}>
              {pendentesCount}
            </span>
          </button>

        </div>

        {/* TAB 1: GESTÃO DE ORIENTADORES */}
        {activeTab === 'tab-projetos' && (
          <div className="space-y-4">
            
            {/* Filtros da Tabela */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <input 
                  type="text" 
                  value={searchProj}
                  onChange={(e) => setSearchProj(e.target.value)}
                  placeholder="Pesquisar por projeto, categoria ou orientador..."
                  className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-color rounded-md text-xs sm:text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary transition-colors"
                />
                <svg className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setOnlyWithoutOrientador(!onlyWithoutOrientador)}
                  className={`px-3 py-2 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${
                    onlyWithoutOrientador 
                      ? 'bg-amber-700 text-white border-amber-600 shadow-sm' 
                      : 'bg-bg-primary text-text-secondary border-border-color hover:border-purple-primary'
                  }`}
                >
                  {onlyWithoutOrientador ? '✓ Apenas sem orientador' : 'Mostrar apenas sem orientador'}
                </button>
              </div>
            </div>

            {/* Tabela de Projetos & Orientadores */}
            <div className="border border-border-color rounded-md overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm text-text-primary">
                <thead>
                  <tr className="bg-bg-primary text-text-secondary border-b border-border-color font-semibold">
                    <th className="py-3 px-4 w-16">ID</th>
                    <th className="py-3 px-4">Projeto</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Orientador Atual</th>
                    <th className="py-3 px-4 text-right">Atribuição de Docente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {projetosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-secondary">
                        Nenhum projeto encontrado com os filtros informados.
                      </td>
                    </tr>
                  ) : (
                    projetosFiltrados.map(p => {
                      const orientadorNome = p.professor || (p.orientador ? p.orientador.username : '');
                      const semOrientador = !orientadorNome;

                      return (
                        <tr key={p.id} className="hover:bg-purple-primary/5 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-text-secondary align-middle">
                            #{p.id}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-text-primary align-middle">
                            <Link 
                              to={`/projeto/${p.id}`} 
                              className="text-text-primary hover:text-purple-primary no-underline transition-colors"
                            >
                              {p.titulo}
                            </Link>
                          </td>

                          <td className="py-3.5 px-4 text-text-secondary align-middle">
                            <span className="inline-block px-2 py-0.5 rounded bg-bg-primary border border-border-color text-xs">
                              {p.categoria || 'Geral'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            {semOrientador ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                                <span>⚠️</span>
                                <span>Pendente de atribuição</span>
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-purple-primary">
                                Prof. {orientadorNome}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right align-middle">
                            <div className="inline-flex items-center gap-2">
                              <select aria-label="Professor orientador do projeto" 
                                value={selectedProfessores[p.id] || ''}
                                onChange={(e) => setSelectedProfessores({ ...selectedProfessores, [p.id]: e.target.value })}
                                className="px-2.5 py-1.5 bg-bg-primary border border-border-color rounded-md text-xs text-text-primary focus:outline-none focus:border-purple-primary transition-colors max-w-[180px]"
                              >
                                <option value="">-- Selecione o Docente --</option>
                                {professores.map(prof => (
                                  <option key={prof.id} value={prof.id}>
                                    Prof. {prof.username}
                                  </option>
                                ))}
                              </select>

                              <button 
                                type="button"
                                disabled={savingId === p.id}
                                onClick={() => handleAtribuirOrientador(p.id)}
                                className="px-3 py-1.5 bg-purple-primary hover:bg-purple-hover text-white rounded-md text-xs font-bold transition-colors cursor-pointer border-none shadow-sm disabled:opacity-50"
                              >
                                {savingId === p.id ? 'Gravando...' : 'Salvar'}
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
            <Paginacao lista={projLista} rotulo="projetos" />
          </div>
        )}

        {/* TAB 2: PROPOSTAS RECEBIDAS DE EMPRESAS */}
        {activeTab === 'tab-submissoes' && (
          <div className="space-y-4">
            
            {/* Filtros da Tabela de Propostas */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <input 
                  type="text" 
                  value={searchSubm}
                  onChange={(e) => setSearchSubm(e.target.value)}
                  placeholder="Pesquisar por projeto, proponente ou categoria..."
                  className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-color rounded-md text-xs sm:text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary transition-colors"
                />
                <svg className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="filterStatusSubm" className="text-xs font-semibold text-text-secondary">Parecer:</label>
                <select aria-label="Filtrar propostas por situação" 
                  id="filterStatusSubm"
                  value={filterSubmStatus}
                  onChange={(e) => setFilterSubmStatus(e.target.value)}
                  className="px-3 py-2 bg-bg-primary border border-border-color rounded-md text-xs font-semibold text-text-primary focus:outline-none focus:border-purple-primary transition-colors"
                >
                  <option value="TODOS">Todas as Propostas</option>
                  <option value="EM ANÁLISE">Aguardando Avaliação</option>
                  <option value="APROVADA">Aprovadas</option>
                  <option value="REJEITADA">Rejeitadas</option>
                </select>
              </div>
            </div>

            {/* Lista Estruturada de Propostas */}
            <div className="space-y-3">
              {submissoesFiltradas.length === 0 ? (
                <div className="py-8 text-center bg-bg-primary border border-border-color rounded-md text-text-secondary text-xs sm:text-sm">
                  Nenhuma proposta de projeto encontrada com os filtros selecionados.
                </div>
              ) : (
                submissoesFiltradas.map(subm => (
                  <div key={subm.id} className="border border-border-color rounded-md p-5 bg-bg-primary space-y-3">
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-color">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-text-primary m-0">
                            {subm.nome_projeto}
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-bg-surface text-text-secondary border border-border-color">
                            {subm.categoria || 'Geral'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary m-0 mt-0.5">
                          Proponente: <span className="font-semibold text-text-primary">{subm.proponente || subm.username}</span> · Contato: {subm.email || 'Não informado'}
                        </p>
                      </div>

                      <div>
                        {subm.status === 'APROVADA' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                            Proposta Aprovada
                          </span>
                        )}
                        {(subm.status === 'EM ANÁLISE' || subm.status === 'PENDENTE') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                            Aguardando Decisão do Colegiado
                          </span>
                        )}
                        {subm.status === 'REJEITADA' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold uppercase bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                            Proposta Indeferida
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed m-0 line-clamp-3">
                      {subm.descricao}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubmissaoAberta(subm)}
                      className="px-3 py-1.5 bg-purple-primary/10 hover:bg-purple-primary/20 text-purple-primary rounded text-xs font-bold border border-purple-primary/30 cursor-pointer transition-colors"
                    >
                      Ver detalhes da proposta
                    </button>

                    {/* Ações de Avaliação (caso pendente) */}
                    {(subm.status === 'EM ANÁLISE' || subm.status === 'PENDENTE') && (
                      <div className="pt-3 border-t border-border-color flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`prof-subm-${subm.id}`} className="text-xs font-semibold text-text-secondary">
                            Vincular Orientador Inicial:
                          </label>
                          <select aria-label="Professor orientador da proposta" 
                            id={`prof-subm-${subm.id}`}
                            value={selectedSubmProf[subm.id] || ''}
                            onChange={(e) => setSelectedSubmProf({ ...selectedSubmProf, [subm.id]: e.target.value })}
                            className="px-2.5 py-1 bg-bg-surface border border-border-color rounded text-xs text-text-primary focus:outline-none focus:border-purple-primary"
                          >
                            <option value="">-- Opcional: Selecione Docente --</option>
                            {professores.map(p => (
                              <option key={p.id} value={p.id}>Prof. {p.username}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button 
                            type="button"
                            disabled={savingId === subm.id}
                            onClick={() => handleAcaoSubmissao(subm.id, 'aprovar')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold border-none cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                          >
                            {savingId === subm.id ? 'Processando...' : '✓ Aprovar Proposta'}
                          </button>

                          <button 
                            type="button"
                            disabled={savingId === subm.id}
                            onClick={() => handleAcaoSubmissao(subm.id, 'rejeitar')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold border-none cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                          >
                            Recusar Proposta
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))
              )}
              <Paginacao lista={submLista} rotulo="propostas" />
            </div>

          </div>
        )}

        {/* TAB 3: APROVAÇÕES DE CONTAS (PROFESSOR / EMPRESA) */}
        {activeTab === 'tab-aprovacoes' && (
          <AprovacoesContasTab onStatusChange={carregarDados} />
        )}

      </div>

      <SubmissaoDetalhesModal submissao={submissaoAberta} onClose={() => setSubmissaoAberta(null)} />
    </div>
  );
}
