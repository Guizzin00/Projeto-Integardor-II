import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../components/UIProvider';

export function AdminForm() {
  const { avisar } = useUI();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    titulo: '',
    categoria: '',
    status: '',
    professor: '',
    descricao_curta: '',
    tags: '',
    detalhes: '',
    imagem: ''
  });
  
  const [titulosOriginais, setTitulosOriginais] = useState<string[]>([]);
  const [links, setLinks] = useState<{ nome: string; url: string }[]>([]);
  const [imagemCapa, setImagemCapa] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const carregarProjeto = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/projeto/${id}`);
        const p = res.data.projeto || res.data;
        if (p && p.titulo) {
          let detalhesText = '';
          setTitulosOriginais(Array.isArray(p.detalhes) ? p.detalhes.filter((i: any) => i && typeof i === 'object' && i.titulo).map((i: any) => String(i.titulo)) : []);
          if (Array.isArray(p.detalhes)) {
            detalhesText = p.detalhes.map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                return (item.titulo ? item.titulo + ': ' : '') + (item.conteudo || '');
              }
              return String(item);
            }).join('\n');
          } else if (p.detalhes) {
            detalhesText = String(p.detalhes);
          }

          setFormData({
            titulo: p.titulo || '',
            categoria: p.categoria || '',
            status: p.status || 'DISPONÍVEL',
            professor: p.professor || '',
            descricao_curta: p.descricao_curta || '',
            tags: p.tags || '',
            detalhes: detalhesText,
            imagem: p.imagem || ''
          });

          if (p.links && typeof p.links === 'object') {
            const arr = Object.entries(p.links).map(([nome, url]) => ({ nome, url: String(url) }));
            setLinks(arr.length > 0 ? arr : [{ nome: '', url: '' }]);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar projeto.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      carregarProjeto();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLinkChange = (index: number, field: 'nome' | 'url', value: string) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const addLink = () => {
    setLinks([...links, { nome: '', url: '' }]);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'imagem' && key !== 'detalhes') data.append(key, value);
    });

    // Reconstrói os itens "Título: conteúdo" para preservar a estrutura original dos detalhes
    const itensDetalhes = formData.detalhes
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(linha => {
        const titulo = titulosOriginais.find(t => linha.startsWith(`${t}: `));
        return titulo ? { titulo, conteudo: linha.slice(titulo.length + 2) } : linha;
      });
    data.append('detalhes_json', JSON.stringify(itensDetalhes));
    
    links.forEach(l => {
      data.append('link_nome[]', l.nome);
      data.append('link_url[]', l.url);
    });
    
    if (imagemCapa) data.append('imagem_capa', imagemCapa);

    try {
      const url = id ? `/admin/projeto/${id}/editar` : `/admin/projeto/novo`;
      const res = await api.post(url, data, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (res.data.status === 'success' || res.status === 200) {
        avisar(`✅ Projeto ${id ? 'editado' : 'criado'} com sucesso!`);
        navigate(user?.role === 'admin' ? '/admin' : `/projeto/${id}`);
      } else {
        setError(res.data.message || 'Erro ao salvar projeto');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar projeto.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="max-w-[700px] mx-auto my-12 bg-bg-surface p-10 rounded-xl shadow-light transition-all">
      <h1 className="text-purple-primary text-[1.8rem] text-center mb-6 font-title font-bold m-0">
        {id ? 'Editar' : 'Novo'} Projeto
      </h1>

      {error && (
        <div className="mb-4 bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] text-[#721c24] p-2.5 rounded-md text-sm font-medium">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col">
          <label htmlFor="titulo" className="font-semibold text-purple-primary mb-1.5">Título:</label>
          <input 
            type="text" id="titulo" name="titulo" required 
            value={formData.titulo} onChange={handleChange}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="categoria" className="font-semibold text-purple-primary mb-1.5">Categoria:</label>
          <select 
            id="categoria" name="categoria" required 
            value={formData.categoria} onChange={handleChange}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none"
          >
            <option value="" disabled>Selecione uma categoria</option>
            <option value="Responsabilidade Social">Responsabilidade Social</option>
            <option value="Projetos do CEUB">Projetos do CEUB</option>
            <option value="Empresas do Setor Privado">Empresas do Setor Privado</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="status" className="font-semibold text-purple-primary mb-1.5">Status:</label>
          <select 
            id="status" name="status" required 
            value={formData.status} onChange={handleChange}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none"
          >
            <option value="" disabled>Selecione o status</option>
            <option value="DISPONÍVEL">Disponível</option>
            <option value="EM EXECUÇÃO">Em Execução</option>
            <option value="CONCLUÍDO">Concluído</option>
            <option value="INDISPONÍVEL">Indisponível</option>
            {formData.status && !['DISPONÍVEL','EM EXECUÇÃO','CONCLUÍDO','INDISPONÍVEL'].includes(formData.status) && (
              <option value={formData.status}>{formData.status}</option>
            )}
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="professor" className="font-semibold text-purple-primary mb-1.5">Professor:</label>
          <input 
            type="text" id="professor" name="professor" 
            value={formData.professor} onChange={handleChange}
            disabled={user?.role !== 'admin'}
            title={user?.role !== 'admin' ? 'Somente o administrador altera o professor responsável' : undefined}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="descricao_curta" className="font-semibold text-purple-primary mb-1.5">Descrição curta:</label>
          <textarea 
            id="descricao_curta" name="descricao_curta" rows={2} 
            value={formData.descricao_curta} onChange={handleChange}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none resize-y"
          ></textarea>
        </div>

        <div className="flex flex-col">
          <label htmlFor="tags" className="font-semibold text-purple-primary mb-1.5">
            Tags / Tecnologias <small className="font-normal text-text-secondary">(separadas por vírgula; usadas nas recomendações aos alunos)</small>:
          </label>
          <input 
            type="text" id="tags" name="tags" 
            placeholder="Ex: React, Python, Mobile"
            value={formData.tags} onChange={handleChange}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="detalhes" className="font-semibold text-purple-primary mb-1.5">
            Detalhes (Pressione Enter para criar novos parágrafos):
          </label>
          <textarea 
            id="detalhes" name="detalhes" rows={6} 
            placeholder="Escreva os parágrafos de detalhes aqui..."
            value={formData.detalhes} onChange={handleChange}
            className="p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] focus:outline-none resize-y"
          ></textarea>
        </div>

        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <label className="m-0 font-semibold text-purple-primary">🔗 Links Relacionados:</label>
            <button type="button" onClick={addLink} className="bg-transparent border-[1.5px] border-purple-primary text-purple-primary px-3 py-1.5 rounded-md cursor-pointer text-[0.85rem] font-semibold transition-all hover:bg-purple-primary hover:text-white">
              ➕ Adicionar Link
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {links.map((link, index) => (
              <div key={index} className="flex gap-2.5 items-center animate-[fadeIn_0.2s_ease]">
                <input 
                  type="text" placeholder="Nome (ex: GitHub)" required 
                  value={link.nome} onChange={(e) => handleLinkChange(index, 'nome', e.target.value)}
                  className="flex-1 p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:outline-none"
                />
                <input 
                  type="url" placeholder="URL completa (ex: https://...)" required 
                  value={link.url} onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                  className="flex-[2] p-2.5 border border-border-color rounded-lg text-base bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:outline-none"
                />
                <button 
                  type="button" onClick={() => removeLink(index)} title="Remover Link"
                  className="bg-[#ef4444] text-white border-none rounded-lg w-[38px] h-[38px] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[#dc2626] transition-colors"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="imagem_capa" className="font-semibold text-purple-primary mb-1.5">
            Imagem de Capa (Opcional - deixe vazio para manter a atual):
          </label>
          {formData.imagem && (
            <p className="text-[0.9rem] text-text-secondary mb-1.5">
              Capa atual: <a href={`/static/${formData.imagem}`} target="_blank" rel="noreferrer" className="text-purple-primary">Visualizar</a>
            </p>
          )}
          <input 
            type="file" id="imagem_capa" name="imagem_capa" accept="image/*" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setImagemCapa(e.target.files[0]);
              }
            }}
            className="bg-bg-primary text-text-primary p-2.5 rounded-lg border border-border-color w-full box-border"
          />
        </div>

        <div className="flex gap-2.5 mt-6">
          <button 
            type="submit" disabled={submitting}
            className="flex-1 bg-purple-primary text-text-on-purple border-none rounded-lg p-3 text-base font-bold cursor-pointer transition-colors hover:bg-purple-hover disabled:opacity-70"
          >
            {submitting ? 'Salvando...' : 'Salvar Projeto'}
          </button>
          <Link 
            to={user?.role === 'admin' ? '/admin' : (id ? `/projeto/${id}` : '/perfil')} 
            className="flex-1 bg-transparent border-[1.5px] border-border-color text-text-primary rounded-lg p-3 text-base font-bold text-center no-underline transition-colors hover:bg-border-color flex items-center justify-center"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
