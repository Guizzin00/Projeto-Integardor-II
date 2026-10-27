/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useEffect, useRef } from 'react';
import { useModalA11y } from './UIProvider';

export interface SubmissaoDetalhes {
  id: number;
  nome_projeto: string;
  categoria?: string;
  descricao?: string;
  proponente?: string;
  email?: string;
  status?: string;
  username?: string;
  imagem?: string | null;
  tags?: string;
}

interface Props {
  submissao: SubmissaoDetalhes | null;
  onClose: () => void;
}

const statusClasses = (status?: string) =>
  status === 'APROVADA'
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
    : status === 'REJEITADA'
    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30';

export function SubmissaoDetalhesModal({ submissao, onClose }: Props) {
  const dialogoRef = useRef<HTMLDivElement>(null);
  useModalA11y(true, onClose, dialogoRef);
  useEffect(() => {
    if (!submissao) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submissao, onClose]);

  if (!submissao) return null;

  const tags = (submissao.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const imagemUrl = submissao.imagem
    ? submissao.imagem.startsWith('http') ? submissao.imagem : `/static/${submissao.imagem}`
    : null;

  const campo = (rotulo: string, valor?: string) => (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{rotulo}</dt>
      <dd className="m-0 mt-0.5 text-sm text-text-primary break-words">{valor || 'Não informado'}</dd>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da proposta ${submissao.nome_projeto}`}
    >
      <div
        ref={dialogoRef}
      className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto bg-bg-surface border border-border-color rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border-color">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              Proposta #{submissao.id}
            </p>
            <h2 className="m-0 mt-0.5 text-lg font-bold text-text-primary break-words">{submissao.nome_projeto}</h2>
            <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${statusClasses(submissao.status)}`}>
              {submissao.status || 'EM ANÁLISE'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 w-8 h-8 rounded-lg border border-border-color bg-bg-primary text-text-primary cursor-pointer hover:bg-border-color"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {imagemUrl && (
            <img src={imagemUrl} alt="Logo ou imagem da proposta" className="max-h-40 rounded-lg border border-border-color object-contain bg-bg-primary" />
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
            {campo('Categoria', submissao.categoria)}
            {campo('Proponente', submissao.proponente)}
            {campo('E-mail de contato', submissao.email)}
            {campo('Enviado por', submissao.username ? `@${submissao.username}` : undefined)}
          </dl>

          <div>
            <h3 className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary">Descrição da proposta</h3>
            <p className="m-0 text-sm text-text-primary leading-relaxed whitespace-pre-line break-words">
              {submissao.descricao || 'Nenhuma descrição informada.'}
            </p>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-purple-primary/10 text-purple-primary text-[11px] font-semibold">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-color text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-purple-primary hover:bg-purple-hover text-white text-sm font-bold border-none cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
