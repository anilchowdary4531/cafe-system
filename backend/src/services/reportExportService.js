import PDFDocument from "pdfkit";

/**
 * Escape CSV Field for Safe UTF-8 CSV Parsing
 */
const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * 1. CSV EXPORT GENERATOR
 */
export const generateCSV = (dataArray = [], columns = []) => {
  if (!Array.isArray(columns) || columns.length === 0) {
    if (dataArray.length > 0) {
      columns = Object.keys(dataArray[0]).map((k) => ({ key: k, label: k }));
    } else {
      return "";
    }
  }

  const headerRow = columns.map((col) => escapeCsvCell(col.label || col.key)).join(",");
  const dataRows = dataArray.map((row) =>
    columns
      .map((col) => {
        const val = col.formatter ? col.formatter(row[col.key], row) : row[col.key];
        return escapeCsvCell(val);
      })
      .join(",")
  );

  return [headerRow, ...dataRows].join("\n");
};

/**
 * 2. EXCEL COMPATIBLE HTML/XML SPREADSHEET GENERATOR
 */
export const generateExcelHTML = (title = "Report", dataArray = [], columns = [], summary = null) => {
  const headerHtml = columns.map((col) => `<th style="background-color:#1e293b;color:#f8fafc;padding:8px;border:1px solid #334155;">${col.label || col.key}</th>`).join("");

  const rowsHtml = dataArray
    .map(
      (row, idx) =>
        `<tr style="background-color:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">` +
        columns
          .map((col) => {
            const val = col.formatter ? col.formatter(row[col.key], row) : row[col.key];
            return `<td style="padding:6px;border:1px solid #e2e8f0;">${val !== undefined && val !== null ? val : ""}</td>`;
          })
          .join("") +
        `</tr>`
    )
    .join("");

  let summaryHtml = "";
  if (summary && typeof summary === "object") {
    summaryHtml = `
      <table style="margin-bottom:16px;border-collapse:collapse;font-family:sans-serif;">
        <tr style="background-color:#f1f5f9;"><td colspan="2" style="padding:8px;font-weight:bold;">Report Summary</td></tr>
        ${Object.entries(summary)
          .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#64748b;">${k}</td><td style="padding:4px 8px;font-weight:bold;">${typeof v === "object" ? JSON.stringify(v) : v}</td></tr>`)
          .join("")}
      </table>
    `;
  }

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${title}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
      </style>
    </head>
    <body>
      <h2 style="color:#0f172a;">Tiffzy POS - ${title}</h2>
      ${summaryHtml}
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `;
};

/**
 * 3. PDF REPORT GENERATOR (PDFKit)
 */
export const generatePDFReport = ({
  title = "Report",
  restaurantName = "Tiffzy POS",
  dateRange = "",
  dataArray = [],
  columns = [],
  summary = null,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Title & Branding Header
      doc.fillColor("#f59e0b").fontSize(20).font("Helvetica-Bold").text("TIFFZY POS", 36, 36);
      doc.fillColor("#0f172a").fontSize(14).font("Helvetica-Bold").text(restaurantName, 36, 60);
      doc.fillColor("#64748b").fontSize(11).font("Helvetica").text(`Report: ${title}`, 36, 78);
      if (dateRange) {
        doc.fillColor("#64748b").fontSize(9).text(`Period: ${dateRange} | Generated: ${new Date().toLocaleString()}`, 36, 94);
      }

      doc.moveTo(36, 110).lineTo(559, 110).strokeColor("#cbd5e1").lineWidth(1).stroke();

      let currentY = 125;

      // Summary Box if provided
      if (summary && typeof summary === "object") {
        doc.fillColor("#f8fafc").rect(36, currentY, 523, 40).fill();
        doc.strokeColor("#e2e8f0").rect(36, currentY, 523, 40).stroke();

        doc.fillColor("#0f172a").fontSize(9).font("Helvetica-Bold").text("EXECUTIVE SUMMARY", 44, currentY + 6);
        const summaryText = Object.entries(summary)
          .filter(([_, v]) => typeof v !== "object")
          .slice(0, 4)
          .map(([k, v]) => `${k}: ${v}`)
          .join("   |   ");

        doc.fillColor("#334155").fontSize(8).font("Helvetica").text(summaryText, 44, currentY + 22);
        currentY += 52;
      }

      // Table Headers
      const colWidth = Math.floor(523 / Math.max(1, columns.length));

      doc.fillColor("#1e293b").rect(36, currentY, 523, 20).fill();
      columns.forEach((col, idx) => {
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold").text(col.label || col.key, 40 + idx * colWidth, currentY + 5, { width: colWidth - 8, truncate: true });
      });

      currentY += 20;

      // Table Rows
      dataArray.slice(0, 100).forEach((row, rowIdx) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 36;
        }

        if (rowIdx % 2 === 1) {
          doc.fillColor("#f8fafc").rect(36, currentY, 523, 18).fill();
        }

        columns.forEach((col, colIdx) => {
          const rawVal = col.formatter ? col.formatter(row[col.key], row) : row[col.key];
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";

          doc.fillColor("#1e293b").fontSize(8).font("Helvetica").text(val, 40 + colIdx * colWidth, currentY + 4, { width: colWidth - 8, truncate: true });
        });

        currentY += 18;
      });

      // Footer Page Number
      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica").text("Generated by Tiffzy POS Reporting Engine", 36, 765, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
