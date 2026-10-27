/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filtroUser, setFiltroUser] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (page = 1, userQuery = '') => {
    try {
      setLoading(true);
      const res = await api.get('/admin/logs', {
        params: {
          page: page,
          user: userQuery
        }
      });
      if (res.data.status === 'success') {
        setLogs(res.data.logs || []);
        setCurrentPage(res.data.page || 1);
        setTotalPages(res.data.pages || 1);
        setTotalLogs(res.data.total || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, '');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, filtroUser);
  };

  const limparFiltro = () => {
    setFiltroUser('');
    fetchLogs(1, '');
  };

  return (
    <div className="w-[92%] max-w-[1280px] mx-auto py-8">
      
      {/* CABEÇALHO INSTITUCIONAL */}
      <div className="bg-bg-surface border border-border-color rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Link 
              to="/admin" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-primary hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Voltar ao Painel Geral de Administração</span>
            </Link>
            <h1 className="font-title text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Logs e Trilha de Auditoria
            </h1>
            <p className="text-sm text-text-secondary">
              Registro histórico cronológico de acessos, modificações e operações sensíveis no sistema.
            </p>
          </div>

          {/* Form de Filtro */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Filtrar por usuário..."
                value={filtroUser}
                onChange={(e) => setFiltroUser(e.target.value)}
                className="bg-bg-primary border border-border-color rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-purple-primary transition-colors min-w-[200px]"
              />
            </div>
            <button 
              type="submit" 
              className="bg-purple-primary text-white border-none px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-purple-hover transition-colors shadow-sm"
            >
              Filtrar
            </button>
            {filtroUser && (
              <button 
                type="button" 
                onClick={limparFiltro} 
                className="bg-bg-primary border border-border-color text-text-secondary px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:text-text-primary transition-colors"
              >
                Limpar
              </button>
            )}
          </form>
        </div>
      </div>

      {/* TABELA DE AUDITORIA */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-primary border-t-transparent mx-auto mb-3"></div>
            <p className="text-xs text-text-secondary">Carregando registros de auditoria...</p>
          </div>
        </div>
      ) : (
        <div className="bg-bg-surface rounded-2xl shadow-sm overflow-hidden border border-border-color">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-text-primary">
              <thead>
                <tr className="bg-bg-primary text-text-secondary border-b border-border-color uppercase text-[0.7rem] tracking-wider font-semibold">
                  <th className="p-4">Identificador</th>
                  <th className="p-4">Operador</th>
                  <th className="p-4">Ação Registrada</th>
                  <th className="p-4">Detalhamento da Operação</th>
                  <th className="p-4 text-right">Data e Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-text-secondary">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="font-medium text-xs">
                          Nenhum registro de auditoria encontrado{filtroUser ? ` para o filtro "${filtroUser}"` : ''}.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const acaoLower = (log.acao || '').toLowerCase();
                    let badgeClass = "bg-bg-primary border border-border-color text-text-secondary";
                    
                    if (acaoLower.includes('exclu') || acaoLower.includes('rejeit') || acaoLower.includes('cancel')) {
                      badgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
                    } else if (acaoLower.includes('aprov') || acaoLower.includes('criou') || acaoLower.includes('login') || acaoLower.includes('cadastr')) {
                      badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                    } else if (acaoLower.includes('atualiz') || acaoLower.includes('edit') || acaoLower.includes('atribui')) {
                      badgeClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
                    }

                    return (
                      <tr key={log.id} className="hover:bg-bg-primary/50 transition-colors">
                        <td className="p-4 font-mono text-xs text-text-secondary font-semibold">#{log.id}</td>
                        <td className="p-4 font-bold text-text-primary">
                          {log.username}
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${badgeClass}`}>
                            {log.acao}
                          </span>
                        </td>
                        <td className="p-4 text-text-secondary max-w-[400px]">
                          <span className="line-clamp-2">{log.detalhes || '—'}</span>
                        </td>
                        <td className="p-4 text-text-secondary text-right whitespace-nowrap font-mono text-[0.75rem]">
                          {log.data}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-border-color bg-bg-primary gap-3 text-xs">
            <span className="text-text-secondary">
              Página <strong className="text-text-primary">{currentPage}</strong> de <strong className="text-text-primary">{totalPages}</strong> (Total de {totalLogs} registros)
            </span>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage <= 1}
                onClick={() => fetchLogs(currentPage - 1, filtroUser)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-color bg-bg-surface text-text-primary text-xs font-semibold cursor-pointer disabled:opacity-40 hover:bg-bg-primary transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Anterior</span>
              </button>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => fetchLogs(currentPage + 1, filtroUser)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-color bg-bg-surface text-text-primary text-xs font-semibold cursor-pointer disabled:opacity-40 hover:bg-bg-primary transition-colors"
              >
                <span>Próxima</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
