import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

interface ErrorConfig {
  code: number;
  badge: string;
  badgeColor: string;
  title: string;
  message: string;
  image: string;
  primaryAction: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    to: string;
  };
}

const ERROR_DETAILS: Record<number, ErrorConfig> = {
  401: {
    code: 401,
    badge: 'ERRO 401 · NÃO AUTORIZADO',
    badgeColor: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    title: 'Autenticação Necessária',
    message: 'Para acessar esta seção do SisCPTI, é necessário estar autenticado com sua conta institucional ativa ou renovar sua sessão.',
    image: '/static/img/errors/401.svg',
    primaryAction: {
      label: 'Fazer Login Institucional',
      to: '/login'
    },
    secondaryAction: {
      label: 'Ir para o Início',
      to: '/'
    }
  },
  403: {
    code: 403,
    badge: 'ERRO 403 · ACESSO RESTRITO',
    badgeColor: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50',
    title: 'Permissão Insuficiente',
    message: 'Seu perfil de usuário não possui autorização para acessar este recurso. Se você acredita que isto é um engano, consulte o orientador ou coordenador do projeto.',
    image: '/static/img/errors/403.svg',
    primaryAction: {
      label: 'Retornar ao Início',
      to: '/'
    },
    secondaryAction: {
      label: 'Ver Meus Projetos',
      to: '/perfil'
    }
  },
  404: {
    code: 404,
    badge: 'ERRO 404 · NÃO ENCONTRADO',
    badgeColor: 'bg-purple-primary/10 text-purple-primary border-purple-primary/20',
    title: 'Página Não Localizada',
    message: 'O endereço informado não existe em nossos registros ou o conteúdo acadêmico foi remanejado para outro identificador.',
    image: '/static/img/errors/404.svg',
    primaryAction: {
      label: 'Retornar à Página Inicial',
      to: '/'
    },
    secondaryAction: {
      label: 'Explorar Projetos',
      to: '/projetos'
    }
  },
  500: {
    code: 500,
    badge: 'ERRO 500 · FALHA INTERNA',
    badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    title: 'Instabilidade Temporária no Servidor',
    message: 'Identificamos uma intercorrência no processamento interno da requisição. Nossa equipe técnica monitora os registros para restabelecimento imediato.',
    image: '/static/img/errors/500.svg',
    primaryAction: {
      label: 'Recarregar Página',
      onClick: () => window.location.reload()
    },
    secondaryAction: {
      label: 'Retornar ao Início',
      to: '/'
    }
  }
};

interface ErrorPageProps {
  code?: number;
  title?: string;
  message?: string;
}

