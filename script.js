const $ = (id) => document.getElementById(id);

const state = {
  masterResume: localStorage.getItem("dn_master_resume") || "",
  evidence: JSON.parse(localStorage.getItem("dn_evidence") || "[]"),
  scans: JSON.parse(localStorage.getItem("dn_scans") || "[]"),
  applications: JSON.parse(localStorage.getItem("dn_applications") || "[]"),
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
    evidence: "Evidence Vault",
    applications: "Applications",
    interview: "Interview Lab"
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
      body: JSON.stringify({resume, jobDescription: job, evidenceVault: vault})
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

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
document.querySelectorAll(".jump-btn").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.target)));
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));

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
  ["dn_master_resume","dn_evidence","dn_scans","dn_applications"].forEach(k => localStorage.removeItem(k));
  state.masterResume = ""; state.evidence = []; state.scans = []; state.applications = []; state.latest = null;
  $("resumeInput").value = ""; $("jobInput").value = ""; $("scanResults").classList.add("hidden");
  persist(); renderDashboard(); toast("Local data reset");
});

renderDashboard();
