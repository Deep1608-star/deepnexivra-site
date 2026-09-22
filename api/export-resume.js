function clean(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function safeArray(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function validateResume(resume) {
  if (!resume || typeof resume !== "object") return "Resume payload is required";
  if (!resume.profile || typeof resume.profile !== "object") return "Profile data is required";
  if (!Array.isArray(resume.experiences) || !resume.experiences.length) return "At least one experience entry is required";
  return "";
}

function filenameBase(resume) {
  const name = clean(resume.profile && resume.profile.fullName) || "Candidate";
  const role = clean(resume.targetRole) || "Tailored-Resume";
  return (name + "-" + role).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 100);
}

async function makeDocx(resume) {
  const docx = await import("docx");
  const template = resume.template || "classic";
  const compact = !!resume.onePageMode || template === "compact";
  const modern = template === "modern";
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle
  } = docx;

  const children = [];
  const baseFont = "Arial";
  const defaultBodySize = compact ? 18 : 20;

  function p(text, options) {
    const opts = options || {};
    return new Paragraph({
      alignment: opts.alignment,
      spacing: { before: opts.before || 0, after: opts.after == null ? 80 : opts.after, line: opts.line || 240 },
      border: opts.borderBottom ? {
        bottom: { color: "666666", style: BorderStyle.SINGLE, size: 4, space: 2 }
      } : undefined,
      bullet: opts.bullet ? { level: 0 } : undefined,
      children: [
        new TextRun({
          text: clean(text),
          font: baseFont,
          size: opts.size || defaultBodySize,
          bold: !!opts.bold,
          allCaps: !!opts.allCaps
        })
      ]
    });
  }

  function section(title) {
    children.push(p(title, {
      size: 20,
      bold: true,
      allCaps: true,
      before: 140,
      after: 70,
      borderBottom: true
    }));
  }

  const profile = resume.profile || {};
  children.push(p(profile.fullName || "Candidate", {
    size: compact ? 28 : 30,
    bold: true,
    alignment: modern ? AlignmentType.LEFT : AlignmentType.CENTER,
    after: 50
  }));

  const contact = [
    profile.location,
    profile.phone,
    profile.email,
    ...safeArray(profile.links, 4)
  ].map(clean).filter(Boolean).join(" | ");

  if (contact) children.push(p(contact, { size: compact ? 16 : 18, alignment: modern ? AlignmentType.LEFT : AlignmentType.CENTER, after: compact ? 90 : 130 }));

  if (clean(resume.summary)) {
    section("Professional Summary");
    children.push(p(resume.summary, { size: compact ? 17 : 19, line: compact ? 225 : 250, after: compact ? 55 : 80 }));
  }

  const skills = safeArray(resume.skills, 30).map(clean).filter(Boolean);
  if (skills.length) {
    section("Core Skills");
    children.push(p(skills.join(" | "), { size: compact ? 16 : 18, line: compact ? 220 : 240, after: compact ? 55 : 90 }));
  }

  section("Professional Experience");
  safeArray(resume.experiences, 20).forEach(function(exp) {
    const titleLine = [clean(exp.title), clean(exp.employer)].filter(Boolean).join(" — ");
    const dates = [clean(exp.startDate), exp.isCurrent ? "Present" : clean(exp.endDate)].filter(Boolean).join(" – ");
    const headerText = dates ? titleLine + " | " + dates : titleLine;
    children.push(p(headerText, { size: compact ? 18 : 20, bold: true, before: compact ? 70 : 100, after: 20 }));
    if (clean(exp.location)) children.push(p(exp.location, { size: compact ? 16 : 18, after: compact ? 30 : 45 }));
    safeArray(exp.bullets, 10).forEach(function(bullet) {
      if (clean(bullet)) children.push(p(bullet, { size: compact ? 17 : 19, bullet: true, line: compact ? 220 : 245, after: compact ? 22 : 35 }));
    });
  });

  const projects = safeArray(resume.projects, 10);
  if (projects.length) {
    section("Projects");
    projects.forEach(function(item) {
      const title = [clean(item.name), clean(item.role)].filter(Boolean).join(" — ") || "Project";
      children.push(p(title, { size: 20, bold: true, after: 15 }));
      if (clean(item.description)) children.push(p(item.description, { size: compact ? 17 : 19, after: 25 }));
      const tools = safeArray(item.tools, 20).map(clean).filter(Boolean);
      const skills = safeArray(item.skills, 20).map(clean).filter(Boolean);
      if (tools.length) children.push(p("Tools: " + tools.join(" | "), { size: compact ? 16 : 18, after: 20 }));
      if (skills.length) children.push(p("Skills: " + skills.join(" | "), { size: compact ? 16 : 18, after: 20 }));
      safeArray(item.outcomes, 10).forEach(function(outcome) {
        if (clean(outcome)) children.push(p(outcome, { size: compact ? 17 : 19, bullet: true, line: compact ? 220 : 245, after: compact ? 22 : 35 }));
      });
    });
  }

  const education = safeArray(resume.education, 10);
  if (education.length) {
    section("Education");
    education.forEach(function(item) {
      const credential = [clean(item.credential), clean(item.field)].filter(Boolean).join(" — ") || "Education";
      const meta = [clean(item.institution), clean(item.location), clean(item.endDate)].filter(Boolean).join(" | ");
      children.push(p(credential, { size: 20, bold: true, after: 15 }));
      if (meta) children.push(p(meta, { size: 18, after: 30 }));
      safeArray(item.details, 8).forEach(function(detail) {
        if (clean(detail)) children.push(p(detail, { size: compact ? 16 : 18, bullet: true, after: compact ? 18 : 28 }));
      });
    });
  }

  const certifications = safeArray(resume.certifications, 15);
  if (certifications.length) {
    section("Certifications");
    certifications.forEach(function(item) {
      const line = [clean(item.name), clean(item.issuer), clean(item.date)].filter(Boolean).join(" | ");
      if (line) children.push(p(line, { size: 19, after: 35 }));
    });
  }

  const document = new Document({
    creator: "Deep Nexivra",
    title: clean(resume.targetRole) + " Tailored Resume",
    description: "Evidence-grounded ATS-safe resume generated by Deep Nexivra",
    sections: [{
      properties: {
        page: {
          margin: {
            top: compact ? 540 : 720,
            right: compact ? 540 : 720,
            bottom: compact ? 540 : 720,
            left: compact ? 540 : 720
          }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(document);
}

async function makePdf(resume) {
  const { jsPDF } = await import("jspdf");
  const template = resume.template || "classic";
  const compact = !!resume.onePageMode || template === "compact";
  const modern = template === "modern";
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = compact ? 40 : 48;
  const contentWidth = pageWidth - margin * 2;
  let y = 50;

  function ensureSpace(height) {
    if (y + height > pageHeight - 48) {
      doc.addPage();
      y = 50;
    }
  }

  function drawLines(text, opts) {
    const o = opts || {};
    const fontSize = o.fontSize || 10;
    const lineHeight = o.lineHeight || fontSize * 1.35;
    const lines = doc.splitTextToSize(clean(text), contentWidth);
    ensureSpace(lines.length * lineHeight + (o.after || 0));
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(20, 20, 20);
    const x = o.align === "center" ? pageWidth / 2 : margin;
    doc.text(lines, x, y, { align: o.align || "left" });
    y += lines.length * lineHeight + (o.after || 0);
  }

  function section(title) {
    ensureSpace(28);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(clean(title).toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(90);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  const profile = resume.profile || {};
  drawLines(profile.fullName || "Candidate", { fontSize: compact ? 15 : 16, bold: true, align: modern ? "left" : "center", lineHeight: 18, after: 3 });

  const contact = [
    profile.location,
    profile.phone,
    profile.email,
    ...safeArray(profile.links, 4)
  ].map(clean).filter(Boolean).join(" | ");
  if (contact) drawLines(contact, { fontSize: compact ? 8 : 8.5, align: modern ? "left" : "center", lineHeight: compact ? 9.5 : 10, after: compact ? 7 : 10 });

  if (clean(resume.summary)) {
    section("Professional Summary");
    drawLines(resume.summary, { fontSize: compact ? 8.8 : 9.5, lineHeight: compact ? 11.3 : 12.5, after: 3 });
  }

  const skills = safeArray(resume.skills, 30).map(clean).filter(Boolean);
  if (skills.length) {
    section("Core Skills");
    drawLines(skills.join(" | "), { fontSize: compact ? 8.3 : 9, lineHeight: compact ? 10.5 : 11.5, after: 3 });
  }

  section("Professional Experience");
  safeArray(resume.experiences, 20).forEach(function(exp) {
    ensureSpace(55);
    const titleLine = [clean(exp.title), clean(exp.employer)].filter(Boolean).join(" — ");
    const dates = [clean(exp.startDate), exp.isCurrent ? "Present" : clean(exp.endDate)].filter(Boolean).join(" – ");
    drawLines(dates ? titleLine + " | " + dates : titleLine, { fontSize: compact ? 9 : 9.7, bold: true, lineHeight: compact ? 11 : 12, after: 1 });
    if (clean(exp.location)) drawLines(exp.location, { fontSize: compact ? 8 : 8.5, lineHeight: compact ? 9.5 : 10.5, after: 2 });

    safeArray(exp.bullets, 10).forEach(function(bullet) {
      const text = "• " + clean(bullet);
      const lines = doc.splitTextToSize(text, contentWidth - 10);
      ensureSpace(lines.length * 11.5 + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(compact ? 8.3 : 9);
      doc.text(lines, margin + 8, y);
      y += lines.length * (compact ? 10.4 : 11.5) + (compact ? 2 : 3);
    });
    y += 3;
  });

  const projects = safeArray(resume.projects, 10);
  if (projects.length) {
    section("Projects");
    projects.forEach(function(item) {
      const title = [clean(item.name), clean(item.role)].filter(Boolean).join(" — ") || "Project";
      drawLines(title, { fontSize: 9.5, bold: true, lineHeight: 12, after: 1 });
      if (clean(item.description)) drawLines(item.description, { fontSize: compact ? 8.5 : 9, lineHeight: compact ? 10.5 : 11.5, after: 2 });
      const tools = safeArray(item.tools, 20).map(clean).filter(Boolean);
      const skills = safeArray(item.skills, 20).map(clean).filter(Boolean);
      if (tools.length) drawLines("Tools: " + tools.join(" | "), { fontSize: compact ? 8 : 8.5, lineHeight: 10.5, after: 1 });
      if (skills.length) drawLines("Skills: " + skills.join(" | "), { fontSize: compact ? 8 : 8.5, lineHeight: 10.5, after: 1 });
      safeArray(item.outcomes, 10).forEach(function(outcome) {
        const text = "• " + clean(outcome);
        const lines = doc.splitTextToSize(text, contentWidth - 10);
        ensureSpace(lines.length * 11 + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(compact ? 8.2 : 8.8);
        doc.text(lines, margin + 8, y);
        y += lines.length * (compact ? 10.2 : 11) + 2;
      });
      y += 3;
    });
  }

  const education = safeArray(resume.education, 10);
  if (education.length) {
    section("Education");
    education.forEach(function(item) {
      const credential = [clean(item.credential), clean(item.field)].filter(Boolean).join(" — ") || "Education";
      const meta = [clean(item.institution), clean(item.location), clean(item.endDate)].filter(Boolean).join(" | ");
      drawLines(credential, { fontSize: 9.5, bold: true, lineHeight: 12, after: 0 });
      if (meta) drawLines(meta, { fontSize: 8.5, lineHeight: 10.5, after: 1 });
      safeArray(item.details, 8).forEach(function(detail) {
        drawLines("• " + detail, { fontSize: compact ? 8 : 8.5, lineHeight: compact ? 10 : 10.5, after: 1 });
      });
    });
  }

  const certifications = safeArray(resume.certifications, 15);
  if (certifications.length) {
    section("Certifications");
    certifications.forEach(function(item) {
      const line = [clean(item.name), clean(item.issuer), clean(item.date)].filter(Boolean).join(" | ");
      if (line) drawLines(line, { fontSize: 9, lineHeight: 11.5, after: 2 });
    });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(115, 115, 115);
    doc.text("Generated with Deep Nexivra · Page " + page + " of " + pages, pageWidth / 2, pageHeight - 24, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const format = body.format;
  const resume = body.resume;
  const validationError = validateResume(resume);

  if (validationError) {
    return res.status(400).json({ ok: false, message: validationError });
  }
  if (format !== "docx" && format !== "pdf") {
    return res.status(400).json({ ok: false, message: "Format must be docx or pdf" });
  }

  try {
    const buffer = format === "docx" ? await makeDocx(resume) : await makePdf(resume);
    const mime = format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", 'attachment; filename="' + filenameBase(resume) + "." + format + '"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Unable to export the approved resume"
    });
  }
}
