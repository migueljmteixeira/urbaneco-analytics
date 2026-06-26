/* ============================================================
   section8.js — Melhores 5 Negócios por Freguesia
============================================================ */

let NEGOCIOS_DADOS = [];

async function iniciarSeccaoMelhoresNegocios() {
  NEGOCIOS_DADOS = (await carregarDados("melhores_negocios")) || [];
  const freguesias = Array.from(new Set(NEGOCIOS_DADOS.map((d) => d.freguesia)));

  const wrap = document.getElementById("mn-pills");
  if (!wrap) return;
  wrap.innerHTML = freguesias
    .map((f, i) => `<button class="pill-btn ${i === 0 ? "active" : ""}" data-freguesia="${f}">${f}</button>`)
    .join("");

  wrap.querySelectorAll(".pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mostrarNegociosFreguesia(btn.dataset.freguesia);
    });
  });

  if (freguesias.length) mostrarNegociosFreguesia(freguesias[0]);
}

function mostrarNegociosFreguesia(freguesia) {
  const lista = NEGOCIOS_DADOS.filter((d) => d.freguesia === freguesia).sort((a, b) => b.evi - a.evi);
  const el = document.getElementById("mn-cards");
  if (!el) return;

  el.innerHTML = lista
    .map(
      (d, i) => `
    <div class="card" style="opacity:1; transform:none;">
      <span class="src" style="margin-bottom:8px; display:block;">#${i + 1} · ${d.tipo} ${d.tipologia}</span>
      <div class="ttl" style="font-size:17px;">${formatoPT(d.preco)} € <span style="color:var(--ink-faint); font-size:12px; font-weight:400;">(${formatoPT(d.eur_m2)} €/m²)</span></div>
      <div class="txt">${d.morada || d.freguesia} · Classe ${d.classe_energetica || "—"} · ${d.estado}</div>
      <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
        <span class="big" style="font-size:22px;">EVI ${formatoPT(d.evi, 1)}</span>
        <a href="${d.url}" target="_blank" rel="noopener" style="font-family:var(--font-mono); font-size:12px; color:var(--accent);">ver anúncio ↗</a>
      </div>
    </div>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", iniciarSeccaoMelhoresNegocios);
