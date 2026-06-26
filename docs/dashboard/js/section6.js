/* ============================================================
   section6.js — Oportunidades por Freguesia
   Cruza o Índice Verde com o "Energy Gap" (% de stock ineficiente,
   classes C a G) calculado a partir de distribuicao_energetica.
============================================================ */

const CLASSES_INEFICIENTES = ["C", "D", "E", "F", "G"];

async function iniciarSeccaoOportunidades() {
  const [distribuicao, indiceVerde] = await Promise.all([
    carregarDados("distribuicao_energetica"),
    carregarDados("indice_verde"),
  ]);
  if (!distribuicao || !indiceVerde) return;

  const gapPorFreguesia = calcularEnergyGap(distribuicao);
  graficoOportunidades(gapPorFreguesia, indiceVerde.geral);
  identificarParadoxo(gapPorFreguesia, indiceVerde.geral);
}

function calcularEnergyGap(distribuicao) {
  const porFreguesia = {};
  distribuicao.forEach((d) => {
    porFreguesia[d.freguesia] = porFreguesia[d.freguesia] || { total: 0, ineficiente: 0 };
    porFreguesia[d.freguesia].total += d.stock;
    if (CLASSES_INEFICIENTES.includes(d.classe_energetica)) {
      porFreguesia[d.freguesia].ineficiente += d.stock;
    }
  });
  const resultado = {};
  for (const [freguesia, v] of Object.entries(porFreguesia)) {
    resultado[freguesia] = v.total > 0 ? (v.ineficiente / v.total) * 100 : 0;
  }
  return resultado;
}

function graficoOportunidades(gap, geral) {
  const el = document.querySelector("#grafico-oportunidades");
  if (!el) return;
  const ordenado = [...geral].sort((a, b) => b.indice_verde_100 - a.indice_verde_100);
  const freguesias = ordenado.map((d) => d.freguesia);

  const opcoes = {
    ...temaApexBase(),
    chart: { ...temaApexBase().chart, type: "bar", height: 380 },
    series: [
      { name: "Índice Verde", data: ordenado.map((d) => Number(d.indice_verde_100)) },
      { name: "Energy Gap (%)", data: freguesias.map((f) => Math.round((gap[f] || 0) * 10) / 10) },
    ],
    colors: ["#2FBE6E", "#E5484D"],
    plotOptions: { bar: { columnWidth: "60%", borderRadius: 4 } },
    xaxis: { categories: freguesias, labels: { style: { fontSize: "11px" } } },
  };
  new ApexCharts(el, opcoes).render();
}

function identificarParadoxo(gap, geral) {
  const el = document.getElementById("oportunidade-callout");
  if (!el) return;
  // freguesia com IV acima da mediana E gap acima da mediana = "paradoxo"
  const ivs = geral.map((d) => Number(d.indice_verde_100));
  const gaps = Object.values(gap);
  const medIv = ivs.slice().sort((a, b) => a - b)[Math.floor(ivs.length / 2)];
  const medGap = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

  const candidatos = geral
    .filter((d) => Number(d.indice_verde_100) >= medIv && (gap[d.freguesia] || 0) >= medGap)
    .sort((a, b) => (gap[b.freguesia] || 0) - (gap[a.freguesia] || 0));

  if (candidatos.length) {
    const top = candidatos[0];
    el.innerHTML = `<b>${top.freguesia}</b> combina Índice Verde acima da mediana (${formatoPT(top.indice_verde_100, 1)}) com ${formatoPT(gap[top.freguesia], 1)}% de stock energeticamente ineficiente — a maior oportunidade de reabilitação numa zona já desejável.`;
  } else {
    el.textContent = "Sem dados suficientes para identificar oportunidades neste momento.";
  }
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoOportunidades);
