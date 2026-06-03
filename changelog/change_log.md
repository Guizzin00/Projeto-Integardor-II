# 📝 Diário de Bordo / Changelog – SisCPTI

Este arquivo documenta as atualizações, implementações, evoluções e correções realizadas no **SisCPTI** (Sistema de Gestão de Projetos de TI) durante a evolução do **Projeto Integrador II**, no período de **06/04/2026** a **03/06/2026**.

---

## 📅 Semana 1: Fundação, Modelagem e Autenticação (06/04/2026 – 12/04/2026)

### 🖥️ Backend e Banco de Dados
* **Configuração Inicial do Servidor**: Inicialização do backend em Flask (`app.py`), configurando rotas dinâmicas, controle de sessões e manipuladores de erros.
* **Modelagem Relacional (SQLite + SQLAlchemy)**: Criação do esquema inicial do banco de dados:
  * `User`: Perfis e permissões (`admin`, `professor`, `empresa`, `aluno`), dados de biografia e contato.
  * `Project`: Projetos do catálogo do UniCEUB.
  * `Submission`: Propostas de novos projetos submetidas por organizações parceiras.
  * `Application`: Registro de candidaturas de estudantes.
* **Criptografia e Segurança**: Hashing seguro de senhas com `werkzeug.security`.

### 🔑 Autenticação e Recuperação
* **Login e Cadastro**: Telas interativas (`login.html` e `cadastro.html`) com validação de credenciais e controle de sessões.
* **Recuperação de Senha**: Modelo `PasswordReset` e rotas iniciais para redefinição segura de senhas via tokens temporários.

---

## 📅 Semanas 2 e 3: Catálogo, Candidaturas e Workspace (13/04/2026 – 26/04/2026)

### 🗂️ Catálogo de Projetos
* **Listagem Dinâmica**: Renderização do catálogo direto do banco de dados (`projetos.html`) com filtros básicos por termo de busca, categoria e status.
* **Detalhes do Projeto**: Tela expandida com visualização de requisitos, cronograma e links úteis (`projeto_detalhes.html`).

### 📩 Submissão e Candidatura
* **Envio de Propostas pelas Empresas**: Interface para submissão de ideias/projetos pelas empresas (`submissao.html` e `submissao_editar.html`) com upload de imagens.
* **Candidatura de Alunos**: Envio de motivações e competências de estudantes interessados em vagas nos projetos.

### 💬 Workspace de Equipes
* **Ambiente Integrado**: Criação de um workspace para cada projeto (`workspace.html`) permitindo centralizar a interação do grupo.
* **Chat Interno**: Integração de um chat básico com suporte a mensagens e envio de anexos de arquivos (inicialmente baseado em AJAX Polling).

---

## 📅 Semanas 4 e 5: Auditoria, Dashboards e Polimento Visual (27/04/2026 – 10/05/2026)

### 📊 Painel Geral e Auditoria
* **Admin Dashboard**: Centralização do gerenciamento de usuários, submissões de empresas e aprovação de candidaturas.
* **Log de Atividades (Auditoria)**: Criação da tabela `ActivityLog` e tela de auditoria (`admin_logs.html`) para registrar ações cruciais no sistema.
* **Exportação Básica**: Download de relatórios administrativos simplificados em formato CSV.
* **Gráficos Dinâmicos**: Integração do `Chart.js` para exibir a distribuição de projetos por categoria e status.

### 🎨 Refatoração Visual e Tema Escuro Automático
* **Sincronização de Tema**: Implementação de detecção automática do tema do sistema operacional (`prefers-color-scheme`) e interruptor manual sincronizado via `localStorage`.
* **CSS Variabilizado**: Substituição de cores fixas por variáveis CSS globais (`static/style.css`), garantindo perfeita adaptação ao modo escuro.
* **Responsividade**: Redesenho de Media Queries e menu hambúrguer para dispositivos mobile.
* **Inversão da Logo do UNICEUB**: Aplicação do filtro CSS `filter: brightness(0) invert(1)` na logo institucional quando o tema escuro estiver ativo.

---

## 📅 Semanas 6 e 7: Expansão de Roles, Kanban, PDFs e WebSockets (11/05/2026 – 24/05/2026)

