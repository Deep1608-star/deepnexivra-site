const $ = (id) => document.getElementById(id);

const state = {
  masterResume: localStorage.getItem("dn_master_resume") || "",
  evidence: JSON.parse(localStorage.getItem("dn_evidence") || "[]"),
  scans: JSON.parse(localStorage.getItem("dn_scans") || "[]"),
  applications: JSON.parse(localStorage.getItem("dn_applications") || "[]"),
  careerGraph: JSON.parse(localStorage.getItem("dn_career_graph") || "null"),
  resumeSource: JSON.parse(localStorage.getItem("dn_resume_source") || "null"),
  tailoredResume: JSON.parse(localStorage.getItem("dn_tailored_resume") || "null"),
  resumeVersions: JSON.parse(localStorage.getItem("dn_resume_versions") || "[]"),
  applicationPackage: JSON.parse(localStorage.getItem("dn_application_package") || "null"),
  importedResumeText: "",
  importedFile: null,
  latest: null
};

const stopWords = new Set([
  "the","and","for","with","that","this","from","your","you","our","are","will","have","has","had","into","their","they",
  "who","what","when","where","how","but","not","all","any","can","may","job","role","work","working","team","teams",
  "years","year","skills","skill","experience","required","preferred","responsibilities","responsibility","including",
  "within","using","use","used","ability","strong","excellent","good","support","provide","position","candidate","company",
  "business","environment","knowledge","related","requirements","qualifications","perform","ensure","such","other","more"
]);

function persist() {
  localStorage.setItem("dn_master_resume", state.masterResume);
  localStorage.setItem("dn_evidence", JSON.stringify(state.evidence));
  localStorage.setItem("dn_scans", JSON.stringify(state.scans));
  localStorage.setItem("dn_applications", JSON.stringify(state.applications));
  localStorage.setItem("dn_career_graph", JSON.stringify(state.careerGraph));
  localStorage.setItem("dn_resume_source", JSON.stringify(state.resumeSource));
  localStorage.setItem("dn_tailored_resume", JSON.stringify(state.tailoredResume));
  localStorage.setItem("dn_resume_versions", JSON.stringify(state.resumeVersions));
  localStorage.setItem("dn_application_package", JSON.stringify(state.applicationPackage));
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(v => v.classList.remove("active"));
  const view = $("view-" + name);
  if (view) view.classList.add("active");
  const nav = document.querySelector('.nav-item[data-view="' + name + '"]');
  if (nav) nav.classList.add("active");
  const titleMap = {
    command: "Command Center",
    match: "Match Lab",
    resume: "Resume Studio",
    tailor: "Tailor Studio",
    evidence: "Evidence Vault",
    graph: "Career Graph",
    applications: "Applications",
    interview: "Interview Lab",
    package: "Application Package"
  };
  $("viewTitle").textContent = titleMap[name] || "Deep Nexivra";
  $("sidebar").classList.remove("open");
  window.scrollTo({top: 0, behavior: "smooth"});
}

function esc(text = "") {
  return String(text).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function normalize(text = "") {
  return text.toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  return normalize(text).split(" ").filter(w => w.length > 2 && !stopWords.has(w));
}

function frequency(text = "") {
  const counts = {};
  tokenize(text).forEach(w => counts[w] = (counts[w] || 0) + 1);
  return counts;
}

function topKeywords(jobText, limit = 18) {
  const counts = frequency(jobText);
  return Object.entries(counts)
    .filter(([w]) => !/^\d+$/.test(w))
    .sort((a,b) => b[1]-a[1])
    .slice(0, limit)
    .map(([word, count]) => ({word, count}));
}

function extractRole(jobText) {
  const lines = jobText.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const likely = lines.find(line =>
    line.length > 3 &&
    line.length < 90 &&
    /(manager|coordinator|analyst|specialist|supervisor|technician|technologist|assistant|engineer|lead|director|associate|administrator|developer|consultant|representative)/i.test(line)
  );
  return likely || lines[0] || "Target role";
}

function splitRequirements(jobText) {
  const raw = jobText
    .split(/\n|•|·|▪|\u2022|\u25AA|;/)
    .map(s => s.trim().replace(/^[-–—*]+\s*/, ""))
    .filter(s => s.length >= 18 && s.length <= 240);

  const scored = raw.map(text => {
    let weight = 0;
    if (/(required|must|minimum|qualification|responsibil|experience|knowledge|proficien|certif|degree|diploma|license|ability|manage|coordinate|analy|develop|lead|operate|maintain|support|prepare|monitor|communicat)/i.test(text)) weight += 2;
    if (/\d+\+?\s*(year|years)/i.test(text)) weight += 2;
    if (/(preferred|asset|nice to have)/i.test(text)) weight += 1;
    return {text, weight};
  }).filter(x => x.weight > 0);

  const unique = [];
  const seen = new Set();
  for (const item of scored) {
    const key = normalize(item.text).slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item.text);
    }
    if (unique.length >= 12) break;
  }

  if (unique.length < 5) {
    jobText.split(/[.!?]\s+/).forEach(s => {
      const t = s.trim();
      if (t.length >= 28 && t.length <= 220 && unique.length < 10) unique.push(t);
    });
  }
  return unique.slice(0, 12);
}

function sentenceMatchScore(sentence, resumeText) {
  const keys = [...new Set(tokenize(sentence))].filter(w => w.length > 3);
  if (!keys.length) return 0;
  const resume = normalize(resumeText);
  let hit = 0;
  keys.forEach(k => { if (resume.includes(k)) hit++; });
  return Math.round((hit / keys.length) * 100);
}

function detectAtsIssues(resume) {
  const issues = [];
  if (resume.length < 900) issues.push({level:"warn", text:"Resume text is quite short; the scan may not have enough evidence to evaluate."});
  if (!/experience|employment|work history/i.test(resume)) issues.push({level:"warn", text:"No clearly labeled Experience or Employment section detected."});
  if (!/education/i.test(resume)) issues.push({level:"warn", text:"No clearly labeled Education section detected."});
  if (!/skills|technical skills|core competencies/i.test(resume)) issues.push({level:"warn", text:"No dedicated Skills or Core Competencies section detected."});
  if ((resume.match(/\|/g) || []).length > 12) issues.push({level:"warn", text:"Heavy pipe-character formatting may indicate complex columns or visual formatting."});
  if ((resume.match(/\t/g) || []).length > 12) issues.push({level:"warn", text:"Tab-heavy formatting can be less reliable when copied into some ATS parsers."});
  if (/[★◆■▶✓]/.test(resume)) issues.push({level:"warn", text:"Decorative symbols detected. Standard bullets are safer for machine parsing."});
  if (!issues.length) issues.push({level:"good", text:"No obvious text-level ATS structure risk detected in the pasted content."});
  return issues;
}

