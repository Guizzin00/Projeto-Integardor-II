# 🚀 Como Iniciar o Projeto (SisCPTI)

Este guia orienta sobre como configurar, popular e testar o **Sistema de Gestão do Caderno de Projetos de TI (SisCPTI)**.

A plataforma está preparada para operar em **dois modos**:
1. **Modo 100% Local (Padrão/Recomendado para Testes Rápidos):** Utiliza um banco de dados local SQLite, salva uploads localmente no disco e exibe links de ativação/recuperação diretamente no terminal.
2. **Modo Nuvem (Opcional):** Utiliza banco PostgreSQL no Supabase, armazenamento em Supabase Storage e disparos de e-mail de ativação reais via SMTP.

---

## 📋 Pré-requisitos

Certifique-se de possuir em seu computador:
1. **Python 3.10 ou superior** instalado.
2. Um terminal (PowerShell, Command Prompt, bash, etc.).

---

## 🛠️ Passo a Passo para Configuração e Inicialização

### Passo 1: Navegar até a pasta do projeto
Abra o terminal na pasta raiz do repositório e acesse a pasta da aplicação:
```bash
cd SISCPTI
```

### Passo 2: Criar e ativar o Ambiente Virtual (Venv)
O ambiente virtual isola as dependências da aplicação para evitar conflitos de bibliotecas.

* **No Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
  *(Caso o script seja bloqueado por políticas de segurança do Windows, execute `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` e tente ativar novamente).*

* **No Linux / macOS:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### Passo 3: Instalar as Dependências
Com a venv ativa, instale todas as bibliotecas necessárias:
```bash
pip install -r requirements.txt
```

### Passo 4: Configurar o arquivo de Ambiente (`.env`)
Na pasta `SISCPTI/`, você encontrará ou poderá criar o arquivo `.env`.

* **Para rodar 100% LOCAL (Recomendado):**
  Deixe o arquivo `.env` vazio ou sem variáveis de nuvem. O Flask ativará automaticamente os fallbacks locais:
  * Banco de Dados: SQLite local (`siscpti.db` criado na pasta `instance/`).
  * Uploads de Imagens: Salvos localmente na pasta `static/img/uploads/`.
  * E-mails: Impressos diretamente no console do terminal (Console Fallback) para que você possa copiar os links de ativação/recuperação.

* **Para rodar em NUVEM (Opcional):**
  Preencha as chaves do Supabase e do SMTP no arquivo `.env`:
  ```ini
  DATABASE_URL=postgresql://postgres.[PROJETO_ID]:[SENHA_DB]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
  SUPABASE_URL=https://[PROJETO_ID].supabase.co
  SUPABASE_KEY=sua-service-role-key-do-supabase
  SUPABASE_BUCKET=uploads
  
  MAIL_SERVER=smtp.gmail.com
  MAIL_PORT=587
  MAIL_USER=seu-email-siscpti@gmail.com
  MAIL_PASS=sua-senha-de-app-do-google
  ```

### Passo 5: Popular o Banco de Dados de Teste
Para preencher o banco de dados (seja ele o SQLite local ou o PostgreSQL do Supabase configurado) com dados fictícios estruturados de teste:
```bash
# Com a venv ativa e dentro da pasta SISCPTI/
python seed_db.py --force
```

### Passo 6: Iniciar o Servidor
Execute a aplicação Flask localmente:
```bash
python app.py
```