export function ErrorPage({ code: propCode, title: propTitle, message: propMessage }: ErrorPageProps) {
  const { code: paramCode } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  
  // Resolve o código de erro a partir de props, params de rota (/erro/:code) ou query string (?status=403)
  const resolvedCode = Number(propCode || paramCode || searchParams.get('status') || searchParams.get('code') || 404);
  const errorData = ERROR_DETAILS[resolvedCode] || ERROR_DETAILS[404];

  const displayTitle = propTitle || errorData.title;
  const displayMessage = propMessage || errorData.message;

  // Trava totalmente o scroll da página no navegador (html e body estáticos)
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen max-h-screen overflow-hidden select-none bg-bg-primary text-text-primary flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:px-16 transition-colors">
      
      {/* Barra Superior / Identificação Institucional */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between pb-3 sm:pb-4 border-b border-border-color shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center" tabIndex={0}>
            <img 
              src="/static/logoCEUB.png?v=2" 
              alt="UniCEUB" 
              className="h-7 sm:h-8 w-auto object-contain transition-all dark:invert dark:brightness-0" 
              onError={(e) => { e.currentTarget.src = 'https://www.uniceub.br/imagens/logoCEUB2021.png'; }}
            />
          </Link>
          <span className="text-border-color">|</span>
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <Link to="/" className="text-purple-primary hover:text-purple-hover hover:underline">SisCPTI</Link>
            <span>/</span>
            <span>Status HTTP {errorData.code}</span>
          </div>
        </div>

        <div className="text-[11px] text-text-secondary hidden sm:block">
          Centro Universitário de Brasília · UniCEUB
        </div>
      </header>

      {/* Área Central Estática em Tela Cheia (Sem Scroll) */}
      <main className="w-full max-w-7xl mx-auto flex-1 flex items-center justify-center my-auto py-2 sm:py-4 overflow-hidden">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-14 max-h-full">
          
          {/* Ilustração SVG Institucional Proporcional */}
          <div className="lg:col-span-7 flex justify-center items-center overflow-hidden">
            <div className="w-full max-w-[380px] sm:max-w-[440px] lg:max-w-[540px] flex items-center justify-center">
              <img 
                src={errorData.image} 
                alt={`Ilustração do Erro ${errorData.code}`}
                className="w-full h-auto max-h-[28vh] sm:max-h-[34vh] lg:max-h-[44vh] object-contain drop-shadow-sm pointer-events-none"
                loading="eager"
              />
            </div>
          </div>

          {/* Coluna de Informações e Ações */}
          <div className="lg:col-span-5 flex flex-col text-left justify-center">
            
            {/* Indicador Numérico e Badge */}
            <div className="flex items-center gap-3 mb-1 sm:mb-2">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-black text-purple-primary/25 tracking-tighter leading-none">
                {errorData.code}
              </span>
              <span className={`inline-block px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold tracking-wider rounded border ${errorData.badgeColor}`}>
                {errorData.badge}
              </span>
            </div>

            {/* Título */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-text-primary tracking-tight leading-tight m-0 mb-2 sm:mb-3">
              {displayTitle}
            </h1>

            {/* Mensagem Detalhada */}
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed m-0 mb-4 sm:mb-6 max-w-lg">
              {displayMessage}
            </p>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 border-t border-border-color">
              {errorData.primaryAction.onClick ? (
                <button
                  type="button"
                  onClick={errorData.primaryAction.onClick}
                  className="py-2.5 px-5 bg-purple-primary hover:bg-purple-hover text-white text-xs sm:text-sm font-semibold rounded-md shadow-sm transition-colors text-center cursor-pointer border-none flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{errorData.primaryAction.label}</span>
                </button>
              ) : (
                <Link
                  to={errorData.primaryAction.to || '/'}
                  className="py-2.5 px-5 bg-purple-primary hover:bg-purple-hover text-white text-xs sm:text-sm font-semibold rounded-md shadow-sm transition-colors text-center no-underline flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>{errorData.primaryAction.label}</span>
                </Link>
              )}

              {errorData.secondaryAction && (
                <Link
                  to={errorData.secondaryAction.to}
                  className="py-2.5 px-5 bg-bg-surface hover:bg-bg-primary border border-border-color hover:border-purple-primary text-text-primary hover:text-purple-primary text-xs sm:text-sm font-semibold rounded-md transition-colors text-center no-underline"
                >
                  {errorData.secondaryAction.label}
                </Link>
              )}
            </div>

            {/* Links Rápidos Institucionais */}
            <div className="mt-4 sm:mt-5 pt-3 border-t border-border-color/60 text-[11px] sm:text-xs text-text-secondary hidden sm:block">
              <span className="font-semibold text-text-primary mr-2">Acesso rápido:</span>
              <div className="inline-flex flex-wrap gap-x-3 gap-y-1">
                <Link to="/" className="text-purple-primary hover:text-purple-hover hover:underline">Página Inicial</Link>
                <span>·</span>
                <Link to="/projetos" className="text-purple-primary hover:text-purple-hover hover:underline">Caderno de Projetos</Link>
                <span>·</span>
                <Link to="/sobre" className="text-purple-primary hover:text-purple-hover hover:underline">Sobre o UniCEUB</Link>
                <span>·</span>
                <Link to="/login" className="text-purple-primary hover:text-purple-hover hover:underline">Área de Login</Link>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Faixa Inferior Fixa */}
      <footer className="w-full max-w-7xl mx-auto pt-3 border-t border-border-color text-[11px] sm:text-xs text-text-secondary flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0">
        <p className="m-0">SisCPTI · Sistema de Gestão do Caderno de Projetos de Tecnologia da Informação</p>
        <p className="m-0">Suporte Institucional: nucleoti@ceub.edu.br</p>
      </footer>

    </div>
  );
}