### 👥 Hierarquia de 7 Cargos (Roles)
* **Permissões Refinadas**: Divisão de privilégios para `admin`, `coordenador`, `professor`, `empresa`, `cliente`, `aluno` e `lider`.
* **Painel do Coordenador**: Interface exclusiva (`/coordenador`) permitindo aprovação de propostas com atribuição direta de Professores Orientadores.

### 📈 Kanban Drag & Drop e Avaliação Multidimensional
* **Kanban do Workspace**: Kanban funcional com arrastar-e-soltar de tarefas (`todo`, `doing`, `done`) e controle de permissões de visualização apenas-leitura para Clientes, Coordenadores e Empresas.
* **Avaliações Estrela (Ratings)**: Sistema de feedback multidimensional no encerramento de projetos (notas em Geral, Organização, Orientação e Aprendizado).

### 📄 Certificados ReportLab e WebSockets no Chat
* **Certificados em PDF**: Geração dinâmica de certificados em formato paisagem (landscape) com ReportLab para projetos concluídos, com assinaturas da coordenação e do orientador.
* **Chat Realtime (Socket.IO)**: Substituição do polling de 3 segundos por WebSockets em tempo real, organizando conversas por salas exclusivas de projetos.

### 🔍 Paginação, Tags e Recomendador
* **Paginação e Fuzzy Search**: Paginação de 6 itens por página no catálogo e integração do `Fuse.js` para buscas tolerantes a erros de digitação.
* **Recomendador de Projetos**: Algoritmo que lê os interesses de tecnologia no perfil do aluno e sugere projetos ideais no painel do estudante.

---

## 📅 Semanas 8 e 9: Integração Supabase, Métricas Avançadas, SMTP Premium e Ferramentas (25/05/2026 – 03/06/2026)

### ☁️ Banco de Dados PostgreSQL no Supabase & Storage
* **Migração de Banco**: Configuração da string de conexão de pooler IPv4 (`aws-1-sa-east-1`) para garantir estabilidade local e em nuvem.
* **Tratamento de String de Hashing**: Redimensionamento da coluna de senhas para `VARCHAR(255)` no PostgreSQL para evitar truncamento de hashes longos (`scrypt`).
* **Upload em Nuvem (Supabase Storage)**: Integração das rotas de chat, projeto e perfil com o bucket `uploads` do Supabase, contornando caminhos de arquivo relativos.

### 🎯 Autocomplete, Menções e Kanban Avançado
* **Autocomplete de `@username`**: Dropdown inteligente no chat e sistema de notificações reais ao mencionar colegas de equipe.
* **Checklist e Prazos no Kanban**: Kanban expandido com subtarefas (riscadas em tempo real), deadlines com coloração de alerta para tarefas atrasadas e barra de progresso.

### 📉 Gráficos de Desempenho e Relatórios Administrativos
* **Burn-down e Gantt**: Aba de métricas no Workspace exibindo o gráfico de Burn-down (ritmo ideal vs real) e diagrama de Gantt interativo gerado dinamicamente em CSS.
* **Relatório Executivo PDF**: Geração de relatórios analíticos completos em PDF para administradores contendo tabelas e estatísticas de uso da plataforma.
* **Exportação Completa (CSV)**: Exportação de logs, avaliações e projetos.

### 📧 Ativação de Contas, SMTP e E-mails Premium com Logo
* **Fluxo de Ativação**: Usuários cadastrados iniciam como inativos (`ativo = False`) e recebem e-mail com token temporário para ativação.
* **SMTP Gmail TLS**: Otimização do envio usando porta `587` e TLS (`starttls()`) para funcionamento estável no Vercel.
* **Templates HTML Premium**: E-mails de ativação e recuperação de senha estruturados em cards minimalistas responsivos, com o logotipo oficial do CEUB (`https://www.uniceub.br/imagens/logoCEUB2021.png`) no topo e botão CTA na cor roxa da identidade do SisCPTI.

### 🧹 Ferramentas de Manutenção
* **`reset_db.py`**: Script utilitário para limpar e recriar toda a estrutura do banco de dados (SQLite/Supabase).
* **`seed_db.py`**: Script de semeadura que preenche o banco com 11 usuários de papéis distintos, 4 projetos, tarefas de Kanban estruturadas, chat histórico e avaliações para validações pontuais.
