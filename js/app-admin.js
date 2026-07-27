// =========================================================
// Painel admin: login + CRUD de clientes (telefone+senha) e amigos
// =========================================================

const loginView = document.getElementById("login-view");
const painelView = document.getElementById("painel-view");
const loginErro = document.getElementById("login-erro");
const cadastroErro = document.getElementById("cadastro-erro");
const listaClientes = document.getElementById("lista-clientes");

let clientesCache = [];

// ---------- Autenticação do admin ----------
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    loginView.style.display = "none";
    painelView.style.display = "block";
    carregarClientes();
  } else {
    loginView.style.display = "block";
    painelView.style.display = "none";
  }
});

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email-input").value.trim();
  const senha = document.getElementById("senha-admin-input").value;
  loginErro.style.display = "none";
  try {
    await firebase.auth().signInWithEmailAndPassword(email, senha);
  } catch (err) {
    loginErro.textContent = "E-mail ou senha inválidos.";
    loginErro.style.display = "block";
  }
});

document.getElementById("btn-logout").addEventListener("click", () => firebase.auth().signOut());

// ---------- Cadastro de cliente (cria login telefone+senha sem derrubar o admin) ----------
document.getElementById("btn-add-cliente").addEventListener("click", async () => {
  const nome = document.getElementById("novo-nome").value.trim();
  const telefone = somenteDigitos(document.getElementById("novo-telefone").value);
  const senha = document.getElementById("novo-senha").value;
  cadastroErro.style.display = "none";

  if (!nome || telefone.length < 10 || senha.length < 6) {
    mostrarErroCadastro("Preencha nome, celular com DDD e uma senha de pelo menos 6 caracteres.");
    return;
  }

  const codigo = telefone; // documento identificado pelo telefone
  const emailAuth = telefoneParaEmailAuth(telefone);

  // App secundário: evita deslogar o admin ao criar a conta do cliente
  const appSecundario = firebase.initializeApp(firebaseConfig, "secundario-" + Date.now());

  try {
    const existente = await db.collection("clientes").doc(codigo).get();
    if (existente.exists) {
      mostrarErroCadastro("Já existe um cliente com esse celular.");
      await appSecundario.delete();
      return;
    }

    const cred = await appSecundario.auth().createUserWithEmailAndPassword(emailAuth, senha);
    const authUid = cred.user.uid;
    await appSecundario.auth().signOut();
    await appSecundario.delete();

    await db.collection("clientes").doc(codigo).set({
      nome,
      telefone,
      authUid,
      amigos: [],
      dataInicioTolerancia: null,
      criadoEm: new Date().toISOString()
    });

    document.getElementById("novo-nome").value = "";
    document.getElementById("novo-telefone").value = "";
    document.getElementById("novo-senha").value = "";
    carregarClientes();
  } catch (err) {
    console.error(err);
    await appSecundario.delete().catch(() => {});
    if (err.code === "auth/email-already-in-use") {
      mostrarErroCadastro("Já existe uma conta com esse celular.");
    } else {
      mostrarErroCadastro("Erro ao cadastrar. Tente novamente.");
    }
  }
});

function mostrarErroCadastro(msg) {
  cadastroErro.textContent = msg;
  cadastroErro.style.display = "block";
}

// ---------- Listagem ----------
async function carregarClientes() {
  listaClientes.innerHTML = `<div class="empty-state">Carregando...</div>`;
  try {
    const snap = await db.collection("clientes").orderBy("criadoEm", "desc").get();
    clientesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderizarLista();
  } catch (err) {
    console.error(err);
    listaClientes.innerHTML = `<div class="empty-state">Erro ao carregar clientes. Confira as regras do Firestore.</div>`;
  }
}

