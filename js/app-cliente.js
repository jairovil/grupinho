// =========================================================
// Página do cliente: login por telefone+senha e exibição do cartão
// =========================================================

const loginView = document.getElementById("login-view");
const homeView = document.getElementById("home-view");
const perfilView = document.getElementById("perfil-view");
const tabbar = document.getElementById("tabbar");
const loginErro = document.getElementById("login-erro");

let clienteAtual = null;

// ---------- Login ----------
document.getElementById("btn-entrar").addEventListener("click", fazerLogin);
document.getElementById("senha-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") fazerLogin();
});

async function fazerLogin() {
  const telefone = document.getElementById("telefone-input").value;
  const senha = document.getElementById("senha-input").value;
  loginErro.style.display = "none";

  const digitos = somenteDigitos(telefone);
  if (digitos.length < 10 || !senha) {
    mostrarErroLogin("Preencha o celular (com DDD) e a senha.");
    return;
  }

  try {
    const emailAuth = telefoneParaEmailAuth(digitos);
    await firebase.auth().signInWithEmailAndPassword(emailAuth, senha);
    // onAuthStateChanged cuida do resto
  } catch (err) {
    console.error(err);
    mostrarErroLogin("Celular ou senha incorretos.");
  }
}

function mostrarErroLogin(msg) {
  loginErro.textContent = msg;
  loginErro.style.display = "block";
}

// ---------- Estado de autenticação ----------
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    loginView.style.display = "block";
    homeView.style.display = "none";
    perfilView.style.display = "none";
    tabbar.style.display = "none";
    return;
  }

  try {
    const snap = await db.collection("clientes").where("authUid", "==", user.uid).limit(1).get();
    if (snap.empty) {
      mostrarErroLogin("Conta encontrada, mas nenhum cadastro de cliente associado. Fale com o administrador.");
      await firebase.auth().signOut();
      return;
    }
    const doc = snap.docs[0];
    clienteAtual = { id: doc.id, ...doc.data() };
    renderizarHome(clienteAtual);
    loginView.style.display = "none";
    homeView.style.display = "block";
    tabbar.style.display = "flex";
  } catch (err) {
    console.error(err);
    mostrarErroLogin("Não foi possível carregar seu cartão agora. Tente novamente.");
  }
});

document.getElementById("btn-sair").addEventListener("click", () => firebase.auth().signOut());

// ---------- Abas ----------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const alvo = tab.dataset.tab;

    homeView.style.display = alvo === "home" || alvo === "friends" ? "block" : "none";
    perfilView.style.display = alvo === "perfil" ? "block" : "none";

    if (alvo === "friends") {
      document.getElementById("friends-section").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (alvo === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});

