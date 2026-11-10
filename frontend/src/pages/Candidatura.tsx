/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUI } from '../components/UIProvider';
import { useAuth } from '../contexts/AuthContext';
import { CamposCandidatura, erroCandidatura } from '../components/CamposCandidatura';

export function Candidatura() {
  const { user } = useAuth();
  const { avisar } = useUI();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [projeto, setProjeto] = useState<any>(null);
  const [motivo, setMotivo] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Evita repetir o aviso: `avisar` muda a cada aviso exibido e reexecuta o efeito
  const redirecionado = useRef(false);

  useEffect(() => {
    const fetchProjeto = async () => {
      try {
        const response = await api.get(`/projeto/${id}`);
        if (response.data.status === 'success') {
          const proj = response.data.projeto;
          setProjeto(proj);

          // Bloqueia dono / criador / orientador, quem já participa, não-alunos e projetos fechados
          let bloqueio = '';
          if (user && (
            proj.owner_username?.toLowerCase() === user.username?.toLowerCase() ||
            (proj.owner_id && proj.owner_id === user.id) ||
            proj.professor?.toLowerCase() === user.username?.toLowerCase() ||
            (proj.professor_id && proj.professor_id === user.id) ||
            proj.orientador?.username?.toLowerCase() === user.username?.toLowerCase()
          )) {
            bloqueio = "⚠️ Você é o líder/autor deste projeto e já faz parte da equipe. Não é permitido se candidatar ao próprio projeto.";
          } else if (proj.minha_candidatura) {
            bloqueio = "ℹ️ Você já possui uma candidatura ou participação neste projeto.";
          } else if (user && !['aluno', 'lider', 'user'].includes(user.role)) {
            bloqueio = "ℹ️ Apenas alunos podem se candidatar a projetos.";
          } else if (!['DISPONÍVEL', 'EM EXECUÇÃO'].includes(proj.status)) {
            bloqueio = "ℹ️ Este projeto não está recebendo candidaturas.";
          }
          if (bloqueio && !redirecionado.current) {
            redirecionado.current = true;
            avisar(bloqueio, "info");
            navigate(`/projeto/${id}`, { replace: true });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjeto();
  }, [id, user, navigate, avisar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const erroLocal = erroCandidatura(motivo);
    if (erroLocal) {
      setError(erroLocal);
      return;
    }
    setSubmitting(true);
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
      <h1 className="text-purple-primary m-0 mb-1.5 border-l-[5px] border-purple-primary pl-2.5 font-title text-2xl font-bold">
        Candidatar-se ao Projeto
      </h1>
      <p className="m-0 text-text-primary text-[0.95rem]">
        Você está se candidatando para: <strong>{projeto?.titulo}</strong>
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-md text-sm font-medium">
          ❌ {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <CamposCandidatura
          motivo={motivo}
          experiencia={experiencia}
          onMotivo={setMotivo}
          onExperiencia={setExperiencia}
        />
        
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
