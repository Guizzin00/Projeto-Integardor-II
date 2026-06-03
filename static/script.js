// Controle de Tema (Modo Escuro / Modo Claro)
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  
  // Carrega o tema salvo
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }
  
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-theme");
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }
});

// Menu hambúrguer (mobile)
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.querySelector(".hamburger");
  const nav = document.querySelector(".ceub-nav");

  if (!hamburger || !nav) return;

  hamburger.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav-open");
    hamburger.classList.toggle("is-open", isOpen);
    hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
});


// Filtro de projetos
document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll(".card");

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Atualiza botão ativo
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.getAttribute("data-filter");

      cards.forEach(card => {
        const status = card.getAttribute("data-status");

        if (filter === "all" || status === filter) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
});

console.log("SisCPTI iniciado com sucesso!");

// Filtro de status e busca
document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = document.querySelectorAll(".filter-btn");
  const searchInput = document.getElementById("searchInput");
  const cards = document.querySelectorAll(".card");

  if (!searchInput && filterButtons.length === 0) return;

  let activeFilter = "all";

  // Função para aplicar filtros e busca
  function applyFilters() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    cards.forEach(card => {
      const title = card.querySelector("h4").textContent.toLowerCase();
      const status = card.getAttribute("data-status");

      const matchesSearch = searchTerm ? title.includes(searchTerm) : true;
      const matchesFilter = activeFilter === "all" || status === activeFilter;

      if (matchesSearch && matchesFilter) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  }

  // Evento de clique nos botões de filtro
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.getAttribute("data-filter");
      applyFilters();
    });
  });

  // Evento de digitação na pesquisa
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
});

// Auto-fechamento dos alertas (flash messages)
document.addEventListener("DOMContentLoaded", () => {
  const alerts = document.querySelectorAll(".alert");
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.classList.add("fade-out");
      // Remove do DOM após a animação de fade (500ms)
      setTimeout(() => {
        alert.remove();
      }, 500);
    }, 3500); // Mostra por 3.5 segundos e depois some
  });
});

// SISTEMA DE NOTIFICAÇÕES (Sino e Dropdown) & DROPDOWN DE USUÁRIO
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("notification-btn");
  const dropdown = document.getElementById("notification-dropdown");
  const badge = document.getElementById("notification-badge");
  const list = document.getElementById("notification-list");
  const markAllBtn = document.getElementById("notif-mark-all-btn");

  const userBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-menu-dropdown");

  // Fechar dropdowns ao clicar fora
  document.addEventListener("click", () => {
    if (dropdown) dropdown.style.display = "none";
    if (userDropdown) userDropdown.style.display = "none";
  });

  // Only initialize notifications if all elements are present in the DOM (e.g. when logged in)
  if (btn && dropdown && badge && list && markAllBtn) {
    // Toggle do Dropdown ao clicar no Sino
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (userDropdown) userDropdown.style.display = "none";
      const isShowing = dropdown.style.display === "flex";
      dropdown.style.display = isShowing ? "none" : "flex";
    });
    dropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Função para renderizar notificações na lista
    function renderNotifications(notifs) {
      // Atualiza o Badge vermelho
      if (notifs.length > 0) {
        badge.textContent = notifs.length;
        badge.style.display = "block";
      } else {
        badge.style.display = "none";
      }

      // Limpa a lista
      list.innerHTML = "";

      if (notifs.length === 0) {
        list.innerHTML = `<li class="notif-empty">Nenhuma notificação não lida.</li>`;
        return;
      }

      notifs.forEach(n => {
        const li = document.createElement("li");
        li.className = "notif-item";
        li.setAttribute("data-id", n.id);
        li.style.cursor = "pointer";

        li.innerHTML = `
          <div>${n.mensagem}</div>
          <small>${n.data}</small>
        `;

        // Clique individual para ler e redirecionar
        li.addEventListener("click", async () => {
          try {
            await fetch(`/api/notificacoes/ler/${n.id}`, { method: "POST" });
            if (n.link) {
              window.location.href = n.link;
            } else {
              // Se não tiver link específico, apenas recarrega para sumir da lista
              window.location.reload();
            }
          } catch (err) {
            console.error("Erro ao ler notificação:", err);
            if (n.link) window.location.href = n.link;
          }
        });

        list.appendChild(li);
      });
    }

    // Buscar notificações (Polling a cada 4 segundos)
    async function fetchNotifications() {
      try {
        const response = await fetch("/api/notificacoes");
        if (response.ok) {
          const notifs = await response.json();
          renderNotifications(notifs);
        }
      } catch (err) {
        console.error("Erro ao carregar notificações:", err);
      }
    }

    // Primeiro carregamento
    fetchNotifications();
    setInterval(fetchNotifications, 4000);

    // Marcar todas como lidas
    markAllBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/notificacoes/ler-todas", { method: "POST" });
        if (response.ok) {
          renderNotifications([]);
        }
      } catch (err) {
        console.error("Erro ao limpar notificações:", err);
      }
    });
  }

  if (userBtn && userDropdown) {
    // Toggle do Dropdown ao clicar no Botão do Usuário
    userBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (dropdown) dropdown.style.display = "none";
      const isShowing = userDropdown.style.display === "block" || userDropdown.style.display === "flex";
      userDropdown.style.display = isShowing ? "none" : "block";
    });
    userDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});

