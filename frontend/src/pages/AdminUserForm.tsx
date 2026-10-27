/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../components/UIProvider';

export function AdminUserForm() {
  const { avisar } = useUI();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    matricula: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/admin/usuario/${id}`);
        if (res.data.status === 'success' && res.data.user) {
          setFormData({
            username: res.data.user.username || '',
            matricula: res.data.user.matricula || '',
            password: '',
            role: res.data.user.role || 'user'
          });
        } else {
          setError(res.data.message || 'Erro ao carregar usuário');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar usuário.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      carregarUsuario();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const url = id ? `/admin/usuario/${id}/editar` : `/admin/usuario/novo`;
      const res = await api.post(url, formData);
      if (res.data.status === 'success' || res.status === 200) {
        avisar(`✅ Usuário ${id ? 'editado' : 'criado'} com sucesso!`);
        navigate('/admin');
      } else {
        setError(res.data.message || 'Erro ao salvar usuário');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  const isSelf = currentUser?.username === formData.username;

  return (
    <div className="max-w-[800px] mx-auto my-8 bg-bg-surface p-10 rounded-xl shadow-light transition-all flex flex-col gap-5">
      <h1 className="text-purple-primary m-0 mb-1.5 border-l-[5px] border-purple-primary pl-2.5 font-title text-2xl font-bold">
        {id ? 'Editar' : 'Criar Novo'} Usuário
      </h1>
      <p className="m-0 text-text-primary text-[0.95rem]">
        Defina as credenciais e o nível de acesso do usuário no sistema.
      </p>

      {error && (
        <div className="bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] text-[#721c24] p-2.5 rounded-md text-sm font-medium">
          ❌ {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col">
          <label htmlFor="username" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5">
            Nome de Usuário (Username):
          </label>
          <input 
            type="text" 
            id="username" 
            name="username" 
            required 
            placeholder="Ex: professor.jose"
            value={formData.username}
            onChange={handleChange}
            className="p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="matricula" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5">
            Matrícula CEUB (Opcional):
          </label>
          <input 
            type="text" 
            id="matricula" 
            name="matricula" 
            placeholder="Ex: 23101234"
            value={formData.matricula}
            onChange={handleChange}
            className="p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
          />
        </div>
        
        <div className="flex flex-col">
          <label htmlFor="password" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5">
            Senha:
          </label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            required={!id}
            placeholder={id ? "Deixe em branco para não alterar" : "Senha de acesso"}
            value={formData.password}
            onChange={handleChange}
            className="p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="role" className="font-semibold text-[0.9rem] text-purple-primary mb-1.5">
            Papel / Nível de Acesso (Role):
          </label>
          <select 
            id="role" 
            name="role" 
            required 
            disabled={isSelf}
            value={formData.role}
            onChange={handleChange}
            className="p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] focus:outline-none"
          >
            <option value="user">Usuário Comum (user)</option>
            <option value="admin">Administrador do Sistema (admin)</option>
            <option value="coordenador">Coordenador Acadêmico (coordenador)</option>
            <option value="professor">Professor Orientador (professor)</option>
            <option value="empresa">Empresa Representante (empresa)</option>
            <option value="cliente">Cliente PO (cliente)</option>
            <option value="aluno">Aluno Candidato/Membro (aluno)</option>
            <option value="lider">Líder da Equipe / Scrum Master (lider)</option>
          </select>
          {isSelf && (
            <small className="text-[#f39c12] block mt-2 font-medium">⚠️ Você não pode alterar o seu próprio papel.</small>
          )}
        </div>
        
        <div className="mt-6 flex gap-2.5">
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-purple-primary text-white border-none py-3 px-6 rounded-md text-base font-bold cursor-pointer transition-colors hover:bg-purple-hover disabled:opacity-70"
          >
            {submitting ? 'Salvando...' : 'Salvar Usuário'}
          </button>
          <Link 
            to="/admin" 
            className="bg-transparent border-[1.5px] border-border-color text-text-primary py-3 px-6 rounded-md text-base font-bold text-center transition-colors hover:bg-border-color no-underline flex items-center justify-center"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
