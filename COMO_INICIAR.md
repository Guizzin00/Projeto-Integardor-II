# 🚀 Como Iniciar o Projeto (SisCPTI)

Este documento orienta sobre como configurar e executar o **Sistema de Gestão do Caderno de Projetos de TI (SisCPTI)** localmente em seu computador.

---

## 📋 Pré-requisitos

Certifique-se de ter instalado em sua máquina:
1. **Python 3.10 ou superior** (com o instalador `pip` atualizado).
2. Um terminal de sua escolha (PowerShell, Command Prompt, Git Bash ou terminal do Linux/macOS).

---

## 🛠️ Passo a Passo para Execução

Siga os passos abaixo no seu terminal para rodar o aplicativo:

### Passo 1: Navegar até a pasta do projeto
Abra o seu terminal na pasta raiz do repositório e navegue até o diretório onde o backend do Flask está localizado:
```bash
cd SISCPTI
```

### Passo 2: Criar e ativar um Ambiente Virtual (Venv)
Recomenda-se criar um ambiente virtual isolado para não misturar os pacotes com outras aplicações do computador.

* **No Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\activate
  ```
  *(Nota: Se houver restrições de execução de scripts no PowerShell, execute `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` antes).*

* **No Windows (Command Prompt - cmd):**
  ```cmd
  python -m venv venv
  call venv\Scripts\activate
  ```

* **No Linux / macOS:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### Passo 3: Instalar as Dependências
Com o ambiente virtual ativado, instale todas as bibliotecas requeridas executando:
```bash
pip install -r requirements.txt
```

### Passo 4: Executar a Aplicação
Inicie o servidor de desenvolvimento do Flask:
```bash
python app.py
```

### Passo 5: Acessar no Navegador
Quando o terminal exibir que o servidor está rodando, abra o seu navegador de preferência e acesse:
```
http://127.0.0.1:5000
```
ou
```
http://localhost:5000
```

---

## 🗂️ Estrutura dos Arquivos Principais

Agora que o projeto está modularizado, os arquivos principais do sistema dentro da pasta `SISCPTI/` são:
* **`app.py`**: Ponto de entrada que carrega a aplicação, executa as migrações de banco de dados e inicia o servidor local.
* **`app_instance.py`**: Declara a instância central unificada do Flask e ativa o banco de dados (evitando problemas de importação duplicada ou erro 404).
* **`models.py`**: Modelos relacionais das tabelas do banco de dados (User, Project, Submission, etc.).
* **`utils.py`**: Funções auxiliares (envio de e-mail e registro de logs de atividade).
* **`routes_core.py`**: Rotas da página inicial (`/`), página sobre (`/sobre`) e páginas de erros (404, 403, 500).
* **`routes_auth.py`**: Rotas de controle de acesso (login, logout, cadastro, recuperação de senha e alteração de perfil).
* **`routes_project.py`**: Rotas de visualização de projetos, candidaturas de alunos, submissão de propostas por empresas e workspace com chat integrado.
* **`routes_admin.py`**: Rotas do painel do administrador, auditorias de log, exportações de relatórios em CSV e gráficos estatísticos.

---

## 👥 Criando Contas e Acesso
Como o banco de dados é gerado automaticamente na primeira execução (`siscpti.db` na pasta `instance/` ou pasta do app):
1. **Primeiro Acesso**: Acesse a rota `/cadastro` para criar seu usuário principal.
2. **Cargos (Roles)**: Os usuários são criados por padrão com papel de `'user'` (aluno/empresa). Para testar a funcionalidade de administrador, você pode alterar o campo `role` para `'admin'` diretamente no banco de dados SQLite ou criar um usuário com o script adequado.

---

## 🧪 Banco de Dados de Teste (Dados Reais para QA)

Para facilitar testes completos da plataforma, disponibilizamos o script **`scratch/populate_db.py`** que **apaga e recria** o banco de dados com dados realistas e completos.

### ▶️ Como popular o banco de dados de teste:
```bash
# A partir da raiz do repositório (Projeto-Integardor-II/)
python scratch/populate_db.py
```

> ⚠️ **Atenção**: Este comando **apaga todos os dados existentes** e recria o banco do zero. Use apenas em ambiente local de desenvolvimento.

---

### 🔑 Credenciais de Acesso (Dados de Teste)

| Tipo | Usuário | Senha | Papel |
| :--- | :--- | :--- | :--- |
| 👑 Administrador | `admin` | `admin123` | admin |
| 🎓 Aluno | `gabriel.silva` | `teste123` | user |
| 🎓 Aluna | `julia.souza` | `teste123` | user |
| 🎓 Aluno | `lucas.nunes` | `teste123` | user |
| 🎓 Aluna | `mariana.costa` | `teste123` | user |
| 👨‍🏫 Professor | `prof.flavio` | `teste123` | user |
| 👨‍🏫 Professora | `prof.ana` | `teste123` | user |
| 👨‍🏫 Professor | `prof.ricardo` | `teste123` | user |
| 🏢 Empresa | `google_brasil` | `teste123` | user |
| 🏢 Empresa | `meta_devs` | `teste123` | user |
| 🏢 Empresa | `softex_df` | `teste123` | user |

---

### 📦 O que o banco de teste contém:

| Entidade | Quantidade | Descrição |
| :--- | :---: | :--- |
| **Usuários** | 11 | 1 admin, 4 alunos, 3 professores, 3 empresas |
| **Projetos** | 4 | Web, Mobile, IA e IoT em diferentes status |
| **Submissões** | 3 | 1 em análise, 1 aprovada, 1 rejeitada |
| **Candidaturas** | 5 | 2 aprovadas, 1 pendente, 1 rejeitada em projetos diferentes |
| **Mensagens (Chat)** | 5 | Conversa completa no workspace do Projeto #1 |
| **Avaliações** | 3 | Com notas de 4 e 5 estrelas e comentários detalhados |
| **Notificações** | 3 | Algumas lidas, outras não lidas (para testar o sino) |
| **Logs de Auditoria** | 6 | Histórico de ações do sistema para o painel admin |

---

### 🔬 Cenários de Teste Recomendados

1. **Testar painel admin** → Login com `admin` / `admin123`, acesse `/admin`.
2. **Testar workspace com chat** → Login com `gabriel.silva` / `teste123`, acesse `/projeto/1/workspace`.
3. **Testar candidatura pendente** → Login com `lucas.nunes` / `teste123`, veja sua candidatura **PENDENTE** no perfil do Projeto #1.
4. **Testar candidatura rejeitada** → Login com `mariana.costa` / `teste123`, veja a candidatura **REJEITADA** no Projeto #2.
5. **Testar notificação não lida** → Login com `lucas.nunes` / `teste123`, o sino 🔔 deve exibir uma notificação não lida.
6. **Testar avaliação de projetos** → Login com qualquer usuário e avalie o Projeto #3 (Concluído).
7. **Testar exportação de CSV** → Login com `admin`, vá em `/admin` e exporte candidaturas ou usuários.

---

## 📂 Pasta `scratch/`
A pasta `scratch/` na raiz do projeto é uma área de rascunho utilizada para **scripts temporários, testes experimentais e depurações rápidas**.
* **`create_admin.py`**: Cria ou redefine o usuário administrador do sistema.
* **`populate_db.py`**: Popula o banco com dados realistas completos para testes de QA.
* Os demais arquivos são experimentos de validação técnica e **não são necessários** para a execução do sistema.


