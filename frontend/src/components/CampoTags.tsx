/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';

interface TagSugerida {
  nome: string;
  projetos: number;
}

interface Props {
  id: string;
  /** Tags separadas por vírgula (mesmo formato salvo no banco) */
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  maxCaracteres?: number;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const separar = (valor: string) => valor.split(',').map(t => t.trim()).filter(Boolean);

// Sugestões carregadas uma vez por sessão e compartilhadas entre os campos
let cacheSugestoes: Promise<TagSugerida[]> | null = null;
function carregarSugestoes() {
  if (!cacheSugestoes) {
    cacheSugestoes = api.get('/tags')
      .then(res => (res.data.tags || []) as TagSugerida[])
      .catch(() => { cacheSugestoes = null; return []; });
  }
  return cacheSugestoes;
}

export function CampoTags({ id, valor, onChange, placeholder, maxCaracteres = 300 }: Props) {
  const [sugestoes, setSugestoes] = useState<TagSugerida[]>([]);
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  // Enter só usa a sugestão destacada se a pessoa navegou até ela; senão vale o que foi digitado
  const [navegou, setNavegou] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => separar(valor), [valor]);
  const escolhidas = useMemo(() => new Set(tags.map(semAcento)), [tags]);

  useEffect(() => {
    let ativo = true;
    carregarSugestoes().then(lista => { if (ativo) setSugestoes(lista); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const filtradas = useMemo(() => {
    const busca = semAcento(texto);
    const disponiveis = sugestoes.filter(s => !escolhidas.has(semAcento(s.nome)));
    if (!busca) return disponiveis.slice(0, 8);
    const exata = disponiveis.filter(s => semAcento(s.nome) === busca);
    const comeca = disponiveis.filter(s => semAcento(s.nome) !== busca && semAcento(s.nome).startsWith(busca));
    const contem = disponiveis.filter(s => !semAcento(s.nome).startsWith(busca) && semAcento(s.nome).includes(busca));
    return [...exata, ...comeca, ...contem].slice(0, 8);
  }, [texto, sugestoes, escolhidas]);

  const adicionar = (nome: string) => {
    const limpo = nome.replace(/,/g, ' ').trim();
    if (!limpo) return;
    // Reaproveita a grafia de uma tag já existente (evita "react" e "React" como tags diferentes)
    const existente = sugestoes.find(s => semAcento(s.nome) === semAcento(limpo));
    const final = existente ? existente.nome : limpo;
    if (!escolhidas.has(semAcento(final))) {
      const novo = [...tags, final].join(', ');
      if (novo.length <= maxCaracteres) onChange(novo);
    }
    setTexto('');
    setDestaque(0);
    setNavegou(false);
    inputRef.current?.focus();
  };

  const remover = (nome: string) => onChange(tags.filter(t => t !== nome).join(', '));

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setNavegou(true);
      setDestaque(d => (navegou ? Math.min(d + 1, Math.max(filtradas.length - 1, 0)) : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setNavegou(true);
      setDestaque(d => Math.max(d - 1, 0));
    } else if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (e.key === 'Tab' && !texto.trim()) return;
      e.preventDefault();
      if (aberto && navegou && filtradas[destaque]) adicionar(filtradas[destaque].nome);
      else adicionar(texto);
    } else if (e.key === 'Backspace' && !texto && tags.length) {
      remover(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  const idLista = `${id}-sugestoes`;

  return (
    <div ref={raizRef} className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 p-2 min-h-[46px] border border-border-color rounded-lg bg-bg-primary transition-all focus-within:border-purple-primary focus-within:shadow-[0_0_0_2px_rgba(168,85,247,0.2)] cursor-text"
      >
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-purple-primary/10 text-purple-primary text-sm font-semibold border border-purple-primary/20">
            {t}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remover(t); }}
              aria-label={`Remover ${t}`}
              className="w-4 h-4 flex items-center justify-center rounded-full bg-transparent border-none text-purple-primary hover:bg-purple-primary/20 cursor-pointer text-xs leading-none"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={aberto && filtradas.length > 0}
          aria-controls={idLista}
          aria-autocomplete="list"
          autoComplete="off"
          value={texto}
          placeholder={tags.length ? 'Adicionar outra...' : placeholder}
          onChange={(e) => { setTexto(e.target.value); setAberto(true); setDestaque(0); setNavegou(false); }}
          onFocus={() => setAberto(true)}
          onKeyDown={aoTeclar}
          onBlur={() => { if (texto.trim()) adicionar(texto); }}
          className="flex-1 min-w-[140px] p-1 bg-transparent border-none outline-none text-base text-text-primary"
        />
      </div>

      {aberto && filtradas.length > 0 && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-bg-surface border border-border-color rounded-lg shadow-hover list-none m-0 p-1"
        >
          <li className="px-2.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            {texto.trim() ? 'Tags sugeridas' : 'Mais usadas nos projetos'}
          </li>
          {filtradas.map((s, i) => (
            <li
              key={s.nome}
              role="option"
              aria-selected={navegou && i === destaque}
              onMouseDown={(e) => { e.preventDefault(); adicionar(s.nome); }}
              onMouseEnter={() => { setDestaque(i); setNavegou(true); }}
              className={`flex justify-between items-center px-2.5 py-2 rounded-md text-sm cursor-pointer ${navegou && i === destaque ? 'bg-purple-primary/10 text-purple-primary' : 'text-text-primary'}`}
            >
              <span className="font-medium">{s.nome}</span>
              {s.projetos > 0 && (
                <span className="text-[11px] text-text-secondary">{s.projetos} {s.projetos === 1 ? 'projeto' : 'projetos'}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-1 text-xs text-text-secondary">
        Clique em uma sugestão (ou use as setas) ou digite uma nova tecnologia e pressione Enter.
      </p>
    </div>
  );
}