function localAnalysis(resume, job) {
  const role = extractRole(job);
  const kws = topKeywords(job, 20);
  const resumeNorm = normalize(resume);
  const kwMatches = kws.filter(k => resumeNorm.includes(k.word));
  const kwMissing = kws.filter(k => !resumeNorm.includes(k.word));

  const requirements = splitRequirements(job).map(req => {
    const score = sentenceMatchScore(req, resume);
    let status = score >= 46 ? "direct" : score >= 24 ? "transferable" : "gap";
    const matched = [...new Set(tokenize(req))].filter(k => resumeNorm.includes(k)).slice(0, 5);
    return {
      requirement: req,
      status,
      evidence: matched.length ? "Matching terms/evidence: " + matched.join(", ") : "No clear supporting evidence found in the pasted resume."
    };
  });

  const direct = requirements.filter(r => r.status === "direct").length;
  const transferable = requirements.filter(r => r.status === "transferable").length;
  const reqScore = requirements.length
    ? Math.round(((direct + transferable * .55) / requirements.length) * 100)
    : Math.round((kwMatches.length / Math.max(kws.length,1)) * 100);

  const numberEvidence = (resume.match(/\b\d+(?:\.\d+)?%?|\$[\d,.]+|\b\d+\+?\b/g) || []).length;
  const actionVerbEvidence = (resume.match(/\b(led|managed|built|created|reduced|increased|improved|coordinated|developed|implemented|analyzed|processed|delivered|trained|optimized|supported|maintained)\b/gi) || []).length;
  const evidenceScore = Math.max(30, Math.min(100, Math.round(38 + Math.min(numberEvidence,10)*3 + Math.min(actionVerbEvidence,18)*1.7)));

  const atsIssues = detectAtsIssues(resume);
  const atsWarnings = atsIssues.filter(i => i.level === "warn").length;
  const atsScore = Math.max(45, 96 - atsWarnings * 10);

  const sentenceCount = Math.max(1, resume.split(/[.!?\n]+/).filter(s => s.trim().length > 20).length);
  const recruiterScore = Math.max(35, Math.min(98, Math.round(48 + Math.min(numberEvidence,12)*2.4 + Math.min(actionVerbEvidence / sentenceCount * 100, 30))));

  const readiness = Math.round(reqScore*.38 + evidenceScore*.23 + atsScore*.17 + recruiterScore*.22);

  const strengths = kwMatches.slice(0,6).map(k => "Resume already contains a strong signal for “" + k.word + "”.");
  if (!strengths.length) strengths.push("The resume provides baseline career information, but stronger job-specific alignment is needed.");

  const rewrites = kwMissing.slice(0,5).map(k => ({
    title: "Verify before adding: " + k.word,
    suggestion: "If you genuinely used or demonstrated “" + k.word + "”, add a bullet that names the context, action, and result. Do not add it only to increase keyword coverage."
  }));

  const nextActions = [
    ...requirements.filter(r => r.status === "gap").slice(0,3).map(r => "Resolve or consciously accept this gap: " + r.requirement),
    ...kwMissing.slice(0,3).map(k => "Check whether your real experience supports the missing concept “" + k.word + "”.")
  ].slice(0,6);

  const questions = requirements.slice(0,6).map((r,i) => ({
    question: i < 3
      ? "Tell me about a time you demonstrated: " + r.requirement
      : "How would your experience help you handle: " + r.requirement,
    why: r.status === "gap" ? "This is a current evidence gap." : "This appears important in the job description."
  }));

  return {
    role,
    summary: "This local fallback scan compares the job posting with the resume text, keeps unsupported requirements visible, and separates match quality from ATS readability.",
    scores: {
      requirementMatch: reqScore,
      evidenceStrength: evidenceScore,
      atsReadability: atsScore,
      recruiterQuality: recruiterScore,
      readiness
    },
    requirements,
    keywords: kws.slice(0,14).map(k => ({keyword:k.word, present:resumeNorm.includes(k.word)})),
    atsIssues,
    strengths,
    rewrites,
    nextActions: nextActions.length ? nextActions : ["Review the strongest requirements and add measurable evidence where truthful."],
    interviewQuestions: questions
  };
}

async function deepAnalyze(resume, job) {
  const vault = state.evidence.slice(0,30);
  try {
    const response = await fetch("/api/career-analyze", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        resume,
        jobDescription: job,
        evidenceVault: vault,
        careerGraph: state.careerGraph
      })
    });
    if (!response.ok) throw new Error("AI endpoint unavailable");
    const data = await response.json();
    if (!data?.ok || !data?.result) throw new Error("Invalid AI response");
    return data.result;
  } catch (err) {
    console.warn("Using local fallback analysis:", err);
    const result = localAnalysis(resume, job);
    result.summary += " AI service was unavailable, so this result was generated by the local analysis engine.";
    return result;
  }
}

function createTextBlock(parent, className, text) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  parent.appendChild(div);
  return div;
}

function renderScan(result) {
  state.latest = result;
  $("scanResults").classList.remove("hidden");
  $("scoreRequirement").textContent = result.scores?.requirementMatch ?? 0;
  $("scoreEvidence").textContent = result.scores?.evidenceStrength ?? 0;
  $("scoreAts").textContent = result.scores?.atsReadability ?? 0;
  $("scoreRecruiter").textContent = result.scores?.recruiterQuality ?? 0;
  $("scoreReadiness").textContent = result.scores?.readiness ?? 0;
  $("resultRole").textContent = result.role || "Target role";
  $("resultSummary").textContent = result.summary || "";

  const gapTable = $("gapTable");
  gapTable.innerHTML = "";
  (result.requirements || []).forEach(item => {
    const row = document.createElement("div");
    row.className = "requirement-row";
    const body = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = item.requirement || "";
    const p = document.createElement("p");
    p.textContent = item.evidence || "";
    body.append(strong,p);
    const badge = document.createElement("span");
    badge.className = "status-badge status-" + (item.status || "gap");
    badge.textContent = item.status === "direct" ? "Direct" : item.status === "transferable" ? "Transferable" : "Gap";
    row.append(body,badge);
    gapTable.appendChild(row);
  });

  const keywordList = $("keywordList");
  keywordList.innerHTML = "";
  (result.keywords || []).forEach(item => {
    const chip = document.createElement("span");
    chip.className = "chip" + (item.present ? "" : " missing");
    chip.textContent = (item.present ? "✓ " : "+ ") + (item.keyword || "");
    keywordList.appendChild(chip);
  });

  const ats = $("atsIssues");
  ats.innerHTML = "";
  (result.atsIssues || []).forEach(item => createTextBlock(ats, "issue-item " + (item.level || "warn"), item.text || item));

  const strength = $("strengthList");
  strength.innerHTML = "";
  (result.strengths || []).forEach(item => createTextBlock(strength, "issue-item good", item));

  const rewrites = $("rewriteList");
  rewrites.innerHTML = "";
  (result.rewrites || []).forEach(item => {
    const div = document.createElement("div");
    div.className = "rewrite-item";
    const strong = document.createElement("strong");
    strong.textContent = item.title || "Suggested improvement";
    const p = document.createElement("small");
    p.textContent = item.suggestion || "";
    div.append(strong,p);
    rewrites.appendChild(div);
  });

  const next = $("nextActions");
  next.innerHTML = "";
  (result.nextActions || []).forEach((item,i) => createTextBlock(next, "action-item", (i+1) + ". " + item));

  renderInterview();
}

function renderDashboard() {
  $("masterResume").value = state.masterResume;
  $("resumeStatus").textContent = state.masterResume ? "Loaded" : "Not loaded";
  $("evidenceCount").textContent = state.evidence.length;
  $("applicationCount").textContent = state.applications.length;
  $("scanCount").textContent = state.scans.length;
  $("vaultTag").textContent = state.evidence.length + (state.evidence.length === 1 ? " record" : " records");

  const latest = state.scans[0];
  $("heroReadiness").textContent = latest?.result?.scores?.readiness ?? "—";
  $("heroTarget").textContent = latest?.result?.role || "No job analyzed yet";
  $("heroSummary").textContent = latest?.result?.summary || "Run your first Match Lab scan to build your application intelligence.";

  const history = $("historyList");
  history.innerHTML = "";
  if (!state.scans.length) {
    history.className = "empty-state";
    history.textContent = "No scans yet.";
  } else {
    history.className = "";
    state.scans.slice(0,5).forEach(scan => {
      const row = document.createElement("div");
      row.className = "history-item";
      const left = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = scan.result?.role || "Target role";
      const small = document.createElement("small");
      small.textContent = new Date(scan.createdAt).toLocaleString();
      left.append(strong,small);
      const score = document.createElement("span");
      score.className = "history-score";
      score.textContent = (scan.result?.scores?.readiness ?? 0) + "/100";
      row.append(left,score);
      history.appendChild(row);
    });
  }
  renderEvidence();
  renderCareerGraph();
  renderTailorStudio();
  renderResumeVersions();
  renderApplicationPackage();
  renderApplications();
  renderInterview();
}

function renderEvidence() {
  const list = $("evidenceList");
  if (!list) return;
  list.innerHTML = "";
  if (!state.evidence.length) {
    list.className = "empty-state";
    list.textContent = "Your evidence vault is empty.";
    return;
  }
  list.className = "";
  state.evidence.forEach(item => {
    const div = document.createElement("div");
    div.className = "evidence-item";
    const strong = document.createElement("strong");
    strong.textContent = item.title;
    const small = document.createElement("small");
    small.textContent = item.category + " · " + item.text;
    const btn = document.createElement("button");
    btn.className = "delete-evidence";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      state.evidence = state.evidence.filter(x => x.id !== item.id);
      persist(); renderDashboard(); toast("Evidence removed");
    });
    div.append(strong,small,btn);
    list.appendChild(div);
  });
}

function renderApplications() {
  const board = $("applicationBoard");
  if (!board) return;
  board.innerHTML = "";
  const stages = ["Saved","Applied","Interview","Offer"];
  stages.forEach(stage => {
    const col = document.createElement("div");
    col.className = "kanban-col";
    const title = document.createElement("h3");
    const records = state.applications.filter(a => a.stage === stage);
    title.textContent = stage + " · " + records.length;
    col.appendChild(title);

    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.style.minHeight = "80px";
      empty.textContent = "No applications";
      col.appendChild(empty);
    }

    records.forEach(app => {
      const card = document.createElement("div");
      card.className = "app-card";
      const strong = document.createElement("strong");
      strong.textContent = app.role;
      const small = document.createElement("small");
      small.textContent = "Readiness " + app.readiness + "/100 · " + new Date(app.createdAt).toLocaleDateString();
      const select = document.createElement("select");
      stages.forEach(s => {
        const op = document.createElement("option");
        op.value = s; op.textContent = s;
        if (s === app.stage) op.selected = true;
        select.appendChild(op);
      });
      select.addEventListener("change", () => {
        app.stage = select.value; persist(); renderApplications(); renderDashboard();
      });
      card.append(strong,small,select);
      col.appendChild(card);
    });
    board.appendChild(col);
  });
}

