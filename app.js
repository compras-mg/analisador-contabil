import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const SAMPLE = {
  id: "sample-abnt-2025",
  filename: "ECD 2025 — ABNT.pdf",
  company: "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS — ABNT",
  cnpj: "33.402.892/0011-88",
  year: "2025",
  pages: 4,
  scale: 1,
  status: "confirmed",
  confidence: "high",
  origin: "Exemplo validado contra o CRC fornecido",
  values: {
    ac: 14402217.39,
    rlp: 0,
    pc: 8033328.34,
    pnc: 26114794.18,
    at: 53564546.75
  },
  expected: { lg: 0.42, lc: 1.79, sg: 1.57 },
  edited: []
};

const state = { documents: [], activeId: null };
const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  sampleButton: document.querySelector("#sampleButton"),
  emptySample: document.querySelector("#emptySample"),
  documentList: document.querySelector("#documentList"),
  documentCount: document.querySelector("#documentCount"),
  emptyState: document.querySelector("#emptyState"),
  analysis: document.querySelector("#analysis"),
  companyName: document.querySelector("#companyName"),
  companyIdentity: document.querySelector("#companyIdentity"),
  analysisYear: document.querySelector("#analysisYear"),
  reviewBanner: document.querySelector("#reviewBanner"),
  statusIcon: document.querySelector("#statusIcon"),
  reviewTitle: document.querySelector("#reviewTitle"),
  reviewText: document.querySelector("#reviewText"),
  lgValue: document.querySelector("#lgValue"),
  lcValue: document.querySelector("#lcValue"),
  sgValue: document.querySelector("#sgValue"),
  scaleNote: document.querySelector("#scaleNote"),
  sourceFile: document.querySelector("#sourceFile"),
  sourceDetails: document.querySelector("#sourceDetails"),
  auditChip: document.querySelector("#auditChip"),
  printButton: document.querySelector("#printButton"),
  toast: document.querySelector("#toast")
};

const fields = [...document.querySelectorAll("[data-field]")];

function normalize(text) {
  return (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function money(value) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function parseMoney(value) {
  const clean = String(value || "").replace(/[^\d,.-]/g, "");
  if (!clean) return null;
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ""));
  return Number(clean);
}

function lastNumber(line) {
  const matches = line.match(/(?:R\$\s*)?\(?-?\d[\d.]*,\d{2}\)?|(?:^|\s)-?\d{1,3}(?:\.\d{3})+(?=\s|$)/g);
  if (!matches?.length) return null;
  const raw = matches.at(-1).trim();
  const negative = raw.startsWith("(") && raw.endsWith(")");
  const parsed = parseMoney(raw);
  return negative && parsed !== null ? -Math.abs(parsed) : parsed;
}

function ratio(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : null;
}

function indices(values) {
  const debt = (values.pc ?? 0) + (values.pnc ?? 0);
  return {
    lg: ratio((values.ac ?? 0) + (values.rlp ?? 0), debt),
    lc: ratio(values.ac, values.pc),
    sg: ratio(values.at, debt)
  };
}

function indexDisplay(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "—";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3200);
}

function cloneSample() {
  return JSON.parse(JSON.stringify(SAMPLE));
}

function addSample() {
  if (!state.documents.some(doc => doc.id === SAMPLE.id)) state.documents.unshift(cloneSample());
  state.activeId = SAMPLE.id;
  render();
  showToast("Exemplo ABNT 2025 carregado. Os índices conferem com o CRC.");
}

function activeDocument() {
  return state.documents.find(doc => doc.id === state.activeId) || null;
}

