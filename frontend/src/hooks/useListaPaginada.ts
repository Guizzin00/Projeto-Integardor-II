/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export interface ListaPaginada<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  setPage: (p: number) => void;
  reload: () => Promise<void>;
}

/**
 * Lista paginada e filtrada no servidor (/admin/lista/<tipo>).
 * A busca de texto é enviada com atraso (debounce) para não gerar uma requisição por tecla.
 */
export function useListaPaginada<T = any>(
  tipo: string,
  filtros: { q?: string; status?: string; sem_orientador?: boolean },
  porPagina = 15
): ListaPaginada<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const pedido = useRef(0);

  const { q = '', status = 'TODOS', sem_orientador = false } = filtros;

  // Mudou algum filtro: volta para a primeira página
  useEffect(() => {
    setPageState(1);
  }, [q, status, sem_orientador]);

  const carregar = useCallback(async () => {
    const meu = ++pedido.current;
    setLoading(true);
    try {
      const res = await api.get(`/admin/lista/${tipo}`, {
        params: { page, per_page: porPagina, q: q.trim() || undefined, status: status !== 'TODOS' ? status : undefined, sem_orientador: sem_orientador ? 1 : undefined },
      });
      if (meu !== pedido.current) return; // resposta antiga: ignora
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {
      if (meu === pedido.current) setItems([]);
    } finally {
      if (meu === pedido.current) setLoading(false);
    }
  }, [tipo, page, porPagina, q, status, sem_orientador]);

  useEffect(() => {
    const t = window.setTimeout(carregar, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [carregar, q]);

  return { items, setItems, total, page, pages, loading, setPage: setPageState, reload: carregar };
}
