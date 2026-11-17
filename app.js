"use strict";

/* ============ Utilidades ============ */
const $ = (id) => document.getElementById(id);
const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const stripAccents = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============ CsvParticipantStore ============ */
class CsvParticipantStore {
  constructor() { this.items = []; }

  static DEMO = [
    ["Dr. Yo Homero", "Ponente", "laura.mendez@demo.mx"],
    ["Ing. Yael Ruiz", "Ponente", "carlos.ruiz@demo.mx"],
    ["M.C. Elvis Teck", "Ponente", "sofia.herrera@demo.mx"],
    ["Andrea Torres", "Organizador", "andrea.torres@demo.mx"],
    ["Miguel Ángel Cruz", "Organizador", "miguel.cruz@demo.mx"],
    ["Valeria Ortiz", "Organizador", "valeria.ortiz@demo.mx"],
    ["Diego Ramírez", "Asistente", "diego.ramirez@demo.mx"],
    ["Fernanda López", "Asistente", "fernanda.lopez@demo.mx"],
    ["Jorge Castillo", "Asistente", "jorge.castillo@demo.mx"],
    ["Camila Vargas", "Asistente", "camila.vargas@demo.mx"],
    ["Luis Navarro", "Asistente", "luis.navarro@demo.mx"],
    ["Mariana Soto", "Asistente", "mariana.soto@demo.mx"],
  ];

  loadDemo() { this.items = CsvParticipantStore.DEMO.map(([nombre, rol, correo]) => ({ nombre, rol, correo })); }

  static parseLine(line) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  }

  importCsv(text, append = false) {
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(CsvParticipantStore.parseLine);
    if (rows.length && /^nombre$/i.test(rows[0][0])) rows.shift();
    const parsed = rows.filter((r) => r[0]).map((r) => ({ nombre: r[0], rol: r[1] || "Asistente", correo: r[2] || "" }));
    this.items = append ? this.items.concat(parsed) : parsed;
    return parsed.length;
  }

  add() { this.items.push({ nombre: "", rol: "Asistente", correo: "" }); }
  remove(i) { this.items.splice(i, 1); }
  update(i, field, value) { if (this.items[i]) this.items[i][field] = value; }
}

/* ============ QrFolioService ============ */
class QrFolioService {
  constructor(year = new Date().getFullYear()) { this.year = year; }

  // FNV-1a de 32 bits -> 4 caracteres base36
  static shortHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36).toUpperCase().padStart(4, "0").slice(-4);
  }

  folio(index, nombre, evento) {
    const n = String(index + 1).padStart(3, "0");
    return `CERT-${this.year}-${n}-${QrFolioService.shortHash(`${nombre}|${evento}`)}`;
  }

  verificationString(folio, p, evento) {
    return stripAccents(`FOLIO:${folio}|NOMBRE:${p.nombre}|ROL:${p.rol}|EVENTO:${evento}`);
  }

  buildQr(text) {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr;
  }

  drawQr(ctx, text, x, y, size) {
    const qr = this.buildQr(text), n = qr.getModuleCount(), cell = size / n;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
    ctx.fillStyle = "#000";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) ctx.fillRect(Math.round(x + c * cell), Math.round(y + r * cell), Math.ceil(cell), Math.ceil(cell));
  }
}

/* ============ TemplateRenderer ============ */
class TemplateRenderer {
  static W = 1122;
  static H = 794;

