import { useEffect, useRef } from 'react';

/**
 * Executa `tarefa` periodicamente sem sobrecarregar o servidor:
 * - não faz nenhuma requisição enquanto a aba está oculta (e atualiza ao voltar);
 * - dobra o intervalo (até `maximoMs`) enquanto a tarefa devolve `false` (sem novidades);
 * - volta ao intervalo base quando a tarefa devolve `true` (houve novidade).
 */
export function usePolling(
  tarefa: () => Promise<boolean | void>,
  baseMs: number,
  maximoMs: number,
  ativo: boolean,
  dependencias: unknown[] = []
) {
  const tarefaRef = useRef(tarefa);
  tarefaRef.current = tarefa;

  useEffect(() => {
    if (!ativo) return;
    let intervalo = baseMs;
    let timer: number | undefined;
    let cancelado = false;

    const agendar = () => {
      if (cancelado) return;
      timer = window.setTimeout(executar, intervalo);
    };

    const executar = async () => {
      if (document.hidden) return; // retomado pelo evento visibilitychange
      try {
        const novidade = await tarefaRef.current();
        intervalo = novidade === false ? Math.min(intervalo * 2, maximoMs) : baseMs;
      } catch {
        intervalo = Math.min(intervalo * 2, maximoMs);
      }
      agendar();
    };

    const aoMudarVisibilidade = () => {
      window.clearTimeout(timer);
      if (!document.hidden) {
        intervalo = baseMs;
        executar();
      }
    };

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    agendar();
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, baseMs, maximoMs, ...dependencias]);
}
