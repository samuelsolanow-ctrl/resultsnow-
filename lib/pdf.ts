"use client";
// Súmula em PDF (A4 deitado) gerada no próprio celular/computador — funciona em qualquer navegador
import type { Standing } from "./scoring";
import type { FlagMode, RaceRow } from "./types";

export type SumulaData = {
  eventName: string;
  subtitle: string;
  className: string;
  info: string;
  flagMode: FlagMode;
  crewSize: number;
  races: Pick<RaceRow, "id" | "number">[];
  standings: Standing[];
  legend: string[];
  updated: string;
};

async function loadImage(src: string): Promise<string | null> {
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => ok(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadSumula(d: SumulaData) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;

  // faixa com logo
  doc.setFillColor(42, 47, 53);
  doc.rect(0, 0, W, 16, "F");
  const logo = await loadImage("/logo-horizontal.png");
  if (logo) doc.addImage(logo, "PNG", M, 3, 41.5, 10);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("Pontuação baixa · RRS Apêndice A", W - M, 9.5, { align: "right" });

  // título
  doc.setTextColor(34, 38, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(d.eventName, M, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (d.subtitle) doc.text(d.subtitle, M, 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 127, 150);
  doc.text(d.className, M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(d.info, M + doc.getTextWidth(d.className) * (12 / 9) + 4, 38);

  const flagLabel = d.flagMode === "state" ? "UF" : d.flagMode === "both" ? "País/UF" : "País";
  const head = [
    "Rank",
    flagLabel,
    "Nº vela",
    d.crewSize > 1 ? "Timoneiro / Proeiro" : "Velejador",
    "Clube",
    "ID CBVela",
    ...d.races.map((r) => `R${r.number}`),
    "Total",
    "Líq.",
  ];
  const body = d.standings.map((s) => {
    const e = s.entry;
    const flag =
      d.flagMode === "state"
        ? e.state ?? ""
        : d.flagMode === "both"
          ? [e.country, e.state].filter(Boolean).join(" / ")
          : e.country ?? "";
    const dual = d.crewSize > 1 && e.crew_name;
    return [
      String(s.rank),
      flag,
      e.sail_number,
      dual ? `${e.helm_name}\n${e.crew_name}` : e.helm_name,
      e.club ?? "",
      dual ? `${e.helm_cbvela ?? "—"}\n${e.crew_cbvela ?? "—"}` : e.helm_cbvela ?? "—",
      ...s.cells.map((c) => (c.discarded ? `(${c.label})` : c.label)),
      String(s.total),
      String(s.net),
    ];
  });

  const firstRace = 6;
  const lastCol = head.length - 1;
  autoTable(doc, {
    startY: 42,
    head: [head],
    body,
    theme: "grid",
    margin: { left: M, right: M, bottom: 14 },
    styles: { font: "helvetica", fontSize: d.races.length > 10 ? 6.5 : 8, cellPadding: 1.4, lineColor: [227, 232, 238], lineWidth: 0.2, valign: "middle", textColor: [34, 38, 43] },
    headStyles: { fillColor: [42, 47, 53], textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 10 },
      1: { halign: "center", cellWidth: d.flagMode === "both" ? 16 : 11 },
      2: { cellWidth: 17, fontStyle: "bold" },
      3: { cellWidth: "auto", minCellWidth: 38 },
      4: { cellWidth: "wrap" },
      5: { cellWidth: 17, fontSize: 7 },
      [lastCol]: { halign: "center", fontStyle: "bold" },
      [lastCol - 1]: { halign: "center", textColor: [100, 116, 139] },
    },
    didParseCell: (h) => {
      if (h.section !== "body") return;
      const i = h.column.index;
      if (i >= firstRace && i < lastCol - 1) {
        h.cell.styles.halign = "center";
        const txt = String(h.cell.raw ?? "");
        if (txt.startsWith("(")) h.cell.styles.textColor = [148, 163, 184];
        else if (/[A-Z]{3}/.test(txt)) h.cell.styles.textColor = [215, 38, 61];
      }
    },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const page = doc.getNumberOfPages();
      doc.text(`Atualizado em ${d.updated} · resultsnow`, M, H - 6);
      doc.text(`Página ${page}`, W - M, H - 6, { align: "right" });
    },
  });

  // legenda
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y = ((doc as any).lastAutoTable?.finalY ?? 42) + 5;
  if (d.legend.length && y < H - 16) {
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(["( ) descartado", ...d.legend].join("   ·   "), W - 2 * M);
    doc.text(lines, M, y);
  }

  const file = `Sumula_${d.eventName}_${d.className}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_");
  doc.save(`${file}.pdf`);
}