function renderInterview() {
  const list = $("interviewList");
  if (!list) return;
  const source = state.latest || state.scans[0]?.result;
  const questions = source?.interviewQuestions || [];
  list.innerHTML = "";
  if (!questions.length) {
    list.className = "empty-state";
    list.textContent = "Run a Match Lab scan first. Interview questions from your latest scan will appear here.";
    return;
  }
  list.className = "";
  questions.forEach((q,i) => {
    const div = document.createElement("div");
    div.className = "question-item";
    const strong = document.createElement("strong");
    strong.textContent = "Q" + (i+1) + ". " + (q.question || q);
    div.appendChild(strong);
    if (q.why) {
      const small = document.createElement("small");
      small.textContent = q.why;
      div.appendChild(small);
    }
    list.appendChild(div);
  });
}


const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs";
const MAMMOTH_URL = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.12.3/mammoth.browser.min.js";

function setParserProgress(percent, message) {
  const wrap = $("parserProgress");
  if (!wrap) return;
  wrap.classList.remove("hidden");
  $("parserBar").style.width = Math.max(0, Math.min(100, percent)) + "%";
  $("parserStatus").textContent = message;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function cleanExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();
}

async function loadExternalScript(src, globalName) {
  if (window[globalName]) return window[globalName];
  const existing = document.querySelector('script[data-deep-lib="' + globalName + '"]');
  if (existing) {
    await new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, {once:true});
      existing.addEventListener("error", reject, {once:true});
    });
    return window[globalName];
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.deepLib = globalName;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load " + globalName));
    document.head.appendChild(script);
  });
  return window[globalName];
}

async function extractPdfText(file) {
  setParserProgress(12, "Loading secure PDF parser");
  const pdfjs = await import(PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const bytes = new Uint8Array(await file.arrayBuffer());
  setParserProgress(24, "Reading PDF structure");
  const doc = await pdfjs.getDocument({data: bytes}).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items || []) {
      if (!item || typeof item.str !== "string") continue;
      pageText += item.str;
      pageText += item.hasEOL ? "\n" : " ";
    }
    pages.push(pageText.trim());
    setParserProgress(24 + Math.round((pageNo / doc.numPages) * 46), "Extracting PDF page " + pageNo + " of " + doc.numPages);
  }

  return cleanExtractedText(pages.join("\n\n"));
}

async function extractDocxText(file) {
  setParserProgress(14, "Loading DOCX parser");
  const mammoth = await loadExternalScript(MAMMOTH_URL, "mammoth");
  if (!mammoth || typeof mammoth.extractRawText !== "function") throw new Error("DOCX parser unavailable");
  setParserProgress(32, "Reading Word document");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({arrayBuffer});
  setParserProgress(70, "Cleaning extracted Word text");
  return cleanExtractedText(result.value || "");
}

async function extractResumeText(file) {
  const name = (file.name || "").toLowerCase();
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than the 10 MB import limit.");
  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractPdfText(file);
  if (name.endsWith(".docx") || /wordprocessingml/.test(file.type || "")) return extractDocxText(file);
  if (name.endsWith(".txt") || file.type === "text/plain") {
    setParserProgress(35, "Reading text document");
    return cleanExtractedText(await file.text());
  }
  throw new Error("Unsupported format. Use PDF, DOCX, or TXT.");
}

function renderImportPreview(text) {
  const preview = $("resumePreview");
  const tag = $("parseQualityTag");
  if (!text) {
    preview.className = "preview-box empty-state";
    preview.textContent = "Upload a resume to preview the extracted text before it becomes career evidence.";
    tag.textContent = "Not parsed";
    return;
  }
  preview.className = "preview-box";
  preview.textContent = text.length > 18000 ? text.slice(0,18000) + "\n\n[Preview truncated]" : text;
  if (text.length >= 1800) tag.textContent = "Strong extraction";
  else if (text.length >= 700) tag.textContent = "Usable extraction";
  else tag.textContent = "Low-text extraction";
}

async function handleResumeFile(file) {
  if (!file) return;
  state.importedFile = {
    name: file.name,
    size: file.size,
    type: file.type || "",
    lastModified: file.lastModified || null
  };
  const meta = $("fileMeta");
  meta.classList.remove("hidden");
  meta.innerHTML = "";
  const left = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = file.name;
  const small = document.createElement("small");
  small.textContent = formatBytes(file.size) + " · " + (file.type || "detected by extension");
  left.append(strong, small);
  const status = document.createElement("span");
  status.className = "tag";
  status.textContent = "Parsing";
  meta.append(left, status);
  $("buildCareerGraph").disabled = true;
  $("clearImportedResume").disabled = false;

  try {
    const text = await extractResumeText(file);
    if (text.length < 120) {
      throw new Error("Very little selectable text was found. This may be a scanned/image-only PDF; OCR is not enabled in this phase.");
    }
    state.importedResumeText = text;
    renderImportPreview(text);
    setParserProgress(100, "Extraction complete · ready for evidence structuring");
    status.textContent = "Ready";
    meta.classList.add("import-success");
    $("buildCareerGraph").disabled = false;
    toast("Resume extracted successfully");
  } catch (error) {
    console.error(error);
    state.importedResumeText = "";
    renderImportPreview("");
    setParserProgress(100, error.message || "Resume extraction failed");
    status.textContent = "Needs attention";
    meta.classList.add("import-warning");
    toast(error.message || "Resume extraction failed");
  }
}

async function ingestCareerGraph(rawText) {
  const response = await fetch("/api/resume-ingest", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      resumeText: rawText,
      sourceFile: state.importedFile || null
    })
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.result) {
    throw new Error(data?.message || "Career graph ingestion failed");
  }
  return data.result;
}

function graphUniqueSkillNames(graph) {
  const names = new Set();
  (graph?.skills || []).forEach(x => names.add(x.name));
  (graph?.experience || []).forEach(x => (x.tools || []).forEach(v => names.add(v)));
  return [...names].filter(Boolean);
}

function graphEvidenceToVault(graph) {
  const records = graph?.evidenceRecords || [];
  const existing = new Set(state.evidence.map(e => normalize((e.category || "") + "|" + (e.title || "") + "|" + (e.text || ""))));
  let added = 0;
  records.forEach(rec => {
    const key = normalize((rec.category || "") + "|" + (rec.title || "") + "|" + (rec.text || ""));
    if (!key || existing.has(key)) return;
    existing.add(key);
    state.evidence.push({
      id: crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + added),
      title: rec.title || "Imported evidence",
      category: rec.category || "Responsibility",
      text: rec.text || "",
      sourceSnippet: rec.sourceSnippet || "",
      employer: rec.employer || "",
      role: rec.role || "",
      source: "resume_import",
      createdAt: new Date().toISOString()
    });
    added++;
  });
  return added;
}

function graphRecord(container, title, meta, body) {
  const div = document.createElement("div");
  div.className = "graph-record";
  const strong = document.createElement("strong");
  strong.textContent = title;
  div.appendChild(strong);
  if (meta) {
    const small = document.createElement("small");
    small.textContent = meta;
    div.appendChild(small);
  }
  if (body) {
    const p = document.createElement("p");
    p.textContent = body;
    div.appendChild(p);
  }
  container.appendChild(div);
}

