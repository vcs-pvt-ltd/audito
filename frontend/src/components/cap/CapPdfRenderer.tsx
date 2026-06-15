"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { auditExecutionApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────
interface EntityProgress {
  entity_code: string;
  entity_name?: string;
  total_questions: number;
  answered_questions: number;
  total_marks: number;
  obtained_marks: number;
  status: string;
  org_tree_id?: number | null;
}

interface Evidence {
  id: number;
  file_type: string;
  file_path: string;
  file_name: string;
  file_size: number;
}

interface AuditResponse {
  id: number;
  question_id: number;
  entity_code: string;
  org_tree_id?: number | null;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: number;
  remarks: string | null;
  cap_required: number;
  status: string;
  evidence: Evidence[];
}

interface QuestionOption {
  id: number;
  option_text: string;
  marks: number;
}

interface Question {
  id: number;
  question_text: string;
  answer_type: string;
  total_marks: number;
  entity_code: string;
  order_index: number;
  options: QuestionOption[];
}

interface AuditEntity {
  entity_code: string;
  entity_type: string;
  entity_name: string;
}

interface ReportData {
  audit: {
    id: number;
    audit_code: string;
    title: string;
    status: string;
    start_date: string;
    end_date: string;
    entities: AuditEntity[];
    organization_name?: string;
    auditor_name?: string;
    auditor_email?: string;
    auditor_phone?: string;
  };
  responses: AuditResponse[];
  progress: EntityProgress[];
  questions: Question[];
  summary: {
    total_marks: number;
    obtained_marks: number;
    score_pct: number;
    total_questions: number;
    answered_questions: number;
    total_entities: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function safeTitle(s: string) {
  return (s || "").replace(/[\\/:*?\"<>|]+/g, "-").trim() || "report";
}

interface EntityTreeNode {
  code: string;
  name?: string;
  entity_type?: string;
  edge_id?: number | null;
  children?: EntityTreeNode[];
}

// ─── PDF Renderer ─────────────────────────────────────────────────
interface CapPdfRendererProps {
  report: ReportData | null;
  entityTree?: EntityTreeNode | null;
}

export function CapPdfRenderer({ report, entityTree }: CapPdfRendererProps) {
  const [downloading, setDownloading] = useState(false);

  const getAccessToken = () => {
    try {
      const stored = localStorage.getItem("audito_auth");
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return (parsed?.accessToken as string) || null;
    } catch {
      return null;
    }
  };

  const loadImageAsDataUrl = async (url: string): Promise<string | undefined> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return undefined;
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  };

  const inferImageFormat = (dataUrl: string): "PNG" | "JPEG" => {
    const m = /^data:(image\/[^;]+);/i.exec(dataUrl);
    const mime = (m?.[1] || "").toLowerCase();
    if (mime.includes("png")) return "PNG";
    return "JPEG";
  };

  const isLikelyImageEvidence = (ev: {
    file_type?: string | null;
    file_path?: string | null;
  }) => {
    const t = (ev.file_type || "").toLowerCase();
    if (t === "image") return true;
    if (t.startsWith("image/")) return true;
    const p = (ev.file_path || "").toLowerCase();
    return (
      p.endsWith(".png") ||
      p.endsWith(".jpg") ||
      p.endsWith(".jpeg") ||
      p.endsWith(".gif")
    );
  };

  const MEDIA_ORIGIN =
    process.env.NEXT_PUBLIC_MEDIA_URL ||
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(
      /\/api\/?$/,
      ""
    );
  const getMediaUrl = (filePath: string) => {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://"))
      return filePath;
    const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return `${MEDIA_ORIGIN}${path}`;
  };



  const fetchEntityTree = async (
    auditId: number
  ): Promise<EntityTreeNode | null> => {
    try {
      const token = getAccessToken();
      if (!token) return null;
      const res = await auditExecutionApi.getEntityTree(token, auditId);
      if (!res?.success) return null;
      return (res.data as any)?.tree as EntityTreeNode;
    } catch {
      return null;
    }
  };

  const generatePdf = useCallback(async () => {
    if (!report) return;

    setDownloading(true);
    try {
      const tree = entityTree || (await fetchEntityTree(report.audit.id));
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;

      const title = report.audit.title || "Audit Report";
      const auditCode = report.audit.audit_code || String(report.audit.id);

      // ── Color Palette ──────────────────────────────────────────
      const PRIMARY: [number, number, number] = [16, 185, 129];
      const DARK: [number, number, number] = [15, 23, 42];
      const TEXT_DARK: [number, number, number] = [30, 30, 30];
      const TEXT_GRAY: [number, number, number] = [107, 114, 128];
      const LIGHT_BG: [number, number, number] = [248, 250, 252];
      const BORDER: [number, number, number] = [226, 232, 240];

      const entityNameByCode: Record<string, string> = {};
      report.audit.entities.forEach((e) => {
        entityNameByCode[e.entity_code] = e.entity_name || e.entity_code;
      });

      const currentDate = new Date().toLocaleDateString();

      // ── Footer ─────────────────────────────────────────────────
      const addFooter = (pageNumber: number, totalPages: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT_GRAY);
        doc.text("https://www.audito.cloud", margin, pageHeight - 20);
        doc.text(
          `Page ${pageNumber} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 20,
          { align: "center" }
        );
        doc.text(currentDate, pageWidth - margin, pageHeight - 20, {
          align: "right",
        });
      };

      let logoDataUrl: string | undefined;
      try {
        logoDataUrl = await loadImageAsDataUrl("/logo.png");
      } catch (_) { }

      // ─── Cover Page ────────────────────────────────────────────
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      const logoW = 80;
      const logoH = 26;
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", (pageWidth - logoW) / 2, 35, logoW, logoH);
      } else {
        doc.setTextColor(...PRIMARY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("AUDITO", pageWidth / 2, 55, { align: "center" });
      }

      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text("Audit Report", pageWidth / 2, 95, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(...TEXT_GRAY);
      doc.text(
        "Comprehensive Audit Summary & Analysis",
        pageWidth / 2,
        118,
        { align: "center" }
      );

      // Info Box
      const boxX = margin;
      const boxY = 155;
      const boxWidth = pageWidth - margin * 2;
      const boxHeight = 140;

      doc.setFillColor(...LIGHT_BG);
      doc.rect(boxX, boxY, boxWidth, boxHeight, "F");
      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(2);
      doc.rect(boxX, boxY, boxWidth, boxHeight);

      // Column config
      const leftColX = boxX + 24;
      const rightColX = boxX + boxWidth / 2 + 12;
      const colWidth = boxWidth / 2 - 36;
      let detailY = boxY + 20;

      // Column headers
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PRIMARY);
      doc.text("Organization", leftColX, detailY);
      doc.text("Auditor", rightColX, detailY);

      // Divider line under headers
      detailY += 6;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.5);
      doc.line(leftColX, detailY, leftColX + colWidth, detailY);
      doc.line(rightColX, detailY, rightColX + colWidth, detailY);

      detailY += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT_DARK);

      const orgName = report.audit.organization_name || report.audit.entities[0]?.entity_name || "N/A";
      const orgEmail = (report.audit as any).organization_email || "N/A";
      const orgPhone = (report.audit as any).organization_phone || "N/A";

      const leftRows = [
        ["Name", orgName],
        ["Email", orgEmail],
        ["Phone", orgPhone],
        ["Start", fmtDate(report.audit.start_date)],
        ["End", fmtDate(report.audit.end_date)],
      ];

      const rightRows = [
        ["Name", report.audit.auditor_name || "N/A"],
        ["Email", report.audit.auditor_email || "N/A"],
        ["Phone", report.audit.auditor_phone || "N/A"],
        ["Title", title],
      ];

      const rowSpacing = 19;
      leftRows.forEach(([label, value], i) => {
        const y = detailY + i * rowSpacing;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_GRAY);
        doc.text(`${label}:`, leftColX, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_DARK);
        doc.text(String(value), leftColX + 36, y, { maxWidth: colWidth - 36 });
      });

      rightRows.forEach(([label, value], i) => {
        const y = detailY + i * rowSpacing;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_GRAY);
        doc.text(`${label}:`, rightColX, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_DARK);
        doc.text(String(value), rightColX + 36, y, { maxWidth: colWidth - 36 });
      });
      // Executive Summary
      let cursorY = boxY + boxHeight + 35;

      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Executive Summary", margin, cursorY);
      cursorY += 22;

      const complianceRate =
        report.summary.total_questions > 0
          ? `${Math.round(
            (report.summary.answered_questions /
              report.summary.total_questions) *
            100
          )}%`
          : "0%";

      const summaryMetrics: {
        label: string;
        value: string;
        color: [number, number, number];
      }[] = [
          { label: "Final Score", value: `${report.summary.score_pct}%`, color: PRIMARY },
          { label: "Questions", value: `${report.summary.total_questions}`, color: [59, 130, 246] },
          { label: "CAP Required", value: `${report.responses.filter((r) => r.cap_required === 1).length}`, color: [245, 158, 11] },
        ];

      const cardWidth = 92;
      const cardHeight = 58;
      const cardGap = 12;
      const totalCardsWidth = summaryMetrics.length * cardWidth + (summaryMetrics.length - 1) * cardGap;
      const cardsStartX = (pageWidth - totalCardsWidth) / 2;

      summaryMetrics.forEach((metric, i) => {
        const cardX = cardsStartX + i * (cardWidth + cardGap);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...metric.color);
        doc.setLineWidth(1.5);
        doc.rect(cardX, cursorY, cardWidth, cardHeight, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(...metric.color);
        doc.text(metric.value, cardX + cardWidth / 2, cursorY + 26, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...TEXT_GRAY);
        doc.text(metric.label.toUpperCase(), cardX + cardWidth / 2, cursorY + 44, { align: "center" });
      });

      cursorY += cardHeight + 35;

      // Organization Performance Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...DARK);
      doc.text("Organization Performance", margin, cursorY);
      cursorY += 18;

      // Roll up Organization Performance to root entities and their immediate direct sub-entities
      // Key is edge_id (as string) or code (if edge_id is null)
      const mappedEntityDetails: Record<string, { code: string; name: string }> = {};

      const mapTreeNodes = (node: EntityTreeNode, targetCode: string, targetName: string) => {
        const key = node.edge_id ? String(node.edge_id) : node.code;
        mappedEntityDetails[key] = { code: targetCode, name: targetName };
        (node.children || []).forEach(c => mapTreeNodes(c, targetCode, targetName));
      };

      if (tree) {
        const rootNodes = tree.code === "__root__" ? (tree.children || []) : [tree];
        rootNodes.forEach(rootNode => {
          // The root entity itself maps to itself
          const rootKey = rootNode.edge_id ? String(rootNode.edge_id) : rootNode.code;
          mappedEntityDetails[rootKey] = {
            code: rootNode.code,
            name: rootNode.name || entityNameByCode[rootNode.code] || rootNode.code
          };

          // Each direct sub-entity, and all its descendants, map to that direct sub-entity
          (rootNode.children || []).forEach(sub => {
            const subName = sub.name || entityNameByCode[sub.code] || sub.code;
            mapTreeNodes(sub, sub.code, subName);
          });
        });
      }

      const rollupMap: Record<string, { name: string; total_marks: number; obtained_marks: number }> = {};

      if (tree && Object.keys(mappedEntityDetails).length > 0) {
        report.progress.forEach((p) => {
          if (p.total_questions > 0) {
            const lookUpKey = p.org_tree_id ? String(p.org_tree_id) : p.entity_code;
            const target = mappedEntityDetails[lookUpKey];

            if (target) {
              const key = target.code; // We use code as the rollup key for the table rows
              if (!rollupMap[key]) {
                rollupMap[key] = {
                  name: target.name,
                  total_marks: 0,
                  obtained_marks: 0,
                };
              }
              rollupMap[key].total_marks += parseFloat(String(p.total_marks || 0));
              rollupMap[key].obtained_marks += parseFloat(String(p.obtained_marks || 0));
            } else {
              // Fallback just in case an entity instance is missing from our tree mapping
              const key = p.entity_code;
              if (!rollupMap[key]) {
                rollupMap[key] = {
                  name: p.entity_name || entityNameByCode[p.entity_code] || p.entity_code,
                  total_marks: 0,
                  obtained_marks: 0,
                };
              }
              rollupMap[key].total_marks += parseFloat(String(p.total_marks || 0));
              rollupMap[key].obtained_marks += parseFloat(String(p.obtained_marks || 0));
            }
          }
        });
      } else {
        // Fallback: If no tree is present or provided
        report.progress.forEach((p) => {
          if (p.total_questions > 0) {
            const key = p.entity_code;
            const selfName = p.entity_name || entityNameByCode[p.entity_code] || p.entity_code;
            if (!rollupMap[key]) {
              rollupMap[key] = {
                name: selfName,
                total_marks: 0,
                obtained_marks: 0,
              };
            }
            rollupMap[key].total_marks += parseFloat(String(p.total_marks || 0));
            rollupMap[key].obtained_marks += parseFloat(String(p.obtained_marks || 0));
          }
        });
      }

      const progressRows = Object.values(rollupMap)
        .map((r) => {
          const pct =
            r.total_marks > 0
              ? Math.round((r.obtained_marks / r.total_marks) * 100)
              : 0;
          return [r.name, `${pct}%`];
        })
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      autoTable(doc, {
        startY: cursorY,
        head: [["Entity", "Score %"]],
        body: progressRows.length
          ? progressRows
          : [["—", "0%"]],
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 6, textColor: TEXT_DARK },
        headStyles: {
          fillColor: PRIMARY,
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        margin: { left: margin, right: margin },
        tableWidth: "auto",
      });

      // ── Findings Table helpers ─────────────────────────────────
      const tableWidth = pageWidth - margin * 2;
      const COL_Q = tableWidth * 0.45; // Question
      const COL_R = tableWidth * 0.38; // Response
      const COL_S = tableWidth * 0.17; // Score 

      const drawFindingsTableHeader = (y: number): number => {
        const hdrH = 26;
        if (y + hdrH > pageHeight - 90) {
          doc.addPage();
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, pageHeight, "F");
          y = 65;
        }

        doc.setFillColor(...PRIMARY);
        doc.rect(margin, y, COL_Q, hdrH, "F");
        doc.rect(margin + COL_Q, y, COL_R, hdrH, "F");
        doc.rect(margin + COL_Q + COL_R, y, COL_S, hdrH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("Question", margin + 10, y + 17);
        doc.text("Response", margin + COL_Q + 8, y + 17);
        doc.text("Score", margin + COL_Q + COL_R + COL_S / 2, y + 17, {
          align: "center",
        });

        return y + hdrH;
      };

      const renderQuestionRow = (
        q: Question,
        resp: AuditResponse | undefined,
        y: number,
        displayNumber: string
      ): number => {
        const hasCap = (resp?.cap_required || 0) === 1;
        const lineH = 13;
        const paddingV = 10;

        // Resolve answer text (including selected options)
        let finalAnswer = resp?.answer_text || "";
        if (resp?.selected_option_ids && q.options?.length) {
          try {
            let parsedIds: any[] = [];
            const rawIds = resp.selected_option_ids;
            if (typeof rawIds === "string" && rawIds.startsWith("[")) {
              parsedIds = JSON.parse(rawIds);
            } else if (typeof rawIds === "string") {
              parsedIds = rawIds.split(",").map((s) => s.trim());
            } else {
              parsedIds = Array.isArray(rawIds) ? rawIds : [rawIds];
            }
            const selectedTexts = q.options
              .filter(
                (opt) =>
                  parsedIds.includes(opt.id) ||
                  parsedIds.includes(String(opt.id))
              )
              .map((opt) => opt.option_text);
            if (selectedTexts.length) {
              const optString = selectedTexts.join(", ");
              finalAnswer = finalAnswer
                ? `${finalAnswer} (${optString})`
                : optString;
            }
          } catch (e) {
            console.error("Failed to parse selected options", e);
          }
        }

        // Measure wrapped lines
        doc.setFontSize(9);
        const questionLines = doc.splitTextToSize(
          `${displayNumber}. ${q.question_text}`,
          COL_Q - 16
        );
        const answerLines = finalAnswer
          ? doc.splitTextToSize(finalAnswer, COL_R - 16)
          : ["—"];

        const contentLines = Math.max(questionLines.length, answerLines.length);
        const rowH = Math.max(
          40,
          Math.min(180, paddingV * 2 + contentLines * lineH)
        );

        // Page break
        if (y + rowH > pageHeight - 90) {
          doc.addPage();
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, pageHeight, "F");
          y = 65;
          y = drawFindingsTableHeader(y);
        }

        // Row background
        if (hasCap) {
          doc.setFillColor(255, 243, 243); // light red for CAP
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, y, tableWidth, rowH, "F");

        // Left accent bar for CAP rows (3 pt red strip)
        if (hasCap) {
          doc.setFillColor(239, 68, 68);
          doc.rect(margin, y, 3, rowH, "F");
        }

        // Cell borders
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.4);
        doc.rect(margin, y, COL_Q, rowH);
        doc.rect(margin + COL_Q, y, COL_R, rowH);
        doc.rect(margin + COL_Q + COL_R, y, COL_S, rowH);

        // Question cell
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_DARK);
        doc.text(questionLines, margin + 10, y + paddingV + lineH - 3);

        // Response cell
        if (finalAnswer && finalAnswer !== "—") {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...TEXT_DARK);
        } else {
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...TEXT_GRAY);
        }
        doc.setFontSize(9);
        doc.text(answerLines, margin + COL_Q + 8, y + paddingV + lineH - 3);

        // Score cell
        const qPct =
          q.total_marks > 0
            ? Math.round(((resp?.marks_obtained || 0) / q.total_marks) * 100)
            : 0;
        const scoreColor: [number, number, number] =
          qPct >= 80
            ? [34, 197, 94]
            : qPct >= 60
              ? [245, 158, 11]
              : [239, 68, 68];

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...scoreColor);
        doc.text(
          `${resp?.marks_obtained ?? 0}/${q.total_marks}`,
          margin + COL_Q + COL_R + COL_S / 2,
          y + rowH / 2 + 4,
          { align: "center" }
        );

        return y + rowH;
      };

      // ── Entity heading helper ──────────────────────────────────
      const renderNodeHeading = (
        label: string,
        level: number,
        y: number
      ): number => {
        const headingH = 22;
        if (y + headingH > pageHeight - 90) {
          doc.addPage();
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, pageHeight, "F");
          y = 65;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...BORDER);
        doc.rect(margin, y, pageWidth - margin * 2, headingH, "FD");

        // Left accent bar colored by level
        const accentColor: [number, number, number] =
          level === 1 ? PRIMARY : level === 2 ? [59, 130, 246] : [139, 92, 246];
        doc.setFillColor(...accentColor);
        doc.rect(margin, y, 4, headingH, "F");

        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(level <= 2 ? 10 : 9);
        doc.text(label, margin + 14, y + 14.5);

        return y + headingH + 10;
      };

      // ── Build question lookups ─────────────────────────────────
      const questionsByEntity: Record<string, Question[]> = {};
      for (const q of report.questions) {
        if (!questionsByEntity[q.entity_code])
          questionsByEntity[q.entity_code] = [];
        questionsByEntity[q.entity_code].push(q);
      }
      for (const code of Object.keys(questionsByEntity)) {
        questionsByEntity[code] = questionsByEntity[code].sort(
          (a, b) => (a.order_index || 0) - (b.order_index || 0)
        );
      }

      const responseByEntityQuestion = new Map<string, AuditResponse>();
      for (const r of report.responses) {
        // Use org_tree_id in the key to support reused entity codes
        const key = `${r.entity_code}::${r.org_tree_id ?? "null"}::${r.question_id}`;
        responseByEntityQuestion.set(key, r);
      }

      const questionNumberByEntityQuestion = new Map<string, string>();

      const subtreeHasQuestions = (
        node: EntityTreeNode | null | undefined
      ): boolean => {
        if (!node) return false;
        // Check if this specific node instance has any responses
        const hasResponses = report.responses.some(r =>
          r.entity_code === node.code &&
          String(r.org_tree_id ?? "") === String(node.edge_id ?? "")
        );
        if (hasResponses) return true;
        return (node.children || []).some((c) => subtreeHasQuestions(c));
      };

      // ── Render entity tree detailed findings ──────────────────
      const renderEntityTreeDetailedFindings = async (
        tree: EntityTreeNode
      ) => {
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        let cy = 65;

        doc.setTextColor(...PRIMARY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Detailed Findings", margin, cy);
        cy += 25;

        const walk = (
          node: EntityTreeNode,
          prefix: string,
          level: number
        ) => {
          if (!node) return;
          if (!subtreeHasQuestions(node)) return;

          if (node.code !== "__root__") {
            const name =
              node.name || entityNameByCode[node.code] || node.code;
            const label = `${prefix} - ${name}`;
            cy = renderNodeHeading(label, level, cy);

            // For detailed findings, we filter questions that actually have a response for this instance
            const nodeRespKeyBase = `${node.code}::${node.edge_id ?? "null"}`;
            const instanceResponses = report.responses.filter(r =>
              r.entity_code === node.code &&
              String(r.org_tree_id ?? "") === String(node.edge_id ?? "")
            );

            if (instanceResponses.length > 0) {
              const qs = report.questions.filter(q =>
                instanceResponses.some(r => r.question_id === q.id)
              ).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

              if (qs.length) {
                cy = drawFindingsTableHeader(cy);
                qs.forEach((q, idx) => {
                  const resp = responseByEntityQuestion.get(
                    `${nodeRespKeyBase}::${q.id}`
                  );
                  const qNo = `${prefix}.${idx + 1}`;
                  questionNumberByEntityQuestion.set(
                    `${nodeRespKeyBase}::${q.id}`,
                    qNo
                  );
                  cy = renderQuestionRow(q, resp, cy, qNo);
                });
                cy += 12; // spacing after table
              }
            }
          }

          (node.children || []).forEach((child, i) => {
            const nextPrefix =
              node.code === "__root__"
                ? `${i + 1}`
                : `${prefix}.${i + 1}`;
            walk(
              child,
              nextPrefix,
              node.code === "__root__" ? 1 : level + 1
            );
          });
        };

        if (tree.code === "__root__") {
          (tree.children || []).forEach((child, i) => {
            walk(child, `${i + 1}`, 1);
          });
        } else {
          walk(tree, "1", 1);
        }
      };

      // ── Render findings using pre-fetched tree ──────────────────
      if (tree) {
        await renderEntityTreeDetailedFindings(tree);
      } else {
        // Fallback: one page per entity
        for (const code of report.audit.entities.map((e) => e.entity_code)) {
          const entityName = entityNameByCode[code] || code;
          const qs = (questionsByEntity[code] || []).sort(
            (a, b) => (a.order_index || 0) - (b.order_index || 0)
          );

          if (!qs.length) continue;

          doc.addPage();
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, pageHeight, "F");

          let cy = 65;

          doc.setTextColor(...PRIMARY);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.text(`${entityName} - Detailed Findings`, margin, cy);
          cy += 25;

          cy = drawFindingsTableHeader(cy);

          qs.forEach((q, index) => {
            const resp = responseByEntityQuestion.get(`${code}::${q.id}`);
            const qNo = String(q.order_index || index + 1);
            questionNumberByEntityQuestion.set(`${code}::${q.id}`, qNo);
            cy = renderQuestionRow(q, resp, cy, qNo);
          });
        }
      }

      // ─── Evidence & Remarks Section ────────────────────────────
      const responsesWithDetails = report.responses.filter((r) => {
        const q = report.questions.find((q) => q.id === r.question_id);
        return q && (r.remarks || (r.evidence && r.evidence.length > 0));
      });

      if (responsesWithDetails.length > 0) {
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        let cy = 65;

        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Evidence & Remarks", margin, cy);
        cy += 20;

        const eColWidths = {
          question: (pageWidth - margin * 2) * 0.35,
          evidence: (pageWidth - margin * 2) * 0.35,
          remark: (pageWidth - margin * 2) * 0.3,
        };

        const drawEvidenceHeaders = (y: number) => {
          doc.setFillColor(...PRIMARY);
          doc.rect(margin, y, eColWidths.question, 30, "F");
          doc.rect(margin + eColWidths.question, y, eColWidths.evidence, 30, "F");
          doc.rect(margin + eColWidths.question + eColWidths.evidence, y, eColWidths.remark, 30, "F");

          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Question Reference", margin + 10, y + 20);
          doc.text("Evidence / Attachments", margin + eColWidths.question + 10, y + 20);
          doc.text("Remarks", margin + eColWidths.question + eColWidths.evidence + 10, y + 20);
        };

        drawEvidenceHeaders(cy);
        cy += 35;

        const sorted = [...responsesWithDetails].sort((a, b) => {
          const keyA = `${a.entity_code}::${a.org_tree_id ?? "null"}::${a.question_id}`;
          const keyB = `${b.entity_code}::${b.org_tree_id ?? "null"}::${b.question_id}`;
          const qa = questionNumberByEntityQuestion.get(keyA) || "";
          const qb = questionNumberByEntityQuestion.get(keyB) || "";
          return qa.localeCompare(qb, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

        for (const resp of sorted) {
          const q = report.questions.find((qq) => qq.id === resp.question_id);
          if (!q) continue;

          const respKey = `${resp.entity_code}::${resp.org_tree_id ?? "null"}::${resp.question_id}`;
          const qNo = questionNumberByEntityQuestion.get(respKey) || "—";
          const hasEvidence = resp.evidence && resp.evidence.length > 0;
          const hasRemark =
            resp.remarks && resp.remarks.trim() !== "";

          const evidenceH = hasEvidence ? resp.evidence.length * 20 : 15;
          const remarkH = hasRemark
            ? Math.ceil(resp.remarks!.length / 60) * 15
            : 15;
          const questionH = Math.ceil(qNo.length / 50) * 12;
          const rowHeight = Math.max(80, evidenceH + remarkH + questionH + 20);

          if (cy + rowHeight > pageHeight - 80) {
            doc.addPage();
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, pageHeight, "F");
            cy = 65;
            drawEvidenceHeaders(cy);
            cy += 35;
          }

          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.5);

          // Question cell
          doc.rect(margin, cy, eColWidths.question, rowHeight);
          doc.setTextColor(...TEXT_DARK);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const wrappedQuestion = doc.splitTextToSize(
            qNo,
            eColWidths.question - 20
          );
          doc.text(wrappedQuestion, margin + 10, cy + 15);

          // Evidence cell
          doc.rect(margin + eColWidths.question, cy, eColWidths.evidence, rowHeight);
          if (hasEvidence) {
            let evidenceY = cy + 15;
            for (let i = 0; i < resp.evidence.length; i++) {
              const ev = resp.evidence[i];
              if (isLikelyImageEvidence(ev)) {
                try {
                  const imageData = await loadImageAsDataUrl(
                    getMediaUrl(ev.file_path)
                  );
                  if (imageData) {
                    const imgWidth = Math.min(80, eColWidths.evidence - 20);
                    const imgHeight = 60;
                    const fmt = inferImageFormat(imageData);
                    doc.addImage(
                      imageData,
                      fmt,
                      margin + eColWidths.question + 10,
                      evidenceY,
                      imgWidth,
                      imgHeight
                    );
                    evidenceY += imgHeight + 5;
                  } else {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(59, 130, 246);
                    doc.text("📎", margin + eColWidths.question + 10, evidenceY);
                    evidenceY += 15;
                  }
                } catch {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(8);
                  doc.setTextColor(59, 130, 246);
                  doc.text("📎", margin + eColWidths.question + 10, evidenceY);
                  evidenceY += 15;
                }
              } else {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(59, 130, 246);
                doc.text("📄", margin + eColWidths.question + 10, evidenceY);
                evidenceY += 15;
              }
            }
          } else {
            doc.setTextColor(...TEXT_GRAY);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.text(
              "No evidence attached",
              margin + eColWidths.question + 10,
              cy + rowHeight / 2
            );
          }

          // Remarks cell
          doc.rect(
            margin + eColWidths.question + eColWidths.evidence,
            cy,
            eColWidths.remark,
            rowHeight
          );
          if (hasRemark) {
            doc.setTextColor(...TEXT_DARK);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            const wrappedRemark = doc.splitTextToSize(
              resp.remarks!,
              eColWidths.remark - 20
            );
            doc.text(
              wrappedRemark,
              margin + eColWidths.question + eColWidths.evidence + 10,
              cy + 15
            );
          } else {
            doc.setTextColor(...TEXT_GRAY);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.text(
              "No remarks provided",
              margin + eColWidths.question + eColWidths.evidence + 10,
              cy + rowHeight / 2
            );
          }

          cy += rowHeight + 2;
        }
      }

      // ─── Headers & Footers ─────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i !== 1) {
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, 45, "F");

          doc.setTextColor(...DARK);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(title, margin, 28);


        }
        addFooter(i, totalPages);
      }

      const fileName = `${safeTitle(auditCode)}-${safeTitle(title)}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("PDF Generation Error:", error);
    } finally {
      setDownloading(false);
    }
  }, [report]);

  return (
    <button
      onClick={generatePdf}
      disabled={downloading || !report}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:text-white hover:border-white/20 transition-all print:hidden disabled:opacity-50"
    >
      {downloading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      {downloading ? "Generating..." : "Download Report"}
    </button>
  );
}