function renderizarLista() {
  if (clientesCache.length === 0) {
    listaClientes.innerHTML = `<div class="empty-state">Nenhum cliente cadastrado ainda.</div>`;
    return;
  }

  listaClientes.innerHTML = clientesCache.map((c) => {
    const amigos = c.amigos || [];
    const amigosAtivos = contarAmigosAtivos(amigos);
    const resultado = calcularStatus(amigosAtivos, c.dataInicioTolerancia);
    const statusClass = resultado.status === "GRATUITO" ? "gratuito"
      : resultado.status === "TOLERANCIA" ? "tolerancia" : "sem";
    const statusLabel = resultado.status === "GRATUITO" ? "Gratuito"
      : resultado.status === "TOLERANCIA" ? "Tolerância" : "Sem benefício";

    const chips = amigos.map((a, idx) => `
      <span class="friend-chip">
        ${escapeHtml(a.nome)}${a.telefone ? ` · ${formatarTelefone(a.telefone)}` : " · sem WhatsApp"} · ${a.ativo ? "ativo" : "inativo"}
        <button class="toggle" data-cliente="${c.id}" data-idx="${idx}" data-acao="toggle" title="alternar">⟲</button>
        <button class="remove" data-cliente="${c.id}" data-idx="${idx}" data-acao="remover" title="remover">✕</button>
      </span>
    `).join("");

    return `
      <div class="card" style="margin-bottom:14px;">
        <div class="client-summary">
          <div class="client-avatar">${(c.nome || "?")[0]?.toUpperCase() || "?"}</div>
          <div class="client-info">
            <div class="client-name">${escapeHtml(c.nome)}</div>
            <div class="client-phone">${formatarTelefone(c.telefone)}</div>
          </div>
          <span class="chip ${statusClass === "gratuito" ? "on" : "off"}" style="white-space:nowrap;">${statusLabel}</span>
        </div>

        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-num">${amigosAtivos}</div>
            <div class="stat-label">ATIVOS</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${MINIMO_BENEFICIO}</div>
            <div class="stat-label">META</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${Math.max(0, amigosAtivos - MINIMO_BENEFICIO)}</div>
            <div class="stat-label">RESERVA</div>
          </div>
        </div>

        <div style="padding:0 20px;">
          ${chips || '<span class="field-hint">Nenhum amigo adicionado.</span>'}
        </div>

        <div class="field" style="margin-top:14px; display:flex; gap:8px; padding:0 20px; flex-wrap:wrap;">
          <input type="text" placeholder="nome do amigo" class="input-novo-amigo" data-cliente="${c.id}"
            style="flex:2; min-width:120px; padding:10px 12px; border:1px solid var(--surface-border); border-radius:8px; background:var(--surface-2); color:var(--text); font-size:13px;" />
          <input type="tel" placeholder="WhatsApp (DDD+número)" class="input-novo-amigo-telefone" data-cliente="${c.id}"
            style="flex:1; min-width:150px; padding:10px 12px; border:1px solid var(--surface-border); border-radius:8px; background:var(--surface-2); color:var(--text); font-size:13px;" />
        </div>

        <div class="action-row">
          <button class="btn ghost auto small btn-add-amigo" data-cliente="${c.id}">+ amigo</button>
          <a class="btn ghost auto small" href="index.html?ref=${c.id}" target="_blank">ver cartão</a>
          <button class="btn danger auto small btn-del-cliente" data-cliente="${c.id}">excluir</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".btn-add-amigo").forEach((btn) =>
    btn.addEventListener("click", () => adicionarAmigo(btn.dataset.cliente)));
  document.querySelectorAll("[data-acao='toggle']").forEach((btn) =>
    btn.addEventListener("click", () => alternarAmigo(btn.dataset.cliente, Number(btn.dataset.idx))));
  document.querySelectorAll("[data-acao='remover']").forEach((btn) =>
    btn.addEventListener("click", () => removerAmigo(btn.dataset.cliente, Number(btn.dataset.idx))));
  document.querySelectorAll(".btn-del-cliente").forEach((btn) =>
    btn.addEventListener("click", () => excluirCliente(btn.dataset.cliente)));
}

// ---------- Ações sobre amigos ----------
async function adicionarAmigo(clienteId) {
  const inputNome = document.querySelector(`.input-novo-amigo[data-cliente="${clienteId}"]`);
  const inputTelefone = document.querySelector(`.input-novo-amigo-telefone[data-cliente="${clienteId}"]`);
  const nome = inputNome.value.trim();
  const telefone = somenteDigitos(inputTelefone.value);
  if (!nome) return;
  const cliente = clientesCache.find((c) => c.id === clienteId);
  const amigos = [...(cliente.amigos || []), { nome, telefone, ativo: true }];
  await salvarAmigos(clienteId, amigos);
}

async function alternarAmigo(clienteId, idx) {
  const cliente = clientesCache.find((c) => c.id === clienteId);
  const amigos = [...cliente.amigos];
  amigos[idx] = { ...amigos[idx], ativo: !amigos[idx].ativo };
  await salvarAmigos(clienteId, amigos);
}

async function removerAmigo(clienteId, idx) {
  const cliente = clientesCache.find((c) => c.id === clienteId);
  const amigos = cliente.amigos.filter((_, i) => i !== idx);
  await salvarAmigos(clienteId, amigos);
}

async function salvarAmigos(clienteId, amigos) {
  const cliente = clientesCache.find((c) => c.id === clienteId);
  const amigosAtivos = contarAmigosAtivos(amigos);
  const novaDataTolerancia = proximaDataTolerancia(amigosAtivos, cliente.dataInicioTolerancia);
  try {
    await db.collection("clientes").doc(clienteId).update({ amigos, dataInicioTolerancia: novaDataTolerancia });
    await carregarClientes();
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar. Tente novamente.");
  }
}

async function excluirCliente(clienteId) {
  if (!confirm("Excluir este cliente e todo o histórico do grupo? O login dele deixará de funcionar.")) return;
  try {
    await db.collection("clientes").doc(clienteId).delete();
    await carregarClientes();
  } catch (err) {
    console.error(err);
    alert("Erro ao excluir. Tente novamente.");
  }
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