// Validação de Formulários em Tempo Real (Cadastro e Submissão)
document.addEventListener("DOMContentLoaded", () => {
  // Função auxiliar para mostrar/esconder o feedback e bordas
  function showFeedback(inputElement, isValid, message) {
    if (!inputElement) return;

    const formGroup = inputElement.closest(".form-group");
    if (!formGroup) return;

    if (isValid) {
      inputElement.classList.remove("is-invalid");
      inputElement.classList.add("is-valid");
      const feedback = formGroup.querySelector(".invalid-feedback");
      if (feedback) feedback.style.display = "none";
    } else {
      inputElement.classList.remove("is-valid");
      inputElement.classList.add("is-invalid");
      
      let feedback = formGroup.querySelector(".invalid-feedback");
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.className = "invalid-feedback";
        formGroup.appendChild(feedback);
      }
      feedback.textContent = message;
      feedback.style.display = "block";
    }
  }

  // 1. Validação da Tela de Cadastro
  const cadastroForm = document.querySelector("form[action*='cadastro']");
  if (cadastroForm) {
    const userField = cadastroForm.querySelector("input[name='username']");
    const pwField = cadastroForm.querySelector("input[name='password']");
    const confirmField = cadastroForm.querySelector("input[name='confirm']");
    const submitBtn = cadastroForm.querySelector("button[type='submit']");

    function validateCadastro() {
      let isUserValid = true;
      let isPwValid = true;
      let isConfirmValid = true;

      // Validar Username (mínimo 3 caracteres)
      if (userField) {
        const val = userField.value.trim();
        if (val.length < 3) {
          showFeedback(userField, false, "O nome de usuário deve ter pelo menos 3 caracteres.");
          isUserValid = false;
        } else {
          showFeedback(userField, true);
        }
      }

      // Validar Senha (mínimo 4 caracteres)
      if (pwField) {
        const val = pwField.value;
        if (val.length < 4) {
          showFeedback(pwField, false, "A senha deve conter ao menos 4 caracteres.");
          isPwValid = false;
        } else {
          showFeedback(pwField, true);
        }
      }

      // Validar Confirmação de Senha
      if (confirmField && pwField) {
        const val1 = pwField.value;
        const val2 = confirmField.value;
        if (val1 !== val2) {
          showFeedback(confirmField, false, "As senhas não coincidem.");
          isConfirmValid = false;
        } else if (val2.length === 0) {
          showFeedback(confirmField, false, "Por favor, confirme sua senha.");
          isConfirmValid = false;
        } else {
          showFeedback(confirmField, true);
        }
      }

      // Desabilita botão de envio se houver algum erro
      if (submitBtn) {
        submitBtn.disabled = !(isUserValid && isPwValid && isConfirmValid);
        submitBtn.style.opacity = submitBtn.disabled ? "0.6" : "1";
      }
    }

    if (userField) userField.addEventListener("input", validateCadastro);
    if (pwField) pwField.addEventListener("input", validateCadastro);
    if (confirmField) confirmField.addEventListener("input", validateCadastro);
  }

  // 2. Validação da Tela de Submissão (E-mail)
  const submitFormElement = document.querySelector(".submit-form");
  if (submitFormElement) {
    const emailField = submitFormElement.querySelector("input[name='email']");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailField) {
      emailField.addEventListener("input", () => {
        const val = emailField.value.trim();
        if (val.length > 0 && !emailRegex.test(val)) {
          showFeedback(emailField, false, "Por favor, insira um e-mail em formato válido.");
        } else if (val.length === 0) {
          showFeedback(emailField, false, "O e-mail de contato é obrigatório.");
        } else {
          showFeedback(emailField, true);
        }
      });
    }
  }
});

// Função Global para Exibir Toast Pop-ups (some em 1.5 segundos)
window.showToast = function(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  // Escolhe o emoji com base no tipo de feedback
  let icon = "🔔";
  if (type === "success") icon = "✅";
  else if (type === "error" || type === "danger") {
    icon = "❌";
    type = "error"; // Corrige danger para erro no estilo
    toast.className = "toast toast-error";
  } else if (type === "warning") icon = "⚠️";

  toast.innerHTML = `
    <span style="font-size: 1.2rem; display: flex; align-items: center;">${icon}</span>
    <span style="flex-grow: 1; line-height: 1.4;">${message}</span>
    <button class="toast-close" type="button" aria-label="Fechar">&times;</button>
  `;

  container.appendChild(toast);

  // Iniciar transição de entrada
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Função auxiliar para remover o toast com transição de saída
  function removeToast() {
    toast.classList.replace("show", "fade-out");
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  }

  // Desaparecer automaticamente em 1.5 segundos (1500ms)
  const timeoutId = setTimeout(removeToast, 1500);

  // Clique no botão fechar manual
  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      clearTimeout(timeoutId);
      removeToast();
    });
  }
};