function renderCareerGraph() {
  const graph = state.careerGraph;
  const roleCount = graph?.experience?.length || 0;
  const skillNames = graphUniqueSkillNames(graph);
  const evidenceCount = graph?.evidenceRecords?.length || 0;
  $("graphRoleCount").textContent = roleCount;
  $("graphSkillCount").textContent = skillNames.length;
  $("graphEvidenceCount").textContent = evidenceCount;
  $("graphConfidence").textContent = graph?.resumeQuality?.parseConfidence != null ? Math.round(graph.resumeQuality.parseConfidence) + "%" : "—";
  $("experienceTag").textContent = roleCount + (roleCount === 1 ? " role" : " roles");
  $("skillsTag").textContent = skillNames.length + " items";
  $("graphEvidenceTag").textContent = evidenceCount + (evidenceCount === 1 ? " record" : " records");

  const sourceName = state.resumeSource?.name || "";
  $("graphSourceTag").textContent = sourceName || "Awaiting import";
  $("masterSourceTag").textContent = sourceName ? "Imported · " + sourceName : "Manual";

  const visual = $("careerGraphVisual");
  const exp = $("graphExperience");
  const skills = $("graphSkills");
  const edu = $("graphEducation");
  const projects = $("graphProjects");
  const evidence = $("graphEvidenceList");

  [visual, exp, skills, edu, projects, evidence].forEach(el => { if (el) el.innerHTML = ""; });

  if (!graph) {
    $("graphPersonName").textContent = "No career graph yet";
    visual.className = "career-graph empty-state";
    visual.textContent = "Import a resume in Resume Studio to build your graph.";
    exp.className = "graph-list empty-state"; exp.textContent = "No structured experience yet.";
    skills.innerHTML = "";
    edu.className = "graph-list empty-state"; edu.textContent = "No credentials yet.";
    projects.className = "graph-list empty-state"; projects.textContent = "No projects or achievements yet.";
    evidence.className = "graph-evidence-list empty-state"; evidence.textContent = "Evidence created from imported resumes will appear here with its source context.";
    return;
  }

  const personName = graph.profile?.fullName || "Career Profile";
  $("graphPersonName").textContent = personName;
  visual.className = "career-graph";
  const map = document.createElement("div");
  map.className = "graph-map";
  const left = document.createElement("div"); left.className = "graph-column left";
  const center = document.createElement("div");
  const right = document.createElement("div"); right.className = "graph-column right";

  (graph.experience || []).slice(0,5).forEach(role => {
    const node = document.createElement("div"); node.className = "graph-node";
    const strong = document.createElement("strong"); strong.textContent = role.title || "Role";
    const small = document.createElement("small"); small.textContent = [role.employer, role.startDate && role.endDate ? role.startDate + " – " + role.endDate : ""].filter(Boolean).join(" · ");
    node.append(strong,small); left.appendChild(node);
  });

  const core = document.createElement("div"); core.className = "graph-core";
  const coreStrong = document.createElement("strong"); coreStrong.textContent = personName;
  const coreSmall = document.createElement("small"); coreSmall.textContent = graph.profile?.professionalHeadline || roleCount + " structured roles";
  core.append(coreStrong, coreSmall); center.appendChild(core);

  const rightItems = [
    ...skillNames.slice(0,4).map(name => ({title:name, meta:"Skill / tool"})),
    ...(graph.education || []).slice(0,1).map(x => ({title:x.credential || x.field || "Education", meta:x.institution || "Education"})),
    ...(graph.certifications || []).slice(0,1).map(x => ({title:x.name || "Certification", meta:x.issuer || "Certification"}))
  ];
  rightItems.slice(0,6).forEach(item => {
    const node = document.createElement("div"); node.className = "graph-node";
    const strong = document.createElement("strong"); strong.textContent = item.title;
    const small = document.createElement("small"); small.textContent = item.meta;
    node.append(strong,small); right.appendChild(node);
  });

  map.append(left,center,right); visual.appendChild(map);

  exp.className = "graph-list";
  if (!(graph.experience || []).length) { exp.className += " empty-state"; exp.textContent = "No structured experience found."; }
  (graph.experience || []).forEach(role => {
    const dates = [role.startDate, role.endDate].filter(Boolean).join(" – ");
    const meta = [role.employer, role.location, dates].filter(Boolean).join(" · ");
    graphRecord(exp, role.title || "Role", meta, role.summary || "");
  });

  skills.innerHTML = "";
  skillNames.forEach(name => {
    const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = name; skills.appendChild(chip);
  });

  edu.className = "graph-list";
  const credentials = [
    ...(graph.education || []).map(x => ({title:x.credential || x.field || "Education", meta:[x.institution,x.endDate].filter(Boolean).join(" · "), body:x.field || ""})),
    ...(graph.certifications || []).map(x => ({title:x.name || "Certification", meta:[x.issuer,x.date].filter(Boolean).join(" · "), body:""}))
  ];
  if (!credentials.length) { edu.className += " empty-state"; edu.textContent = "No credentials found."; }
  credentials.forEach(x => graphRecord(edu,x.title,x.meta,x.body));

  projects.className = "graph-list";
  const projectItems = [...(graph.projects || []).map(x => ({title:x.name || "Project", meta:(x.tools || []).join(", "), body:x.description || ""}))];
  (graph.experience || []).forEach(role => (role.achievements || []).slice(0,3).forEach(a => projectItems.push({title:"Achievement · " + (role.title || "Role"), meta:role.employer || "", body:a})));
  if (!projectItems.length) { projects.className += " empty-state"; projects.textContent = "No projects or achievements found."; }
  projectItems.slice(0,16).forEach(x => graphRecord(projects,x.title,x.meta,x.body));

  evidence.className = "graph-evidence-list";
  if (!(graph.evidenceRecords || []).length) { evidence.className += " empty-state"; evidence.textContent = "No source-backed evidence records found."; }
  (graph.evidenceRecords || []).slice(0,40).forEach(rec => {
    const card = document.createElement("div"); card.className = "graph-evidence";
    const strong = document.createElement("strong"); strong.textContent = rec.title || "Evidence";
    const label = document.createElement("span"); label.className = "source-label"; label.textContent = [rec.category,rec.employer,rec.role].filter(Boolean).join(" · ");
    const p = document.createElement("p"); p.textContent = rec.text || "";
    card.append(strong,label,p);
    if (rec.sourceSnippet) {
      const quote = document.createElement("blockquote"); quote.textContent = rec.sourceSnippet; card.appendChild(quote);
    }
    evidence.appendChild(card);
  });
}


function ensureCareerGraphIds() {
  if (!state.careerGraph) return null;
  let changed = false;
  state.careerGraph.experience = (state.careerGraph.experience || []).map((role, index) => {
    if (role.roleId) return role;
    changed = true;
    return Object.assign({}, role, {roleId: "R" + String(index + 1).padStart(3, "0")});
  });
  state.careerGraph.evidenceRecords = (state.careerGraph.evidenceRecords || []).map((record, index) => {
    if (record.evidenceId) return record;
    changed = true;
    return Object.assign({}, record, {evidenceId: "E" + String(index + 1).padStart(3, "0")});
  });
  if (changed) persist();
  return state.careerGraph;
}

function latestTargetScan() {
  return state.scans && state.scans.length ? state.scans[0] : null;
}

function evidenceById(id) {
  const graph = ensureCareerGraphIds();
  return (graph?.evidenceRecords || []).find(item => item.evidenceId === id) || null;
}

function roleById(id) {
  const graph = ensureCareerGraphIds();
  return (graph?.experience || []).find(item => item.roleId === id) || null;
}

function countAcceptedBullets() {
  let total = 0;
  (state.tailoredResume?.experiences || []).forEach(exp => {
    (exp.bullets || []).forEach(bullet => { if (bullet.accepted !== false) total++; });
  });
  return total;
}

function hydrateTailoredState(result, scan) {
  result.generatedForScanId = scan?.id || "";
  result.targetContext = {
    jobDescription: scan?.jobSnapshot || "",
    analysis: scan?.result || {}
  };
  result.generatedAt = new Date().toISOString();
  result.template = result.template || "classic";
  result.onePageMode = !!result.onePageMode;
  result.integrity = {
    status: "valid",
    checkedAt: result.generatedAt,
    summary: "Generated content passed evidence-ID and same-role validation.",
    findings: []
  };
  result.professionalSummary = result.professionalSummary || {text:"",sourceEvidenceIds:[]};
  result.coreSkills = (result.coreSkills || []).map(skill => Object.assign({selected:true}, skill));
  result.experiences = (result.experiences || []).map(exp => Object.assign({}, exp, {
    bullets: (exp.bullets || []).map(bullet => Object.assign({
      accepted:true,
      editedText: bullet.text || ""
    }, bullet))
  }));
  return result;
}

async function requestTailoredResume() {
  const scan = latestTargetScan();
  const graph = ensureCareerGraphIds();
  if (!scan) throw new Error("Run a Match Lab scan first");
  if (!graph) throw new Error("Build your Career Graph first");

  const response = await fetch("/api/tailor-resume", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      careerGraph: graph,
      masterResume: state.masterResume,
      jobDescription: scan.jobSnapshot || "",
      jobAnalysis: scan.result || {}
    })
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.result) {
    throw new Error(data?.message || "Tailored resume generation failed");
  }
  return hydrateTailoredState(data.result, scan);
}

function skillSelectedCount() {
  return (state.tailoredResume?.coreSkills || []).filter(s => s.selected !== false).length;
}

