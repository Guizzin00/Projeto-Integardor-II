# 📘 Sistema de Gestão do Caderno de Projetos de TI (SisCPTI) 📝

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask Version](https://img.shields.io/badge/flask-3.0.x-green.svg)](https://flask.palletsprojects.com/)
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%7C%20Supabase-blueviolet.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/deploy-Vercel-black.svg)](https://vercel.com/)

O **SisCPTI** é um ecossistema de gestão acadêmica e corporativa desenvolvido originalmente para a disciplina de **Projeto Integrador I** e evoluído de forma robusta e em tempo real em **Projeto Integrador II** no **UniCEUB**.  

A plataforma atua como um catálogo digital centralizado, permitindo que empresas parceiras proponham desafios tecnológicos reais, coordenadores gerenciem o fluxo pedagógico, professores orientem e estudantes desenvolvam soluções integradoras organizadas sob a metodologia ágil Scrum.

---

## 📑 Sumário

- [💡 Justificativa e Objetivos](#-justificativa-e-objetivos)
- [🎯 Objetivo do Produto](#-objetivo-do-produto)
- [📊 Stakeholders](#-stakeholders)
- [📐 Arquitetura e Fluxo do Sistema](#-arquitetura-e-fluxo-do-sistema)
- [📌 Product Backlog – Scrum](#-product-backlog--scrum)
- [✅ Definição de Escopos por Fases (PI I, PI II e PI III)](#-definição-de-escopos-por-fases-pi-i-pi-ii-e-pi-iii)
- [👥 Hierarquia e Matriz de Permissões (7 Roles)](#-hierarquia-e-matriz-de-permissões-7-roles)
- [✨ Funcionalidades Avançadas e Detalhes Técnicos](#-funcionalidades-avançadas-e-detalhes-técnicos)
- [💻 Tecnologia e Stack Completa](#-tecnologia-e-stack-completa)
- [⚙️ Guia de Variáveis de Ambiente (.env)](#-guia-de-variáveis-de-ambiente-env)
- [🛠️ Instalação e Execução Local](#-instalação-e-execução-local)
- [🧼 Scripts de Manutenção e Testes](#-scripts-de-manutenção-e-testes)
- [🚨 Guia de Resolução de Problemas (Troubleshooting)](#-guia-de-resolução-de-problemas-troubleshooting)
- [🗂️ Diário de Bordo / Changelog](#-diário-de-bordo--changelog)
- [🤝 Equipe do Projeto](#-equipe-do-projeto)
- [📄 Licença](#-licença)

---

## 💡 Justificativa e Objetivos

* **Centralização Acadêmica:** Resolve a fragmentação de informações sobre projetos integradores, TCCs e parcerias externas.
* **Ciclo de Vida do Projeto Monitorado:** Acompanhamento transparente desde o rascunho de uma ideia proposta por uma empresa até o fechamento com emissão de certificado em PDF.
* **Comunicação Ativa e Direcionada:** Elimina o uso de canais externos descentralizados, integrando chat em tempo real nas próprias salas dos projetos com rastreabilidade de menções.

---

## 🎯 Objetivo do Produto

Fornecer uma plataforma web interativa, responsiva e em tempo real que otimize em **até 80% o tempo de gestão, atribuição, desenvolvimento e avaliação** dos projetos de tecnologia desenvolvidos no UniCEUB.

---

## 📊 Stakeholders

Os atores envolvidos no ciclo de vida da plataforma e suas responsabilidades são:

* **Coordenação do Curso:** Valida as diretrizes pedagógicas, supervisiona o andamento global e avalia as estatísticas agregadas através de relatórios executivos.
* **Professor Orientador (Supervisor):** Guia e valida as etapas de desenvolvimento das equipes vinculadas aos seus respectivos projetos, alterando status e emitindo notas.
* **Alunos (Desenvolvedores / Scrum Master):** Visualizam o catálogo, candidatam-se a vagas, participam de workspaces privados e movimentam o Kanban de entregas.
* **Empresas Parceiras / Clientes (Product Owners):** Propõem desafios reais do mercado de trabalho através do formulário de submissão e monitoram passivamente o progresso.
* **Administrador do Sistema (TI CEUB):** Gerencia contas de usuários, altera níveis de acessos e audita o sistema por meio de logs de eventos.

---

## 📐 Arquitetura e Fluxo do Sistema

Abaixo é apresentada a arquitetura lógica do SisCPTI, mapeando as interações em tempo real dos clientes web com os serviços de infraestrutura e nuvem:

```mermaid
graph TD
    %% Clientes e Navegadores
    subgraph Client ["Cliente (Navegador Web)"]
        UI["Interface HTML5 / CSS3 (Variáveis Globais)"]
        JS["Script Client-side (JS Vanilla / Fuse.js / Chart.js)"]
        WS_Client["Socket.IO Client"]
    end

    %% Servidor Flask
    subgraph Server ["Backend (Flask App / Vercel Serverless)"]
        App["App Principal (app.py)"]
        RoutesAuth["Rotas de Autenticação & SMTP (routes_auth.py)"]
        RoutesProj["Workspace, Kanban & Chat (routes_project.py)"]
        RoutesAdmin["Dashboards & CSV (routes_admin.py)"]
        WS_Server["Socket.IO Server (Salas por ID de Projeto)"]
        ReportLab["Gerador PDF (ReportLab / admin_report.py)"]
    end

    %% Infraestrutura & Nuvem
    subgraph Cloud ["Serviços em Nuvem / Terceiros"]
        DB_Postgres[("Supabase PostgreSQL (aws-1-sa-east-1 Pooler)")]
        Storage[("Supabase Storage (uploads bucket)")]
        SMTP["SMTP Server (Gmail TLS Port 587)"]
    end

    %% Fluxo de Conexões
    UI --> JS
    JS --> WS_Client
    
    WS_Client <-->|WebSockets Realtime| WS_Server
    JS -->|HTTP GET/POST / AJAX| App
    
    App --> RoutesAuth
    App --> RoutesProj
    App --> RoutesAdmin
    
    RoutesAuth -->|Envio de HTML Premium| SMTP
    RoutesProj -->|Upload de Anexos/Imagens| Storage
    RoutesProj -->|Geração de Certificados TCC| ReportLab
    RoutesAdmin -->|Geração de Relatórios Estatísticos| ReportLab
    
    RoutesAuth <-->|ORM SQLAlchemy| DB_Postgres
    RoutesProj <-->|ORM SQLAlchemy| DB_Postgres
    RoutesAdmin <-->|ORM SQLAlchemy| DB_Postgres
```

---

## 📌 Product Backlog – Scrum

Este é o Product Backlog do **SisCPTI** estruturado sob a metodologia ágil Scrum, organizado por Épicos e priorizado conforme as entregas acadêmicas do Projeto Integrador:

### 🔴 Épico 1 – Gestão de Usuários e Autenticação

| ID | User Story (História de Usuário) | Prioridade | Story Points | Fase / MVP | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **US01** | Como aluno ou professor, quero visualizar os projetos disponíveis no catálogo para conhecer oportunidades. | Alta | 5 | PI I | ✅ Concluído |
| **US02** | Como empresa, quero cadastrar meus dados básicos para poder submeter novos projetos de TI. | Alta | 5 | PI I | ✅ Concluído |
| **US03** | Como aluno, quero criar um perfil estruturado contendo bio e interesses acadêmicos de tecnologias para obter recomendações. | Média | 3 | PI II | ✅ Concluído |
| **US11** | Como usuário cadastrado, quero efetuar login com hash seguro de senhas e papéis (roles) definidos. | Alta | 5 | PI II | ✅ Concluído |
| **US12** | Como novo usuário, quero receber uma ativação obrigatória em meu e-mail com link de confirmação para poder acessar a plataforma. | Alta | 8 | PI II | ✅ Concluído |

### 🔴 Épico 2 – Catálogo de Projetos e Propostas

| ID | User Story (História de Usuário) | Prioridade | Story Points | Fase / MVP | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **US04** | Como empresa, quero submeter uma proposta de projeto (desafio de TI) de forma estruturada para avaliação acadêmica. | Alta | 8 | PI I | ✅ Concluído |
| **US05** | Como coordenador, quero visualizar, aprovar ou reprovar ideias submetidas pelas empresas. | Alta | 5 | PI I | ✅ Concluído |
| **US06** | Como professor, quero atualizar o status do projeto (ex.: de "Em Desenvolvimento" para "Concluído") para andamento do ciclo de vida. | Alta | 5 | PI I | ✅ Concluído |
| **US07** | Como usuário, quero clicar em um projeto para visualizar a descrição completa, requisitos e links úteis. | Alta | 3 | PI I | ✅ Concluído |
| **US13** | Como coordenador, quero selecionar e atribuir dinamicamente um Professor Orientador ao aprovar uma proposta. | Alta | 5 | PI II | ✅ Concluído |

### 🔴 Épico 3 – Workspace e Acompanhamento Ágil

| ID | User Story (História de Usuário) | Prioridade | Story Points | Fase / MVP | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **US08** | Como aluno, quero enviar uma candidatura para um projeto, descrevendo minhas experiências e motivações. | Média | 5 | PI II | ✅ Concluído |
| **US09** | Como membro de equipe, quero um quadro Kanban interativo com Drag & Drop, subtarefas e prazos de entrega. | Alta | 8 | PI II | ✅ Concluído |
| **US10** | Como integrante de projeto, quero um chat instantâneo para alinhamento rápido com WebSockets e menções `@username`. | Média | 8 | PI II | ✅ Concluído |
| **US14** | Como aluno de projeto concluído, quero emitir um Certificado acadêmico oficial em PDF assinado eletronicamente. | Média | 5 | PI II | ✅ Concluído |
| **US15** | Como administrador / coordenador, quero extrair relatórios estatísticos da plataforma em formato PDF e planilhas CSV. | Média | 5 | PI II | ✅ Concluído |
| **US16** | Como aluno ou orientador, quero visualizar gráficos de Burn-down e diagramas de Gantt para acompanhar o rendimento. | Alta | 8 | PI II | ✅ Concluído |

---

## ✅ Definição de Escopos por Fases (PI I, PI II e PI III)

### 📦 Escopo do MVP (Projeto Integrador I - Figma & Protótipo Navegável)
O objetivo do PI I foi projetar e validar o conceito inicial com um protótipo navegável contendo:
* **US01, US02, US04, US05, US06 e US07** (Catálogo simplificado, formulário de submissão e fluxo de andamento sem persistência em banco complexo).
* **Total de Story Points (MVP PI I):** 31 pontos.

### 🚀 Escopo da Evolução (Projeto Integrador II - Sistema Completo e Conectado em Nuvem)
O PI II transformou o conceito inicial em uma aplicação robusta de produção com persistência escalável:
* **US03, US11, US12, US13, US08, US09, US10, US14, US15 e US16** (Sistema de 7 papéis, banco de dados Supabase PostgreSQL, upload em nuvem, chat realtime Socket.IO com menções, Kanban interativo, PDFs automatizados, gráficos dinâmicos de Gantt/Burn-down e e-mails premium).
* **Total de Story Points (Evolução PI II):** 60 pontos.
* **Total de Story Points Acumulados no Backlog:** 91 pontos.

### 🔄 Evolução Futura (Projeto Integrador III - Planejado)
* Integração de Single Sign-On (SSO) com o sistema de autenticação corporativo (Azure AD / LDAP UniCEUB).
* Módulo de entrega final automatizada com exportação para o repositório de TCC do CEUB.
* Integração de chamadas de vídeo/áudio integradas diretamente na aba de reuniões do Workspace.

---

## 👥 Hierarquia e Matriz de Permissões (7 Roles)

O controle de privilégios e acessos nas views e nas requisições é gerenciado de forma rigorosa por perfis no banco de dados. Abaixo está a matriz detalhada de permissões:

| Funcionalidade / Tela | Admin | Coordenador | Professor | Líder | Aluno | Empresa | Cliente |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Painel de Usuários (CRUD)** | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **Auditoria e Logs do Sistema** | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **Aprovação de Ideias / Projetos** | ✅ Sim | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **Atribuição de Professor Orientador**| ✅ Sim | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **Mudar Status do Projeto (Concluir)**| ✅ Sim | ❌ Não | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **Criar/Editar Tarefas Kanban** | ✅ Sim | ❌ Não | ❌ Não | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |
| **Marcar Checklists do Kanban** | ✅ Sim | ❌ Não | ❌ Não | ✅ Sim | ✅ Sim | ❌ Não | ❌ Não |
| **Movimentar Cards (Drag & Drop)** | ✅ Sim | ❌ Não | ❌ Não | ✅ Sim | ✅ Sim | ❌ Não | ❌ Não |
| **Enviar Mensagens no Chat** | ✅ Sim | ❌ Não | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **Baixar Relatórios Administrativos** | ✅ Sim | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **Baixar Certificado em PDF** | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim | ❌ Não | ❌ Não |

---

## ✨ Funcionalidades Avançadas e Detalhes Técnicos

### 1. Chat Realtime via WebSockets (Flask-SocketIO)
* **Estrutura de Salas:** Quando o usuário acessa o Workspace, ele é inserido em uma sala Socket.IO baseada no `projeto_id` correspondente. As mensagens não sobrecarregam o servidor com requisições repetitivas.
* **Parser de Menções (`@username`):** O backend faz a leitura Regex de cada mensagem. Ao detectar `@username`, ele valida se o mencionado é um integrante do projeto e gera um registro na tabela `Notification` enviando alertas imediatos via socket para a tela do mencionado com destaque dourado (`.mention-bubble-highlight`) na bolha correspondente.
* **Dropdown de Autocomplete:** Implementação nativa no textarea do chat. Ao digitar `@`, exibe a listagem de membros do projeto permitindo navegação pelas setas do teclado e fechamento ao apertar Enter ou Escape.

### 2. Kanban com Checklists e Detecção de Atraso
* **Drag & Drop Responsivo:** Inteiramente desenvolvido em HTML5 Drag & Drop API, comunicando-se assincronamente com o endpoint `/api/projeto/<id>/tasks`.
* **Deadlines e Atraso Visual:** Ao carregar as tarefas no client-side, o script calcula a diferença entre o fuso horário local e a data de entrega. Prazos estourados pintam o badge visual de vermelho (`📅 DD/MM/YYYY`), enquanto prazos a expirar em até 2 dias recebem tonalidades laranjas.
* **Contagem de Checklists:** Um objeto JSON na coluna `checklist` armazena sub-itens. A interface calcula automaticamente a razão (ex: `3/5`) e exibe uma barra de progresso em tons de roxo integrada no card.

### 3. Métricas de Progresso (Gantt & Burn-down)
* **Gráfico de Burn-down:** Utilizando Chart.js sob o contexto da aba de métricas, o script cruza as datas de criação e conclusão das tarefas para projetar a reta de "Progresso Ideal" contra os passos do "Progresso Real" no projeto.
* **Diagrama de Gantt Acadêmico:** As tarefas do Kanban contendo prazos são organizadas de forma escalar na aba "Métricas". As durações estimadas entre data inicial e final de entrega são transformadas em larguras e distanciamentos percentuais usando CSS puro, desenhando um mapa visual do progresso.

### 4. Emissão de Documentação Executiva (ReportLab)
* **Certificados em PDF:** Desenho vetorial diretamente via código no canvas do ReportLab. Configuração de margens seguras, molduras geométricas nos tons corporativos do UniCEUB, inserção dinâmica do nome do estudante, categoria, nome do orientador e data formatada por extenso em português.
* **Relatório Corporativo PDF:** Consolida métricas gerais do sistema (número de alunos, projetos ativos e encerrados, médias gerais de satisfação por critérios) estruturadas em tabelas automáticas (`TableFlowable`) com paginação e logo no cabeçalho.

### 5. Ativação de Contas e SMTP Premium
* **Processo de Homologação:** Contas criadas por estudantes iniciam como inativas (`ativo = False`), impedindo o login no ecossistema de projetos.
* **Design de E-mail Responsivo (HTML):** O corpo do e-mail é gerado com formatação em inline-styling para compatibilidade com leitores móveis e desktop. O design apresenta:
  * Logotipo oficial do UniCEUB centralizado em alta definição.
  * Título da plataforma e descrição da ação.
  * Botão de chamada para ação (CTA) roxo proeminente com o link de ativação seguro.
  * Rodapé com disclaimer jurídico institucional.

---

## 💻 Tecnologia e Stack Completa

* **Linguagem Principal:** [Python 3.10+](https://www.python.org/)
* **Framework Web:** [Flask 3.0.2](https://flask.palletsprojects.com/)
* **ORM:** [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)
* **Banco de Dados (Produção):** [PostgreSQL (Supabase)](https://supabase.com/) conectado via Connection Pooler (Porta `6543`)
* **Armazenamento de Imagens/Anexos:** [Supabase Storage](https://supabase.com/docs/guides/storage)
* **Conexão Realtime:** [Flask-SocketIO](https://flask-socketio.readthedocs.io/)
* **Processador de PDFs:** [ReportLab 4.1.0](https://www.reportlab.com/)
* **Envio de E-mails:** Protocolo SMTP (Gmail API com suporte a TLS e porta `587`)
* **Pesquisa Client-side:** [Fuse.js](https://fusejs.io/) (Busca Fuzzy)
* **Gráficos:** [Chart.js 4.4.x](https://www.chartjs.org/)

---

## ⚙️ Guia de Variáveis de Ambiente (.env)

Crie um arquivo `.env` no diretório principal `SISCPTI/` contendo as seguintes definições para habilitar a integração em nuvem e o disparo de e-mails:

```ini
# Configuração de Conexão com o Supabase PostgreSQL (Pooler IPv4)
DATABASE_URL=postgresql://postgres.[PROJETO_ID]:[SENHA_DB]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres

# Parâmetros de Integração com o Supabase Storage
SUPABASE_URL=https://[PROJETO_ID].supabase.co
# IMPORTANTE: Use a "service_role" key para permitir o bypass das políticas RLS no upload do chat/perfil
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET=uploads

# Configurações do Servidor de E-mail (SMTP Gmail com TLS)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=seu-email-siscpti@gmail.com
# Use uma Senha de App do Google (App Password)
MAIL_PASS=sua-senha-de-app-do-google
```

---

## 🛠️ Instalação e Execução Local

Siga o passo a passo abaixo para rodar o projeto localmente em sua máquina de desenvolvimento:

### 1. Clonar o repositório
```bash
git clone https://github.com/Guizzin00/Projeto-Integardor-II.git
cd Projeto-Integardor-II/SISCPTI
```

### 2. Configurar o Ambiente Virtual (Virtualenv)
No Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

No Linux / macOS:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar as Dependências
```bash
pip install -r requirements.txt
```

### 4. Configurar as Variáveis de Ambiente
Renomeie ou crie o arquivo `.env` conforme a seção anterior e insira as credenciais do Supabase e do e-mail.

### 5. Iniciar o Servidor de Desenvolvimento
```bash
python app.py
```
O servidor estará disponível localmente em: `http://127.0.0.1:5000`

---

## 🧼 Scripts de Manutenção e Testes

Para agilizar o desenvolvimento e garantir o correto funcionamento do ecossistema, dois scripts utilitários foram disponibilizados no diretório `/SISCPTI`:

### A. Limpeza do Banco de Dados (`reset_db.py`)
Remove todas as tabelas e dados do banco conectado e reconstrói o esquema limpo (PostgreSQL do Supabase ou SQLite).
* **Modo Interativo (Seguro):**
  ```bash
  venv\Scripts\python reset_db.py
  ```
* **Modo Forçado (Bypass de confirmação):**
  ```bash
  venv\Scripts\python reset_db.py --force
  ```

### B. Carregamento de Massa de Testes (`seed_db.py`)
Zera o banco e carrega um ecossistema realista composto por:
* 11 usuários de teste contendo os 7 perfis (Senha padrão de todos: `1234`).
* 4 projetos em diferentes status com tags e escopos preenchidos.
* Tarefas de Kanban associadas com checklists completos e pendentes.
* Histórico de mensagens no chat do workspace, candidaturas, ratings multidimensionais, notificações e logs.
* **Comando:**
  ```bash
  venv\Scripts\python seed_db.py --force
  ```

---

## 🚨 Guia de Resolução de Problemas (Troubleshooting)

#### 1. Erro de Truncamento de Senha (`psycopg2.errors.StringDataRightTruncation`)
* **Problema:** A coluna `password` na tabela `user` no banco local de SQLite aceitava strings longas, mas o PostgreSQL do Supabase rejeitava hashes complexos do `scrypt` (com mais de 100 caracteres).
* **Solução:** O modelo `User` foi alterado para `db.String(255)`. O backend no `app.py` realiza automaticamente a migração segura da coluna ao iniciar.

#### 2. Erro de Assinatura Inválida do Token (`400 Invalid Compact JWS`)
* **Problema:** Ocorre no Supabase Storage quando o backend tenta criar e fazer o upload de arquivos usando a chave pública anon key que esbarra nas regras RLS.
* **Solução:** Certifique-se de configurar a variável `SUPABASE_KEY` no `.env` utilizando a chave privada secreta **`service_role`**, permitindo o bypass de permissões das pastas.

#### 3. E-mails SMTP não chegam no Vercel (Timeout de Rede)
* **Problema:** O Vercel bloqueia a porta padrão `465` (SSL direta) em contêineres serverless.
* **Solução:** O método de envio em `utils.py` foi atualizado para utilizar a porta **`587`** baseando-se no protocolo de segurança TLS (`starttls()`).

---

## 🗂️ Diário de Bordo / Changelog

O histórico de entregas semanais, correções de bugs de responsividade e log de commits do projeto pode ser acompanhado detalhadamente no arquivo:
* 📄 [Diário de Bordo / Changelog](changelog/change_log.md)

---

## 🤝 Equipe do Projeto

Este projeto foi construído pelo grupo de acadêmicos da Faculdade de Tecnologia da Informação do UniCEUB:

* **Guilherme Gouveia** (Scrum Master) — [GitHub Profile](https://github.com/GuilhermeGouveia12)
* **Davi Souza** (Desenvolvedor) — [GitHub Profile](https://github.com/davi-ssg)
* **Arthur Grangeiro** (Product Owner) — [GitHub Profile](https://github.com/ArthurGrangeiro)
* **Guilherme Oliveira** (Desenvolvedor) — [GitHub Profile](https://github.com/Guizzin00)

---

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
