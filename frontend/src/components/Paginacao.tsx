import type { ListaPaginada } from '../hooks/useListaPaginada';

export function Paginacao({ lista, rotulo }: { lista: Pick<ListaPaginada<unknown>, 'page' | 'pages' | 'total' | 'setPage' | 'loading'>; rotulo: string }) {
  const { page, pages, total, setPage, loading } = lista;
  const botao = 'px-3 py-1.5 text-xs font-semibold rounded-md border border-border-color bg-bg-surface text-text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <nav aria-label={`Paginação de ${rotulo}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border-color text-xs text-text-secondary">
      <span aria-live="polite">
        {loading ? 'Carregando...' : `${total} ${total === 1 ? 'registro' : 'registros'} · página ${page} de ${pages}`}
      </span>
      <div className="flex gap-2">
        <button type="button" className={botao} disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Anterior</button>
        <button type="button" className={botao} disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Próxima</button>
      </div>
    </nav>
  );
}