function approvedResumePayload() {
  const graph = ensureCareerGraphIds();
  const draft = state.tailoredResume;
  if (!graph || !draft) return null;

  const experiences = [];
  (draft.experiences || []).forEach(exp => {
    const sourceRole = roleById(exp.roleId);
    if (!sourceRole) return;
    let bullets = (exp.bullets || [])
      .filter(b => b.accepted !== false && String(b.editedText || b.text || "").trim())
      .map(b => ({
        text: String(b.editedText || b.text || "").trim(),
        confidence: Number(b.confidence) || 0,
        priority: Number(b.priority) || 0
      }));

    if (draft.onePageMode) {
      bullets = bullets.sort((a,b) => (b.priority - a.priority) || (b.confidence - a.confidence)).slice(0,3);
    }

    if (!bullets.length) return;
    experiences.push({
      employer: sourceRole.employer || "",
      title: sourceRole.title || "",
      location: sourceRole.location || "",
      startDate: sourceRole.startDate || "",
      endDate: sourceRole.endDate || "",
      isCurrent: !!sourceRole.isCurrent,
      bullets: bullets.map(b => b.text)
    });
  });

  let finalExperiences = experiences;
  if (draft.onePageMode) finalExperiences = experiences.slice(0,4);

  let skills = (draft.coreSkills || []).filter(s => s.selected !== false).map(s => s.name).filter(Boolean);
  if (draft.onePageMode) skills = skills.slice(0,12);

  return {
    targetRole: draft.targetRole || latestTargetScan()?.result?.role || "",
    profile: graph.profile || {},
    summary: String(draft.professionalSummary?.text || "").trim(),
    skills,
    experiences: finalExperiences,
    education: graph.education || [],
    certifications: graph.certifications || [],
    template: draft.template || "classic",
    onePageMode: !!draft.onePageMode
  };
}

function renderTailorPreview() {
  const paper = $("tailoredResumePreview");
  if (!paper) return;
  const resume = approvedResumePayload();
  paper.innerHTML = "";
  paper.className = "resume-paper template-" + (state.tailoredResume?.template || "classic") + (state.tailoredResume?.onePageMode ? " one-page-mode" : "");
  if (!resume) {
    const empty = document.createElement("div");
    empty.className = "resume-paper-empty";
    empty.textContent = "Generate a tailored resume to see the document preview.";
    paper.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className = "resume-doc-header";
  const h1 = document.createElement("h1");
  h1.textContent = resume.profile.fullName || "Candidate";
  const contact = document.createElement("div");
  contact.className = "resume-contact";
  contact.textContent = [
    resume.profile.location,
    resume.profile.phone,
    resume.profile.email,
    ...(resume.profile.links || [])
  ].filter(Boolean).join("  |  ");
  header.append(h1, contact);
  paper.appendChild(header);

  function sectionTitle(text) {
    const title = document.createElement("div");
    title.className = "resume-section-title";
    title.textContent = text;
    return title;
  }

  if (resume.summary) {
    const section = document.createElement("section");
    section.className = "resume-section";
    section.appendChild(sectionTitle("Professional Summary"));
    const p = document.createElement("div");
    p.className = "resume-summary";
    p.textContent = resume.summary;
    section.appendChild(p);
    paper.appendChild(section);
  }

  if (resume.skills.length) {
    const section = document.createElement("section");
    section.className = "resume-section";
    section.appendChild(sectionTitle("Core Skills"));
    const line = document.createElement("div");
    line.className = "resume-skill-line";
    line.textContent = resume.skills.join("  |  ");
    section.appendChild(line);
    paper.appendChild(section);
  }

  if (resume.experiences.length) {
    const section = document.createElement("section");
    section.className = "resume-section";
    section.appendChild(sectionTitle("Professional Experience"));
    resume.experiences.forEach(exp => {
      const job = document.createElement("div");
      job.className = "resume-job";
      const head = document.createElement("div");
      head.className = "resume-job-head";
      const left = document.createElement("strong");
      left.textContent = [exp.title, exp.employer].filter(Boolean).join(" — ");
      const dates = document.createElement("span");
      dates.textContent = [exp.startDate, exp.isCurrent ? "Present" : exp.endDate].filter(Boolean).join(" – ");
      head.append(left, dates);
      job.appendChild(head);
      if (exp.location) {
        const meta = document.createElement("div");
        meta.className = "resume-job-meta";
        meta.textContent = exp.location;
        job.appendChild(meta);
      }
      const ul = document.createElement("ul");
      exp.bullets.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        ul.appendChild(li);
      });
      job.appendChild(ul);
      section.appendChild(job);
    });
    paper.appendChild(section);
  }

  if (resume.education.length) {
    const section = document.createElement("section");
    section.className = "resume-section";
    section.appendChild(sectionTitle("Education"));
    resume.education.forEach(item => {
      const div = document.createElement("div");
      div.className = "resume-credential";
      const strong = document.createElement("strong");
      strong.textContent = [item.credential, item.field].filter(Boolean).join(" — ") || "Education";
      const meta = document.createElement("div");
      meta.textContent = [item.institution, item.location, item.endDate].filter(Boolean).join("  |  ");
      div.append(strong, meta);
      section.appendChild(div);
    });
    paper.appendChild(section);
  }

  if (resume.certifications.length) {
    const section = document.createElement("section");
    section.className = "resume-section";
    section.appendChild(sectionTitle("Certifications"));
    resume.certifications.forEach(item => {
      const div = document.createElement("div");
      div.className = "resume-credential";
      const strong = document.createElement("strong");
      strong.textContent = item.name || "Certification";
      const meta = document.createElement("div");
      meta.textContent = [item.issuer, item.date].filter(Boolean).join("  |  ");
      div.append(strong, meta);
      section.appendChild(div);
    });
    paper.appendChild(section);
  }
}

function renderTailorAudit() {
  const root = $("tailorEvidenceAudit");
  if (!root) return;
  root.innerHTML = "";
  const bullets = [];
  (state.tailoredResume?.experiences || []).forEach(exp => {
    (exp.bullets || []).forEach(bullet => {
      if (bullet.accepted !== false) bullets.push({exp, bullet});
    });
  });

  $("auditTag").textContent = bullets.length + (bullets.length === 1 ? " grounded bullet" : " grounded bullets");
  if (!bullets.length) {
    root.className = "empty-state";
    root.textContent = "Accepted bullets and their evidence links will appear here.";
    return;
  }

  root.className = "";
  bullets.forEach(({exp,bullet}) => {
    const record = document.createElement("div");
    record.className = "audit-record";
    const strong = document.createElement("strong");
    strong.textContent = bullet.editedText || bullet.text || "";
    const small = document.createElement("small");
    small.textContent = "Confidence " + Math.round(bullet.confidence || 0) + "% · " + (bullet.rationale || "Grounded rewrite");
    record.append(strong, small);
    (bullet.sourceEvidenceIds || []).forEach(id => {
      const evidence = evidenceById(id);
      if (!evidence) return;
      const source = document.createElement("div");
      source.className = "audit-source";
      source.textContent = id + " · " + (evidence.sourceSnippet || evidence.text || "");
      record.appendChild(source);
    });
    root.appendChild(record);
  });
}

