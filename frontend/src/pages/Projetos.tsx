import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';

interface Projeto {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  descricao_curta: string;
  imagem: string;
  professor: string;
  tags: string;
}

export function Projetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const selectedTag = searchParams.get('tag') || '';
  const [searchInput, setSearchInput] = useState('');
  
  // Extrai tags unicas (simulando backend)
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchProjetos = async () => {
      try {
        const response = await api.get('/projetos');
        const projs = response.data.projetos || [];
        setProjetos(projs);
        
        // Simular a extração de tags do backend
        const tagsSet = new Set<string>();
        projs.forEach((p: Projeto) => {
          if (p.tags) {
            p.tags.split(',').forEach(t => tagsSet.add(t.trim().toLowerCase()));
          }
        });
        setUniqueTags(Array.from(tagsSet).filter(t => t));
      } catch (error) {
        console.error("Erro ao buscar projetos", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjetos();
  }, []);

  const filteredProjetos = projetos.filter(p => {
    let match = true;
    if (selectedTag) {
      match = p.tags?.toLowerCase().includes(selectedTag);
    }
    if (match && searchInput) {
      const q = searchInput.toLowerCase();
      match = p.titulo.toLowerCase().includes(q) || 
              p.professor.toLowerCase().includes(q) ||
              p.categoria.toLowerCase().includes(q);
    }
    return match;
  });

  return (
    <div className="ceub-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', margin: '0 0 0.4rem' }}>
          📂 Projetos de TI
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0' }}>
          Explore os projetos de tecnologia desenvolvidos no UniCEUB.
        </p>
      </div>

      <div className="projects-layout" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        <div className="tags-sidebar" style={{ flex: '0 0 240px', minWidth: '200px' }}>
          <h3 style={{ fontSize: '1.1rem', marginTop: '0', marginBottom: '1rem', fontFamily: 'var(--font-title)' }}>Filtro por Tags</h3>
          
          {selectedTag && (
            <div style={{ marginBottom: '1rem' }}>
              <Link to="/projetos" className="btn-sm btn-delete" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Limpar Filtro [x]
              </Link>
            </div>
          )}
          
          <div className="tags-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uniqueTags.map((tag) => (
              <Link 
                key={tag}
                to={`/projetos?tag=${tag}`}
                className={`sidebar-tag-link ${tag === selectedTag ? 'active' : ''}`}
                style={{ 
                  textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', 
                  border: '1px solid var(--border-color)', fontSize: '0.85rem', 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  color: 'var(--text-primary)', transition: 'all 0.2s' 
                }}
              >
                <span># {tag}</span>
                {tag === selectedTag && <span style={{ color: 'var(--purple-primary)' }}>✓</span>}
              </Link>
            ))}
            {uniqueTags.length === 0 && !loading && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Nenhuma tag cadastrada.</p>
            )}
          </div>
        </div>

        <div className="projects-content" style={{ flex: '1', minWidth: '300px' }}>
          
          <div className="search-filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="🔍  Filtrar nesta página por título ou professor..."
              className="search-input" 
              autoComplete="off" 
              style={{ width: '100%', padding: '0.7rem 1rem', border: '1.5px solid var(--border-color)', borderRadius: '50px', fontSize: '0.95rem', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          <div id="results-count" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Exibindo <strong id="count-num">{filteredProjetos.length}</strong> projetos nesta página
            {selectedTag && <span> filtrados pela tag <strong>#{selectedTag}</strong></span>}
          </div>

          <div className="card-grid" id="projects-grid">
            {loading ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>Carregando...</div>
            ) : filteredProjetos.length > 0 ? (
              filteredProjetos.map(p => (
                <Link key={p.id} to={`/projeto/${p.id}`} className="card-link">
                  <div className="card">
                    <div className={`card-cover-wrapper ${p.imagem.includes('default_capa_1') ? 'cover-grad-1' : p.imagem.includes('default_capa_2') ? 'cover-grad-2' : p.imagem.includes('default_capa_3') ? 'cover-grad-3' : ''}`}>
                      <img 
                        src={p.imagem.startsWith('http') ? p.imagem : `/static/${p.imagem}`} 
                        className={`card-cover ${p.imagem.includes('default_capa') ? 'is-default-cover' : ''}`}
                        alt={`Capa do projeto ${p.titulo}`}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = '/static/default_capa_1.jpg'; }}
                      />
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h2 style={{ fontSize: '1rem', margin: '0', fontFamily: 'var(--font-title)', lineHeight: '1.3' }}>{p.titulo}</h2>
                        <span className={`badge ${p.status.includes('CONCLUÍDO') ? 'status-green' : p.status.includes('EXECUÇÃO') ? 'status-orange' : p.status.includes('INDISPONÍVEL') ? 'status-red' : 'status-gray'}`}
                              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{p.status}</span>
                      </div>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--purple-primary)', fontWeight: 600 }}>
                        👨‍🏫 Orientador: {p.professor}
                      </p>
                      <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {p.descricao_curta.length > 100 ? p.descricao_curta.substring(0, 100) + '…' : p.descricao_curta}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="categoria-tag" style={{ display: 'inline-block', background: 'rgba(122,27,181,0.08)', color: 'var(--purple-primary)', borderRadius: '50px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>{p.categoria}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Ver detalhes →</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                <h3 style={{ fontFamily: 'var(--font-title)', margin: '0 0 0.5rem' }}>Nenhum projeto nesta página</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Tente voltar ou limpar os filtros de tags.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
