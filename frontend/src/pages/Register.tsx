import { useState } from 'react';
import { api } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { validarSenha, DICA_SENHA } from '../utils/senha';

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'aluno' | 'professor' | 'empresa'>('aluno');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirm) {
      setError('A confirmação de senha não confere com a senha informada.');
      return;
    }

    const erroSenha = validarSenha(password);
    if (erroSenha) {
      setError(erroSenha);
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/cadastro', { 
        username: username.trim(), 
        email: email.trim(), 
        password, 
        confirm,
        role
      });

      if (response.data.status === 'success') {
        setSuccess(response.data.message || 'Cadastro realizado com êxito! Verifique seu e-mail para ativação.');
        setTimeout(() => navigate('/login'), 4000);
      } else {
        setError(response.data.message || 'Não foi possível concluir o cadastro.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha de comunicação com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
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
            Cadastro Institucional
          </h1>
          <p className="text-xs text-text-secondary mt-1 m-0">
            SisCPTI · Crie sua conta para submeter ou participar de projetos
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
        {success && (
          <div 
            role="status" 
            className="mb-5 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <div className="leading-relaxed font-medium">
              <p className="m-0 font-semibold">{success}</p>
              <p className="m-0 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Redirecionando para o login em instantes...</p>
            </div>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Perfil / Cargo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Perfil Institucional / Tipo de Conta
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('aluno')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                  role === 'aluno'
                    ? 'bg-purple-primary text-white border-purple-primary shadow-sm'
                    : 'bg-bg-primary text-text-secondary border-border-color hover:border-purple-primary/50'
                }`}
              >
                🎓 Aluno
              </button>
              <button
                type="button"
                onClick={() => setRole('professor')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                  role === 'professor'
                    ? 'bg-purple-primary text-white border-purple-primary shadow-sm'
                    : 'bg-bg-primary text-text-secondary border-border-color hover:border-purple-primary/50'
                }`}
              >
                👨‍🏫 Professor
              </button>
              <button
                type="button"
                onClick={() => setRole('empresa')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                  role === 'empresa'
                    ? 'bg-purple-primary text-white border-purple-primary shadow-sm'
                    : 'bg-bg-primary text-text-secondary border-border-color hover:border-purple-primary/50'
                }`}
              >
                🏢 Empresa / Parceiro
              </button>
            </div>
            <p className="text-[11px] text-text-secondary mt-1.5 m-0">
              {role === 'aluno' && 'Para estudantes interessados em se candidatar a vagas e desenvolver projetos.'}
              {role === 'professor' && 'Para docentes do UniCEUB que irão orientar equipes e acompanhar projetos.'}
              {role === 'empresa' && 'Para empresas e parceiros externos interessados em propor problemas e acompanhar MVPs.'}
            </p>
            {role !== 'aluno' && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <span className="text-sm shrink-0">⏳</span>
                <span className="leading-relaxed">
                  <strong>Aviso Institucional:</strong> Contas com perfil de <strong>{role === 'professor' ? 'Professor' : 'Empresa'}</strong> entram em espera e passam por validação prévia da Coordenação ou Administração antes do primeiro acesso.
                </span>
              </div>
            )}
          </div>

          <div>
            <label 
              htmlFor="username" 
              className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              Matrícula / Usuário
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-text-secondary pointer-events-none">
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </span>
              <input 
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: aluno.silva ou 12345678 (sem @)"
                pattern="[^@]+"
                title="Não use @ na matrícula/usuário; seu e-mail também serve para entrar."
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg-surface text-text-primary border border-border-color rounded-md placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="email" 
              className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              E-mail Institucional ou Pessoal
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@ceub.edu.br ou pessoal"
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg-surface text-text-primary border border-border-color rounded-md placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              Definir Senha
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-text-secondary pointer-events-none">
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </span>
              <input 
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8, com letras e números"
                title={DICA_SENHA}
                className="w-full pl-9 pr-10 py-2 text-sm bg-bg-surface text-text-primary border border-border-color rounded-md placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute right-2.5 p-1 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label 
              htmlFor="confirm" 
              className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              Confirmar Senha
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-text-secondary pointer-events-none">
                <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              <input 
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha definida"
                className="w-full pl-9 pr-3 py-2 text-sm bg-bg-surface text-text-primary border border-border-color rounded-md placeholder:text-text-secondary/60 focus:outline-none focus:border-purple-primary focus:ring-1 focus:ring-purple-primary transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-purple-primary hover:bg-purple-hover text-white text-sm font-semibold rounded-md shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Registrando Conta...</span>
                </>
              ) : (
                <span>Concluir Cadastro</span>
              )}
            </button>
          </div>
        </form>

        {/* Rodapé Interno com Retorno ao Login */}
        <div className="mt-6 pt-5 border-t border-border-color text-center">
          <p className="text-xs text-text-secondary m-0 mb-3">
            Já possui cadastro ativo no SisCPTI?
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
        <p className="m-0 text-[11px] text-text-secondary mt-0.5">Ao cadastrar-se você declara ciência dos termos de integridade acadêmica</p>
      </div>
    </div>
  );
}
