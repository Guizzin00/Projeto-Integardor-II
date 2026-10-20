import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface NotificationItem {
  id: number;
  mensagem: string;
  data: string;
  link?: string;
}

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificationItem[]>([]);
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const menuRef = useRef<HTMLLIElement>(null);
  const notifRef = useRef<HTMLLIElement>(null);

  // Apply theme class to body
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Fetch notifications
  const fetchNotificacoes = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notificacoes');
      if (res.data.status === 'success' && Array.isArray(res.data.data)) {
        setNotificacoes(res.data.data);
      }
    } catch (err) {
      // Silent error for notifications polling
    }
  };

  useEffect(() => {
    if (!user) return; // Bug 5: não criar intervalo se não há usuário logado
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, 15000); // 15s polling
    return () => clearInterval(interval);
  }, [user]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarcarLida = async (id: number) => {
    try {
      await api.post(`/notificacoes/ler/${id}`);
      setNotificacoes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarcarTodasLidas = async () => {
    try {
      await api.post('/notificacoes/ler-todas');
      setNotificacoes([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    navigate('/login', { replace: true, state: { loggedOut: true } });
    await logout();
  };

  return (
    <header className="bg-bg-surface pt-3 pb-1 relative z-50 transition-colors border-b border-border-color">
      <div className="w-[90%] max-w-[1200px] mx-auto flex items-center justify-between">
        
        <Link to="/">
          <img 
            src="/static/logoCEUB.png?v=2" 
            alt="Logo CEUB" 
            className="ceub-logo w-[170px] h-auto"
            onError={(e) => { e.currentTarget.src = 'https://www.uniceub.br/imagens/logoCEUB2021.png'; }}
          />
        </Link>

        <nav className="flex-1 flex items-center justify-between ml-10">
          <ul className="flex items-center gap-6 m-0 p-0 list-none">
            <li><Link to="/" className="text-purple-primary font-semibold hover:text-purple-hover transition-colors">Início</Link></li>
            <li><Link to="/projetos" className="text-purple-primary font-semibold hover:text-purple-hover transition-colors">Projetos</Link></li>
            <li><Link to="/sobre" className="text-purple-primary font-semibold hover:text-purple-hover transition-colors">Sobre</Link></li>
          </ul>

          <ul className="flex items-center gap-5 m-0 p-0 list-none">
            {/* THEME TOGGLE */}
            <li>
              <button 
                onClick={toggleTheme}
                title={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
                className="text-purple-primary text-xl p-2 rounded-full hover:bg-purple-primary/10 transition-all flex items-center justify-center bg-transparent border-none cursor-pointer"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </li>

            {user ? (
              <>
                {/* NOTIFICATIONS */}
                <li className="relative" ref={notifRef}>
                  <button 
                    onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }}
                    title="Notificações"
                    className="text-purple-primary text-xl p-2 rounded-full hover:bg-purple-primary/10 transition-all flex items-center justify-center bg-transparent border-none cursor-pointer relative"
                  >
                    🔔
                    {notificacoes.length > 0 && (
                      <span className="absolute top-1 right-1 bg-[#dc3545] text-white text-[0.65rem] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                        {notificacoes.length > 9 ? '9+' : notificacoes.length}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-bg-surface rounded-xl shadow-hover py-3 z-50 border border-border-color animate-[fadeIn_0.2s_ease-out]">
                      <div className="flex justify-between items-center px-4 pb-2 border-b border-border-color">
                        <span className="font-bold text-sm text-text-primary">Notificações</span>
                        {notificacoes.length > 0 && (
                          <button 
                            onClick={handleMarcarTodasLidas}
                            className="text-xs text-purple-primary hover:underline bg-transparent border-none cursor-pointer font-medium"
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto">
                        {notificacoes.length === 0 ? (
                          <div className="p-6 text-center text-xs text-text-secondary">
                            Você não possui novas notificações.
                          </div>
                        ) : (
                          notificacoes.map(n => (
                            <div key={n.id} className="p-3 border-b border-border-color hover:bg-purple-primary/5 transition-colors flex flex-col gap-1">
                              <p className="m-0 text-xs text-text-primary leading-relaxed">{n.mensagem}</p>
                              <div className="flex justify-between items-center text-[0.7rem] text-text-secondary mt-1">
                                <span>{n.data}</span>
                                <div className="flex gap-2">
                                  {n.link && (
                                    <Link 
                                      to={n.link}
                                      onClick={() => { handleMarcarLida(n.id); setNotifOpen(false); }}
                                      className="text-purple-primary font-bold hover:underline"
                                    >
                                      Acessar →
                                    </Link>
                                  )}
                                  <button 
                                    onClick={() => handleMarcarLida(n.id)}
                                    className="text-text-secondary hover:text-text-primary bg-transparent border-none cursor-pointer p-0"
                                  >
                                    Lida ✓
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </li>

                {/* USER PROFILE DROPDOWN */}
                <li className="relative" ref={menuRef}>
                  <button 
                    onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}
                    className="flex items-center gap-1 text-purple-primary font-semibold hover:text-purple-hover bg-transparent border-none cursor-pointer text-base"
                  >
                    <span>👤 {user.username}</span>
                    <span className="text-xs">▼</span>
                  </button>
                  
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-bg-surface rounded-xl shadow-hover py-2 z-50 border border-border-color animate-[fadeIn_0.2s_ease-out]">
                      {user.role === 'admin' && (
                        <Link 
                          to="/admin" 
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-purple-primary hover:bg-purple-primary/5 hover:text-purple-hover font-medium text-sm no-underline"
                        >
                          🛡️ Painel Administrativo
                        </Link>
                      )}
                      {(user.role === 'coordenador' || user.role === 'admin') && (
                        <Link 
                          to="/coordenador" 
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-purple-primary hover:bg-purple-primary/5 hover:text-purple-hover font-medium text-sm no-underline"
                        >
                          📋 Painel da Coordenação
                        </Link>
                      )}
                      <Link 
                        to="/perfil" 
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-purple-primary hover:bg-purple-primary/5 hover:text-purple-hover font-medium text-sm no-underline"
                      >
                        {user.role === 'professor' 
                          ? '👨‍🏫 Painel do Orientador' 
                          : (user.role === 'empresa' || user.role === 'cliente') 
                          ? '🏢 Portal da Empresa / Parceiro'
                          : (user.role === 'admin' || user.role === 'coordenador') 
                          ? '👤 Meu Perfil' 
                          : user.role === 'lider'
                          ? '🚀 Painel da Liderança'
                          : '🎓 Painel do Aluno'}
                      </Link>
                      <Link 
                        to="/submissao" 
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-purple-primary hover:bg-purple-primary/5 hover:text-purple-hover font-medium text-sm no-underline"
                      >
                        {(user.role === 'empresa' || user.role === 'cliente') 
                          ? '💡 Submeter Demanda de Projeto' 
                          : '📤 Submeter Proposta'}
                      </Link>
                      <div className="h-px bg-border-color my-1"></div>
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium cursor-pointer border-none bg-transparent text-sm"
                      >
                        🚪 Sair
                      </button>
                    </div>
                  )}
                </li>
              </>
            ) : (
              <li>
                <Link to="/login" className="bg-purple-primary text-white px-4 py-2 rounded-lg font-bold text-sm no-underline hover:bg-purple-hover transition-colors shadow-sm">
                  Entrar
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div className="h-1 bg-purple-primary w-full relative top-[6px] shadow-sm transition-colors"></div>
    </header>
  );
}
