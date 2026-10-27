/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import axios from 'axios';

// Cria uma instância do axios configurada para o nosso backend Flask
export const api = axios.create({
  // No Vercel ou local, as chamadas /api baterão no Flask devido ao vercel.json
  // No dev mode do Vite, precisamos configurar um proxy no vite.config.ts
  baseURL: '/api',
  withCredentials: true, // Importante para enviar os cookies da sessão do Flask
});

// Interceptador para lidar com respostas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sessão expirada: avisa a aplicação (sem recarregar a página) para pedir novo login.
    const url: string = error?.config?.url || '';
    const ehAutenticacao = /^\/(login|logout|me|cadastro|recuperar-senha|redefinir-senha|verificar-conta)/.test(url);
    if (error?.response?.status === 401 && !ehAutenticacao) {
      window.dispatchEvent(new Event('sessao-expirada'));
    }
    return Promise.reject(error);
  }
);

