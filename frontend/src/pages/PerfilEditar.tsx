import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useUI } from '../components/UIProvider';
import { validarSenha, DICA_SENHA } from '../utils/senha';

export function PerfilEditar() {
  const { avisar } = useUI();
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [emailSecundario, setEmailSecundario] = useState('');
  const [bio, setBio] = useState('');
  const [interesses, setInteresses] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fill initial values from user context if available
    if (user) {
      setEmail(user.email || '');
      setEmailSecundario(user.email_secundario || '');
      setBio(user.bio || '');
      setInteresses(user.interesses || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (novaSenha && novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      setSubmitting(false);
      return;
    }

    if (novaSenha) {
      const erroSenha = validarSenha(novaSenha);
      if (erroSenha) {
        setError(erroSenha);
        setSubmitting(false);
        return;
      }
    }

    try {
      const payload = {
        email,
        email_secundario: emailSecundario,
        bio,
        interesses,
        ...(novaSenha ? { nova_senha: novaSenha, confirmar_senha: confirmarSenha } : {})
      };

      const res = await api.post('/perfil/editar', payload);
      if (res.data.status === 'success') {
        if (res.data.user) login(res.data.user);
        avisar("✅ Perfil atualizado com sucesso!");
        navigate('/perfil');
      } else {
        setError(res.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao atualizar perfil.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="w-[90%] max-w-[620px] mx-auto py-10">
      <div className="mb-8">
        <Link to="/perfil" className="text-purple-primary no-underline text-[0.9rem] font-semibold hover:underline">
          ← Voltar ao Perfil
        </Link>
      </div>

      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-primary to-purple-hover text-white rounded-full flex items-center justify-center font-title text-3xl font-bold shrink-0 shadow-[0_4px_16px_rgba(122,27,181,0.3)]">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="m-0 text-[1.6rem] font-title font-bold text-text-primary">Editar Perfil</h1>
          <p className="m-0 text-text-secondary text-[0.95rem]">@{user.username}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] text-[#721c24] p-2.5 rounded-md text-[0.82rem] font-medium">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-bg-surface p-8 rounded-2xl shadow-light transition-all border border-border-color">
        
        <div className="font-title font-bold text-base text-purple-primary border-b-2 border-border-color pb-1.5 mb-5">
          Informações Pessoais
        </div>

        <div className="mb-5 flex flex-col">
          <label htmlFor="email" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">📧 E-mail</label>
          <input 
            type="email" 
            id="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" 
            className="w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)]"
          />
        </div>

        <div className="mb-5 flex flex-col">
          <label htmlFor="email_secundario" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">
            📨 E-mail Secundário <small className="text-text-secondary font-normal">(opcional, usado para recuperar o acesso)</small>
          </label>
          <input 
            type="email" 
            id="email_secundario" 
            value={emailSecundario}
            onChange={(e) => setEmailSecundario(e.target.value)}
            placeholder="email.alternativo@exemplo.com" 
            className="w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)]"
          />
        </div>

        <div className="mb-5 flex flex-col">
          <label htmlFor="bio" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">
            📝 Bio <small className="text-text-secondary font-normal">(máx. 300 caracteres)</small>
          </label>
          <textarea 
            id="bio" 
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Conte um pouco sobre você..."
            className="w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)] resize-y min-h-[80px]"
          ></textarea>
          <div className="text-right text-[0.78rem] text-text-secondary mt-1">
            <span>{bio.length}</span>/300
          </div>
        </div>

        <div className="mb-5 flex flex-col">
          <label htmlFor="interesses" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">
            ✨ Meus Interesses de Tecnologia <small className="text-text-secondary font-normal">(Separados por vírgula)</small>
          </label>
          <input 
            type="text" 
            id="interesses" 
            value={interesses}
            onChange={(e) => setInteresses(e.target.value)}
            placeholder="Ex: React, Django, UX Design, Data Science" 
            maxLength={300}
            className="w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)]"
          />
        </div>

        <div className="font-title font-bold text-base text-purple-primary border-b-2 border-border-color pb-1.5 mb-5 mt-6">
          Alterar Senha <small className="font-normal text-text-secondary">(deixe em branco para manter)</small>
        </div>

        <div className="mb-5 flex flex-col">
          <label htmlFor="nova_senha" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">🔑 Nova Senha</label>
          <input 
            type="password" 
            id="nova_senha" 
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Mínimo 8, com letras e números"
            title={DICA_SENHA} 
            className="w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)]"
          />
        </div>

        <div className="mb-5 flex flex-col">
          <label htmlFor="confirmar_senha" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">🔑 Confirmar Nova Senha</label>
          <input 
            type="password" 
            id="confirmar_senha" 
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="Repita a nova senha" 
            className="w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-purple-primary focus:shadow-[0_0_0_3px_rgba(122,27,181,0.15)]"
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="w-full mt-4 bg-purple-primary text-white border-none py-3 px-5 rounded-md font-bold text-base cursor-pointer hover:bg-purple-hover transition-colors shadow-sm disabled:opacity-70"
        >
          {submitting ? 'Salvando...' : '💾 Salvar Alterações'}
        </button>
      </form>
    </div>
  );
}
