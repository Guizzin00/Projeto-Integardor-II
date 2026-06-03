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
- [📐 Arquitetura e Fluxo do Sistema](#-arquitetura-e-fluxo-do-sistema)
- [👥 Hierarquia e Matriz de Permissões (7 Roles)](#-hierarquia-e-matriz-de-permissões-7-roles)
- [✨ Funcionalidades Avançadas e Detalhes Técnicos](#-funcionalidades-avançadas-e-detalhes-técnicos)
- [💻 Tecnologia e Stack Completa](#-tecnologia-e-stack-completa)
- [⚙️ Guia de Variáveis de Ambiente (.env)](#️-guia-de-variáveis-de-ambiente-env)
- [🛠️ Instalação e Execução Local](#️-instalação-e-execução-local)
- [🧼 Scripts de Manutenção e Testes](#-scripts-de-manutenção-e-testes)
- [📌 Evolução do Escopo (PI I vs PI II)](#-evolução-do-escopo-pi-i-vs-pi-ii)
- [🚨 Guia de Resolução de Problemas (Troubleshooting)](#-guia-de-resolução-de-problemas-troubleshooting)
- [🗂️ Diário de Bordo / Changelog](#️-diário-de-bordo--changelog)
- [🛠️ Roadmap de Desenvolvimento](#️-roadmap-de-desenvolvimento)
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
* **Banco de Dados (Produção):** [Supabase PostgreSQL](https://supabase.com/) conectado via Connection Pooler (Porta `6543`)
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

## 📌 Evolução do Escopo (PI I vs PI II)

| Característica / Recurso | MVP (Projeto Integrador I) | Versão Completa (Projeto Integrador II) |
| :--- | :--- | :--- |
| **Banco de Dados** | SQLite local (básico / sem persistência dinâmica) | PostgreSQL em Nuvem (Supabase) + Pooler IPv4 |
| **Níveis de Usuários** | 4 Perfis básicos estáticos | 7 Roles complexos com controle de permissão |
| **Kanban do Workspace**| Sem funcionalidade interativa | Drag & Drop funcional + checklist JSON + deadlines |
| **Ambiente de Chat** | Chat simulado por formulário simples | WebSockets instantâneos + autocomplete + menções |
| **Processamento de Mídia**| Armazenamento local temporário | Supabase Storage integrado com caminhos absolutos |
| **Controle de Cadastro** | Abertura geral automática de contas | Verificação obrigatória via e-mail corporativo |
| **Visual / Design** | Layout estático ou páginas básicas | Tema claro/escuro nativo automático e CSS com variáveis |
| **Documentação PDF** | Sem emissão de arquivos | Certificados de TCC e Relatórios executivos em PDF |

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

## 🛠️ Roadmap de Desenvolvimento

#### ✅ Fase I (Projeto Integrador I - Concluída)
* Levantamento de requisitos iniciais e design de telas no Figma.
* Modelagem conceitual do Product Backlog e MVP.

#### ✅ Fase II (Projeto Integrador II - Concluída / Atual)
* Migração e persistência no PostgreSQL do Supabase + Storage.
* Sistema de 7 Roles, ativação e redefinição de senhas com e-mail HTML premium e logo CEUB.
* Workspace Kanban com Drag & Drop, checklists e datas limite.
* Chat em tempo real por WebSockets (Socket.IO) com menções `@username`.
* Métricas e visualizações (Burn-down e Gantt CSS).
* Certificados de TCC e relatórios analíticos em PDF (ReportLab).
* Ferramentas automáticas `reset_db.py` e `seed_db.py`.

#### 🔄 Fase III (Projeto Integrador III - Planejado)
* Integração de Single Sign-On (SSO) com o sistema de autenticação corporativo do UniCEUB.
* Integração de chamadas de vídeo/áudio integradas diretamente na aba de reuniões do Workspace.
* Módulo de entrega final e exportação automatizada para o Portal de Repositório de Monografias do CEUB.

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
