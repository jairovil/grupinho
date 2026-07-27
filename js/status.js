// =========================================================
// GRUPINHO — regras do programa
//   0–3 amigos ativos -> Sem benefício
//   4                 -> Em período de tolerância (até 30 dias)
//   5                 -> Grátis
//   6                 -> Grátis + reserva de segurança
//   7                 -> Grátis garantido mesmo se 2 saírem
// =========================================================

const MINIMO_BENEFICIO = 5;
const DIAS_TOLERANCIA = 30;

function calcularStatus(amigosAtivos, dataInicioTolerancia) {
  if (amigosAtivos >= MINIMO_BENEFICIO) {
    const margem = amigosAtivos - MINIMO_BENEFICIO;
    let mensagem = "Seu ponto está grátis. Seu grupo está completo.";
    if (margem > 0) {
      mensagem = `Parabéns! Você tem margem de segurança de ${margem} amigo${margem > 1 ? "s" : ""}.`;
    }
    return { status: "GRATUITO", margem, diasRestantesTolerancia: null, mensagem };
  }

  if (amigosAtivos === MINIMO_BENEFICIO - 1) {
    const inicio = dataInicioTolerancia ? new Date(dataInicioTolerancia) : new Date();
    const diasPassados = Math.floor((Date.now() - inicio.getTime()) / 86400000);
    const diasRestantes = DIAS_TOLERANCIA - diasPassados;

    if (diasRestantes > 0) {
      return {
        status: "TOLERANCIA",
        margem: 0,
        diasRestantesTolerancia: diasRestantes,
        mensagem: `Você ainda mantém o benefício. Convide mais 1 amigo em até ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} para não perder o acesso.`
      };
    }
    return {
      status: "SEM_BENEFICIO",
      margem: 0,
      diasRestantesTolerancia: 0,
      mensagem: "O prazo de tolerância acabou. Convide mais amigos para reativar o benefício."
    };
  }

  return {
    status: "SEM_BENEFICIO",
    margem: 0,
    diasRestantesTolerancia: null,
    mensagem: `Faltam ${MINIMO_BENEFICIO - amigosAtivos} amigo${MINIMO_BENEFICIO - amigosAtivos > 1 ? "s" : ""} ativo${MINIMO_BENEFICIO - amigosAtivos > 1 ? "s" : ""} para liberar o benefício gratuito.`
  };
}

function proximaDataTolerancia(amigosAtivos, dataInicioToleranciaAtual) {
  if (amigosAtivos === MINIMO_BENEFICIO - 1) {
    return dataInicioToleranciaAtual || new Date().toISOString();
  }
  return null;
}

function contarAmigosAtivos(amigos) {
  return (amigos || []).filter((a) => a.ativo).length;
}

/**
 * Gera o SVG de um anel de progresso.
 * @param {number} atual
 * @param {number} meta
 * @param {number} size - diâmetro em px
 */
function anelProgressoSvg(atual, meta, size = 84) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, atual / meta));
  const offset = c * (1 - pct);
  const cor = atual >= meta ? "var(--mint)" : atual === meta - 1 ? "var(--amber)" : "var(--red)";
  return `
    <svg class="ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-border)" stroke-width="${stroke}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${cor}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size / 2} ${size / 2})" />
      <text x="50%" y="53%" text-anchor="middle" fill="${cor}" font-size="15" font-weight="700"
        font-family="Space Grotesk, sans-serif">${atual}</text>
    </svg>
  `;
}

/** Mantém só os dígitos de um telefone. */
function somenteDigitos(str) {
  return (str || "").replace(/\D/g, "");
}

/** Converte um telefone em e-mail sintético usado internamente pelo Firebase Auth. */
function telefoneParaEmailAuth(telefone) {
  return `${somenteDigitos(telefone)}@grupinho.local`;
}
