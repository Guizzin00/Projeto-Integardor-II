/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from './UIProvider';

const campoClasse =
  'w-full p-2.5 border-[1.5px] border-border-color rounded-lg text-[0.95rem] bg-bg-primary text-text-primary transition-all focus:outline-none focus:border-rose-600';

export function ExcluirConta() {
  const { logout } = useAuth();
  const { avisar } = useUI();
  const navigate = useNavigate();

  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const confirmado = confirmacao.trim().toUpperCase() === 'EXCLUIR' && senha.length > 0;

  const cancelar = () => {
    setAberto(false);
    setSenha('');
    setConfirmacao('');
    setErro('');
  };

  const excluir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmado || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      await api.post('/perfil/excluir', { senha, confirmacao });
      await logout();
      avisar('Sua conta foi excluída.', 'info');
      navigate('/', { replace: true });
    } catch (err: any) {
      setErro(err.response?.data?.message || 'Não foi possível excluir a conta.');
      setEnviando(false);
    }
  };

  return (
    <section
      aria-labelledby="excluir-conta-titulo"
      className="mt-8 bg-bg-surface p-8 rounded-2xl border border-rose-500/40"
    >
      <h2 id="excluir-conta-titulo" className="font-title font-bold text-base text-rose-600 m-0 mb-2">
        Excluir conta
      </h2>
      <p className="text-[0.9rem] text-text-secondary m-0">
        A exclusão é permanente. Seu perfil, candidaturas, notificações e propostas em análise são apagados e você sai das
        equipes de que participa. Mensagens e avaliações que você deixou continuam nos projetos, sem o seu nome.
      </p>
      <p className="text-[0.9rem] text-text-secondary m-0 mt-2">
        Se você é dono ou orientador de algum projeto, transfira ou exclua esses projetos antes.
      </p>

      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-4 bg-transparent border-[1.5px] border-rose-600 text-rose-600 py-2.5 px-5 rounded-md font-bold text-sm cursor-pointer hover:bg-rose-600 hover:text-white transition-colors"
        >
          Quero excluir minha conta
        </button>
      ) : (
        <form onSubmit={excluir} className="mt-5 flex flex-col gap-4">
          {erro && (
            <div role="alert" className="bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] text-[#721c24] p-2.5 rounded-md text-[0.82rem] font-medium">
              ❌ {erro}
            </div>
          )}
          <div className="flex flex-col">
            <label htmlFor="excluir_senha" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">Sua senha atual</label>
            <input
              type="password"
              id="excluir_senha"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={campoClasse}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="excluir_confirmacao" className="font-semibold text-[0.9rem] mb-1.5 text-text-primary">
              Digite <strong>EXCLUIR</strong> para confirmar
            </label>
            <input
              type="text"
              id="excluir_confirmacao"
              autoComplete="off"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className={campoClasse}
            />
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button
              type="submit"
              disabled={!confirmado || enviando}
              className="bg-rose-600 hover:bg-rose-700 text-white border-none py-2.5 px-5 rounded-md font-bold text-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? 'Excluindo...' : 'Excluir conta definitivamente'}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="bg-transparent border-[1.5px] border-border-color text-text-primary py-2.5 px-5 rounded-md font-bold text-sm cursor-pointer hover:bg-border-color transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
