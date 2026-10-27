/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';

export function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await api.post('/recuperar-senha', { email: email.trim() });
      if (res.data.status === 'success') {
        setMessage(res.data.message || 'Se o e-mail estiver cadastrado, as instruções de recuperação foram enviadas.');
      } else {
        setError(res.data.message || 'Não foi possível processar a solicitação.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha de comunicação com o servidor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center px-4 py-12 bg-bg-primary transition-colors">
      <div className="w-full max-w-md bg-bg-surface border border-border-color rounded-md shadow-sm p-8 transition-colors">
        
        {/* Cabeçalho Institucional */}
        <div className="text-center pb-6 mb-6 border-b border-border-color">
          <Link to="/" className="inline-block mb-4">
            <img 
              src="/static/logoCEUB.png?v=2" 
              alt="UniCEUB" 
              className="h-10 w-auto mx-auto object-contain transition-all dark:invert dark:brightness-0" 
              onError={(e) => { e.currentTarget.src = 'https://www.uniceub.br/imagens/logoCEUB2021.png'; }}
            />
          </Link>
          <h1 className="text-xl font-bold text-text-primary tracking-tight m-0">
            Recuperação de Senha
          </h1>
          <p className="text-xs text-text-secondary mt-1 m-0">
            Informe seu e-mail para receber o link seguro de redefinição
          </p>
        </div>

        {/* Alerta de Erro */}
        {error && (
          <div 
            role="alert" 
            className="mb-5 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300"
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* Alerta de Sucesso */}
        {message && (
          <div 
            role="status" 
            className="mb-5 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span className="leading-relaxed font-medium">{message}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="email" 
              className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              E-mail Institucional ou Cadastrado
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-text-secondary pointer-events-none">
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
              </span>
              <input 
                id="email" 
                type="email" 
                required 
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@ceub.edu.br"
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg-surface text-text-primary border border-border-color rounded-md placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-purple-primary hover:bg-purple-hover text-white text-sm font-semibold rounded-md shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Enviando Instruções...</span>
                </>
              ) : (
                <span>Enviar Link de Recuperação</span>
              )}
            </button>
          </div>
        </form>

        {/* Rodapé Interno com Retorno ao Login */}
        <div className="mt-6 pt-5 border-t border-border-color text-center">
          <p className="text-xs text-text-secondary m-0 mb-3">
            Lembrou suas credenciais de acesso?
          </p>
          <Link 
            to="/login" 
            className="inline-block w-full py-2 px-4 border border-border-color hover:border-purple-primary text-text-primary hover:text-purple-primary text-xs font-semibold rounded-md transition-colors text-center"
          >
            Retornar ao Login
          </Link>
        </div>
        
      </div>

      {/* Nota de Apoio Institucional */}
      <div className="mt-8 text-center text-xs text-text-secondary">
        <p className="m-0">Centro Universitário de Brasília · UniCEUB</p>
        <p className="m-0 text-[11px] text-text-secondary mt-0.5">O link enviado possui prazo de expiração de 1 hora para segurança institucional</p>
      </div>
    </div>
  );
}
