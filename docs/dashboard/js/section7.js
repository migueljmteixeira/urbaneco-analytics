/* ============================================================
   section7.js — Site de Pesquisa de Imóveis
============================================================ */

let PESQUISA_DADOS = [];
const LIMITE_RESULTADOS = 60;

async function iniciarSeccaoPesquisa() {
  PESQUISA_DADOS = (await carregarDados("imoveis_pesquisa")) || [];
  popularFiltrosPesquisa();

  const ids = [
    "pq-freguesia", "pq-tipo", "pq-tipologia", "pq-classe",
    "pq-energy-desc", "pq-categoria", "pq-classificacao",
    "pq-preco-min", "pq-preco-max",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", aplicarFiltrosPesquisa);
  });

  const reset = document.getElementById("pq-reset");
  if (reset) reset.addEventListener("click", () => {
    ids.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    aplicarFiltrosPesquisa();
  });

  aplicarFiltrosPesquisa();
}

function valoresUnicos(campo) {
  return Array.from(new Set(PESQUISA_DADOS.map((d) => d[campo]).filter(Boolean))).sort();
}

function popularSelect(id, valores) {
  const el = document.getElementById(id);
  if (!el) return;
  valores.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

function popularFiltrosPesquisa() {
  popularSelect("pq-freguesia", valoresUnicos("freguesia"));
  popularSelect("pq-tipo", valoresUnicos("tipo"));
  popularSelect("pq-tipologia", TIPOLOGIAS_ORDEM.filter((t) => valoresUnicos("tipologia").includes(t)));
  popularSelect("pq-classe", ORDEM_CLASSES.filter((c) => valoresUnicos("classe_energetica").includes(c)));
  popularSelect("pq-energy-desc", valoresUnicos("energy_score_descricao"));
  popularSelect("pq-categoria", ["Excelente", "Bom", "Médio", "Fraco", "Muito Fraco"].filter((c) => valoresUnicos("categoria").includes(c)));
  popularSelect("pq-classificacao", valoresUnicos("classificacao"));
}

function aplicarFiltrosPesquisa() {
  const v = (id) => document.getElementById(id)?.value || "";
  const freguesia = v("pq-freguesia"), tipo = v("pq-tipo"), tipologia = v("pq-tipologia");
  const classe = v("pq-classe"), energyDesc = v("pq-energy-desc"), categoria = v("pq-categoria");
  const classificacao = v("pq-classificacao");
  const precoMin = parseFloat(v("pq-preco-min")); const precoMax = parseFloat(v("pq-preco-max"));

  const filtrados = PESQUISA_DADOS.filter((d) => {
    if (freguesia && d.freguesia !== freguesia) return false;
    if (tipo && d.tipo !== tipo) return false;
    if (tipologia && d.tipologia !== tipologia) return false;
    if (classe && d.classe_energetica !== classe) return false;
    if (energyDesc && d.energy_score_descricao !== energyDesc) return false;
    if (categoria && d.categoria !== categoria) return false;
    if (classificacao && d.classificacao !== classificacao) return false;
    if (!isNaN(precoMin) && (d.preco ?? 0) < precoMin) return false;
    if (!isNaN(precoMax) && (d.preco ?? 0) > precoMax) return false;
    return true;
  });

  document.getElementById("pq-resultados-count").textContent =
    `${formatoPT(filtrados.length)} imóve${filtrados.length === 1 ? "l" : "is"} encontrado(s)` +
    (filtrados.length > LIMITE_RESULTADOS ? ` · a mostrar os primeiros ${LIMITE_RESULTADOS}` : "");

  const tbody = document.querySelector("#tabela-pesquisa tbody");
  tbody.innerHTML = filtrados
    .slice(0, LIMITE_RESULTADOS)
    .map(
      (d) => `
    <tr>
      <td>${d.freguesia}</td>
      <td>${d.tipo}</td>
      <td>${d.tipologia}</td>
      <td>${d.estado || "—"}</td>
      <td>${d.classe_energetica || "—"}</td>
      <td>${d.preco ? formatoPT(d.preco) + " €" : "—"}</td>
      <td>${d.eur_m2 ? formatoPT(d.eur_m2) + " €/m²" : "—"}</td>
      <td>${d.evi !== null && d.evi !== undefined ? formatoPT(d.evi, 1) : "—"}</td>
      <td>${d.categoria || "—"}</td>
      <td>${d.classificacao}</td>
      <td><a href="${d.url}" target="_blank" rel="noopener">ver ↗</a></td>
    </tr>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoPesquisa);