// ---------- Renderização ----------
function renderizarHome(cliente) {
  const primeiroNome = (cliente.nome || "").trim().split(/\s+/)[0] || "";
  document.getElementById("saudacao").textContent = `Olá, ${primeiroNome}! 👋`;

  const amigos = cliente.amigos || [];
  const amigosAtivos = contarAmigosAtivos(amigos);
  const resultado = calcularStatus(amigosAtivos, cliente.dataInicioTolerancia);

  document.getElementById("ring-num").innerHTML = `${amigosAtivos} <small>/ ${MINIMO_BENEFICIO}</small>`;
  document.getElementById("ring-meta").textContent = `Meta: ${MINIMO_BENEFICIO} amigos`;
  document.getElementById("ring-svg-holder").innerHTML = anelProgressoSvg(amigosAtivos, MINIMO_BENEFICIO, 84);

  const statusBlock = document.getElementById("status-block");
  const statusClass = resultado.status === "GRATUITO" ? "gratuito"
    : resultado.status === "TOLERANCIA" ? "tolerancia" : "sem";
  const statusLabel = resultado.status === "GRATUITO" ? "✅ Gratuito"
    : resultado.status === "TOLERANCIA" ? "⏳ Em tolerância" : "🔒 Sem benefício";
  statusBlock.className = `status-block ${statusClass}`;
  document.getElementById("status-value").textContent = statusLabel;
  document.getElementById("status-sub").textContent = resultado.mensagem;

  const listaEl = document.getElementById("friends-list");
  if (amigos.length === 0) {
    listaEl.innerHTML = `<div class="empty-state" style="padding:24px 20px;">Nenhum amigo cadastrado ainda.</div>`;
  } else {
    listaEl.innerHTML = amigos.map((a, idx) => `
      <div class="friend-row" style="flex-wrap:wrap; gap:8px;">
        <div class="friend-left">
          <div class="friend-check ${a.ativo ? "on" : "off"}">${a.ativo ? "✓" : "·"}</div>
          <div>
            <div class="friend-name">${escapeHtml(a.nome)}${idx >= MINIMO_BENEFICIO && a.ativo ? ' <span class="friend-tag">(Reserva)</span>' : ""}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="chip ${a.ativo ? "on" : "off"}">${a.ativo ? "ATIVO" : "INATIVO"}</span>
          ${!a.ativo && a.telefone ? `<button class="btn small auto btn-whatsapp" data-nome="${escapeHtml(a.nome)}" data-telefone="${a.telefone}" style="background:#25D366; border-color:#25D366; color:#06170e;">📲 Chamar no WhatsApp</button>` : ""}
        </div>
      </div>
    `).join("");

    listaEl.querySelectorAll(".btn-whatsapp").forEach((btn) => {
      btn.addEventListener("click", () => {
        chamarNoWhatsapp(btn.dataset.nome, btn.dataset.telefone, clienteAtual.nome);
      });
    });
  }

  const margemCard = document.getElementById("margem-card");
  if (resultado.status === "GRATUITO" && resultado.margem >= 0) {
    margemCard.style.display = "flex";
    document.getElementById("margem-sub").textContent =
      resultado.margem > 0
        ? `Você pode perder até ${resultado.margem} amigo${resultado.margem > 1 ? "s" : ""} e ainda manter o benefício.`
        : "Você está exatamente na meta. Convide mais 1 amigo para ter uma margem de segurança.";
    document.querySelector("#margem-badge span").textContent = resultado.margem;
  } else {
    margemCard.style.display = "none";
  }

  document.getElementById("perfil-avatar").textContent = (primeiroNome[0] || "?").toUpperCase();
  document.getElementById("perfil-nome").textContent = cliente.nome || "—";
  document.getElementById("perfil-telefone").textContent = formatarTelefone(cliente.telefone);

  const link = `${window.location.origin}${window.location.pathname.replace(/index\.html$/, "")}?ref=${cliente.id}`;
  document.getElementById("btn-ver-link").href = link;
  document.getElementById("btn-ver-link").setAttribute("href", link);
}

document.getElementById("btn-compartilhar").addEventListener("click", () => {
  const form = document.getElementById("compartilhar-form");
  const abrindo = form.style.display === "none";
  form.style.display = abrindo ? "block" : "none";
  if (abrindo) document.getElementById("compartilhar-telefone").focus();
});

document.getElementById("compartilhar-telefone").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-compartilhar-confirmar").click();
});

document.getElementById("btn-compartilhar-confirmar").addEventListener("click", () => {
  if (!clienteAtual) return;
  const telefoneInput = document.getElementById("compartilhar-telefone");
  const digitos = somenteDigitos(telefoneInput.value);

  if (digitos.length < 10) {
    telefoneInput.focus();
    return;
  }

  const texto = `Estou usando um app de TV muito bom e lembrei de você. Ele trava bem pouco, tem um suporte excelente e funciona muito bem. Se quiser testar, me chama que te passo mais informações!`;

  const numeroCompleto = digitos.length <= 11 ? `55${digitos}` : digitos; // assume Brasil se vier sem DDI
  const waLink = `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(texto)}`;
  window.open(waLink, "_blank");

  telefoneInput.value = "";
  document.getElementById("compartilhar-form").style.display = "none";
});

function chamarNoWhatsapp(nomeAmigo, telefoneAmigo, nomeCliente) {
  const primeiroNomeAmigo = (nomeAmigo || "").trim().split(/\s+/)[0];
  const primeiroNomeCliente = (nomeCliente || "").trim().split(/\s+/)[0];
  const mensagem = `Oi ${primeiroNomeAmigo}! Aqui é o(a) ${primeiroNomeCliente} 😊 Vi que seu acesso no Grupinho ficou inativo e isso também afeta o meu benefício. Consegue reativar/renovar pra gente continuar aproveitando juntos? Qualquer dúvida me chama!`;
  const digitos = somenteDigitos(telefoneAmigo);
  const numeroCompleto = digitos.length <= 11 ? `55${digitos}` : digitos; // assume Brasil se vier sem DDI
  const link = `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensagem)}`;
  window.open(link, "_blank");
}

function formatarTelefone(digitos) {
  const d = somenteDigitos(digitos);
  if (d.length !== 11) return digitos || "—";
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