### Passo 7: Acessar a Plataforma
Abra o navegador e acesse: [http://localhost:5000](http://localhost:5000)

---

## 👥 Credenciais de Acesso (Dados de Teste)

Todos os usuários abaixo são gerados automaticamente pelo script `seed_db.py` e possuem a senha padrão **`1234`**:

| Usuário | E-mail associado | Cargo (Role) | Objetivo de Teste |
| :--- | :--- | :--- | :--- |
| `admin` | `admin@ceub.br` | Administrador | CRUD de usuários, logs e relatórios globais |
| `coord1` | `coord1@ceub.br` | Coordenador | Aprovação de propostas e atribuição de orientador |
| `prof.ana` | `ana.silva@ceub.br` | Professor | Orientação, mover projetos, inserir avaliação |
| `prof.carlos`| `carlos.souza@ceub.br` | Professor | Orientação de projetos e supervisão |
| `lider.bruno`| `bruno.lima@aluno.ceub.br` | Líder (Scrum Master) | Criar/editar tarefas no Kanban e subtarefas |
| `aluno.lucas`| `lucas.silva@aluno.ceub.br` | Aluno (Dev) | Interação no chat, alteração de checklists |
| `aluno.julia`| `julia.santos@aluno.ceub.br` | Aluno (Dev) | Verificação de tarefas atribuídas no Kanban |
| `empresa.tech`| `contato@techsolutions.com` | Empresa | Leitura de workspaces e chat de PO |
| `cliente.maria`| `maria.po@cliente.com` | Cliente (PO) | Acompanhamento apenas-leitura |
| `user.inativo`| `inativo@aluno.ceub.br` | Aluno (Inativo) | Teste de bloqueio de login e link de ativação |

---

## 🔬 Roteiro de Testes Acadêmicos Recomendados

### Cenário 1: Cadastro e Ativação de Conta (Bloqueio Pedagógico)
1. Acesse `/cadastro` e crie um novo usuário.
2. Tente logar com os dados informados. O sistema deve **recusar** com o alerta: *"Esta conta ainda não foi ativada"*.
3. **No Modo Local:** Vá até a janela do terminal onde a aplicação está rodando. O link de ativação foi impresso no console. Copie-o e cole-o no seu navegador.
4. Tente o login novamente: o acesso estará liberado com sucesso.

### Cenário 2: Aprovação de Projetos (Fluxo do Coordenador)
1. Faça login como `coord1` (senha `1234`).
2. Acesse o **Painel Coord.** no cabeçalho.
3. Visualize as propostas de empresas e selecione **Aprovar**. Escolha a professora `Ana Silva` no seletor e envie.
4. O novo projeto será criado no catálogo automaticamente e atribuído à orientadora.

### Cenário 3: Kanban e Limitações de Acesso
1. Faça login como `cliente.maria` (Cliente) ou `empresa.tech` e acesse o Workspace do Projeto #1.
2. Tente arrastar um cartão ou alterar itens do checklist da tarefa.
3. O sistema **bloqueará a ação** e restaurará a posição do card, exibindo aviso de permissão de leitura.
4. Repita o teste logando com `lider.bruno` (Líder). Você poderá arrastar cartões e salvar alterações livremente.

### Cenário 4: Chat Realtime e Notificações de Menção
1. Abra duas abas anônimas lado a lado no navegador.
2. Faça login na Aba A como `aluno.julia` e na Aba B como `aluno.lucas`.
3. Na Aba A, envie uma mensagem no chat contendo `@aluno.lucas`.
4. Na Aba B, o chat será atualizado na hora (sem recarregar a página) e uma notificação flutuante avisará: *"Você foi mencionado por @aluno.julia!"*. A bolha da mensagem ficará em destaque dourado.

### Cenário 5: Emissão de Certificados PDF
1. Faça login como `aluno.julia`.
2. Acesse os detalhes do Projeto #3 (que possui status **CONCLUÍDO** no banco).
3. Clique em **Emitir Certificado**. Um documento PDF em formato paisagem com layout acadêmico oficial, assinaturas digitais da coordenação e orientador será gerado na hora.

---

## 🗂️ Organização das Ferramentas Úteis (`/SISCPTI`)

* **`reset_db.py`**: Limpa as tabelas existentes no banco local ou na nuvem do Supabase.
* **`seed_db.py`**: Limpa o banco de dados e insere a massa de testes completa documentada neste guia.