  constructor(canvas, qrService) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.qr = qrService;
    this.logo = null;
  }

  setLogoFromFile(file, onReady) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { this.logo = img; onReady(); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  static fill(text, vars) {
    return text.replace(/\{\{\s*(NOMBRE|ROL|EVENTO|FECHA|FOLIO)\s*\}\}/gi, (_, k) => vars[k.toUpperCase()] ?? "");
  }

  wrap(text, maxWidth) {
    const lines = [];
    text.split("\n").forEach((para) => {
      let line = "";
      para.split(/\s+/).forEach((w) => {
        const test = line ? `${line} ${w}` : w;
        if (this.ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
        else line = test;
      });
      lines.push(line);
    });
    return lines;
  }

  render(tpl, participant, folio, verification) {
    const { ctx } = this, W = TemplateRenderer.W, H = TemplateRenderer.H, accent = tpl.color;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    // Bordes elegantes
    ctx.strokeStyle = accent; ctx.lineWidth = 14; ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.lineWidth = 2; ctx.strokeRect(46, 46, W - 92, H - 92);
    ctx.fillStyle = accent;
    [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    });

    ctx.textAlign = "center";
    let y = 120;
    if (this.logo) {
      const h = 80, w = (this.logo.width / this.logo.height) * h;
      ctx.drawImage(this.logo, W / 2 - w / 2, 70, w, h);
      y = 190;
    }

    ctx.fillStyle = "#444"; ctx.font = "600 24px Georgia, serif";
    ctx.fillText((tpl.institucion || "").toUpperCase(), W / 2, y);

    ctx.fillStyle = accent; ctx.font = "bold 50px Georgia, serif";
    ctx.fillText(tpl.titulo || "", W / 2, y + 70);

    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2 - 140, y + 92); ctx.lineTo(W / 2 + 140, y + 92); ctx.stroke();

    ctx.fillStyle = "#555"; ctx.font = "italic 22px Georgia, serif";
    ctx.fillText("Se otorga a:", W / 2, y + 140);

    ctx.fillStyle = "#111"; ctx.font = "bold 44px Georgia, serif";
    ctx.fillText(participant.nombre || "—", W / 2, y + 200);

    const vars = { NOMBRE: participant.nombre, ROL: participant.rol, EVENTO: tpl.evento, FECHA: tpl.fecha, FOLIO: folio };
    ctx.fillStyle = "#333"; ctx.font = "22px Georgia, serif";
    const lines = this.wrap(TemplateRenderer.fill(tpl.cuerpo, vars), W - 300);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 255 + i * 32));

    // Firma
    const sy = H - 130;
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 150, sy); ctx.lineTo(W / 2 + 150, sy); ctx.stroke();
    ctx.fillStyle = "#222"; ctx.font = "bold 20px Georgia, serif"; ctx.fillText(tpl.firmante || "", W / 2, sy + 28);
    ctx.fillStyle = "#666"; ctx.font = "17px Georgia, serif"; ctx.fillText(tpl.cargo || "", W / 2, sy + 52);

    // Folio y QR
    ctx.textAlign = "left"; ctx.fillStyle = "#555"; ctx.font = "16px monospace";
    ctx.fillText(`Folio: ${folio}`, 80, H - 76);
    const qrSize = 110;
    this.qr.drawQr(ctx, verification, W - 80 - qrSize, H - 80 - qrSize, qrSize);
    ctx.textAlign = "right"; ctx.font = "12px sans-serif"; ctx.fillStyle = "#777";
    ctx.fillText("Escanea para verificar", W - 80, H - 62);
  }

  toDataUrl() { return this.canvas.toDataURL("image/jpeg", 0.92); }
}

/* ============ BatchPdfExporter ============ */
class BatchPdfExporter {
  constructor(renderer, qrService, onProgress) {
    this.renderer = renderer; this.qr = qrService; this.onProgress = onProgress;
  }

  async exportPdf(tpl, participants, filename = "constancias_lote.pdf") {
    const { jsPDF } = window.jspdf, W = TemplateRenderer.W, H = TemplateRenderer.H;
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H], compress: true });
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const folio = this.qr.folio(i, p.nombre, tpl.evento);
      this.renderer.render(tpl, p, folio, this.qr.verificationString(folio, p, tpl.evento));
      if (i > 0) pdf.addPage([W, H], "landscape");
      pdf.addImage(this.renderer.toDataUrl(), "JPEG", 0, 0, W, H);
      this.onProgress(i + 1, participants.length);
      await sleep(0);
    }
    pdf.save(filename);
  }

  buildLogCsv(tpl, participants) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["folio", "nombre", "rol", "correo", "verificacion"].join(",")];
    participants.forEach((p, i) => {
      const folio = this.qr.folio(i, p.nombre, tpl.evento);
      rows.push([folio, p.nombre, p.rol, p.correo, this.qr.verificationString(folio, p, tpl.evento)].map(esc).join(","));
    });
    return "\ufeff" + rows.join("\r\n");
  }
}

/* ============ Controlador de UI ============ */
class App {
  constructor() {
    this.store = new CsvParticipantStore();
    this.qr = new QrFolioService();
    this.renderer = new TemplateRenderer($("canvas"), this.qr);
    this.exporter = new BatchPdfExporter(this.renderer, this.qr, (d, t) => this.setProgress(d, t));
    this.current = 0;
    this.setDefaults();
    this.bind();
    this.refresh();
  }

  setDefaults() {
    $("tplInstitucion").value = "EDS";
    $("tplTitulo").value = "CONSTANCIA DE PARTICIPACIÓN";
    $("tplEvento").value = "Taller de Automatización Semiconductores 2026";
    $("tplCuerpo").value = "Por su valiosa participación como {{ROL}} en el evento \"{{EVENTO}}\", realizado el {{FECHA}}. Folio de verificación: {{FOLIO}}.";
    $("tplFecha").value = "15 de noviembre de 2026";
    $("tplFirmante").value = "Dr. Ricardo Salazar";
    $("tplCargo").value = "Coordinador del Evento";
  }