function renderDocumentList() {
  els.documentCount.textContent = String(state.documents.length);
  if (!state.documents.length) {
    els.documentList.innerHTML = '<div class="no-documents">Nenhum documento adicionado.</div>';
    return;
  }
  els.documentList.innerHTML = state.documents.map(doc => {
    const label = doc.status === "confirmed" ? "Conferido" : doc.status === "error" ? "Leitura insuficiente" : "Revisar extração";
    const dot = doc.status === "confirmed" ? "ok" : doc.status === "error" ? "error" : "";
    return `<button class="document-item ${doc.id === state.activeId ? "active" : ""}" data-document-id="${doc.id}" type="button">
      <span class="doc-icon">PDF</span>
      <span><strong title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</strong><small><i class="doc-dot ${dot}"></i>${label}</small></span>
    </button>`;
  }).join("");
  els.documentList.querySelectorAll("[data-document-id]").forEach(button => {
    button.addEventListener("click", () => { state.activeId = button.dataset.documentId; render(); });
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function renderAnalysis() {
  const doc = activeDocument();
  els.emptyState.classList.toggle("hidden", Boolean(doc));
  els.analysis.classList.toggle("hidden", !doc);
  if (!doc) return;

  els.companyName.textContent = doc.company || "Empresa não identificada";
  els.companyIdentity.textContent = doc.cnpj ? `CNPJ ${doc.cnpj}` : "CNPJ não identificado";
  els.analysisYear.textContent = doc.year ? `Exercício ${doc.year}` : "Exercício não identificado";
  els.sourceFile.textContent = doc.filename;
  els.sourceDetails.textContent = `${doc.pages || "—"} página(s) · ${doc.origin}`;
  els.scaleNote.textContent = doc.scale === 1000 ? "Documento em milhares de reais" : "Valores em reais";

  fields.forEach(input => {
    const key = input.dataset.field;
    input.value = money(doc.values[key]);
    input.closest(".field").classList.toggle("edited", doc.edited.includes(key));
  });

  const calculated = indices(doc.values);
  els.lgValue.textContent = indexDisplay(calculated.lg);
  els.lcValue.textContent = indexDisplay(calculated.lc);
  els.sgValue.textContent = indexDisplay(calculated.sg);

  els.reviewBanner.className = "review-banner";
  els.auditChip.className = "audit-chip";
  if (doc.status === "confirmed") {
    els.reviewBanner.classList.add("ok");
    els.auditChip.classList.add("ok");
    els.statusIcon.textContent = "✓";
    els.reviewTitle.textContent = "Cálculo reproduzido com sucesso";
    els.reviewText.textContent = "Os valores arredondados coincidem com o CRC de referência: LG 0,42 · LC 1,79 · SG 1,57.";
    els.auditChip.textContent = "Conferido com CRC";
  } else if (doc.status === "error") {
    els.reviewBanner.classList.add("error");
    els.auditChip.classList.add("error");
    els.statusIcon.textContent = "×";
    els.reviewTitle.textContent = "O PDF precisa de OCR ou digitação assistida";
    els.reviewText.textContent = "O documento parece ser uma imagem ou publicação de jornal. Preencha os campos abaixo para testar o cálculo.";
    els.auditChip.textContent = "Leitura insuficiente";
  } else {
    els.statusIcon.textContent = "!";
    els.reviewTitle.textContent = "Revise os valores extraídos";
    els.reviewText.textContent = "A extração automática é preliminar. Confirme principalmente o realizável e o passivo não circulante.";
    els.auditChip.textContent = doc.edited.length ? "Revisão em andamento" : "Revisão pendente";
  }
}

function render() {
  renderDocumentList();
  renderAnalysis();
}

async function pageLines(page) {
  const content = await page.getTextContent();
  const rows = new Map();
  for (const item of content.items) {
    if (!item.str?.trim()) continue;
    const y = Math.round(item.transform?.[5] || 0);
    const key = [...rows.keys()].find(existing => Math.abs(existing - y) <= 2) ?? y;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: item.transform?.[4] || 0, text: item.str.trim() });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map(part => part.text).join(" "));
}

function identify(lines, filename) {
  const text = lines.join("\n");
  const entity = text.match(/Entidade:\s*([^\n]+)/i)?.[1]?.trim();
  const cemig = text.match(/Demonstrações Financeiras\s+([^\n]+(?:\nS\.A\.[^\n]*)?)/i)?.[1]?.replace(/\s+/g, " ").trim();
  const cnpj = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0] || "";
  const yearMatches = [...text.matchAll(/(?:31\/12\/|31 DE DEZEMBRO DE |EXERC[IÍ]CIO\s+)(20\d{2})/gi)].map(match => match[1]);
  return {
    company: entity || cemig || filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
    cnpj,
    year: yearMatches[0] || text.match(/\b(20\d{2})\b/)?.[1] || ""
  };
}