function renderTailorEditor() {
  const draft = state.tailoredResume;
  const editor = $("tailorBulletEditor");
  const skills = $("tailorSkills");
  if (!editor || !skills) return;
  editor.innerHTML = "";
  skills.innerHTML = "";

  if (!draft) return;

  (draft.coreSkills || []).forEach((skill,index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-toggle" + (skill.selected !== false ? " selected" : "");
    btn.textContent = skill.name;
    btn.addEventListener("click", () => {
      skill.selected = skill.selected === false;
      state.applicationPackage = null;
      persist();
      renderTailorStudio();
    });
    skills.appendChild(btn);
  });

  (draft.experiences || []).forEach(exp => {
    const role = roleById(exp.roleId);
    if (!role) return;
    const wrap = document.createElement("div");
    wrap.className = "tailor-role-editor";
    const header = document.createElement("header");
    const left = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = [role.title,role.employer].filter(Boolean).join(" — ");
    const small = document.createElement("small");
    small.textContent = [role.startDate, role.isCurrent ? "Present" : role.endDate].filter(Boolean).join(" – ");
    left.append(strong,small);
    const count = document.createElement("span");
    count.className = "tag";
    count.textContent = (exp.bullets || []).filter(b => b.accepted !== false).length + "/" + (exp.bullets || []).length + " included";
    header.append(left,count);
    wrap.appendChild(header);

    (exp.bullets || []).forEach((bullet,bulletIndex) => {
      const card = document.createElement("div");
      card.className = "tailor-bullet-card " + (bullet.accepted !== false ? "accepted" : "rejected");
      const top = document.createElement("div");
      top.className = "bullet-topline";
      const confidence = document.createElement("span");
      confidence.className = (bullet.confidence || 0) >= 75 ? "grounding-good" : "grounding-warn";
      confidence.textContent = "Evidence " + Math.round(bullet.confidence || 0) + "% · Job priority " + Math.round(bullet.priority || 0) + "%";
      const actions = document.createElement("div");
      actions.className = "bullet-actions";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.textContent = "Accept";
      accept.className = bullet.accepted !== false ? "active-accept" : "";
      const reject = document.createElement("button");
      reject.type = "button";
      reject.textContent = "Reject";
      reject.className = bullet.accepted === false ? "active-reject" : "";
      accept.addEventListener("click", () => {
        bullet.accepted = true;
        state.applicationPackage = null;
        persist(); renderTailorStudio();
      });
      reject.addEventListener("click", () => {
        bullet.accepted = false;
        state.applicationPackage = null;
        persist(); renderTailorStudio();
      });
      actions.append(accept,reject);
      top.append(confidence,actions);

      const textarea = document.createElement("textarea");
      textarea.className = "bullet-editor";
      textarea.value = bullet.editedText || bullet.text || "";
      textarea.addEventListener("input", () => {
        bullet.editedText = textarea.value;
        markTailoredDirty("A bullet was edited and must be revalidated against its cited evidence.");
        persist();
        $("acceptedBulletCount").textContent = countAcceptedBullets();
        renderTailorPreview();
        renderTailorAudit();
      });

      const rationale = document.createElement("div");
      rationale.className = "bullet-rationale";
      const sourceIds = (bullet.sourceEvidenceIds || []).join(", ");
      rationale.textContent = (bullet.rationale || "") + (sourceIds ? " · Sources: " + sourceIds : "");

      const sourceBox = document.createElement("div");
      sourceBox.className = "bullet-source-box";
      const sourceLabel = document.createElement("strong");
      sourceLabel.textContent = "Source evidence";
      sourceBox.appendChild(sourceLabel);
      (bullet.sourceEvidenceIds || []).forEach(id => {
        const evidence = evidenceById(id);
        if (!evidence) return;
        const source = document.createElement("div");
        source.textContent = id + " · " + (evidence.sourceSnippet || evidence.text || "");
        sourceBox.appendChild(source);
      });

      card.append(top,textarea,rationale,sourceBox);
      wrap.appendChild(card);
    });
    editor.appendChild(wrap);
  });
}


function markTailoredDirty(reason) {
  if (!state.tailoredResume) return;
  state.tailoredResume.integrity = {
    status: "needs_review",
    checkedAt: null,
    summary: reason || "Manual edits require evidence revalidation before export.",
    findings: []
  };
  state.applicationPackage = null;
  persist();
  renderIntegrityGate();
}

function currentIntegrityStatus() {
  return state.tailoredResume?.integrity?.status || (state.tailoredResume ? "valid" : "none");
}

function renderIntegrityGate() {
  if (!$("integrityStatusTag")) return;
  const integrity = state.tailoredResume?.integrity;
  const tag = $("integrityStatusTag");
  const summary = $("integritySummary");
  const findings = $("integrityFindings");
  findings.innerHTML = "";

  if (!state.tailoredResume) {
    tag.textContent = "No draft";
    summary.textContent = "Generate a tailored resume first.";
    return;
  }

  const status = integrity?.status || "valid";
  tag.textContent = status === "valid" ? "Validated" : status === "blocked" ? "Blocked" : "Needs revalidation";
  tag.className = "tag " + (status === "valid" ? "grounding-good" : status === "blocked" ? "grounding-warn" : "");
  summary.textContent = integrity?.summary || "Generated content is evidence-grounded.";

  (integrity?.findings || []).forEach(item => {
    const div = document.createElement("div");
    div.className = "integrity-finding " + (item.status || "supported");
    const strong = document.createElement("strong");
    strong.textContent = (item.claimLabel || item.claimId || "Claim") + " · " + (item.status || "supported");
    const p = document.createElement("p");
    p.textContent = item.explanation || "";
    div.append(strong,p);
    if (item.suggestedText) {
      const suggestion = document.createElement("p");
      suggestion.textContent = "Suggested correction: " + item.suggestedText;
      div.appendChild(suggestion);
    }
    findings.appendChild(div);
  });

  const exportBlocked = status !== "valid";
  $("exportDocx").disabled = exportBlocked;
  $("exportPdf").disabled = exportBlocked;
}

async function revalidateTailoredResume() {
  const graph = ensureCareerGraphIds();
  const draft = state.tailoredResume;
  if (!graph || !draft) throw new Error("Generate a tailored resume first");

  const claims = [];
  if (String(draft.professionalSummary?.text || "").trim()) {
    claims.push({
      claimId: "SUMMARY",
      claimLabel: "Professional summary",
      text: String(draft.professionalSummary.text).trim(),
      sourceEvidenceIds: draft.professionalSummary.sourceEvidenceIds || [],
      roleId: ""
    });
  }
  (draft.experiences || []).forEach(exp => {
    (exp.bullets || []).forEach(bullet => {
      if (bullet.accepted === false) return;
      claims.push({
        claimId: bullet.bulletId,
        claimLabel: (roleById(exp.roleId)?.title || "Experience") + " bullet",
        text: String(bullet.editedText || bullet.text || "").trim(),
        sourceEvidenceIds: bullet.sourceEvidenceIds || [],
        roleId: exp.roleId
      });
    });
  });

  const response = await fetch("/api/revalidate-resume", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      careerGraph: graph,
      claims
    })
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.result) throw new Error(data?.message || "Validation failed");
  return data.result;
}

function renderResumeVersions() {
  if (!$("resumeVersionList")) return;
  const list = $("resumeVersionList");
  $("versionCountTag").textContent = state.resumeVersions.length + (state.resumeVersions.length === 1 ? " version" : " versions");
  list.innerHTML = "";
  if (!state.resumeVersions.length) {
    list.className = "empty-state";
    list.textContent = "Save an approved resume version to preserve exactly what you used for an application.";
    return;
  }
  list.className = "";
  state.resumeVersions.forEach(version => {
    const row = document.createElement("div");
    row.className = "version-row";
    const info = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = version.name;
    const small = document.createElement("small");
    small.textContent = [version.targetRole, new Date(version.createdAt).toLocaleString(), version.template + " template", version.onePageMode ? "one-page" : "standard"].filter(Boolean).join(" · ");
    info.append(strong,small);

    const actions = document.createElement("div");
    actions.className = "version-actions";
    const load = document.createElement("button");
    load.textContent = "Load";
    load.addEventListener("click", () => {
      state.tailoredResume = JSON.parse(JSON.stringify(version.tailoredResume));
      state.tailoredResume.versionLoaded = true;
      state.applicationPackage = version.applicationPackage ? JSON.parse(JSON.stringify(version.applicationPackage)) : null;
      persist();
      renderDashboard();
      switchView("tailor");
      toast("Saved resume version loaded");
    });
    const docx = document.createElement("button");
    docx.textContent = "DOCX";
    docx.addEventListener("click", async () => {
      try { await exportResumePayload("docx", version.approvedResume, version.name); }
      catch (error) { toast(error.message || "Version export failed"); }
    });
    const pdf = document.createElement("button");
    pdf.textContent = "PDF";
    pdf.addEventListener("click", async () => {
      try { await exportResumePayload("pdf", version.approvedResume, version.name); }
      catch (error) { toast(error.message || "Version export failed"); }
    });
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      state.resumeVersions = state.resumeVersions.filter(v => v.id !== version.id);
      persist(); renderResumeVersions(); toast("Version deleted");
    });
    actions.append(load,docx,pdf,del);
    row.append(info,actions);
    list.appendChild(row);
  });
}

function saveCurrentResumeVersion() {
  if (!state.tailoredResume) throw new Error("Generate a tailored resume first");
  if (currentIntegrityStatus() !== "valid") throw new Error("Validate the current draft before saving a version");
  const defaultName = (state.tailoredResume.targetRole || "Tailored Resume") + " · " + new Date().toLocaleDateString();
  const name = window.prompt("Name this resume version:", defaultName);
  if (!name) return false;
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    name: name.trim(),
    targetRole: state.tailoredResume.targetRole || "",
    scanId: state.tailoredResume.generatedForScanId || "",
    createdAt: new Date().toISOString(),
    template: state.tailoredResume.template || "classic",
    onePageMode: !!state.tailoredResume.onePageMode,
    tailoredResume: JSON.parse(JSON.stringify(state.tailoredResume)),
    approvedResume: approvedResumePayload(),
    applicationPackage: state.applicationPackage ? JSON.parse(JSON.stringify(state.applicationPackage)) : null
  };
  state.resumeVersions.unshift(record);
  state.resumeVersions = state.resumeVersions.slice(0,50);
  persist();
  renderResumeVersions();
  return true;
}

