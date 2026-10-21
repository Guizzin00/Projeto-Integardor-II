import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUI } from '../components/UIProvider';

export function Candidatura() {
  const { avisar } = useUI();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [projeto, setProjeto] = useState<any>(null);
  const [motivo, setMotivo] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjeto = async () => {
      try {
        const response = await api.get(`/projeto/${id}`);
        if (response.data.status === 'success') {
          setProjeto(response.data.projeto);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjeto();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/projeto/${id}/candidatar`, { motivo, experiencia });
      if (res.data.status === 'success') {
        avisar("✅ Sua candidatura foi enviada com sucesso!");
        navigate(`/projeto/${id}`);
      } else {
        setError(res.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar candidatura.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto my-8 bg-bg-surface p-10 rounded-xl shadow-light transition-all flex flex-col gap-5">
      <h2 className="text-purple-primary m-0 mb-1.5 border-l-[5px] border-purple-primary pl-2.5 font-title text-2xl font-bold">
        Candidatar-se ao Projeto
      </h2>
      <p className="m-0 text-text-primary text-[0.95rem]">
        Você está se candidatando para: <strong>{projeto?.titulo}</strong>
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-md text-sm font-medium">
          ❌ {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col">
          <label htmlFor="motivo" className="font-semibold text-purple-primary mb-1.5">
            Por que você quer participar deste projeto?
          </label>
          <textarea 
            id="motivo" 
            rows={4} 
            required 
            placeholder="Explique seu interesse e motivação..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary resize-y transition-all focus:border-purple-primary focus:outline-none"
          ></textarea>
        </div>
        
        <div className="flex flex-col mt-4">
          <label htmlFor="experiencia" className="font-semibold text-purple-primary mb-1.5">
            Qual sua experiência prévia? (Opcional)
          </label>
          <textarea 
            id="experiencia" 
            rows={3} 
            placeholder="Linguagens, frameworks, cursos..."
            value={experiencia}
            onChange={(e) => setExperiencia(e.target.value)}
            className="p-3 border border-border-color rounded-md text-base bg-bg-primary text-text-primary resize-y transition-all focus:border-purple-primary focus:outline-none"
          ></textarea>
        </div>
        
        <div className="mt-6 flex gap-2.5">
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-purple-primary text-text-on-purple border-none py-3 px-6 rounded-md text-base font-bold cursor-pointer transition-colors hover:bg-purple-hover disabled:opacity-70"
          >
            {submitting ? 'Enviando...' : 'Enviar Candidatura'}
          </button>
          <Link 
            to={`/projeto/${id}`} 
            className="bg-[#ccc] text-[#333] py-3 px-6 rounded-md text-base font-bold no-underline hover:bg-[#bbb] transition-colors inline-block"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
