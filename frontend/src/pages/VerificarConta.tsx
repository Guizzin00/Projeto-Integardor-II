import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export function VerificarConta() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const requestedRef = useRef(false);

  useEffect(() => {
    const ativarConta = async () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      try {
        const res = await api.post(`/verificar-conta/${token}`);
        if (res.data.status === 'success') {
          setSuccess(true);
          setMessage(res.data.message || 'Sua conta foi ativada com sucesso!');
        } else {
          setSuccess(false);
          setMessage(res.data.message || 'Não foi possível ativar sua conta.');
        }
      } catch (err: any) {
        setSuccess(false);
        setMessage(err.response?.data?.message || 'Link de ativação inválido ou expirado.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      ativarConta();
    } else {
      setLoading(false);
      setMessage('Token de ativação ausente.');
    }
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center px-4 py-12 bg-bg-primary transition-colors">
      <div className="w-full max-w-md bg-bg-surface border border-border-color rounded-md shadow-sm p-8 text-center transition-colors">
        
        {/* Cabeçalho Institucional */}
        <div className="pb-6 mb-6 border-b border-border-color">
          <Link to="/" className="inline-block mb-4">
            <img 
              src="/static/logoCEUB.png?v=2" 
              alt="UniCEUB" 
              className="h-10 w-auto mx-auto object-contain transition-all dark:invert dark:brightness-0" 
              onError={(e) => { e.currentTarget.src = 'https://www.uniceub.br/imagens/logoCEUB2021.png'; }}
            />
          </Link>
          <h1 className="text-xl font-bold text-text-primary tracking-tight m-0">
            Validação de Cadastro
          </h1>
          <p className="text-xs text-text-secondary mt-1 m-0">
            SisCPTI · Verificação de autenticidade da conta institucional
          </p>
        </div>

        {loading ? (
          <div className="py-6">
            <svg className="animate-spin w-8 h-8 text-purple-primary mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs font-medium text-text-secondary m-0">Validando autenticidade do token institucional...</p>
          </div>
        ) : (
          <div className="py-2">
            <div className="flex justify-center mb-4">
              {success ? (
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
                  <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            <h2 className="text-lg font-bold text-text-primary mb-2">
              {success ? 'Conta Validada com Sucesso' : 'Inconsistência na Validação'}
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">
              {message}
            </p>

            <Link 
              to="/login"
              className="inline-block w-full py-2.5 px-4 bg-purple-primary hover:bg-purple-hover text-white text-sm font-semibold rounded-md shadow-sm transition-colors text-center"
            >
              Acessar Plataforma
            </Link>
          </div>
        )}

        {/* Rodapé Interno */}
        <div className="mt-6 pt-5 border-t border-border-color text-center">
          <Link 
            to="/" 
            className="text-xs text-purple-primary hover:text-purple-hover hover:underline"
          >
            ← Retornar à Página Inicial
          </Link>
        </div>

      </div>

      {/* Nota de Apoio Institucional */}
      <div className="mt-8 text-center text-xs text-text-secondary">
        <p className="m-0">Centro Universitário de Brasília · UniCEUB</p>
        <p className="m-0 text-[11px] text-text-secondary mt-0.5">Sistema de Gestão do Caderno de Projetos de TI</p>
      </div>
    </div>
  );
}
