/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useUI } from '../components/UIProvider';

export function SubmissaoEditar() {
  const { avisar } = useUI();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nome_projeto: '',
    categoria: '',
    descricao: '',
    proponente: '',
    email: '',
    imagem: ''
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarSubmissao = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/submissao/${id}`);
        if (res.data.status === 'success' && res.data.submissao) {
          const s = res.data.submissao;
          setFormData({
            nome_projeto: s.nome_projeto || '',
            categoria: s.categoria || '',
            descricao: s.descricao || '',
            proponente: s.proponente || '',
            email: s.email || '',
            imagem: s.imagem || ''
          });
        } else {
          setError(res.data.message || 'Erro ao carregar proposta');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar proposta.');
      } finally {
        setLoading(false);
      }
    };
    if (id) carregarSubmissao();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'imagem') data.append(key, value);
    });
    if (logo) data.append('logo', logo);

    try {
      // Endpoint fake
      const res = await api.post(`/submissao/${id}/editar`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.status === 'success' || res.status === 200) {
        avisar("✅ Proposta editada com sucesso!");
        navigate('/perfil');
      } else {
        setError(res.data.message || 'Erro ao editar proposta');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao editar proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="w-[90%] max-w-[1200px] mx-auto my-8">
      <h1 className="text-purple-primary font-title text-3xl font-bold m-0 mb-1.5 transition-colors">
        Editar Proposta de Projeto
      </h1>
      <p className="m-0 mb-6 text-text-primary">
        Ajuste os dados da sua proposta de projeto abaixo.
      </p>

      {error && (
        <div className="mb-4 bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] text-[#721c24] p-2.5 rounded-md text-sm font-medium">
          ❌ {error}
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="max-w-[800px] mx-auto bg-bg-surface p-10 rounded-xl shadow-light flex flex-col gap-5 transition-all"
      >
        <div className="flex flex-col">
          <label htmlFor="nome_projeto" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5 transition-colors">Nome do Projeto:</label>
          <input 
            type="text" 
            id="nome_projeto" 
            name="nome_projeto" 
            required 
            value={formData.nome_projeto}
            onChange={handleChange}
            className="p-3 border-[1.5px] border-border-color rounded-md text-[0.95rem] bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="categoria" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5 transition-colors">Categoria:</label>
          <select 
            id="categoria" 
            name="categoria" 
            required
            value={formData.categoria}
            onChange={handleChange}
            className="p-3 border-[1.5px] border-border-color rounded-md text-[0.95rem] bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
          >
            <option value="Responsabilidade Social">Responsabilidade Social</option>
            <option value="Projetos do CEUB">Projetos do CEUB</option>
            <option value="Empresas do Setor Privado">Empresas do Setor Privado</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="descricao" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5 transition-colors">Descrição:</label>
          <textarea 
            id="descricao" 
            name="descricao" 
            rows={4} 
            required
            value={formData.descricao}
            onChange={handleChange}
            className="p-3 border-[1.5px] border-border-color rounded-md text-[0.95rem] bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none resize-y"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label htmlFor="proponente" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5 transition-colors">Proponente (Aluno / Professor / Empresa):</label>
            <input 
              type="text" 
              id="proponente" 
              name="proponente" 
              required 
              value={formData.proponente}
              onChange={handleChange}
              className="p-3 border-[1.5px] border-border-color rounded-md text-[0.95rem] bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5 transition-colors">E-mail de Contato:</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              value={formData.email}
              onChange={handleChange}
              className="p-3 border-[1.5px] border-border-color rounded-md text-[0.95rem] bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="logo" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5 transition-colors">Logo ou Foto do Projeto (Opcional - deixe vazio para manter a atual):</label>
          {formData.imagem && (
            <p className="text-[0.9rem] text-text-secondary mb-1">
              Imagem atual: <a href={`/static/${formData.imagem}`} target="_blank" rel="noreferrer" className="text-purple-primary">Visualizar</a>
            </p>
          )}
          <input 
            type="file" 
            id="logo" 
            name="logo" 
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setLogo(e.target.files[0]);
              }
            }}
            className="bg-bg-primary p-2.5 rounded-md border border-border-color text-text-primary w-full transition-colors"
          />
        </div>

        <div className="flex gap-2.5 mt-4">
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-purple-primary text-white border-none py-3 px-6 rounded-md text-base font-bold cursor-pointer transition-colors hover:bg-purple-hover disabled:opacity-70"
          >
            {submitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <Link 
            to="/perfil" 
            className="bg-transparent border-[1.5px] border-border-color text-text-primary py-3 px-6 rounded-md text-base font-bold text-center transition-colors hover:bg-border-color no-underline"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