function applicationTargetContext() {
  const draft = state.tailoredResume;
  const scan = latestTargetScan();
  return {
    jobDescription: draft?.targetContext?.jobDescription || scan?.jobSnapshot || "",
    analysis: draft?.targetContext?.analysis || scan?.result || {},
    role: draft?.targetRole || scan?.result?.role || ""
  };
}

async function requestApplicationPackage() {
  const graph = ensureCareerGraphIds();
  const resume = approvedResumePayload();
  const context = applicationTargetContext();
  if (!graph) throw new Error("Build your Career Graph first");
  if (!resume || !resume.experiences.length) throw new Error("Generate an approved tailored resume first");
  if (currentIntegrityStatus() !== "valid") throw new Error("Validate your resume edits before generating the package");
  if (!context.jobDescription) throw new Error("Target job description is missing");

  const questions = $("customApplicationQuestions").value
    .split(/\n+/)
    .map(q => q.trim())
    .filter(Boolean)
    .slice(0,12);

  const response = await fetch("/api/application-package", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      careerGraph: graph,
      approvedResume: resume,
      jobDescription: context.jobDescription,
      jobAnalysis: context.analysis,
      customQuestions: questions
    })
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.result) throw new Error(data?.message || "Application package generation failed");
  data.result.generatedAt = new Date().toISOString();
  data.result.targetRole = context.role;
  return data.result;
}

function renderApplicationPackage() {
  if (!$("packageTargetRole")) return;
  const graph = ensureCareerGraphIds();
  const resume = approvedResumePayload();
  const context = applicationTargetContext();
  $("packageTargetRole").textContent = context.role || "No target";
  $("packageResumeStatus").textContent = resume?.experiences?.length ? (currentIntegrityStatus() === "valid" ? "Validated" : "Needs validation") : "Not ready";
  $("packageEvidenceCount").textContent = graph?.evidenceRecords?.length || 0;
  $("packageStatus").textContent = state.applicationPackage ? "Generated" : "Not generated";

  const workspace = $("applicationPackageWorkspace");
  if (!state.applicationPackage) {
    workspace.classList.add("hidden");
    return;
  }
  workspace.classList.remove("hidden");
  $("packageCoverLetter").value = state.applicationPackage.coverLetter?.text || "";
  $("packageRecruiterMessage").value = state.applicationPackage.recruiterMessage?.text || "";
  $("packageWhyRole").value = state.applicationPackage.whyRole?.text || "";

  const answers = $("packageAnswers");
  answers.innerHTML = "";
  const allAnswers = state.applicationPackage.answers || [];
  $("packageAnswerTag").textContent = allAnswers.length + (allAnswers.length === 1 ? " answer" : " answers");
  allAnswers.forEach((item,index) => {
    const box = document.createElement("div");
    box.className = "package-answer";
    const strong = document.createElement("strong");
    strong.textContent = item.question || ("Question " + (index + 1));
    const textarea = document.createElement("textarea");
    textarea.value = item.answer || "";
    textarea.addEventListener("input", () => {
      item.answer = textarea.value;
      persist();
    });
    const chips = document.createElement("div");
    (item.sourceEvidenceIds || []).forEach(id => {
      const chip = document.createElement("span");
      chip.className = "package-evidence-chip";
      chip.textContent = id;
      chips.appendChild(chip);
    });
    box.append(strong,textarea,chips);
    answers.appendChild(box);
  });

  const usedIds = new Set();
  [state.applicationPackage.coverLetter,state.applicationPackage.recruiterMessage,state.applicationPackage.whyRole]
    .forEach(item => (item?.sourceEvidenceIds || []).forEach(id => usedIds.add(id)));
  allAnswers.forEach(item => (item.sourceEvidenceIds || []).forEach(id => usedIds.add(id)));
  $("packageAuditTag").textContent = usedIds.size + (usedIds.size === 1 ? " source" : " sources");

  const audit = $("packageEvidenceAudit");
  audit.innerHTML = "";
  if (!usedIds.size) {
    audit.className = "empty-state";
    audit.textContent = "No evidence sources were returned.";
  } else {
    audit.className = "";
    [...usedIds].forEach(id => {
      const evidence = evidenceById(id);
      if (!evidence) return;
      const record = document.createElement("div");
      record.className = "package-audit-record";
      const strong = document.createElement("strong");
      strong.textContent = id + " · " + (evidence.title || evidence.category || "Evidence");
      const p = document.createElement("p");
      p.textContent = evidence.sourceSnippet || evidence.text || "";
      record.append(strong,p);
      audit.appendChild(record);
    });
  }
}

function renderTailorStudio() {
  const scan = latestTargetScan();
  const graph = ensureCareerGraphIds();
  let draft = state.tailoredResume;
  if (!$("tailorTargetRole")) return;
  if (draft && scan && draft.generatedForScanId && draft.generatedForScanId !== scan.id && !draft.versionLoaded) {
    state.tailoredResume = null;
    draft = null;
    persist();
  }

  $("tailorTargetRole").textContent = scan?.result?.role || "No scan selected";
  $("tailorGraphStatus").textContent = graph ? ((graph.evidenceRecords || []).length + " evidence records") : "Not ready";
  $("acceptedBulletCount").textContent = countAcceptedBullets();
  $("tailorGrounding").textContent = draft?.quality?.groundingCoverage != null ? Math.round(draft.quality.groundingCoverage) + "%" : "—";

  const empty = $("tailorEmpty");
  const workspace = $("tailorWorkspace");
  const ready = !!scan && !!graph;

  if (!draft) {
    empty.classList.remove("hidden");
    workspace.classList.add("hidden");
    const heading = empty.querySelector("h3");
    const text = empty.querySelector("p");
    if (ready) {
      heading.textContent = "Your evidence and target job are ready.";
      text.textContent = "Generate the first evidence-grounded version, then review each bullet before export.";
    } else {
      heading.textContent = "Run a job scan and build your Career Graph first.";
      text.textContent = "Deep Nexivra needs both the target job and your source-backed career evidence before it will generate a tailored resume.";
    }
    return;
  }

  empty.classList.add("hidden");
  workspace.classList.remove("hidden");
  $("tailorVersionTag").textContent = (draft.versionLoaded ? "Saved version" : "Draft") + " · " + new Date(draft.generatedAt || Date.now()).toLocaleDateString();
  $("tailorDocumentTitle").textContent = draft.documentTitle || ((draft.targetRole || "Target") + " Resume");
  $("tailorSkillTag").textContent = skillSelectedCount() + " selected";
  $("tailorSummary").value = draft.professionalSummary?.text || "";
  $("resumeTemplate").value = draft.template || "classic";
  $("onePageMode").checked = !!draft.onePageMode;
  renderTailorEditor();
  renderTailorPreview();
  renderTailorAudit();
  renderIntegrityGate();
}

async function exportResumePayload(format, resume, filenamePrefix) {
  if (!resume) throw new Error("Resume payload is missing");
  if (!resume.experiences?.length) throw new Error("At least one experience entry is required");

  const response = await fetch("/api/export-resume", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({format, resume})
  });

  if (!response.ok) {
    let message = "Export failed";
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeRole = String(resume.targetRole || "Tailored-Resume").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
  const safePrefix = String(filenamePrefix || "Deep-Nexivra").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
  link.href = url;
  link.download = safePrefix + "-" + safeRole + "." + format;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportApprovedResume(format) {
  const resume = approvedResumePayload();
  if (!resume) throw new Error("Generate a tailored resume first");
  if (currentIntegrityStatus() !== "valid") throw new Error("Validate manual edits before export");
  return exportResumePayload(format, resume, "Deep-Nexivra");
}

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
document.querySelectorAll(".jump-btn").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.target)));
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));

