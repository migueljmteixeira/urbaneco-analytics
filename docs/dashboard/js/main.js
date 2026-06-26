/* ============================================================
   main.js — carregamento de dados + navegação + utilidades
   partilhadas por todas as secções do dashboard.
============================================================ */

// Ordem das classes energéticas, da PIOR para a MELHOR - usada em
// vários gráficos para manter a ordem e as cores consistentes.
const ORDEM_CLASSES = ["NT", "G", "F", "E", "D", "C", "B", "B-", "A", "A+"];

const CORES_CLASSES = {
  "A+": "#1B7F3F", "A": "#2FBE6E", "B": "#8BD448", "B-": "#C9D448",
  "C": "#F2C94C", "D": "#F2A93B", "E": "#E8743B", "F": "#E5484D",
  "G": "#B83246", "NT": "#5C6760",
};

const TIPOLOGIAS_ORDEM = ["T0", "T1", "T2", "T3", "T4+"];

/** Formata um número com separador de milhares "." (estilo português),
 * sem depender de dados de idioma do browser (alguns não os têm completos). */
function formatoPT(n, decimais = 0) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const fixo = Number(n).toFixed(decimais);
  const [inteiro, dec] = fixo.split(".");
  const comPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimais > 0 ? `${comPontos},${dec}` : comPontos;
}

/** Carrega um ficheiro JSON da pasta data/. Lança um erro claro no
 * console (em vez de falhar silenciosamente) se o ficheiro faltar -
 * útil porque cada secção depende de um ficheiro gerado pelo
 * exportar_dados_dashboard.py, e é fácil esquecer de gerar algum. */
async function carregarDados(nome) {
  try {
    const resposta = await fetch(`data/${nome}.json`);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return await resposta.json();
  } catch (erro) {
    console.error(`Não foi possível carregar data/${nome}.json -`, erro);
    return null;
  }
}

/** Anima um número de 0 até ao valor final, ao longo de ~1.2s. */
function animarNumero(elemento, valorFinal, decimais = 0) {
  const duracao = 1200;
  const inicio = performance.now();
  function frame(agora) {
    const p = Math.min(1, (agora - inicio) / duracao);
    const eased = 1 - Math.pow(1 - p, 3);
    elemento.textContent = formatoPT(valorFinal * eased, decimais);
    if (p < 1) requestAnimationFrame(frame);
    else elemento.textContent = formatoPT(valorFinal, decimais);
  }
  requestAnimationFrame(frame);
}

/** Configuração visual partilhada por todos os gráficos ApexCharts,
 * para terem sempre o mesmo aspeto (tema escuro, fontes, cores). */
function temaApexBase() {
  return {
    chart: {
      background: "transparent",
      foreColor: "#9CA39B",
      fontFamily: "'Inter', sans-serif",
      toolbar: { show: false },
      animations: { easing: "easeinout", speed: 600 },
    },
    grid: { borderColor: "rgba(242,240,233,0.08)", strokeDashArray: 3 },
    tooltip: { theme: "dark" },
    legend: { labels: { colors: "#9CA39B" }, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" },
    dataLabels: { enabled: false },
  };
}

// --- Navegação: realça a secção visível, e fecha/abre no mobile -----------
function configurarNavegacao() {
  const links = Array.from(document.querySelectorAll(".nav-links a"));
  const seccoes = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function atualizar() {
    let atual = seccoes[0];
    for (const sec of seccoes) {
      if (sec.getBoundingClientRect().top <= 100) atual = sec;
    }
    links.forEach((a) => {
      a.classList.toggle("active", a.getAttribute("href") === `#${atual.id}`);
    });
  }

  window.addEventListener("scroll", atualizar, { passive: true });
  atualizar();
}

document.addEventListener("DOMContentLoaded", configurarNavegacao);
