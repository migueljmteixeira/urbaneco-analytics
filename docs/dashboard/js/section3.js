/* ============================================================
   section3.js — Serviços e Equipamentos por Freguesia
   (espelha a página "Informação Serviços por Freguesia" do Power BI)
============================================================ */

const SERVICOS_CONFIG = [
  { campo: "rank_verde", titulo: "Espaços Verdes", sub: "km / km²", cor: "#2FBE6E" },
  { campo: "rank_ciclovias", titulo: "Ciclovias", sub: "km / km²", cor: "#8BD448" },
  { campo: "rank_ev", titulo: "Carregadores EV", sub: "EV / 1k hab.", cor: "#F2C94C" },
  { campo: "rank_metro", titulo: "Estações de Metro", sub: "Metro / 1k hab.", cor: "#F2A93B" },
  { campo: "rank_csp", titulo: "Cuidados de Saúde Primários", sub: "1k hab.", cor: "#E8743B" },
  { campo: "rank_desporto", titulo: "Equipamentos Desportivos", sub: "Equip. / km²", cor: "#2FBE6E" },
  { campo: "rank_eb", titulo: "Escolas Básicas", sub: "Esc. / 1k hab.", cor: "#8BD448" },
  { campo: "rank_es", titulo: "Escolas Secundárias", sub: "Esc. / 1k hab.", cor: "#F2C94C" },
];

async function iniciarSeccaoServicos() {
  const dados = await carregarDados("indice_verde");
  if (!dados) return;
  const rankings = dados.rankings;

  SERVICOS_CONFIG.forEach((cfg, i) => {
    const el = document.querySelector(`#grafico-servico-${i}`);
    if (!el) return;
    const ordenado = [...rankings].sort((a, b) => (b[cfg.campo] ?? 0) - (a[cfg.campo] ?? 0));

    const opcoes = {
      ...temaApexBase(),
      chart: { ...temaApexBase().chart, type: "bar", height: 220 },
      series: [{ name: cfg.titulo, data: ordenado.map((d) => Number(d[cfg.campo] ?? 0)) }],
      colors: [cfg.cor],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "60%" } },
      xaxis: { categories: ordenado.map((d) => d.freguesia), labels: { style: { fontSize: "10.5px" } } },
      grid: { ...temaApexBase().grid, yaxis: { lines: { show: false } } },
    };
    new ApexCharts(el, opcoes).render();
  });
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoServicos);
