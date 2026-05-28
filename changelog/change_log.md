# 📝 Diário de Bordo / Changelog – SisCPTI

Este arquivo documenta as atualizações, implementações e correções realizadas no **SisCPTI** (Sistema de Gestão de Projetos de TI) durante a evolução do **Projeto Integrador II**, no período de **01/05/2026** a **28/05/2026**.

---

## 📅 Semanas 1 e 2: Fundação e Autenticação (01/05/2026 – 10/05/2026)

### 🖥️ Backend e Banco de Dados
* **Criação do Servidor Flask**: Inicialização do backend principal (`app.py`) integrando rotas dinâmicas e gerenciamento de sessões de usuário.
* **Modelagem Relacional (SQLite + SQLAlchemy)**: Criação das tabelas relacionais do sistema:
  * `User`: Cadastro de usuários com perfis e permissões (`admin`, `professor`, `empresa`, `aluno`), campos para biografia e email.
  * `Project`: Projetos ativos no catálogo.
  * `Submission`: Propostas de novos projetos submetidas por empresas.
  * `Application`: Candidatura de estudantes a projetos.
* **Segurança das Senhas**: Implementação de criptografia das senhas locais no banco de dados utilizando hashing seguro com `werkzeug.security` (migrando senhas legadas em texto plano para hashes criptográficos).
* **Fluxo de Autenticação Completo**:
  * Implementação de rotas e templates de **Login** e **Cadastro** (`cadastro.html` e `login.html`).
  * Controle de acesso nas rotas por meio do perfil do usuário logado (ex.: restrição de painéis administrativos).
* **Recuperação de Senha**:
  * Criação da tabela `PasswordReset` para gerenciar tokens de expiração.
  * Implementação da rota e tela de recuperação (`recuperar_senha.html` e `redefinir_senha.html`).

---

## 📅 Semana 3: Core de Projetos e Fluxos de Candidatura (11/05/2026 – 20/05/2026)

### 🗂️ Gestão e Visualização de Projetos
* **Visualização Dinâmica**: Migração da listagem estática do catálogo de projetos para renderização dinâmica via banco de dados (`projetos.html`).
* **Filtros e Buscas**: Adicionada filtragem dinâmica por termo de busca, categoria e status do projeto.
* **Página de Detalhes**: Criação da visualização expandida dos requisitos, tecnologias e links úteis dos projetos (`projeto_detalhes.html`).

### 📩 Submissão e Candidatura
* **Envio de Propostas pelas Empresas**: Implementação da tela de submissão de ideias/projetos pelas empresas (`submissao.html` e `submissao_editar.html`) com upload opcional de imagens identificadoras.
* **Candidatura de Alunos**: Implementação da tela onde os estudantes enviam suas motivações e competências para participar de um projeto (`candidatura.html`).
* **Workspace de Equipes**:
  * Criação de um ambiente de desenvolvimento integrado para cada projeto (`workspace.html`).
  * Implementação de um sistema de chat (comunicação integrada) com suporte a mensagens em tempo real e envio de anexos/arquivos.

---

## 📅 Semana 4: Dashboards, Auditoria e Polimento de Design (21/05/2026 – 28/05/2026)

### 📊 Painel Administrativo e Métricas
* **Painel Geral (Admin Dashboard)**: Centralização do gerenciamento de usuários, submissões de empresas e aprovação de candidaturas.
* **Log de Atividades (Auditoria)**: Criação do modelo `ActivityLog` e tela de logs (`admin_logs.html`) que registra todas as ações dos usuários no sistema (como login, novas submissões, alterações de perfil).
* **Exportação de Dados**: Funcionalidade para download de tabelas em formato CSV (exportação de usuários e projetos para relatórios acadêmicos).
* **Gráficos Dinâmicos**: Integração do `Chart.js` para exibir a distribuição de projetos por categoria e por status de forma visual.

### 🎨 Refatoração Visual, Tema Escuro e Acessibilidade (26/05 – 28/05)
* **Unificação do Tema Claro/Escuro**:
  * Correção do interruptor (toggled theme) no JavaScript (`static/script.js`).
  * Substituição de todas as cores hardcoded nos templates HTML por variáveis CSS globais (`static/style.css`), garantindo consistência completa no modo noturno.
  * Ajuste de contraste para textos e placeholders nos campos de formulários em ambas as cores de tema.
* **Inversão da Logo do UNICEUB**:
  * Configuração de classe CSS `.ceub-logo` com aplicação de filtro dinâmico (`filter: brightness(0) invert(1)`) para que a logo do CEUB fique completamente branca apenas quando o tema escuro estiver ativo.
* **Correção de Responsividade**:
  * Redesenho das regras de Media Queries para telas de tablets e smartphones (abaixo de 768px).
  * Correção do menu sanduíche (hamburguer menu) do cabeçalho que apresentava quebra visual.
* **Gráficos Adaptativos**:
  * Configuração no JavaScript para re-renderizar dinamicamente as cores dos textos, eixos e linhas do Chart.js baseando-se na ativação do tema claro/escuro.
* **Estabilização de Versionamento**:
  * Criação do arquivo `.gitignore` para proteção de dados do SQLite (`siscpti.db`), arquivos locais de upload de testes e caches do python (`__pycache__`).
  * Integração total das alterações e push bem-sucedido para o repositório oficial no GitHub.