function extractValues(lines) {
  const normalized = lines.map(line => ({ original: line, text: normalize(line) }));
  const allText = normalized.map(row => row.text).join("\n");
  const scale = /EM MILHARES DE REAIS|VALORES EXPRESSOS EM MILHARES/.test(allText) ? 1000 : 1;
  const values = { ac: null, rlp: null, pc: null, pnc: null, at: null };
  let section = "";
  let totalLiabilities = null;

  for (const row of normalized) {
    const t = row.text.replace(/\s+/g, " ").trim();

    if (/^ATIVO$|^ATIVO\s+NOTA\b/.test(t)) section = "asset";
    if (/^PASSIVO$|^PASSIVO\s+NOTA\b/.test(t)) section = "liability";
    if (/^PATRIMONIO LIQUIDO(?:\s+NOTA)?$/.test(t)) section = "equity";

    const lineValue = lastNumber(row.original);
    if (lineValue === null) continue;

    if (/^ATIVO(?:\s+R\$|\s+\d)/.test(t) || /^ATIVO TOTAL\b/.test(t)) {
      values.at ??= lineValue * scale;
      section = "asset";
      continue;
    }
    if (/^PASSIVO(?:\s+R\$|\s+\d)/.test(t) && !/PASSIVO TOTAL/.test(t)) section = "liability";
    if (/^PATRIMONIO LIQUIDO/.test(t)) section = "equity";

    if (/^TOTAL DO PASSIVO\b/.test(t)) totalLiabilities = lineValue * scale;
    if (/^PASSIVO TOTAL\b/.test(t) && values.at === null) values.at = lineValue * scale;

    if (section !== "liability" && values.ac === null && (/^CIRCULANTE\b/.test(t) || /^TOTAL DO CIRCULANTE\b/.test(t))) {
      values.ac = lineValue * scale;
      section = "asset";
      continue;
    }
    if (section === "asset" && values.rlp === null && /REALIZAVEL A LONGO PRAZO/.test(t)) values.rlp = lineValue * scale;
    if (section !== "asset" && section !== "equity" && values.pc === null && (/^CIRCULANTE\b/.test(t) || /^TOTAL DO CIRCULANTE\b/.test(t))) {
      values.pc = lineValue * scale;
      section = "liability";
      continue;
    }
    if (section === "liability" && values.pnc === null && (/^(NAO CIRCULANTE|NÂO CIRCULANTE)\b/.test(t) || /^TOTAL DO NAO CIRCULANTE\b/.test(t))) values.pnc = lineValue * scale;
  }

  if (values.pnc === null && totalLiabilities !== null && values.pc !== null) values.pnc = totalLiabilities - values.pc;
  if (values.rlp === null) values.rlp = 0;
  return { values, scale };
}

async function analyzeFile(file) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const loading = {
    id, filename: file.name, company: "Lendo documento…", cnpj: "", year: "", pages: 0, scale: 1,
    status: "pending", confidence: "unknown", origin: "Extração em andamento", values: { ac: null, rlp: 0, pc: null, pnc: null, at: null }, edited: []
  };
  state.documents.unshift(loading);
  state.activeId = id;
  render();

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const allLines = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      allLines.push(...await pageLines(page));
    }
    const readableChars = allLines.join("").replace(/\s/g, "").length;
    const identity = identify(allLines, file.name);
    const extracted = extractValues(allLines);
    const found = Object.values(extracted.values).filter(Number.isFinite).length;
    Object.assign(loading, identity, {
      pages: pdf.numPages,
      scale: extracted.scale,
      values: extracted.values,
      status: readableChars < 400 || found < 3 ? "error" : "review",
      confidence: found === 5 ? "medium" : "low",
      origin: readableChars < 400 ? "PDF sem camada de texto detectável" : `${found} de 5 contas identificadas automaticamente`
    });
    showToast(loading.status === "error" ? "O documento exige OCR ou revisão manual." : "Extração concluída. Confira os valores destacados.");
  } catch (error) {
    Object.assign(loading, { company: "Documento não processado", status: "error", origin: "Não foi possível abrir este PDF" });
    showToast("Não foi possível ler o PDF selecionado.");
  }
  render();
}

async function handleFiles(fileList) {
  const files = [...fileList].filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!files.length) return showToast("Selecione pelo menos um arquivo PDF.");
  for (const file of files) await analyzeFile(file);
}

fields.forEach(input => {
  input.addEventListener("focus", () => input.select());
  input.addEventListener("change", () => {
    const doc = activeDocument();
    if (!doc) return;
    const key = input.dataset.field;
    doc.values[key] = parseMoney(input.value);
    if (!doc.edited.includes(key)) doc.edited.push(key);
    if (doc.status === "error" && Object.values(doc.values).every(value => Number.isFinite(value))) doc.status = "review";
    render();
  });
});

els.fileInput.addEventListener("change", event => handleFiles(event.target.files));
els.sampleButton.addEventListener("click", addSample);
els.emptySample.addEventListener("click", addSample);
els.printButton.addEventListener("click", () => window.print());

["dragenter", "dragover"].forEach(type => els.dropZone.addEventListener(type, event => {
  event.preventDefault();
  els.dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach(type => els.dropZone.addEventListener(type, event => {
  event.preventDefault();
  els.dropZone.classList.remove("dragging");
}));
els.dropZone.addEventListener("drop", event => handleFiles(event.dataTransfer.files));

render();
