/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ErrorPage } from '../pages/ErrorPage';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  allowedRoles 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Enquanto verifica o status de autenticação (/api/me)
  if (loading) {
    return (
      <div className="w-full min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-8 bg-bg-primary text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-purple-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary m-0">
            Validando credenciais de acesso...
          </p>
        </div>
      </div>
    );
  }

  // 1. Checagem de usuário autenticado
  if ((requireAuth || (allowedRoles && allowedRoles.length > 0)) && !user) {
    // Leva ao login guardando a página de origem para voltar depois
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search, expirada: true }} />;
  }

  // 2. Checagem de papéis / permissão específica (ex: admin, coordenador)
  if (allowedRoles && allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role)) {
      return <ErrorPage code={403} />;
    }
  }

  // Autorizado com sucesso
  return <>{children}</>;
}
