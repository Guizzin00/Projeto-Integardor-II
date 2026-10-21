import { useState } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../components/UIProvider';

export function Submissao() {
  const { avisar } = useUI();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome_projeto: '',
    categoria: '',
    descricao: '',
    proponente: '',
    email: '',
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => data.append(key, value));
    if (logo) data.append('logo', logo);

    try {
      // Endpoint que precisa ser refatorado no backend depois
      const res = await api.post('/submissao', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.status === 'success' || res.status === 200) {
        avisar("✅ Proposta enviada com sucesso!");
        navigate('/perfil');
      } else {
        setError(res.data.message || 'Erro ao enviar proposta');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-[90%] max-w-[1200px] mx-auto my-8">
      <h2 className="text-purple-primary font-title text-3xl font-bold m-0 mb-1.5 transition-colors">
        Submissão de Novo Projeto
      </h2>
      <p className="m-0 mb-6 text-text-primary">
        Preencha o formulário abaixo para propor um novo projeto acadêmico ou institucional de TI.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-md text-sm font-medium">
          ❌ {error}
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="max-w-[800px] mx-auto bg-bg-surface p-10 rounded-xl shadow-light flex flex-col gap-5 transition-all"
      >
        <div className="flex flex-col">
          <label htmlFor="nome_projeto" className="font-semibold text-purple-primary mb-1.5 transition-colors">Nome do Projeto:</label>
          <input 
            type="text" 
            id="nome_projeto" 
            name="nome_projeto" 
            required 
            value={formData.nome_projeto}
            onChange={handleChange}
            className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="categoria" className="font-semibold text-purple-primary mb-1.5 transition-colors">Categoria:</label>
          <select 
            id="categoria" 
            name="categoria" 
            required
            value={formData.categoria}
            onChange={handleChange}
            className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:outline-none"
          >
            <option value="">Selecione...</option>
            <option value="Responsabilidade Social">Responsabilidade Social</option>
            <option value="Projetos do CEUB">Projetos do CEUB</option>
            <option value="Empresas do Setor Privado">Empresas do Setor Privado</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="descricao" className="font-semibold text-purple-primary mb-1.5 transition-colors">Descrição:</label>
          <textarea 
            id="descricao" 
            name="descricao" 
            rows={4} 
            required
            value={formData.descricao}
            onChange={handleChange}
            className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:outline-none resize-y"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label htmlFor="proponente" className="font-semibold text-purple-primary mb-1.5 transition-colors">Proponente (Aluno / Professor / Empresa):</label>
            <input 
              type="text" 
              id="proponente" 
              name="proponente" 
              required 
              value={formData.proponente}
              onChange={handleChange}
              className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email" className="font-semibold text-purple-primary mb-1.5 transition-colors">E-mail de Contato:</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              value={formData.email}
              onChange={handleChange}
              className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary transition-colors focus:border-purple-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="logo" className="font-semibold text-purple-primary mb-1.5 transition-colors">Logo ou Foto do Projeto (Opcional):</label>
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

        <button 
          type="submit" 
          disabled={submitting}
          className="self-start bg-purple-primary text-text-on-purple border-none py-3 px-6 rounded-md text-base font-bold cursor-pointer transition-colors hover:bg-purple-hover disabled:opacity-70 mt-2"
        >
          {submitting ? 'Enviando...' : 'Enviar Proposta'}
        </button>
      </form>
    </div>
  );
}