  getTemplate() {
    return {
      institucion: $("tplInstitucion").value, titulo: $("tplTitulo").value, evento: $("tplEvento").value,
      cuerpo: $("tplCuerpo").value, fecha: $("tplFecha").value, firmante: $("tplFirmante").value,
      cargo: $("tplCargo").value, color: $("tplColor").value,
    };
  }

  bind() {
    document.querySelectorAll(".panel input[id^=tpl]:not([type=file]), #tplCuerpo").forEach((el) => el.addEventListener("input", () => this.refresh(false)));
    $("tplLogo").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) this.renderer.setLogoFromFile(f, () => this.drawPreview());
    });
    $("btnImportar").addEventListener("click", () => {
      const n = this.store.importCsv($("csvText").value);
      this.status(`${n} participantes importados.`); this.current = 0; this.refresh();
    });
    $("csvFile").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const n = this.store.importCsv(await f.text());
      this.status(`${n} participantes cargados desde ${f.name}.`); this.current = 0; this.refresh(); e.target.value = "";
    });
    $("btnDemo").addEventListener("click", () => { this.store.loadDemo(); this.current = 0; this.status("Taller Demo cargado (12 participantes)."); this.refresh(); });
    $("btnAgregar").addEventListener("click", () => { this.store.add(); this.current = this.store.items.length - 1; this.refresh(); });
    $("btnPrev").addEventListener("click", () => this.go(-1));
    $("btnNext").addEventListener("click", () => this.go(1));
    $("btnPdf").addEventListener("click", () => this.exportPdf());
    $("btnBitacora").addEventListener("click", () => {
      if (!this.store.items.length) return this.status("No hay participantes.");
      downloadBlob(this.exporter.buildLogCsv(this.getTemplate(), this.store.items), "bitacora_folios.csv", "text/csv;charset=utf-8");
      this.status("Bitácora descargada.");
    });
  }

  go(delta) {
    const n = this.store.items.length; if (!n) return;
    this.current = (this.current + delta + n) % n;
    this.refresh(false);
  }

  refresh(rebuildTable = true) {
    if (this.current >= this.store.items.length) this.current = Math.max(0, this.store.items.length - 1);
    if (rebuildTable) this.renderTable();
    else document.querySelectorAll("#tbody tr").forEach((tr, i) => tr.classList.toggle("active", i === this.current));
    this.drawPreview();
  }

  renderTable() {
    const tb = $("tbody"); tb.innerHTML = "";
    this.store.items.forEach((p, i) => {
      const tr = document.createElement("tr");
      if (i === this.current) tr.className = "active";
      const idx = document.createElement("td"); idx.className = "idx"; idx.textContent = i + 1; tr.appendChild(idx);
      ["nombre", "rol", "correo"].forEach((field) => {
        const td = document.createElement("td"), inp = document.createElement("input");
        inp.type = "text"; inp.value = p[field];
        inp.addEventListener("input", () => { this.store.update(i, field, inp.value); this.current = i; this.drawPreview(); });
        inp.addEventListener("focus", () => { this.current = i; this.refresh(false); });
        td.appendChild(inp); tr.appendChild(td);
      });
      const tdDel = document.createElement("td"), del = document.createElement("button");
      del.className = "del"; del.textContent = "✕"; del.title = "Eliminar fila";
      del.addEventListener("click", () => { this.store.remove(i); this.refresh(); });
      tdDel.appendChild(del); tr.appendChild(tdDel); tb.appendChild(tr);
    });
  }

  drawPreview() {
    const tpl = this.getTemplate(), n = this.store.items.length;
    document.documentElement.style.setProperty("--accent", tpl.color);
    $("navInfo").textContent = `${n ? this.current + 1 : 0} / ${n}`;
    const p = n ? this.store.items[this.current] : { nombre: "Nombre del Participante", rol: "Asistente", correo: "" };
    const idx = n ? this.current : 0;
    const folio = this.qr.folio(idx, p.nombre, tpl.evento);
    this.renderer.render(tpl, p, folio, this.qr.verificationString(folio, p, tpl.evento));
  }

  setProgress(done, total) {
    $("bar").style.width = `${(done / total) * 100}%`;
    this.status(`Procesando ${done} de ${total}…`);
  }

  async exportPdf() {
    if (!this.store.items.length) return this.status("Agrega o importa participantes primero.");
    const btn = $("btnPdf"); btn.disabled = true; $("bar").style.width = "0";
    try {
      await this.exporter.exportPdf(this.getTemplate(), this.store.items);
      this.status(`PDF generado con ${this.store.items.length} constancias.`);
    } catch (err) {
      console.error(err); this.status("Error al generar el PDF: " + err.message);
    } finally {
      btn.disabled = false; this.drawPreview();
    }
  }

  status(msg) { $("status").textContent = msg; }
}

document.addEventListener("DOMContentLoaded", () => new App());