$("generateTailoredResume").addEventListener("click", async () => {
  const btn = $("generateTailoredResume");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generating evidence-grounded draft...";
  try {
    state.tailoredResume = await requestTailoredResume();
    state.applicationPackage = null;
    persist();
    renderDashboard();
    toast("Tailored resume generated");
  } catch (error) {
    console.error(error);
    toast(error.message || "Tailored resume generation failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("tailorSummary").addEventListener("input", event => {
  if (!state.tailoredResume) return;
  state.tailoredResume.professionalSummary.text = event.target.value;
  markTailoredDirty("The professional summary was edited and must be revalidated against its cited evidence.");
  persist();
  renderTailorPreview();
});

$("resumeTemplate").addEventListener("change", event => {
  if (!state.tailoredResume) return;
  state.tailoredResume.template = event.target.value;
  persist();
  renderTailorPreview();
});

$("onePageMode").addEventListener("change", event => {
  if (!state.tailoredResume) return;
  state.tailoredResume.onePageMode = event.target.checked;
  state.applicationPackage = null;
  if (event.target.checked) toast("One-page mode prioritizes up to 4 roles, 3 strongest bullets per role, and 12 skills.");
  persist();
  renderTailorStudio();
});

$("validateTailoredResume").addEventListener("click", async () => {
  const btn = $("validateTailoredResume");
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Validating claims...";
  try {
    const result = await revalidateTailoredResume();
    state.tailoredResume.integrity = result;
    persist();
    renderIntegrityGate();
    toast(result.status === "valid" ? "All accepted claims validated" : "Validation found claims that need correction");
  } catch (error) {
    toast(error.message || "Validation failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("saveResumeVersion").addEventListener("click", () => {
  try {
    if (saveCurrentResumeVersion()) toast("Resume version saved");
  } catch (error) {
    toast(error.message);
  }
});

$("generateApplicationPackage").addEventListener("click", async () => {
  const btn = $("generateApplicationPackage");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generating package...";
  try {
    state.applicationPackage = await requestApplicationPackage();
    persist();
    renderApplicationPackage();
    toast("Application package generated");
  } catch (error) {
    toast(error.message || "Package generation failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

["packageCoverLetter","packageRecruiterMessage","packageWhyRole"].forEach(id => {
  $(id).addEventListener("input", event => {
    if (!state.applicationPackage) return;
    if (id === "packageCoverLetter") state.applicationPackage.coverLetter.text = event.target.value;
    if (id === "packageRecruiterMessage") state.applicationPackage.recruiterMessage.text = event.target.value;
    if (id === "packageWhyRole") state.applicationPackage.whyRole.text = event.target.value;
    persist();
  });
});

document.addEventListener("click", async event => {
  const btn = event.target.closest(".copy-package-btn");
  if (!btn) return;
  const target = $(btn.dataset.copyTarget);
  if (!target) return;
  try {
    await navigator.clipboard.writeText(target.value || target.textContent || "");
    toast("Copied");
  } catch (_) {
    target.select?.();
    document.execCommand?.("copy");
    toast("Copied");
  }
});

$("exportDocx").addEventListener("click", async () => {
  const btn = $("exportDocx");
  btn.disabled = true;
  try {
    await exportApprovedResume("docx");
    toast("DOCX export created");
  } catch (error) {
    toast(error.message || "DOCX export failed");
  } finally {
    btn.disabled = false;
  }
});

$("exportPdf").addEventListener("click", async () => {
  const btn = $("exportPdf");
  btn.disabled = true;
  try {
    await exportApprovedResume("pdf");
    toast("PDF export created");
  } catch (error) {
    toast(error.message || "PDF export failed");
  } finally {
    btn.disabled = false;
  }
});

const dropZone = $("resumeDropZone");
const fileInput = $("resumeFile");
["dragenter","dragover"].forEach(eventName => dropZone.addEventListener(eventName, event => {
  event.preventDefault(); event.stopPropagation(); dropZone.classList.add("dragover");
}));
["dragleave","drop"].forEach(eventName => dropZone.addEventListener(eventName, event => {
  event.preventDefault(); event.stopPropagation(); dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", event => {
  const file = event.dataTransfer?.files?.[0];
  if (file) handleResumeFile(file);
});
fileInput.addEventListener("change", event => handleResumeFile(event.target.files?.[0]));

$("clearImportedResume").addEventListener("click", () => {
  state.importedResumeText = "";
  state.importedFile = null;
  fileInput.value = "";
  $("fileMeta").classList.add("hidden");
  $("parserProgress").classList.add("hidden");
  $("buildCareerGraph").disabled = true;
  $("clearImportedResume").disabled = true;
  renderImportPreview("");
  toast("Staged resume import cleared");
});

$("buildCareerGraph").addEventListener("click", async () => {
  if (!state.importedResumeText) return toast("Import a resume first");
  const btn = $("buildCareerGraph");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Structuring career evidence...";
  setParserProgress(78, "AI is identifying roles, achievements, skills, tools, and evidence links");

  try {
    const graph = await ingestCareerGraph(state.importedResumeText);
    state.careerGraph = graph;
    state.tailoredResume = null;
    state.applicationPackage = null;
    state.masterResume = state.importedResumeText;
    state.resumeSource = {
      name: state.importedFile?.name || "Imported resume",
      size: state.importedFile?.size || null,
      type: state.importedFile?.type || "",
      importedAt: new Date().toISOString(),
      parseConfidence: graph?.resumeQuality?.parseConfidence ?? null
    };
    const added = graphEvidenceToVault(graph);
    persist();
    renderDashboard();
    $("masterResume").value = state.masterResume;
    setParserProgress(100, "Career Graph built · " + added + " new evidence records added to the vault");
    toast("Career Graph built successfully");
    switchView("graph");
  } catch (error) {
    console.error(error);
    setParserProgress(100, error.message || "Career Graph build failed");
    toast(error.message || "Career Graph build failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("resumeInput").addEventListener("input", e => $("resumeChars").textContent = e.target.value.length);
$("jobInput").addEventListener("input", e => $("jobChars").textContent = e.target.value.length);

$("saveMasterResume").addEventListener("click", () => {
  state.masterResume = $("masterResume").value.trim();
  persist(); renderDashboard(); toast("Master resume saved");
});

$("loadMasterIntoScan").addEventListener("click", () => {
  if (!state.masterResume) return toast("Save a master resume first");
  $("resumeInput").value = state.masterResume;
  $("resumeChars").textContent = state.masterResume.length;
  toast("Master resume loaded into Match Lab");
});

$("addEvidence").addEventListener("click", () => {
  const title = $("evidenceTitle").value.trim();
  const category = $("evidenceCategory").value;
  const text = $("evidenceText").value.trim();
  if (!title || !text) return toast("Add a title and verified detail");
  state.evidence.unshift({id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), title, category, text, createdAt:new Date().toISOString()});
  $("evidenceTitle").value = "";
  $("evidenceText").value = "";
  persist(); renderDashboard(); toast("Evidence added");
});

$("runScan").addEventListener("click", async () => {
  const resume = $("resumeInput").value.trim();
  const job = $("jobInput").value.trim();
  if (resume.length < 200) return toast("Paste more resume content first");
  if (job.length < 250) return toast("Paste the full job description first");

  const btn = $("runScan");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Analyzing...";
  $("scanStatus").textContent = "Mapping requirements to evidence";

  try {
    const result = await deepAnalyze(resume, job);
    renderScan(result);
    state.tailoredResume = null;
    state.applicationPackage = null;
    state.scans.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt:new Date().toISOString(),
      result,
      resumeSnapshot: resume.slice(0,12000),
      jobSnapshot: job.slice(0,12000)
    });
    state.scans = state.scans.slice(0,30);
    persist(); renderDashboard();
    $("scanStatus").textContent = "Scan complete";
    toast("Deep Scan complete");
    $("scanResults").scrollIntoView({behavior:"smooth",block:"start"});
  } catch (err) {
    console.error(err);
    $("scanStatus").textContent = "Scan failed";
    toast("Unable to complete scan");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("saveApplication").addEventListener("click", () => {
  if (!state.latest) return toast("Run a scan first");
  state.applications.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    role: state.latest.role || "Target role",
    readiness: state.latest.scores?.readiness || 0,
    stage: "Saved",
    createdAt: new Date().toISOString()
  });
  persist(); renderDashboard(); toast("Application saved to pipeline");
});

$("clearLocalData").addEventListener("click", () => {
  if (!confirm("Reset all Deep Nexivra local career data on this browser?")) return;
  ["dn_master_resume","dn_evidence","dn_scans","dn_applications","dn_career_graph","dn_resume_source","dn_tailored_resume","dn_resume_versions","dn_application_package"].forEach(k => localStorage.removeItem(k));
  state.masterResume = ""; state.evidence = []; state.scans = []; state.applications = []; state.careerGraph = null; state.resumeSource = null; state.tailoredResume = null; state.resumeVersions = []; state.applicationPackage = null; state.importedResumeText = ""; state.importedFile = null; state.latest = null;
  $("resumeInput").value = ""; $("jobInput").value = ""; $("scanResults").classList.add("hidden");
  persist(); renderDashboard(); toast("Local data reset");
});

renderDashboard();
