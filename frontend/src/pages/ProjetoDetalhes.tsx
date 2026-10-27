/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUI } from '../components/UIProvider';

interface Avaliacao {
  username: string;
  nota: number;
  comentario: string;
  data: string;
}

export function ProjetoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { avisar, confirmar } = useUI();
  
  const [projeto, setProjeto] = useState<any>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [mediaNota, setMediaNota] = useState<number>(0);
  const [totalAvaliacoes, setTotalAvaliacoes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Formulário de avaliação
  const [minhaNota, setMinhaNota] = useState<number>(5);
  const [meuComentario, setMeuComentario] = useState('');
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [msgAvaliacao, setMsgAvaliacao] = useState('');

  const fetchDados = async () => {
    try {
      const [resProj, resAv] = await Promise.all([
        api.get(`/projeto/${id}`),
        api.get(`/projeto/${id}/avaliacoes`).catch(() => ({ data: { media: 0, total: 0, avaliacoes: [] } }))
      ]);

      if (resProj.data.status === 'success') {
        setProjeto(resProj.data.projeto);
      }
      if (resAv.data) {
        setMediaNota(resAv.data.media || 0);
        setTotalAvaliacoes(resAv.data.total || 0);
        setAvaliacoes(resAv.data.avaliacoes || []);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, [id]);

  const handleEnviarAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoAvaliacao(true);
    setMsgAvaliacao('');
    try {
      const res = await api.post(`/projeto/${id}/avaliar`, {
        nota: minhaNota,
        comentario: meuComentario
      });
      if (res.data.status === 'success') {
        setMsgAvaliacao('✅ ' + res.data.message);
        setMeuComentario('');
        fetchDados();
      } else {
        setMsgAvaliacao('❌ ' + (res.data.message || 'Erro ao enviar avaliação'));
      }
    } catch (err: any) {
      setMsgAvaliacao('❌ ' + (err.response?.data?.message || 'Erro ao enviar avaliação'));
    } finally {
      setEnviandoAvaliacao(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary"></div>
      </div>
    );
  }

  if (!projeto) {
    return <div className="text-center py-20 text-text-secondary">Projeto não encontrado.</div>;
  }

  const imagemUrl = projeto.imagem && projeto.imagem.startsWith('http') 
    ? projeto.imagem 
    : `/static/${projeto.imagem || 'default_capa_1.jpg'}`;

  let coverGradClass = 'bg-[#1a0a2e]';
  if (projeto.imagem?.includes('default_capa_1')) coverGradClass = 'bg-gradient-to-br from-indigo-500/18 to-purple-600/18 bg-bg-surface';
  else if (projeto.imagem?.includes('default_capa_2')) coverGradClass = 'bg-gradient-to-br from-teal-500/18 to-blue-600/18 bg-bg-surface';
  else if (projeto.imagem?.includes('default_capa_3')) coverGradClass = 'bg-gradient-to-br from-purple-500/18 to-pink-500/18 bg-bg-surface';

  let statusClass = 'text-[#6c757d]';
  if (projeto.status?.includes('CONCLUÍDO')) statusClass = 'text-[#28a745]';
  else if (projeto.status?.includes('EXECUÇÃO')) statusClass = 'text-amber-700 dark:text-amber-400';
  else if (projeto.status?.includes('INDISPONÍVEL')) statusClass = 'text-[#dc3545]';

  const podeEditar = !!user && (
    user.role === 'admin' ||
    projeto.owner_username === user.username ||
    (user.role === 'professor' && (projeto.professor === user.username || projeto.orientador?.username === user.username))
  );

  const podeExcluir = !!user && (user.role === 'admin' || projeto.owner_username === user.username);

  const isDonoOuOrientador = !!user && (
    projeto.owner_username?.toLowerCase() === user.username?.toLowerCase() ||
    (projeto.owner_id && projeto.owner_id === user.id) ||
    projeto.professor?.toLowerCase() === user.username?.toLowerCase() ||
    (projeto.professor_id && projeto.professor_id === user.id) ||
    projeto.orientador?.username?.toLowerCase() === user.username?.toLowerCase()
  );

  const isAlunoCandidato = !!user && ['aluno', 'lider', 'user'].includes(user.role) && !isDonoOuOrientador;

  const totalIntegrantes = projeto?.total_integrantes ?? (
    (projeto?.candidaturas_aprovadas || 0) + (projeto?.owner_username ? 1 : 0) || 1
  );

  const linksArray = useMemo<{ nome: string; url: string }[]>(() => {
    if (!projeto?.links) return [];
    if (Array.isArray(projeto.links)) {
      return projeto.links.map((item: any) => {
        if (typeof item === 'string') return { nome: item, url: item };
        return { nome: String(item.nome || item.label || item.titulo || 'Link'), url: String(item.url || item.href || '') };
      }).filter((l: { nome: string; url: string }) => Boolean(l.url));
    }
    if (typeof projeto.links === 'object') {
      return Object.entries(projeto.links).map(([nome, url]) => ({
        nome: String(nome || 'Link'),
        url: String(url || '')
      })).filter((l: { nome: string; url: string }) => Boolean(l.url));
    }
    if (typeof projeto.links === 'string' && projeto.links.trim().startsWith('http')) {
      return [{ nome: 'Link do Projeto', url: projeto.links.trim() }];
    }
    return [];
  }, [projeto?.links]);

  const handleExcluirProjeto = async () => {
    if (!await confirmar(`Tem certeza de que deseja excluir o projeto "${projeto.titulo}"? Esta ação apagará tarefas, mensagens e candidaturas vinculadas.`)) return;

    try {
      const res = await api.post(`/admin/projeto/${projeto.id}/excluir`);
      if (res.data.status === 'success') {
        avisar('✅ Projeto excluído com sucesso!');
        navigate(user?.role === 'admin' ? '/admin' : '/projetos');
      } else {
        avisar(res.data.message || 'Erro ao excluir projeto.', 'erro');
      }
    } catch (err: any) {
      avisar(err.response?.data?.message || 'Erro ao tentar excluir o projeto.', 'erro');
    }
  };

  return (
    <div>
      {/* HERO */}
      <div className={`relative h-[320px] overflow-hidden ${coverGradClass}`}>
        <img 
          src={imagemUrl} 
          alt={projeto.titulo} 
          className={`w-full h-full object-cover transition-opacity ${projeto.imagem?.includes('default_capa') ? 'mix-blend-multiply opacity-100' : 'opacity-45'}`} 
          onError={(e) => { e.currentTarget.src = '/static/default_capa_1.jpg'; }}
        />
        <div className="absolute inset-0 flex flex-col justify-end pb-8 bg-gradient-to-t from-[rgba(10,4,20,0.85)] to-[transparent_60%]">
          <div className="w-[90%] max-w-[1200px] mx-auto">
            <span className={`inline-block px-2.5 py-1 rounded-full text-[0.85rem] mb-3 font-bold bg-bg-primary uppercase ${statusClass}`}>
              {projeto.status}
            </span>
            {podeEditar && (
              <Link
                to={`/projeto/${projeto.id}/editar`}
                className="inline-block ml-2 px-3 py-1 rounded-full text-[0.85rem] mb-3 font-bold bg-purple-primary text-white no-underline hover:bg-purple-hover transition-colors"
              >
                ✏️ Editar projeto
              </Link>
            )}
            <h1 className="font-title text-[clamp(1.4rem,4vw,2.2rem)] font-extrabold text-white m-0 mb-1.5 leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
              {projeto.titulo}
            </h1>
            <p className="text-[rgba(255,255,255,0.85)] m-0 text-[0.95rem]">
              👨‍🏫 <strong>{projeto.professor || '—'}</strong>
              &nbsp;·&nbsp;
              🗂 {projeto.categoria || '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="w-[90%] max-w-[1200px] mx-auto pt-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 items-start">
          
          {/* COLUNA PRINCIPAL */}
          <div>
            {/* Stats Bar */}
            <div className="flex flex-wrap gap-2.5 mb-6">
              <div className="bg-bg-surface border border-border-color rounded-full px-4 py-1.5 text-[0.85rem] text-text-secondary font-medium shadow-sm">
                📋 {totalAvaliacoes} {totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}
              </div>
              <div className="bg-bg-surface border border-border-color rounded-full px-4 py-1.5 text-[0.85rem] text-text-secondary font-medium shadow-sm">
                ⭐ Média: <strong>{mediaNota > 0 ? mediaNota.toFixed(1) : '—'}</strong> / 5.0
              </div>
              <div className="bg-bg-surface border border-border-color rounded-full px-4 py-1.5 text-[0.85rem] text-text-secondary font-medium shadow-sm">
                👥 {totalIntegrantes} {totalIntegrantes === 1 ? 'integrante no time' : 'integrantes no time'}
              </div>
            </div>

            {/* Detalhes do projeto (Safe rendering: evita crash com objetos JSON) */}
            <div className="bg-bg-surface rounded-2xl p-7 mb-6 shadow-light border border-border-color">
              <h2 className="font-title text-[1.2rem] font-bold text-text-primary m-0 mb-5 pb-2.5 border-b-2 border-border-color flex items-center gap-2">
                📄 Sobre o Projeto
              </h2>
              {Array.isArray(projeto.detalhes) && projeto.detalhes.length > 0 ? (
                projeto.detalhes.map((item: any, index: number) => {
                  if (typeof item === 'object' && item !== null) {
                    return (
                      <div key={index} className="mb-5 pb-4 border-b border-border-color last:border-b-0 last:pb-0">
                        <h3 className="font-title text-base font-bold text-purple-primary mb-1.5">
                          {item.titulo || `Tópico ${index + 1}`}
                        </h3>
                        <p className="leading-[1.8] text-text-primary text-[0.95rem] m-0">
                          {item.conteudo || ''}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <p key={index} className="leading-[1.8] text-text-primary mb-4 text-[0.95rem]">
                      {item}
                    </p>
                  );
                })
              ) : (
                <p className="text-text-secondary">Informações detalhadas não disponíveis.</p>
              )}
            </div>

            {/* Links e Recursos do Projeto */}
            {linksArray.length > 0 && (
              <div className="bg-bg-surface rounded-2xl p-7 mb-6 shadow-light border border-border-color">
                <h2 className="font-title text-[1.2rem] font-bold text-text-primary m-0 mb-4 pb-2.5 border-b-2 border-border-color flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    🔗 Links e Recursos Relacionados
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-primary/10 text-purple-primary">
                    {linksArray.length} {linksArray.length === 1 ? 'recurso' : 'recursos'}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {linksArray.map((link, idx) => {
                    const isGithub = link.url.toLowerCase().includes('github.com') || link.nome.toLowerCase().includes('git');
                    const isFigma = link.url.toLowerCase().includes('figma.com') || link.nome.toLowerCase().includes('figma') || link.nome.toLowerCase().includes('protótipo');
                    const isDocs = link.url.toLowerCase().includes('docs') || link.url.toLowerCase().includes('notion') || link.url.toLowerCase().includes('drive.google') || link.nome.toLowerCase().includes('doc');
                    const isVideo = link.url.toLowerCase().includes('youtube.com') || link.url.toLowerCase().includes('youtu.be') || link.nome.toLowerCase().includes('vídeo') || link.nome.toLowerCase().includes('video');
                    
                    const icon = isGithub ? '🐙' : isFigma ? '🎨' : isVideo ? '▶️' : isDocs ? '📑' : '🌐';
                    const formattedUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`;

                    return (
                      <a
                        key={idx}
                        href={formattedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between p-3.5 rounded-xl bg-bg-primary hover:bg-purple-primary/5 border border-border-color hover:border-purple-primary/50 text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0 p-2 rounded-lg bg-bg-surface border border-border-color group-hover:border-purple-primary/40 transition-colors">
                            {icon}
                          </span>
                          <div className="min-w-0">
                            <span className="block font-bold text-xs sm:text-sm text-text-primary group-hover:text-purple-primary truncate">
                              {link.nome}
                            </span>
                            <span className="block text-[11px] text-text-secondary truncate mt-0.5">
                              {link.url}
                            </span>
                          </div>
                        </div>
                        <span className="text-text-secondary group-hover:text-purple-primary group-hover:translate-x-0.5 transition-transform text-xs shrink-0 ml-2 font-bold">
                          ↗
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Avaliações Reais */}
            <div className="bg-bg-surface rounded-2xl p-7 mb-6 shadow-light border border-border-color">
              <h2 className="font-title text-[1.2rem] font-bold text-text-primary m-0 mb-5 pb-2.5 border-b-2 border-border-color flex items-center justify-between">
                <span>⭐ Avaliações da Comunidade</span>
                <span className="text-sm font-normal text-text-secondary">{avaliacoes.length} no total</span>
              </h2>

              {/* Lista de Avaliações */}
              <div className="flex flex-col gap-4 mb-6">
                {avaliacoes.length === 0 ? (
                  <p className="text-text-secondary italic m-0">Nenhuma avaliação cadastrada ainda. Seja o primeiro a avaliar!</p>
                ) : (
                  avaliacoes.map((av, i) => (
                    <div key={i} className="p-4 rounded-xl bg-bg-primary border border-border-color flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[0.9rem] text-text-primary">👤 {av.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500 font-bold text-sm">{'★'.repeat(av.nota)}{'☆'.repeat(5 - av.nota)}</span>
                          <span className="text-xs text-text-secondary">{av.data}</span>
                        </div>
                      </div>
                      {av.comentario && (
                        <p className="text-[0.9rem] text-text-secondary m-0 mt-1 leading-relaxed">"{av.comentario}"</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Formulário de Envio de Avaliação */}
              {user ? (
                user.role === 'admin' ? null : (
                <form onSubmit={handleEnviarAvaliacao} className="pt-4 border-t border-border-color flex flex-col gap-3">
                  <h3 className="m-0 font-title text-sm font-bold text-purple-primary">Deixe sua avaliação</h3>
                  {msgAvaliacao && (
                    <div className="text-sm p-2 rounded bg-purple-primary/10 text-purple-primary font-medium">
                      {msgAvaliacao}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-text-secondary">Sua Nota:</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setMinhaNota(star)}
                          className={`text-2xl border-none bg-transparent cursor-pointer p-0 leading-none transition-transform hover:scale-125 ${star <= minhaNota ? 'text-yellow-500' : 'text-gray-300'}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-text-primary ml-1">{minhaNota} de 5 estrelas</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Escreva um comentário sobre o projeto ou a orientação (opcional)..."
                    value={meuComentario}
                    onChange={(e) => setMeuComentario(e.target.value)}
                    className="p-2.5 rounded-lg border border-border-color bg-bg-primary text-text-primary text-[0.9rem] outline-none focus:border-purple-primary"
                  />
                  <button
                    type="submit"
                    disabled={enviandoAvaliacao}
                    className="self-start px-5 py-2 bg-purple-primary text-white rounded-lg text-sm font-bold border-none cursor-pointer hover:bg-purple-hover transition-colors disabled:opacity-70"
                  >
                    {enviandoAvaliacao ? 'Enviando...' : 'Publicar Avaliação'}
                  </button>
                </form>
                )
              ) : (
                <p className="text-text-secondary italic text-sm m-0 pt-3 border-t border-border-color">
                  <Link to="/login" className="text-purple-primary font-semibold no-underline hover:underline">Faça login</Link> para avaliar este projeto.
                </p>
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="flex flex-col gap-4">
            <div className="bg-bg-surface rounded-2xl p-6 shadow-light border border-border-color">
              <h3 className="font-title text-[1rem] font-bold text-text-primary m-0 mb-4 pb-2 border-b-2 border-border-color">
                {user?.role === 'admin' ? 'Gerenciamento Administrativo' : 'Participação'}
              </h3>
              {user ? (
                <div className="flex flex-col gap-2.5">
                  {isAlunoCandidato && (
                    <Link 
                      to={`/projeto/${projeto.id}/candidatar`} 
                      className="block w-full text-center py-3 px-4 rounded-full bg-gradient-to-br from-purple-primary to-purple-hover text-white font-bold no-underline text-[0.95rem] shadow-[0_4px_16px_rgba(122,27,181,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(122,27,181,0.45)] hover:brightness-110 transition-all"
                    >
                      🚀 Me Candidatar
                    </Link>
                  )}
                  {podeEditar && (
                    <Link 
                      to={`/projeto/${projeto.id}/editar`}
                      className="block w-full text-center py-2.5 px-4 rounded-full bg-purple-primary text-white font-bold no-underline text-[0.88rem] hover:bg-purple-hover transition-all"
                    >
                      ✏️ Editar Projeto
                    </Link>
                  )}
                  <Link 
                    to={`/workspace/${projeto.id}`}
                    className="block w-full text-center py-2.5 px-4 rounded-full bg-transparent border-2 border-purple-primary text-purple-primary font-bold no-underline text-[0.88rem] hover:bg-purple-primary hover:text-white transition-all"
                  >
                    {user.role === 'admin' ? '💬 Supervisionar Workspace' : '💬 Acessar Workspace'}
                  </Link>
                  {podeExcluir && (
                    <button
                      type="button"
                      onClick={handleExcluirProjeto}
                      className="block w-full text-center py-2.5 px-4 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-[0.88rem] hover:bg-rose-500/20 transition-all cursor-pointer"
                    >
                      🗑️ Excluir Projeto
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-text-secondary text-[0.9rem] m-0 mb-3">Faça login para se candidatar às vagas deste projeto.</p>
                  <Link to="/login" className="block w-full text-center py-3 px-4 rounded-full bg-gradient-to-br from-purple-primary to-purple-hover text-white font-bold no-underline text-[0.95rem] shadow-[0_4px_16px_rgba(122,27,181,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(122,27,181,0.45)] hover:brightness-110 transition-all">
                    🔑 Fazer Login
                  </Link>
                </>
              )}
            </div>

            <div className="bg-bg-surface rounded-2xl p-6 shadow-light border border-border-color">
              <h3 className="font-title text-[1rem] font-bold text-text-primary m-0 mb-4 pb-2 border-b-2 border-border-color">
                Informações
              </h3>
              <div className="flex justify-between items-start gap-2 py-2.5 border-b border-border-color text-[0.88rem] flex-wrap">
                <span className="text-text-secondary">📌 Status</span>
                <strong className={statusClass}>{projeto.status || '—'}</strong>
              </div>
              <div className="flex justify-between items-start gap-2 py-2.5 border-b border-border-color text-[0.88rem] flex-wrap">
                <span className="text-text-secondary">🗂 Categoria</span>
                <strong>{projeto.categoria || '—'}</strong>
              </div>
              <div className="flex justify-between items-start gap-2 py-2.5 border-b border-border-color text-[0.88rem] flex-wrap">
                <span className="text-text-secondary">👨‍🏫 Professor</span>
                <strong>{projeto.professor || '—'}</strong>
              </div>
              {projeto.owner_username && (
                <div className="flex justify-between items-start gap-2 py-2.5 border-b border-border-color text-[0.88rem] flex-wrap">
                  <span className="text-text-secondary">👤 Líder / Autor</span>
                  <strong>{projeto.owner_username}</strong>
                </div>
              )}
              <div className="flex justify-between items-start gap-2 py-2.5 border-b border-border-color text-[0.88rem] flex-wrap">
                <span className="text-text-secondary">👥 Integrantes</span>
                <strong>{totalIntegrantes} {totalIntegrantes === 1 ? 'no time' : 'no time'}</strong>
              </div>
              {linksArray.length > 0 && (
                <div className="py-2.5 border-b border-border-color text-[0.88rem]">
                  <span className="text-text-secondary block mb-2 font-medium">🔗 Links do Projeto:</span>
                  <div className="flex flex-col gap-1.5">
                    {linksArray.map((link, idx) => {
                      const formattedUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                      return (
                        <a
                          key={idx}
                          href={formattedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-primary hover:text-purple-hover hover:underline truncate"
                          title={link.url}
                        >
                          <span className="shrink-0">🔗</span>
                          <span className="truncate">{link.nome}</span>
                          <span className="text-[10px] opacity-70 shrink-0">↗</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              {projeto.tags && (
                <div className="py-2.5 text-[0.88rem]">
                  <span className="text-text-secondary block mb-1.5">🏷️ Tags do Projeto:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {projeto.tags.split(',').map((t: string, idx: number) => {
                      const trimmed = t.trim();
                      if (!trimmed) return null;
                      return (
                        <Link 
                          key={idx} 
                          to={`/projetos?tag=${encodeURIComponent(trimmed.toLowerCase())}`}
                          className="inline-block px-2 py-0.5 bg-purple-primary/10 text-purple-primary rounded text-xs font-semibold hover:bg-purple-primary hover:text-white transition-colors no-underline"
                        >
                          #{trimmed}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Link to="/projetos" className="block text-center mt-2 text-purple-primary font-semibold text-[0.9rem] no-underline hover:underline">
              ← Voltar ao Catálogo de Projetos
            </Link>
          </aside>
          
        </div>
      </div>
    </div>
  );
}
