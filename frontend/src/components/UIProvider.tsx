import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type TipoAviso = 'sucesso' | 'erro' | 'info';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensagem: string;
}

interface PedidoConfirmacao {
  mensagem: string;
  rotuloConfirmar: string;
  perigo: boolean;
  resolver: (ok: boolean) => void;
}

interface UIContextType {
  /** Mostra um aviso (toast). Sem `tipo`, mensagens iniciadas por ✅ são de sucesso e as demais, de erro. */
  avisar: (mensagem: string, tipo?: TipoAviso) => void;
  /** Abre um modal de confirmação e resolve com a escolha do usuário. */
  confirmar: (mensagem: string, opcoes?: { rotulo?: string; perigo?: boolean }) => Promise<boolean>;
}

const UIContext = createContext<UIContextType>({
  avisar: () => {},
  confirmar: async () => false,
});

export const useUI = () => useContext(UIContext);

const SELETOR_FOCAVEL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal acessível: foco preso dentro, Esc fecha e o foco volta ao elemento que abriu. */
export function useModalA11y(aberto: boolean, aoFechar: () => void, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const raiz = ref.current;
    raiz?.querySelector<HTMLElement>(SELETOR_FOCAVEL)?.focus();

    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
        return;
      }
      if (e.key !== 'Tab' || !raiz) return;
      const itens = Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(el => !el.hasAttribute('disabled'));
      if (itens.length === 0) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTecla);
    return () => {
      document.removeEventListener('keydown', aoTecla);
      anterior?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
}

const ESTILO_AVISO: Record<TipoAviso, string> = {
  sucesso: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  erro: 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200',
  info: 'bg-bg-surface border-border-color text-text-primary',
};

function ModalConfirmacao({ pedido, aoResponder }: { pedido: PedidoConfirmacao; aoResponder: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(true, () => aoResponder(false), ref);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60" onClick={() => aoResponder(false)}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby="confirmar-texto"
        className="w-full max-w-md bg-bg-surface text-text-primary border border-border-color rounded-md shadow-xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirmar-titulo" className="text-base font-bold m-0 mb-2">Confirmar ação</h2>
        <p id="confirmar-texto" className="text-sm text-text-secondary m-0 mb-5 whitespace-pre-line">{pedido.mensagem}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => aoResponder(false)}
            className="px-4 py-2 text-sm font-semibold rounded-md border border-border-color bg-bg-primary text-text-primary cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={() => aoResponder(true)}
            className={`px-4 py-2 text-sm font-semibold rounded-md border-0 text-white cursor-pointer ${pedido.perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-primary'}`}>
            {pedido.rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Aviso exibido quando a sessão expira, sem desmontar a página (o que o usuário digitou é preservado). */
function AvisoSessaoExpirada() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const aoExpirar = () => setAberto(true);
    window.addEventListener('sessao-expirada', aoExpirar);
    return () => window.removeEventListener('sessao-expirada', aoExpirar);
  }, []);

  useModalA11y(aberto, () => setAberto(false), ref);
  if (!aberto) return null;

  const irParaLogin = () => {
    setAberto(false);
    navigate('/login', { state: { from: location.pathname + location.search, expirada: true } });
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/60">
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="sessao-titulo"
        className="w-full max-w-md bg-bg-surface text-text-primary border border-border-color rounded-md shadow-xl p-6">
        <h2 id="sessao-titulo" className="text-base font-bold m-0 mb-2">Sua sessão expirou</h2>
        <p className="text-sm text-text-secondary m-0 mb-5">
          Por segurança, é preciso entrar novamente. Você voltará a esta página depois do login.
          Se estiver preenchendo algo, copie o texto antes de continuar.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setAberto(false)}
            className="px-4 py-2 text-sm font-semibold rounded-md border border-border-color bg-bg-primary text-text-primary cursor-pointer">
            Continuar nesta página
          </button>
          <button type="button" onClick={irParaLogin}
            className="px-4 py-2 text-sm font-semibold rounded-md border-0 bg-purple-primary text-white cursor-pointer">
            Entrar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const proximoId = useRef(1);

  const avisar = useCallback((mensagem: string, tipo?: TipoAviso) => {
    const limpa = mensagem.replace(/^✅\s*/, '');
    const tipoFinal: TipoAviso = tipo ?? (mensagem.trimStart().startsWith('✅') ? 'sucesso' : 'erro');
    const id = proximoId.current++;
    setAvisos(atuais => [...atuais.slice(-3), { id, tipo: tipoFinal, mensagem: limpa }]);
    window.setTimeout(() => setAvisos(atuais => atuais.filter(a => a.id !== id)), tipoFinal === 'erro' ? 8000 : 5000);
  }, []);

  const confirmar = useCallback((mensagem: string, opcoes?: { rotulo?: string; perigo?: boolean }) => {
    return new Promise<boolean>(resolver => {
      setPedido({ mensagem, rotuloConfirmar: opcoes?.rotulo ?? 'Confirmar', perigo: opcoes?.perigo ?? true, resolver });
    });
  }, []);

  const responder = (ok: boolean) => {
    pedido?.resolver(ok);
    setPedido(null);
  };

  return (
    <UIContext.Provider value={{ avisar, confirmar }}>
      {children}
      {/* Região "live": leitores de tela anunciam os avisos assim que aparecem */}
      <div className="fixed top-4 right-4 z-[2200] flex flex-col gap-2 w-[min(92vw,22rem)]" aria-live="polite" aria-atomic="false">
        {avisos.map(a => (
          <div key={a.id} role={a.tipo === 'erro' ? 'alert' : 'status'}
            className={`flex items-start gap-2 p-3 rounded-md border shadow-lg text-sm ${ESTILO_AVISO[a.tipo]}`}>
            <span className="flex-1">{a.mensagem}</span>
            <button type="button" aria-label="Fechar aviso"
              onClick={() => setAvisos(atuais => atuais.filter(x => x.id !== a.id))}
              className="bg-transparent border-0 cursor-pointer text-current text-base leading-none">×</button>
          </div>
        ))}
      </div>
      {pedido && <ModalConfirmacao pedido={pedido} aoResponder={responder} />}
      <AvisoSessaoExpirada />
    </UIContext.Provider>
  );
}
