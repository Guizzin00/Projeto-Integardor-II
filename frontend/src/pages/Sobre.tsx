/*!
 * SisCPTI - Copyright (c) 2026 Equipe SisCPTI (CEUB).
 * Todos os direitos reservados. Ver LICENSE.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Sobre() {
  const { user } = useAuth();

  return (
    <>
      <div className="sobre-hero-section">
        <div className="sobre-hero-card">
          <div className="sobre-hero-badge">✨ PLATAFORMA INTEGRADA</div>
          <h1 className="sobre-hero-title">Conectando Inovação, <br /><span className="gradient-text">Ensino e Mercado</span></h1>
          <p className="sobre-hero-lead">
            O <strong>SisCPTI</strong> (Sistema de Gestão do Caderno de Projetos de TI) é o ecossistema digital do UniCEUB projetado para catalogar, gerenciar e impulsionar a colaboração prática em projetos de Tecnologia da Informação.
          </p>
          
          <div className="sobre-stats-grid">
            <div className="sobre-stat-item">
              <span className="stat-number">11+</span>
              <span className="stat-label">Usuários Ativos</span>
            </div>
            <div className="sobre-stat-item">
              <span className="stat-number">4+</span>
              <span className="stat-label">Projetos no Catálogo</span>
            </div>
            <div className="sobre-stat-item">
              <span className="stat-number">3+</span>
              <span className="stat-label">Professores Orientadores</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ceub-container sobre-page-content">
        
        <section className="sobre-section">
          <h2 className="sobre-section-title">Pilares do Ecossistema</h2>
          <p className="sobre-section-subtitle">Como nossa plataforma viabiliza a cooperação acadêmica e profissional</p>
          
          <div className="sobre-features-grid">
            <div className="sobre-card">
              <div className="sobre-card-icon-wrapper">📂</div>
              <h3>Vitrine Dinâmica</h3>
              <p>Centralização completa de todas as propostas e projetos em execução, criando um portfólio rico do talento dos alunos do CEUB.</p>
            </div>
            <div className="sobre-card">
              <div className="sobre-card-icon-wrapper">🤝</div>
              <h3>Integração Prática</h3>
              <p>Estudantes podem se candidatar diretamente a projetos propostos por professores ou empresas parceiras, alinhando teoria e prática.</p>
            </div>
            <div className="sobre-card">
              <div className="sobre-card-icon-wrapper">💬</div>
              <h3>Ambientes de Trabalho</h3>
              <p>Workspaces fechados com sistema de chat dedicado, controle de entregas e compartilhamento rápido de arquivos em tempo real.</p>
            </div>
            <div className="sobre-card">
              <div className="sobre-card-icon-wrapper">📈</div>
              <h3>Gestão e Auditoria</h3>
              <p>Painel administrativo consolidado para aprovação de projetos, logs de atividades operacionais e métricas de desempenho.</p>
            </div>
          </div>
        </section>

        <section className="sobre-section">
          <h2 className="sobre-section-title">Como Funciona o Fluxo</h2>
          <p className="sobre-section-subtitle">O ciclo de vida de um projeto dentro da plataforma SisCPTI</p>
          
          <div className="workflow-timeline">
            <div className="timeline-step">
              <div className="step-badge">Passo 1</div>
              <div className="step-content">
                <h3>💡 Submissão de Proposta</h3>
                <p>Empresas externas ou professores cadastram suas ideias, especificando requisitos, quantidade de alunos e tecnologias desejadas.</p>
              </div>
            </div>
            
            <div className="timeline-step">
              <div className="step-badge">Passo 2</div>
              <div className="step-content">
                <h3>📝 Candidaturas Acadêmicas</h3>
                <p>Alunos interessados exploram o catálogo, analisam as propostas e se candidatam diretamente para as vagas disponíveis.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-badge">Passo 3</div>
              <div className="step-content">
                <h3>⚖️ Avaliação e Orientação</h3>
                <p>Coordenadores e professores orientadores revisam as propostas, selecionam as melhores equipes e autorizam o início.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-badge">Passo 4</div>
              <div className="step-content">
                <h3>🚀 Desenvolvimento no Workspace</h3>
                <p>Com a equipe formada, o Workspace do projeto é liberado para troca de mensagens, envio de links e progresso das tarefas.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="sobre-cta">
          <h3>Dê o próximo passo na sua jornada acadêmica</h3>
          <p>Navegue pelos projetos disponíveis no caderno ou realize login para registrar suas propostas e candidaturas.</p>
          <div className="sobre-cta-buttons">
            <Link to="/projetos" className="btn-primary-sobre">📂 Explorar Catálogo</Link>
            {!user ? (
              <Link to="/login" className="btn-secondary-sobre">🔑 Fazer Login</Link>
            ) : (
              <Link to="/perfil" className="btn-secondary-sobre">👤 Meu Perfil</Link>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sobre-page-content {
          max-width: 1000px;
          padding-bottom: 5rem;
          display: block !important;
        }

        .sobre-section {
          margin-bottom: 5rem;
        }

        .sobre-hero-section {
          padding: 5rem 1.5rem;
          background: linear-gradient(135deg, rgba(122, 27, 181, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 4rem;
        }
        
        .sobre-hero-card {
          width: 100%;
          max-width: 820px;
          text-align: center;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          padding: 3rem 2.5rem;
          border-radius: 12px;
          box-shadow: var(--shadow-light);
          animation: fadeInUp 0.4s ease-out;
        }
        
        .sobre-hero-badge {
          display: inline-block;
          background: rgba(122, 27, 181, 0.08);
          color: var(--purple-primary);
          padding: 0.35rem 1rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 1.2rem;
        }
        
        .sobre-hero-title {
          font-family: var(--font-title);
          font-size: clamp(2rem, 4.5vw, 3rem);
          font-weight: 800;
          line-height: 1.25;
          color: var(--text-primary);
          margin: 0 0 1.2rem 0;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, var(--purple-primary) 0%, #6366f1 70%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .sobre-hero-lead {
          font-size: 1.1rem;
          color: var(--text-secondary);
          line-height: 1.65;
          margin: 0 auto 2.5rem;
          max-width: 700px;
        }
        
        .sobre-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          border-top: 1px solid var(--border-color);
          padding-top: 2rem;
        }
        
        .sobre-stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .stat-number {
          font-family: var(--font-title);
          font-size: 2.2rem;
          font-weight: 800;
          color: var(--purple-primary);
          line-height: 1;
          margin-bottom: 0.3rem;
        }
        
        .stat-label {
          font-size: 0.82rem;
          color: var(--text-secondary);
          font-weight: 600;
          text-align: center;
        }
        
        .sobre-section-title {
          font-family: var(--font-title);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--text-primary);
          text-align: center;
          margin: 0 0 0.4rem;
        }

        .sobre-section-subtitle {
          text-align: center;
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0 auto 3rem;
          max-width: 600px;
        }
        
        .sobre-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
        }
        
        .sobre-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          padding: 2rem 1.5rem;
          border-radius: 12px;
          box-shadow: var(--shadow-light);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          text-align: left;
        }
        
        .sobre-card:hover {
          transform: translateY(-4px);
          border-color: var(--purple-primary);
          box-shadow: var(--shadow-hover);
        }
        
        .sobre-card-icon-wrapper {
          font-size: 2rem;
          background: rgba(122, 27, 181, 0.06);
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          margin-bottom: 1.2rem;
        }
        
        .sobre-card h3 {
          font-family: var(--font-title);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.6rem;
        }
        
        .sobre-card p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
        }

        .workflow-timeline {
          position: relative;
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .workflow-timeline::before {
          content: '';
          position: absolute;
          left: 45px;
          top: 20px;
          bottom: 20px;
          width: 2px;
          background: var(--border-color);
          z-index: 0;
        }

        .timeline-step {
          position: relative;
          display: flex;
          gap: 1.5rem;
          z-index: 1;
        }

        .step-badge {
          flex-shrink: 0;
          width: 90px;
          height: 36px;
          background: var(--bg-surface);
          border: 1.5px solid var(--purple-primary);
          color: var(--purple-primary);
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          box-shadow: var(--shadow-light);
        }

        .step-content {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          padding: 1.5rem;
          border-radius: 12px;
          flex-grow: 1;
          box-shadow: var(--shadow-light);
          transition: border-color 0.2s;
        }

        .step-content:hover {
          border-color: var(--purple-primary);
        }

        .step-content h4 {
          font-family: var(--font-title);
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.4rem;
        }

        .step-content p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }
        
        .sobre-cta {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          padding: 3rem 2rem;
          border-radius: 12px;
          text-align: center;
          max-width: 800px;
          margin: 2rem auto 0;
          box-shadow: var(--shadow-light);
        }
        
        .sobre-cta h3 {
          font-family: var(--font-title);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.6rem;
        }
        
        .sobre-cta p {
          color: var(--text-secondary);
          font-size: 0.95rem;
          margin: 0 0 2rem;
          line-height: 1.5;
        }
        
        .sobre-cta-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .btn-primary-sobre {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.6rem;
          background: var(--purple-bg);
          color: var(--text-on-purple) !important;
          border-radius: 6px;
          font-weight: 700;
          text-decoration: none;
          font-size: 0.9rem;
          transition: background 0.2s ease, transform 0.1s ease;
        }
        
        .btn-primary-sobre:hover {
          background: var(--purple-bg-hover);
        }

        .btn-primary-sobre:active {
          transform: translateY(1px);
        }
        
        .btn-secondary-sobre {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.6rem;
          background: transparent;
          color: var(--purple-primary);
          border: 1.5px solid var(--purple-primary);
          border-radius: 6px;
          font-weight: 700;
          text-decoration: none;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        
        .btn-secondary-sobre:hover {
          background: var(--purple-bg);
          color: #fff !important;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 768px) {
          .workflow-timeline::before {
            left: 15px;
          }
          .timeline-step {
            flex-direction: column;
            gap: 0.8rem;
          }
          .step-badge {
            width: 75px;
            height: 30px;
            font-size: 0.75rem;
            margin-left: 0px;
          }
          .workflow-timeline::before {
            display: none; 
          }
        }

        @media (max-width: 600px) {
          .sobre-hero-card {
            padding: 2rem 1.5rem;
          }
          .sobre-stats-grid {
            grid-template-columns: 1fr;
            gap: 1.2rem;
          }
        }
      `}} />
    </>
  );
}
