/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { useUI, useModalA11y } from './UIProvider';

interface UsuarioAprovacao {
  id: number;
  username: string;
  role: string;
  email: string;
  bio?: string;
  interesses?: string;
  ativo: boolean;
  status_aprovacao: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  data_cadastro?: string;
}

interface AprovacoesContasTabProps {
  onStatusChange?: () => void;
}

export function AprovacoesContasTab({ onStatusChange }: AprovacoesContasTabProps) {
  const { avisar, confirmar } = useUI();

  const [usuarios, setUsuarios] = useState<UsuarioAprovacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'TODOS' | 'professor' | 'empresa'>('TODOS');
  const [filterStatus, setFilterStatus] = useState<'PENDENTES' | 'APROVADOS' | 'REJEITADOS' | 'TODOS'>('PENDENTES');
  
  // Modal de Recusa
  const [rejectingUser, setRejectingUser] = useState<UsuarioAprovacao | null>(null);
  const recusaRef = useRef<HTMLDivElement>(null);
  useModalA11y(!!rejectingUser, () => setRejectingUser(null), recusaRef);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [alertFeedback, setAlertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const carregarAprovacoes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/aprovacoes');
      if (res.data.status === 'success' && res.data.data) {
        setUsuarios(res.data.data.usuarios || []);
      }
    } catch (err: any) {
      console.error('Erro ao carregar lista de aprovações:', err);
      setAlertFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Falha ao carregar as solicitações de conta.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAprovacoes();
  }, []);

  const handleAprovar = async (u: UsuarioAprovacao) => {
    if (!await confirmar(`Confirma a aprovação e liberação imediata de acesso para @${u.username} como ${u.role === 'professor' ? 'Professor' : 'Empresa'}?`)) {
      return;
    }

    try {
      setActionLoading(u.id);
      const res = await api.post(`/admin/aprovacoes/${u.id}/aprovar`);
      if (res.data.status === 'success') {
        setAlertFeedback({
          type: 'success',
          message: `Conta de @${u.username} homologada com sucesso! Um e-mail com a liberação foi enviado ao usuário.`
        });
        setUsuarios(prev => prev.map(item => item.id === u.id ? { ...item, status_aprovacao: 'APROVADO', ativo: true } : item));
        if (onStatusChange) onStatusChange();
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao homologar a conta.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmarRecusa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingUser) return;

    try {
      setActionLoading(rejectingUser.id);
      const res = await api.post(`/admin/aprovacoes/${rejectingUser.id}/rejeitar`, {
        motivo: motivoRecusa.trim()
      });
      if (res.data.status === 'success') {
        setAlertFeedback({
          type: 'success',
          message: `Solicitação de @${rejectingUser.username} recusada. Notificação enviada por e-mail.`
        });
        setUsuarios(prev => prev.map(item => item.id === rejectingUser.id ? { ...item, status_aprovacao: 'REJEITADO', ativo: false } : item));
        setRejectingUser(null);
        setMotivoRecusa('');
        if (onStatusChange) onStatusChange();
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao rejeitar a solicitação.');
    } finally {
      setActionLoading(null);
    }
  };

  // Contadores
  const counts = useMemo(() => {
    const pendentes = usuarios.filter(u => u.status_aprovacao === 'PENDENTE').length;
    const aprovados = usuarios.filter(u => u.status_aprovacao === 'APROVADO').length;
    const rejeitados = usuarios.filter(u => u.status_aprovacao === 'REJEITADO').length;
    return { pendentes, aprovados, rejeitados, total: usuarios.length };
  }, [usuarios]);

  // Lista Filtrada
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      // Filtro por role
      if (filterRole !== 'TODOS' && u.role !== filterRole) return false;

      // Filtro por status
      if (filterStatus === 'PENDENTES' && u.status_aprovacao !== 'PENDENTE') return false;
      if (filterStatus === 'APROVADOS' && u.status_aprovacao !== 'APROVADO') return false;
      if (filterStatus === 'REJEITADOS' && u.status_aprovacao !== 'REJEITADO') return false;

      // Busca textual
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchUser = u.username.toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        if (!matchUser && !matchEmail) return false;
      }

      return true;
    });
  }, [usuarios, filterRole, filterStatus, search]);

  const formatarData = (isoStr?: string) => {
    if (!isoStr) return 'Data recente';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Feedback */}
      {alertFeedback && (
        <div 
          role="alert" 
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            alertFeedback.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">
              {alertFeedback.type === 'success' ? '✓' : '⚠️'}
            </span>
            <span className="text-sm font-medium">{alertFeedback.message}</span>
          </div>
          <button 
            onClick={() => setAlertFeedback(null)} 
            className="text-xs font-semibold opacity-70 hover:opacity-100 uppercase tracking-wider bg-transparent border-0 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pendentes */}
        <div 
          onClick={() => setFilterStatus('PENDENTES')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'PENDENTES'
              ? 'bg-amber-500/10 border-amber-500 shadow-sm ring-1 ring-amber-500'
              : 'bg-bg-surface border-border-color hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              ⏳ Em Espera / Pendentes
            </span>
            {counts.pendentes > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text-primary tracking-tight">
              {counts.pendentes}
            </span>
            <span className="text-xs text-text-secondary">
              solicitaç{counts.pendentes === 1 ? 'ão' : 'ões'}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary m-0">
            Aguardando homologação de Coordenador ou Admin
          </p>
        </div>

        {/* Aprovados */}
        <div 
          onClick={() => setFilterStatus('APROVADOS')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'APROVADOS'
              ? 'bg-emerald-500/10 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
              : 'bg-bg-surface border-border-color hover:border-emerald-400'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            ✓ Homologados / Ativos
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text-primary tracking-tight">
              {counts.aprovados}
            </span>
            <span className="text-xs text-text-secondary">
              usuários liberados
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary m-0">
            Professores e empresas com acesso autorizado
          </p>
        </div>

        {/* Rejeitados */}
        <div 
          onClick={() => setFilterStatus('REJEITADOS')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            filterStatus === 'REJEITADOS'
              ? 'bg-red-500/10 border-red-500 shadow-sm ring-1 ring-red-500'
              : 'bg-bg-surface border-border-color hover:border-red-400'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            ✕ Não Homologados
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text-primary tracking-tight">
              {counts.rejeitados}
            </span>
            <span className="text-xs text-text-secondary">
              recusados
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary m-0">
            Solicitações indeferidas pela instituição
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-bg-surface border border-border-color rounded-xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nome de usuário ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-bg-primary text-text-primary border border-border-color rounded-lg focus:outline-none focus:border-purple-primary transition-colors"
          />
        </div>

        {/* Filtro por Tipo de Perfil */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">
            Perfil:
          </label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="py-2 px-3 text-xs font-medium bg-bg-primary text-text-primary border border-border-color rounded-lg focus:outline-none focus:border-purple-primary cursor-pointer"
          >
            <option value="TODOS">Todos os Perfis</option>
            <option value="professor">👨‍🏫 Professores</option>
            <option value="empresa">🏢 Empresas / Parceiros</option>
          </select>
        </div>

        {/* Filtro por Status */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">
            Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="py-2 px-3 text-xs font-medium bg-bg-primary text-text-primary border border-border-color rounded-lg focus:outline-none focus:border-purple-primary cursor-pointer"
          >
            <option value="PENDENTES">⏳ Em Espera (Pendentes)</option>
            <option value="APROVADOS">✓ Homologados</option>
            <option value="REJEITADOS">✕ Recusados</option>
            <option value="TODOS">Todos os Status</option>
          </select>
        </div>
      </div>

      {/* Lista / Tabela de Solicitações */}
      <div className="bg-bg-surface border border-border-color rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-text-secondary">
            <div className="inline-block w-8 h-8 border-3 border-purple-primary border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Carregando solicitações de contas institucionais...</p>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-purple-primary/10 flex items-center justify-center text-2xl text-purple-primary mb-3">
              🛡️
            </div>
            <h3 className="text-base font-bold text-text-primary mb-1">
              Nenhuma solicitação encontrada
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {filterStatus === 'PENDENTES'
                ? 'Excelente! Não há cadastros de professor ou empresa aguardando homologação no momento.'
                : 'Nenhum usuário corresponde aos filtros e termos de busca aplicados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-color bg-bg-primary/50 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  <th className="py-3.5 px-4">Usuário</th>
                  <th className="py-3.5 px-4">Perfil Solicitado</th>
                  <th className="py-3.5 px-4">E-mail Institucional</th>
                  <th className="py-3.5 px-4">Data da Solicitação</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações de Homologação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-xs">
                {usuariosFiltrados.map((u) => {
                  const isProfessor = u.role === 'professor';
                  const isPendente = u.status_aprovacao === 'PENDENTE';
                  const isAprovado = u.status_aprovacao === 'APROVADO';
                  const isRejeitado = u.status_aprovacao === 'REJEITADO';

                  return (
                    <tr key={u.id} className="hover:bg-purple-primary/5 transition-colors">
                      {/* Usuário + Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            isProfessor
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {u.username.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-text-primary block text-sm">
                              @{u.username}
                            </span>
                            <span className="text-[11px] text-text-secondary">
                              ID: #{u.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Perfil */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                          isProfessor
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                        }`}>
                          {isProfessor ? '👨‍🏫 Professor' : '🏢 Empresa'}
                        </span>
                      </td>

                      {/* E-mail */}
                      <td className="py-3.5 px-4 text-text-secondary">
                        <a 
                          href={`mailto:${u.email}`} 
                          className="text-text-primary hover:text-purple-primary transition-colors underline-offset-2 hover:underline"
                        >
                          {u.email || 'Não informado'}
                        </a>
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                        {formatarData(u.data_cadastro)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {isPendente && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            Em Espera
                          </span>
                        )}
                        {isAprovado && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                            ✓ Homologado
                          </span>
                        )}
                        {isRejeitado && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800">
                            ✕ Não Homologado
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPendente && (
                            <>
                              <button
                                onClick={() => handleAprovar(u)}
                                disabled={actionLoading === u.id}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {actionLoading === u.id ? '...' : '✓ Aprovar'}
                              </button>
                              <button
                                onClick={() => { setRejectingUser(u); setMotivoRecusa(''); }}
                                disabled={actionLoading === u.id}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                ✕ Recusar
                              </button>
                            </>
                          )}

                          {isAprovado && (
                            <button
                              onClick={() => { setRejectingUser(u); setMotivoRecusa('Revogação administrativa de credencial'); }}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-text-secondary hover:text-red-600 border border-border-color hover:border-red-300 transition-colors bg-transparent cursor-pointer"
                              title="Revogar credencial"
                            >
                              Revogar Acesso
                            </button>
                          )}

                          {isRejeitado && (
                            <button
                              onClick={() => handleAprovar(u)}
                              disabled={actionLoading === u.id}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-purple-primary hover:bg-purple-primary/10 border border-purple-primary/30 transition-colors bg-transparent cursor-pointer"
                              title="Reavaliar e aprovar"
                            >
                              Reavaliar e Aprovar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Recusa */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
          <div ref={recusaRef} role="dialog" aria-modal="true" aria-label="Recusar solicitação de cadastro" className="bg-bg-surface border border-border-color rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-border-color">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400 text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary m-0">
                  Recusar Solicitação de Cadastro
                </h3>
                <p className="text-xs text-text-secondary m-0">
                  Usuário: @{rejectingUser.username} ({rejectingUser.role})
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmarRecusa} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                  Motivo ou Parecer da Recusa (Enviado por e-mail):
                </label>
                <textarea
                  rows={3}
                  required
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Ex: O vínculo como docente do UniCEUB não pôde ser confirmado pelos registros acadêmicos."
                  className="w-full p-3 text-xs bg-bg-primary text-text-primary border border-border-color rounded-lg focus:outline-none focus:border-red-500 transition-colors resize-none"
                />
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed m-0">
                O usuário não terá acesso liberado e receberá um comunicado formal com este parecer por e-mail institucional.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary bg-transparent border-0 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === rejectingUser.id}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === rejectingUser.id ? 'Processando...' : 'Confirmar Recusa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
