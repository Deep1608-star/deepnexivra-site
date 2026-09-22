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
  analysisCache: JSON.parse(localStorage.getItem("dn_analysis_cache") || "{}"),
  applicationPackage: JSON.parse(localStorage.getItem("dn_application_package") || "null"),
  changeHistory: JSON.parse(localStorage.getItem("dn_change_history") || "[]"),
  historyIndex: Number(localStorage.getItem("dn_history_index") || "-1"),
  careerAgentJobs: JSON.parse(localStorage.getItem("dn_agent_jobs") || "[]"),
  importedResumeText: "",
  cloudClient: null,
  cloudConfig: null,
  importedFile: null,
  latest: null
};

let resumePreparationPromise = null;
let resumePreparationFingerprint = "";

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
  localStorage.setItem("dn_analysis_cache", JSON.stringify(state.analysisCache));
  localStorage.setItem("dn_application_package", JSON.stringify(state.applicationPackage));
  localStorage.setItem("dn_change_history", JSON.stringify(state.changeHistory));
  localStorage.setItem("dn_history_index", String(state.historyIndex));
  localStorage.setItem("dn_agent_jobs", JSON.stringify(state.careerAgentJobs));
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
  if (name === "match") {
    $("view-match")?.classList.add("active");
    $("view-tailor")?.classList.add("active");
  } else if (view) {
    view.classList.add("active");
  }
  const nav = document.querySelector('.nav-item[data-view="' + name + '"]');
  if (nav) nav.classList.add("active");
  const titleMap = {
    command: "Command Center",
    match: "Resume Match",
    resume: "Resume Studio",
    guides: "Resume Guides",
    tailor: "Tailor Studio",
    evidence: "Evidence Vault",
    graph: "Career Graph",
    applications: "Applications",
    interview: "Interview Lab",
    package: "Application Package",
    agent: "Career Agent"
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

function localAnalysis(resume, job, options = {}) {
  const role = extractRole(job);
  const kws = topKeywords(job, 20);
  const resumeNorm = normalize(resume);
  const kwMatches = kws.filter(k => resumeNorm.includes(k.word));
  const kwMissing = kws.filter(k => !resumeNorm.includes(k.word));

  const sourceRequirements = Array.isArray(options.referenceRequirements) && options.referenceRequirements.length
    ? options.referenceRequirements.map(item => String(item.requirement || "").trim()).filter(Boolean)
    : splitRequirements(job);

  const requirements = sourceRequirements.map(req => {
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


function localCanonicalAnalysis(resume, job, referenceRequirements) {
  const base = localAnalysis(resume, job);
  const refs = (referenceRequirements || []).filter(item => item && item.requirement);
  if (!refs.length) return base;

  const requirements = refs.map(item => {
    const score = sentenceMatchScore(item.requirement, resume);
    const status = score >= 62 ? "direct" : score >= 32 ? "transferable" : "gap";
    return {
      requirement: item.requirement,
      status,
      evidence: status === "direct"
        ? "The tailored resume contains strong textual support for this requirement."
        : status === "transferable"
          ? "The tailored resume contains related transferable language but not full direct coverage."
          : "This requirement is not clearly supported in the tailored resume."
    };
  });

  const coveragePoints = requirements.reduce((total,item) => {
    if (item.status === "direct") return total + 100;
    if (item.status === "transferable") return total + 55;
    return total;
  }, 0);

  base.requirements = requirements;
  base.scores = base.scores || {};
  base.scores.requirementMatch = requirements.length
    ? Math.round(coveragePoints / requirements.length)
    : 0;
  return base;
}

async function deepAnalyze(resume, job, options = {}) {
  const vault = state.evidence.slice(0,30);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 80000);
  try {
    const response = await fetch("/api/career-analyze", {
      method: "POST",
      signal: controller.signal,
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        resume,
        jobDescription: job,
        evidenceVault: vault,
        careerGraph: state.careerGraph,
        analysisMode: options.analysisMode || "candidate-fit",
        referenceRequirements: Array.isArray(options.referenceRequirements)
          ? options.referenceRequirements
          : []
      })
    });
    if (!response.ok) throw new Error("AI endpoint unavailable");
    const data = await response.json();
    if (!data?.ok || !data?.result) throw new Error("Invalid AI response");
    data.result.analysisSource = "ai";
    return data.result;
  } catch (err) {
    console.warn("Using local fallback analysis:", err);
    const result = localAnalysis(resume, job, options);
    result.analysisSource = "local";
    result.summary += err?.name === "AbortError"
      ? " The AI scan timed out, so this result was generated by the local analysis engine."
      : " AI service was unavailable, so this result was generated by the local analysis engine.";
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function createTextBlock(parent, className, text) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  parent.appendChild(div);
  return div;
}

let scannerKeywordFilter = "all";
let scannerLiveTimer = null;

function scannerNormalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’\']/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\.+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scannerPhraseCount(text, phrase) {
  const needle = scannerNormalize(phrase);
  if (!needle) return 0;
  const hay = " " + scannerNormalize(text) + " ";
  const token = " " + needle + " ";
  let count = 0;
  let from = 0;
  while (true) {
    const index = hay.indexOf(token, from);
    if (index < 0) break;
    count += 1;
    from = index + token.length - 1;
  }
  return count;
}

function scannerPhrasePresent(text, phrase) {
  return scannerPhraseCount(text, phrase) > 0;
}

function scannerKeywordPresent(text, item) {
  const terms = [item?.keyword].concat(Array.isArray(item?.aliases) ? item.aliases : []).filter(Boolean);
  return terms.some(term => scannerPhrasePresent(text, term));
}

function stableFingerprint(value = "") {
  const text = String(value);
  let hashA = 2166136261;
  let hashB = 2654435761;
  for (const char of text) {
    const code = char.charCodeAt(0);
    hashA ^= code;
    hashA = Math.imul(hashA, 16777619);
    hashB ^= code + 0x9e37;
    hashB = Math.imul(hashB, 2246822519);
  }
  return text.length.toString(16) + "-" + (hashA >>> 0).toString(16) + (hashB >>> 0).toString(16);
}

function analysisCacheKey(resume, job) {
  return stableFingerprint(scannerNormalize(resume) + "\n---JOB---\n" + scannerNormalize(job));
}

function latestScannerKeywords(scan = latestTargetScan()) {
  return scan?.scoringModel?.keywords || scan?.result?.keywords || [];
}

function latestScannerJob(scan = latestTargetScan()) {
  return scan?.scoringModel?.jobText || scan?.jobSnapshot || String($("jobInput")?.value || "");
}

function scannerModelForText(text, sourceKeywords, jobText = "") {
  const categoryBase = {
    hard_skill:1.55, tool:1.55, certification:1.6, qualification:1.45,
    responsibility:1.25, domain:1.15, soft_skill:.8
  };
  const importanceBase = {high:1.45,medium:1,low:.72};

  const activeJob = String(jobText || latestScannerJob() || "");
  const items = (sourceKeywords || []).map(item => {
    let derivedFrequency = scannerPhraseCount(activeJob,item?.keyword || "");
    (item?.aliases || []).forEach(alias => {
      derivedFrequency = Math.max(derivedFrequency,scannerPhraseCount(activeJob,alias));
    });
    const frequency = Math.max(1, Number(item.frequency || derivedFrequency || 1));
    const rawWeight = Number(item.points || 0) > 0
      ? 0
      : (categoryBase[item.category] || 1) *
        (importanceBase[item.importance] || 1) *
        (1 + Math.min(Math.max(frequency - 1,0),5) * .2);
    return Object.assign({}, item, {
      excluded: !!item.excluded,
      frequency,
      present: scannerKeywordPresent(text, item),
      points: Number(item.points || 0),
      _rawWeight: rawWeight
    });
  });

  const hasServerPoints = items.some(item => item.points > 0);
  if (!hasServerPoints && items.length) {
    const totalRaw = items.reduce((sum,item) => sum + item._rawWeight,0) || 1;
    items.forEach(item => {
      item.points = Math.max(.5, Math.round((item._rawWeight / totalRaw) * 1000) / 10);
    });
  }
  items.forEach(item => delete item._rawWeight);

  const active = items.filter(item => !item.excluded);
  const totalPoints = active.reduce((sum,item) => sum + Number(item.points || 0), 0);
  const earnedPoints = active.reduce((sum,item) => sum + (item.present ? Number(item.points || 0) : 0), 0);
  const score = totalPoints ? Math.max(0, Math.min(100, Math.round((earnedPoints / totalPoints) * 100))) : 0;
  return {
    items,
    score,
    matched: active.filter(item => item.present).length,
    missing: active.filter(item => !item.present).length,
    total: active.length
  };
}

function scannerCategoryLabel(value) {
  const map = {
    hard_skill:"Hard skill", tool:"Tool", certification:"Certification", qualification:"Qualification",
    responsibility:"Responsibility", soft_skill:"Soft skill", domain:"Domain"
  };
  return map[value] || "Keyword";
}

function scannerCurrentResumeText() {
  const editor = $("scannerLiveEditor");
  if (editor && editor.value.trim()) return editor.value.trim();
  return String(state.importedResumeText || state.masterResume || latestTargetScan()?.resumeSnapshot || "").trim();
}

function scannerApplyScoreModel(model, options = {}) {
  const score = Math.round(Number(model?.score) || 0);
  if ($("scannerScoreValue")) $("scannerScoreValue").textContent = score;
  if ($("scannerLiveScore")) $("scannerLiveScore").textContent = score + "%";
  if ($("scannerScoreRing")) $("scannerScoreRing").style.setProperty("--scan-score", score + "%");
  if ($("scannerMatchedCount")) $("scannerMatchedCount").textContent = model?.matched ?? 0;
  if ($("scannerMissingCount")) $("scannerMissingCount").textContent = model?.missing ?? 0;
  if ($("scannerKeywordCount")) $("scannerKeywordCount").textContent = model?.total ?? 0;
  if ($("scoreRequirement")) $("scoreRequirement").textContent = score + "%";
  if ($("scannerScoreLabel")) {
    $("scannerScoreLabel").textContent = score >= 90
      ? "Excellent keyword alignment for this posting."
      : score >= 80
        ? "Strong alignment. Review the remaining high-value gaps."
        : score >= 60
          ? "Good foundation, but important job language is still missing."
          : "The resume is missing several high-value terms from this posting.";
  }
  if (options.updateResult && state.latest) {
    state.latest.keywords = model.items;
    state.latest.keywordStats = { score, matched:model.matched, missing:model.missing, total:model.total, model:"weighted-keyword-v1" };
    state.latest.scores = state.latest.scores || {};
    state.latest.scores.requirementMatch = score;
    const scan = latestTargetScan();
    if (scan?.result === state.latest) {
      scan.result = state.latest;
    }
    if (scan?.scoringModel) {
      scan.scoringModel.keywords = scan.scoringModel.keywords.map(item => {
        const updated = model.items.find(candidate => scannerNormalize(candidate.keyword) === scannerNormalize(item.keyword));
        return updated ? Object.assign({}, item, {excluded: !!updated.excluded}) : item;
      });
    }
    persist();
  }
}

function renderScannerKeywordReport(text) {
  const root = $("scannerKeywordReport");
  if (!root || !state.latest) return;
  const scan = latestTargetScan();
  const model = scannerModelForText(text, latestScannerKeywords(scan), latestScannerJob(scan));
  scannerApplyScoreModel(model,{updateResult:true});
  root.innerHTML = "";

  const filtered = model.items
    .filter(item => scannerKeywordFilter === "all" || (scannerKeywordFilter === "missing" ? !item.present : item.present))
    .sort((a,b) => {
      if (a.present !== b.present) return a.present ? 1 : -1;
      return Number(b.points || 0) - Number(a.points || 0);
    });

  if (!filtered.length) {
    root.className = "scanner-keyword-report empty-state";
    root.textContent = "No keywords in this filter.";
    return;
  }
  root.className = "scanner-keyword-report";

  filtered.forEach(item => {
    const row = document.createElement("div");
    row.className = "scanner-keyword-row" + (item.present ? " found" : " missing") + (item.excluded ? " excluded" : "");

    const status = document.createElement("span");
    status.className = "scanner-keyword-status";
    status.textContent = item.present ? "✓" : "!";

    const main = document.createElement("div");
    main.className = "scanner-keyword-main";
    const strong = document.createElement("strong");
    strong.textContent = item.keyword || "";
    const meta = document.createElement("small");
    meta.textContent = scannerCategoryLabel(item.category) + " · " + (item.importance || "medium") + " priority";
    main.append(strong,meta);

    const frequency = document.createElement("div");
    frequency.className = "scanner-keyword-metric";
    frequency.innerHTML = "<strong>" + (item.frequency || 1) + "×</strong><span>in job</span>";

    const points = document.createElement("div");
    points.className = "scanner-keyword-metric";
    points.innerHTML = "<strong>" + Number(item.points || 0).toFixed(1) + "</strong><span>points</span>";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "keyword-exclude-btn";
    toggle.textContent = item.excluded ? "Include" : "Exclude";
    toggle.addEventListener("click", () => {
      const source = (state.latest.keywords || []).find(k => scannerNormalize(k.keyword) === scannerNormalize(item.keyword));
      if (source) source.excluded = !source.excluded;
      const frozenSource = latestScannerKeywords().find(k => scannerNormalize(k.keyword) === scannerNormalize(item.keyword));
      if (frozenSource) frozenSource.excluded = source ? !!source.excluded : !frozenSource.excluded;
      const updated = scannerModelForText(scannerCurrentResumeText(), latestScannerKeywords(), latestScannerJob());
      scannerApplyScoreModel(updated,{updateResult:true});
      renderScannerKeywordReport(scannerCurrentResumeText());
    });

    row.append(status,main,frequency,points,toggle);
    root.appendChild(row);
  });
}

function scannerResumeChecks(text) {
  const value = String(text || "");
  const normalized = scannerNormalize(value);
  const words = normalized.split(" ").filter(Boolean);
  const numberCount = (value.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).length;
  const firstPerson = /\b(i|me|my|mine|we|our)\b/i.test(value);
  const weakPhrases = (value.match(/\b(responsible for|helped with|worked on|duties included)\b/gi) || []).length;
  const actionVerbs = (value.match(/\b(led|managed|built|created|implemented|improved|reduced|increased|coordinated|analyzed|developed|delivered|optimized|resolved|trained|supported|streamlined)\b/gi) || []).length;
  const hasExperience = /\b(experience|employment|professional experience|work history)\b/i.test(value);
  const hasEducation = /\beducation\b/i.test(value);
  const hasSkills = /\b(skills|core skills|technical skills|competencies)\b/i.test(value);
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(value);
  const sensibleLength = words.length >= 250 && words.length <= 1100;
  const metricsHealthy = numberCount >= Math.max(2, Math.round(words.length / 180));
  const actionHealthy = actionVerbs >= Math.max(3, Math.round(words.length / 140));

  return [
    {pass:hasExperience,label:"Standard Experience heading",detail:hasExperience ? "Experience section is easy to identify." : "Use a standard heading such as Professional Experience."},
    {pass:hasEducation,label:"Education section",detail:hasEducation ? "Education section detected." : "Add a clear Education heading when applicable."},
    {pass:hasSkills,label:"Skills section",detail:hasSkills ? "Skills section detected." : "A focused Skills section can improve keyword retrieval."},
    {pass:hasEmail,label:"Email detected",detail:hasEmail ? "Contact email is present." : "Add a professional contact email."},
    {pass:hasPhone,label:"Phone detected",detail:hasPhone ? "Phone number is present." : "Add a reachable phone number."},
    {pass:sensibleLength,label:"Resume length",detail:sensibleLength ? "Text length is within a practical ATS/recruiter range." : "Resume may be unusually short or long; review content density."},
    {pass:metricsHealthy,label:"Measurable impact",detail:metricsHealthy ? "Resume contains a useful amount of quantified evidence." : "Add truthful metrics where you actually have them."},
    {pass:actionHealthy,label:"Action-oriented bullets",detail:actionHealthy ? "Strong action verbs are present." : "Lead more bullets with clear action verbs."},
    {pass:!firstPerson,label:"Professional resume voice",detail:!firstPerson ? "No unnecessary first-person pronouns detected." : "Remove first-person pronouns from resume bullets."},
    {pass:weakPhrases <= 1,label:"Weak phrasing",detail:weakPhrases <= 1 ? "Little or no weak duty phrasing detected." : "Replace phrases like responsible for with stronger action language."}
  ];
}

function renderScannerChecks(text) {
  const root = $("scannerChecks");
  if (!root) return;
  const checks = scannerResumeChecks(text);
  root.innerHTML = "";
  checks.forEach(item => {
    const row = document.createElement("div");
    row.className = "scanner-check-row " + (item.pass ? "pass" : "warn");
    const icon = document.createElement("span");
    icon.className = "scanner-check-icon";
    icon.textContent = item.pass ? "✓" : "!";
    const body = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = item.label;
    const small = document.createElement("small");
    small.textContent = item.detail;
    body.append(strong,small);
    row.append(icon,body);
    root.appendChild(row);
  });
  const passed = checks.filter(item => item.pass).length;
  if ($("scannerCheckSummary")) $("scannerCheckSummary").textContent = passed + "/" + checks.length + " passed";
}

function renderScannerWorkspace(result, resumeText) {
  if (!result) return;
  if (result.originalKeywordScore == null) result.originalKeywordScore = result.scores?.requirementMatch ?? 0;
  const text = String(resumeText || scannerCurrentResumeText() || "");
  if ($("scannerLiveEditor")) $("scannerLiveEditor").value = text;
  renderScannerKeywordReport(text);
  renderScannerChecks(text);
}
function renderScan(result) {
  state.latest = result;
  $("scanResults").classList.remove("hidden");
  const currentMatch = Math.max(0, Math.min(100, Math.round(Number(result.scores?.requirementMatch) || 0)));
  $("scoreRequirement").textContent = currentMatch + "%";
  $("scoreEvidence").textContent = result.scores?.evidenceStrength ?? 0;
  $("scoreAts").textContent = result.scores?.atsReadability ?? 0;
  $("scoreRecruiter").textContent = result.scores?.recruiterQuality ?? 0;
  $("scoreReadiness").textContent = result.scores?.readiness ?? 0;
  $("resultRole").textContent = result.role || "Target role";
  $("resultSummary").textContent = result.summary || "";
  renderScannerWorkspace(result, String(state.importedResumeText || state.masterResume || ""));
  const recommendation = $("matchRecommendation");
  if (recommendation) {
    recommendation.textContent = currentMatch >= 90
      ? "Strong match. You can still generate a tailored version to tighten wording and relevance."
      : currentMatch >= 75
        ? "Good foundation. Generate a tailored resume to improve alignment with this job."
        : "Your current resume is leaving meaningful alignment on the table. Generate a tailored resume to strengthen the supported match.";
  }

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
  renderChangeHistory();
  renderCareerAgent();
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

      const versionSelect = document.createElement("select");
      versionSelect.className = "application-version-select";
      const none = document.createElement("option");
      none.value = ""; none.textContent = "No resume version linked";
      versionSelect.appendChild(none);
      state.resumeVersions.forEach(version => {
        const option = document.createElement("option");
        option.value = version.id;
        option.textContent = version.name;
        if (app.resumeVersionId === version.id) option.selected = true;
        versionSelect.appendChild(option);
      });
      versionSelect.addEventListener("change", () => {
        app.resumeVersionId = versionSelect.value || null;
        persist();
        toast(app.resumeVersionId ? "Resume version linked to application" : "Resume version unlinked");
      });
      card.append(strong,small,select,versionSelect);
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


const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js";
const SUPABASE_ESM_URL = "https://esm.sh/@supabase/supabase-js@2.116.0";
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

  const extracted = cleanExtractedText(pages.join("\n\n"));
  if (extracted.length >= 120) return extracted;

  setParserProgress(72, "Selectable text is insufficient · starting OCR");
  const Tesseract = await loadExternalScript(TESSERACT_URL, "Tesseract");
  if (!Tesseract || typeof Tesseract.createWorker !== "function") {
    throw new Error("OCR engine could not be loaded.");
  }

  const worker = await Tesseract.createWorker("eng", 1, {
    logger: function(message) {
      if (message && message.status === "recognizing text" && Number.isFinite(message.progress)) {
        const pct = 74 + Math.round(message.progress * 20);
        setParserProgress(pct, "OCR recognizing scanned resume text");
      }
    }
  });

  const ocrPages = [];
  try {
    const maxPages = Math.min(doc.numPages, 10);
    for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const viewport = page.getViewport({scale: 2});
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", {willReadFrequently:true});
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({canvasContext:context,viewport}).promise;
      setParserProgress(74 + Math.round(((pageNo - 1) / maxPages) * 20), "OCR page " + pageNo + " of " + maxPages);
      const result = await worker.recognize(canvas);
      ocrPages.push(result?.data?.text || "");
      canvas.width = 1; canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }

  const ocrText = cleanExtractedText(ocrPages.join("\n\n"));
  if (ocrText.length < 120) throw new Error("OCR found too little readable resume text.");
  setParserProgress(96, "OCR complete · cleaning text");
  return ocrText;
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


function resumePreparationKey(text) {
  const value = String(text || "");
  return [
    value.length,
    normalize(value.slice(0, 700)),
    normalize(value.slice(-700))
  ].join("|");
}

async function prepareResumeForTailoring(rawText) {
  const text = String(rawText || "").trim();
  if (text.length < 200) throw new Error("The uploaded resume does not contain enough readable text.");

  const key = resumePreparationKey(text);
  if (state.careerGraph && state.resumeSource?.preparationKey === key) {
    return state.careerGraph;
  }
  if (resumePreparationPromise && resumePreparationFingerprint === key) {
    return resumePreparationPromise;
  }

  resumePreparationFingerprint = key;
  const promise = (async () => {
    const graph = await ingestCareerGraph(text);
    if (!graph || !Array.isArray(graph.experience) || !Array.isArray(graph.evidenceRecords)) {
      throw new Error("Deep Nexivra could not structure this resume for tailoring.");
    }

    state.careerGraph = graph;
    state.masterResume = text;
    state.resumeSource = Object.assign({}, state.resumeSource || {}, {
      name: state.importedFile?.name || state.resumeSource?.name || "Uploaded resume",
      size: state.importedFile?.size || state.resumeSource?.size || null,
      type: state.importedFile?.type || state.resumeSource?.type || "",
      importedAt: state.resumeSource?.importedAt || new Date().toISOString(),
      parseConfidence: graph?.resumeQuality?.parseConfidence ?? null,
      preparationKey: key
    });
    graphEvidenceToVault(graph);
    persist();
    return graph;
  })();

  resumePreparationPromise = promise;
  try {
    return await promise;
  } catch (error) {
    if (resumePreparationFingerprint === key) {
      resumePreparationPromise = null;
    }
    throw error;
  }
}

function primeResumePreparation(rawText) {
  prepareResumeForTailoring(rawText).catch(error => {
    console.warn("Background resume preparation will retry when tailoring is requested:", error);
  });
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
    const previousResume = state.masterResume || "";
    state.masterResume = text;
    if (normalize(previousResume) !== normalize(text)) {
      state.careerGraph = null;
      state.tailoredResume = null;
      state.applicationPackage = null;
      state.evidence = [];
      resumePreparationPromise = null;
      resumePreparationFingerprint = "";
    }
    state.resumeSource = {
      name: state.importedFile?.name || "Uploaded resume",
      size: state.importedFile?.size || null,
      type: state.importedFile?.type || "",
      importedAt: new Date().toISOString(),
      parseConfidence: null,
      preparationKey: null
    };
    if ($("resumeInput")) {
      $("resumeInput").value = text;
      $("resumeChars").textContent = text.length;
    }
    $("scanResults")?.classList.add("hidden");
    renderImportPreview(text);
    persist();
    setParserProgress(100, "Resume ready");
    status.textContent = "Ready";
    meta.classList.add("import-success");
    $("buildCareerGraph").disabled = false;
    primeResumePreparation(text);
    toast("Resume uploaded and ready to scan");
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const response = await fetch("/api/resume-ingest", {
      method: "POST",
      signal: controller.signal,
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        resumeText: rawText,
        sourceFile: state.importedFile || null
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error("The resume preparation service returned an unreadable response. Please retry.");
    }

    if (!response.ok || !data?.ok || !data?.result) {
      throw new Error(data?.message || "Resume preparation failed");
    }
    return data.result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Resume preparation took too long. Please try again.");
    }
    if (/load failed|failed to fetch|network/i.test(String(error?.message || error))) {
      throw new Error("The resume preparation request was interrupted. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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


async function ensureTailoringGraph() {
  const scan = latestTargetScan();
  const resumeText = String(
    state.importedResumeText ||
    state.masterResume ||
    scan?.resumeSnapshot ||
    ""
  ).trim();

  if (resumeText.length < 200) {
    throw new Error("Upload your resume before generating a tailored version.");
  }

  try {
    return await prepareResumeForTailoring(resumeText);
  } catch (error) {
    console.error("Automatic resume preparation failed:", error);
    throw new Error("Deep Nexivra could not prepare this resume for tailoring. Please click Generate Tailored Resume again.");
  }
}

async function requestTailoredResume(optimizationFeedback = null, context = {}) {
  const scan = latestTargetScan();
  if (!scan) throw new Error("Run a Deep Scan first");
  const graph = context.graph || await ensureTailoringGraph();
  setAutoOptimizeStage("Writing optimized resume...");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 155000);

  try {
    const response = await fetch("/api/tailor-resume", {
      method: "POST",
      signal: controller.signal,
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        careerGraph: graph,
        masterResume: context.sourceText ?? (scannerCurrentResumeText() || state.masterResume),
        jobDescription: scan.jobSnapshot || "",
        jobAnalysis: scan.result || {},
        optimizationFeedback
      })
    });

    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error("Tailor Studio returned an unreadable server response. Please try again.");
    }

    if (!response.ok || !data?.ok || !data?.result) {
      throw new Error(data?.message || "Tailored resume generation failed");
    }

    const draft = hydrateTailoredState(data.result, scan);
    draft.fallbackUsed = !!data.fallback;
    draft.fallbackReason = String(data.fallbackReason || "");
    return draft;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Auto Optimize took too long. Please try again.");
    }
    if (/load failed|failed to fetch|network/i.test(String(error?.message || error))) {
      throw new Error("The optimization request was interrupted. Please tap Auto Optimize Resume again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function skillSelectedCount() {
  return (state.tailoredResume?.coreSkills || []).filter(s => s.selected !== false).length;
}

function approvedResumePayload(draft = state.tailoredResume) {
  const graph = ensureCareerGraphIds();
  if (!draft) return null;
  if (draft.versionLoaded && draft.versionApprovedResume && !draft.versionModified) {
    return JSON.parse(JSON.stringify(draft.versionApprovedResume));
  }
  if (!graph) return null;

  const experiences = [];
  (draft.experiences || []).forEach(exp => {
    const sourceRole = roleById(exp.roleId);
    if (!sourceRole) return;
    let bullets = (exp.bullets || [])
      .filter(b => b.accepted !== false && String(b.editedText || b.text || "").trim())
      .map(b => ({
        text: String(b.editedText || b.text || "").trim(),
        confidence: Number(b.confidence) || 0,
        priority: Number(b.priority) || 0,
        bulletId: b.bulletId || ""
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
      bullets: bullets.map(b => b.text),
      _roleId: exp.roleId,
      _bulletIds: bullets.map(b => b.bulletId)
    });
  });

  let finalExperiences = experiences;
  if (draft.onePageMode) finalExperiences = experiences.slice(0,4);

  let skills = (draft.coreSkills || []).filter(s => s.selected !== false).map(s => s.name).filter(Boolean);
  if (draft.onePageMode) skills = skills.slice(0,12);

  return {
    targetRole: draft.targetRole || latestTargetScan()?.result?.role || "",
    profile: graph.profile || {},
    summary: String(draft.professionalSummary?.text || graph.profile?.professionalHeadline || "").trim(),
    skills,
    experiences: finalExperiences,
    projects: draft.onePageMode ? (graph.projects || []).slice(0, 3) : (graph.projects || []),
    education: graph.education || [],
    certifications: graph.certifications || [],
    template: draft.template || "classic",
    onePageMode: !!draft.onePageMode
  };
}



function resumePayloadToAnalysisText(resume) {
  if (!resume) return "";
  const lines = [];
  const profile = resume.profile || {};
  if (profile.fullName) lines.push(profile.fullName);
  if (resume.targetRole) lines.push("TARGET ROLE: " + resume.targetRole);
  if (resume.summary) lines.push("\nPROFESSIONAL SUMMARY\n" + resume.summary);
  if ((resume.skills || []).length) lines.push("\nCORE SKILLS\n" + resume.skills.join(" | "));

  if ((resume.experiences || []).length) {
    lines.push("\nPROFESSIONAL EXPERIENCE");
    resume.experiences.forEach(exp => {
      lines.push("\n" + [exp.title, exp.employer].filter(Boolean).join(" — "));
      lines.push([exp.location, exp.startDate, exp.isCurrent ? "Present" : exp.endDate].filter(Boolean).join(" | "));
      (exp.bullets || []).forEach(text => lines.push("• " + text));
    });
  }

  if ((resume.projects || []).length) {
    lines.push("\nPROJECTS");
    resume.projects.forEach(item => {
      lines.push("\n" + [item.name, item.role].filter(Boolean).join(" — "));
      if (item.description) lines.push(item.description);
      if ((item.tools || []).length) lines.push("Tools: " + item.tools.join(" | "));
      if ((item.skills || []).length) lines.push("Skills: " + item.skills.join(" | "));
      (item.outcomes || []).forEach(text => lines.push("• " + text));
    });
  }

  if ((resume.education || []).length) {
    lines.push("\nEDUCATION");
    resume.education.forEach(item => {
      lines.push([
        item.credential,
        item.field,
        item.institution,
        item.location,
        item.endDate
      ].filter(Boolean).join(" | "));
      (item.details || []).forEach(text => lines.push("• " + text));
    });
  }

  if ((resume.certifications || []).length) {
    lines.push("\nCERTIFICATIONS");
    resume.certifications.forEach(item => {
      lines.push([item.name, item.issuer, item.date].filter(Boolean).join(" | "));
    });
  }

  return lines.join("\n").trim();
}

function markTailoredMatchStale() {
  const analysis = state.tailoredResume?.postTailorAnalysis;
  if (analysis) analysis.stale = true;
  scheduleTailoredScannerScore();
}

function renderTailoredMatchScore() {
  const scoreEl = $("tailoredMatchScore");
  const metaEl = $("tailoredMatchMeta");
  if (!scoreEl || !metaEl) return;

  const analysis = state.tailoredResume?.postTailorAnalysis;
  if (!analysis) {
    scoreEl.textContent = "—";
    metaEl.textContent = "Generate to score vs job";
    scoreEl.className = "";
    return;
  }

  const match = Math.max(0, Math.min(100, Math.round(Number(analysis.match) || 0)));
  scoreEl.textContent = match + "%";
  scoreEl.className = match >= 85 ? "match-strong" : match >= 70 ? "match-good" : "match-needs-work";

  if (analysis.stale) {
    metaEl.textContent = "Stale after edits · validate + re-score";
    return;
  }

  if (analysis.belowOriginal) {
    metaEl.textContent = "Generated version is below the original · original remains the stronger resume";
    return;
  }

  metaEl.textContent = analysis.analysisSource === "local"
    ? "Generated resume vs job description · local fallback"
    : "Generated resume vs job description";
}

async function scoreCurrentTailoredResume(options = {}) {
  const quiet = !!options.quiet;
  const scan = latestTargetScan();
  const resume = approvedResumePayload();

  if (!scan?.jobSnapshot) throw new Error("Target job description is missing");
  if (!resume) throw new Error("Generate a tailored resume first");

  const resumeText = resumePayloadToAnalysisText(resume);
  if (resumeText.length < 200) throw new Error("Tailored resume does not contain enough content to score");

  const model = scannerModelForText(resumeText, latestScannerKeywords(scan), latestScannerJob(scan));
  const match = model.score;

  state.tailoredResume.postTailorAnalysis = {
    scannedAt:new Date().toISOString(),
    match,
    scores:{requirementMatch:match},
    keywords:model.items,
    summary:"Deterministic weighted keyword match against the original job scan.",
    analysisSource:"weighted-keyword-v1",
    stale:false,
    validated:currentIntegrityStatus() === "valid"
  };

  persist();
  renderTailoredMatchScore();
  if (!quiet) toast("Tailored resume match: " + match + "%");
  return {
    scores:{requirementMatch:match},
    keywords:model.items,
    requirements:scan.result?.requirements || [],
    analysisSource:"weighted-keyword-v1"
  };
}



function graphEvidenceMatchesRole(record, role) {
  if (!record || !role) return false;
  const recordEmployer = normalize(record.employer || "");
  const recordRole = normalize(record.role || "");
  const roleEmployer = normalize(role.employer || "");
  const roleTitle = normalize(role.title || "");

  if (recordEmployer && roleEmployer && recordEmployer === roleEmployer) {
    if (!recordRole || !roleTitle) return true;
    return recordRole === roleTitle || recordRole.includes(roleTitle) || roleTitle.includes(recordRole);
  }
  if (!recordEmployer && recordRole && roleTitle) {
    return recordRole === roleTitle || recordRole.includes(roleTitle) || roleTitle.includes(recordRole);
  }
  return false;
}

function coverageRelevance(text, scan) {
  const target = normalize([
    scan?.jobSnapshot || "",
    ...(scan?.result?.keywords || []).map(item => item.keyword || ""),
    ...(scan?.result?.requirements || []).map(item => item.requirement || "")
  ].join(" "));
  const terms = [...new Set(tokenize(text || ""))];
  if (!terms.length) return 20;
  let hits = 0;
  terms.forEach(term => { if (target.includes(term)) hits += 1; });
  return Math.max(20, Math.min(100, Math.round(30 + hits * 9)));
}

function buildCoverageBaselineDraft(scan, graph) {
  graph = graph || ensureCareerGraphIds();
  if (!scan || !graph) return null;

  const experiences = [];
  (graph.experience || []).forEach(role => {
    const candidates = (graph.evidenceRecords || [])
      .filter(record => graphEvidenceMatchesRole(record, role) && (record.text || record.sourceSnippet))
      .map(record => ({
        record,
        priority: coverageRelevance(
          [record.title, record.text, record.sourceSnippet].filter(Boolean).join(" "),
          scan
        )
      }))
      .sort((a,b) => b.priority - a.priority)
      .slice(0, 8);

    if (!candidates.length) return;

    experiences.push({
      roleId: role.roleId,
      bullets: candidates.map((item,index) => ({
        bulletId: role.roleId + "-P" + String(index + 1).padStart(2,"0"),
        text: String(item.record.text || item.record.sourceSnippet || "").trim(),
        sourceEvidenceIds: [item.record.evidenceId],
        confidence: 100,
        priority: item.priority,
        rationale: "Preserved directly from uploaded resume evidence to protect requirement coverage.",
        alternatives: [],
        improvementTip: ""
      }))
    });
  });

  const skillRecords = (graph.evidenceRecords || [])
    .filter(record => (record.category === "Skill" || record.category === "Tool") && record.evidenceId)
    .map(record => ({
      record,
      priority: coverageRelevance([record.title, record.text].filter(Boolean).join(" "), scan)
    }))
    .sort((a,b) => b.priority - a.priority);

  const seen = new Set();
  const coreSkills = [];
  skillRecords.forEach(item => {
    const name = String(item.record.title || item.record.text || "").trim();
    const key = normalize(name);
    if (!name || !key || seen.has(key) || coreSkills.length >= 24) return;
    seen.add(key);
    coreSkills.push({
      name,
      sourceEvidenceIds: [item.record.evidenceId],
      reason: "Preserved from uploaded resume evidence.",
      selected: true
    });
  });

  const topEvidenceIds = (graph.evidenceRecords || [])
    .filter(record => record.evidenceId)
    .sort((a,b) =>
      coverageRelevance([b.title,b.text,b.sourceSnippet].filter(Boolean).join(" "), scan) -
      coverageRelevance([a.title,a.text,a.sourceSnippet].filter(Boolean).join(" "), scan)
    )
    .slice(0, 3)
    .map(record => record.evidenceId);

  const baseline = {
    documentTitle: (scan.result?.role || "Target Role") + " — Coverage-Preserving Resume",
    targetRole: scan.result?.role || "Target Role",
    professionalSummary: {
      text: String(graph.profile?.professionalHeadline || "").trim(),
      sourceEvidenceIds: topEvidenceIds,
      alternatives: [],
      improvementTip: ""
    },
    coreSkills,
    experiences,
    optimizationSuggestions: [],
    warnings: ["Coverage-preserving baseline created from uploaded resume evidence."],
    quality: {
      groundingCoverage: experiences.length ? 100 : 0,
      atsSafety: 95,
      jobAlignment: 0,
      notes: ["Preserves a broad set of source-backed evidence before further optimization."]
    }
  };

  const hydrated = hydrateTailoredState(baseline, scan);
  hydrated.fallbackUsed = true;
  hydrated.coverageBaseline = true;
  return boostSupportedJobTerms(hydrated, scan, graph);
}

function boostSupportedJobTerms(draft, scan, graph) {
  if (!draft || !scan || !graph) return draft;

  const existing = new Set(
    (draft.coreSkills || []).map(skill => normalize(skill.name || "")).filter(Boolean)
  );
  const evidenceRecords = graph.evidenceRecords || [];
  const jobTerms = (scan.result?.keywords || [])
    .map(item => String(item.keyword || "").trim())
    .filter(term => term.length >= 3);

  draft.coreSkills = draft.coreSkills || [];

  jobTerms.forEach(term => {
    const key = normalize(term);
    if (!key || existing.has(key)) return;

    const termTokens = key.split(" ").filter(token => token.length > 2);
    if (!termTokens.length) return;

    const supporting = evidenceRecords.find(record => {
      const hay = normalize([
        record.title,
        record.text,
        record.sourceSnippet
      ].filter(Boolean).join(" "));
      if (!hay) return false;
      return termTokens.every(token => hay.includes(token));
    });

    if (!supporting?.evidenceId) return;

    draft.coreSkills.push({
      name: term,
      sourceEvidenceIds: [supporting.evidenceId],
      reason: "Exact target-job terminology is explicitly supported by uploaded resume evidence.",
      selected: true
    });
    existing.add(key);
  });

  return draft;
}

function optimizationFeedbackFromAnalysis(result) {
  return {
    scores: result?.scores || {},
    remainingRequirements: (result?.requirements || [])
      .filter(item => item.status !== "direct")
      .slice(0, 10),
    missingSupportedTerms: (result?.keywords || [])
      .filter(item => !item.present)
      .slice(0, 12),
    atsIssues: (result?.atsIssues || []).slice(0, 8),
    rewriteOpportunities: (result?.rewrites || []).slice(0, 8),
    nextActions: (result?.nextActions || []).slice(0, 8),
    instruction: "Improve only where the Career Graph and cited evidence genuinely support a stronger match. Preserve true evidence gaps."
  };
}

async function maximizeTailoredMatch(options = {}) {
  const switchToTailor = options.switchToTailor !== false;
  const scan = latestTargetScan();
  if (!scan) throw new Error("Run a Deep Scan first");

  // Snapshot the actual editor before any asynchronous work. Never compare a
  // new candidate to an older structured draft when live edits are visible.
  const editor = $("scannerLiveEditor");
  const editorSnapshot = editor ? editor.value : null;
  const sourceText = editor ? editor.value.trim() : scannerCurrentResumeText();
  if (sourceText.length < 200) throw new Error("Resume text is too short to optimize. Your edits were kept.");
  const previousTailored = state.tailoredResume;
  const draftSnapshot = JSON.stringify(previousTailored);
  const keywordSnapshot = JSON.stringify(latestScannerKeywords(scan));

  const sourceModel = scannerModelForText(sourceText, latestScannerKeywords(scan), latestScannerJob(scan));
  const baselineMatch = sourceModel.score;

  const missing = sourceModel.items
    .filter(item => !item.present && !item.excluded)
    .sort((a,b) => Number(b.points || 0) - Number(a.points || 0))
    .slice(0,18);

  if (!missing.length) {
    setAutoOptimizeStage("Complete — no missing weighted keywords");
    toast("No missing weighted keywords remain in the current resume.");
    return baselineMatch;
  }

  const feedback = {
    targetMatch:94,
    missingSupportedTerms:missing,
    instruction:"Optimize this resume against the weighted missing job terms. Preserve strong existing content. Use exact job terminology only when candidate evidence supports the same concept. Return one stronger optimized version for review."
  };

  captureAutomaticResumeVersion("before Auto Optimize");
  setAutoOptimizeStage("Preparing resume...");
  const graph = await ensureTailoringGraph();
  let candidate = boostSupportedJobTerms(
    await requestTailoredResume(feedback, {graph, sourceText}),
    scan,
    graph
  );
  setAutoOptimizeStage("Scoring optimized resume...");
  // Score without mutating or persisting active state. Failure leaves the
  // previous draft, application package, history and live editor untouched.
  let optimizedPayload = approvedResumePayload(candidate);
  if (!optimizedPayload) throw new Error("The optimized resume could not be scored. Your current resume was kept.");
  let optimizedText = resumePayloadToAnalysisText(optimizedPayload);
  if (optimizedText.length < 200) throw new Error("The optimized resume is incomplete. Your current resume was kept.");
  let optimizedModel = scannerModelForText(optimizedText, sourceModel.items, latestScannerJob(scan));
  let optimizedMatch = optimizedModel.score;

  if (optimizedMatch <= baselineMatch) {
    setAutoOptimizeStage("Trying one targeted second pass...");
    try {
      const retryFeedback = Object.assign({}, feedback, {
        targetMatch:Math.min(100, baselineMatch + 8),
        instruction:"Targeted second pass: revise only the summary, skills, and specific bullets that can truthfully include the remaining supported terms. Keep every other section unchanged. Never invent evidence."
      });
      const retryCandidate = boostSupportedJobTerms(
        await requestTailoredResume(retryFeedback, {graph, sourceText}),
        scan,
        graph
      );
      const retryPayload = approvedResumePayload(retryCandidate);
      const retryText = retryPayload ? resumePayloadToAnalysisText(retryPayload) : "";
      const retryModel = retryText.length >= 200
        ? scannerModelForText(retryText, sourceModel.items, latestScannerJob(scan))
        : null;
      if (retryModel && retryModel.score > optimizedMatch) {
        candidate = retryCandidate;
        optimizedPayload = retryPayload;
        optimizedText = retryText;
        optimizedModel = retryModel;
        optimizedMatch = retryModel.score;
      }
    } catch (error) {
      console.warn("Targeted Auto Optimize retry failed", error);
    }
  }

  if (latestTargetScan() !== scan || state.tailoredResume !== previousTailored ||
      JSON.stringify(state.tailoredResume) !== draftSnapshot ||
      state.careerGraph !== graph ||
      (editor && editor.value !== editorSnapshot) ||
      JSON.stringify(latestScannerKeywords(scan)) !== keywordSnapshot) {
    setAutoOptimizeStage("Resume or scan changed — current work kept. Run Auto Optimize again.");
    toast("Your work changed during optimization. Current edits were kept.");
    return baselineMatch;
  }

  if (optimizedMatch <= baselineMatch) {
    setAutoOptimizeStage("Complete — current " + baselineMatch + "% kept; generated version scored " + optimizedMatch + "%. No supported score increase found.");
    toast("No further supported improvement was found. Your current " + baselineMatch + "% version was kept.");
    return baselineMatch;
  }

  candidate.postTailorAnalysis = {
    scannedAt:new Date().toISOString(), match:optimizedMatch,
    scores:{requirementMatch:optimizedMatch}, keywords:optimizedModel.items,
    summary:"Deterministic weighted keyword match against the original job scan.",
    analysisSource:"weighted-keyword-v1", stale:false,
    validated:candidate.integrity?.status === "valid"
  };
  state.tailoredResume = candidate;
  state.applicationPackage = null;
  {
    if ($("scannerLiveEditor")) $("scannerLiveEditor").value = optimizedText;
    renderScannerKeywordReport(optimizedText);
    renderScannerChecks(optimizedText);
  }

  state.changeHistory = [];
  state.historyIndex = -1;
  recordTailorState("Auto optimized resume");
  persist();
  captureAutomaticResumeVersion("after Auto Optimize");
  renderDashboard();
  renderTailoredMatchScore();
  renderScannerSuggestions();

  setAutoOptimizeStage("Optimization complete");
  if (switchToTailor) {
    setTimeout(() => $("scannerAiPanel")?.scrollIntoView({behavior:"smooth",block:"start"}),80);
  }

  toast("Auto Optimize complete · " + optimizedMatch + "% match");
  return optimizedMatch;
}

function tailorBulletById(roleId, bulletId) {
  const exp = (state.tailoredResume?.experiences || []).find(item => item.roleId === roleId);
  if (!exp) return null;
  return (exp.bullets || []).find(item => item.bulletId === bulletId) || null;
}

function cleanResumeEditText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function setLiveEditDirty(reason) {
  if (!state.tailoredResume) return;
  if (currentIntegrityStatus() !== "needs_review") {
    markTailoredDirty(reason);
  } else {
    state.tailoredResume.versionModified = true;
    state.applicationPackage = null;
  }
}

function syncBulletEditorValue(bulletId, value) {
  const editor = document.querySelector('.bullet-editor[data-bullet-id="' + CSS.escape(String(bulletId || "")) + '"]');
  if (editor && editor !== document.activeElement) editor.value = value;
}

function applySummarySuggestion(text) {
  if (!state.tailoredResume?.professionalSummary) return;
  state.tailoredResume.professionalSummary.text = String(text || "").trim();
  setLiveEditDirty("A suggested professional summary was applied and must be revalidated against its cited evidence.");
  recordTailorState("Apply stronger professional summary");
  persist();
  renderTailorStudio();
  toast("Stronger summary applied · validate before export");
}

function applyBulletSuggestion(roleId, bulletId, text) {
  const bullet = tailorBulletById(roleId, bulletId);
  if (!bullet) return;
  bullet.editedText = String(text || "").trim();
  bullet.accepted = true;
  setLiveEditDirty("A suggested bullet rewrite was applied and must be revalidated against its cited evidence.");
  recordTailorState("Apply stronger resume bullet");
  persist();
  renderTailorStudio();
  toast("Stronger bullet applied · validate before export");
}

function scheduleTailoredScannerScore() {
  clearTimeout(scannerLiveTimer);
  scannerLiveTimer = setTimeout(() => {
    if (!state.tailoredResume) return;
    scoreCurrentTailoredResume({quiet:true})
      .then(() => {
        renderTailoredMatchScore();
        renderScannerSuggestions();
        const payload = approvedResumePayload();
        if (payload) {
          const text = resumePayloadToAnalysisText(payload);
          if ($("scannerLiveEditor")) $("scannerLiveEditor").value = text;
          renderScannerKeywordReport(text);
          renderScannerChecks(text);
        }
      })
      .catch(error => console.warn("Live tailored score unavailable:",error));
  },140);
}

function setAutoOptimizeStage(text) {
  const btn = $("maximizeMatchFromScan");
  if (btn && btn.disabled) btn.textContent = text;
  if ($("scanStatus")) $("scanStatus").textContent = text;
}

function renderScannerSuggestions() {
  const panel = $("scannerAiPanel");
  const root = $("scannerSuggestionList");
  if (!panel || !root) return;
  const draft = state.tailoredResume;
  if (!draft) { panel.classList.add("hidden"); root.innerHTML = ""; return; }

  const rows = [];
  (draft.experiences || []).forEach(exp => {
    (exp.bullets || []).forEach(bullet => {
      const optimized = String(bullet.editedText || bullet.text || "").trim();
      const evidence = (bullet.sourceEvidenceIds || []).map(id => evidenceById(id)).find(Boolean);
      const original = String(evidence?.sourceSnippet || evidence?.text || "").trim();
      if (!optimized) return;
      if (original && scannerNormalize(original) === scannerNormalize(optimized)) return;
      rows.push({exp,bullet,original,optimized});
    });
  });

  if (!rows.length) { panel.classList.add("hidden"); root.innerHTML = ""; return; }
  panel.classList.remove("hidden");
  root.innerHTML = "";

  rows.slice(0,16).forEach(item => {
    const card = document.createElement("div");
    card.className = "scanner-suggestion-card";
    const label = document.createElement("div");
    label.className = "suggestion-label";
    const role = roleById(item.exp.roleId);
    label.textContent = role?.title || "Experience bullet";

    const original = document.createElement("div");
    original.className = "scanner-suggestion-original";
    original.textContent = item.original ? "Original: " + item.original : "Original wording is preserved in the uploaded resume evidence.";
    const optimized = document.createElement("div");
    optimized.className = "scanner-suggestion-new";
    optimized.textContent = "Optimized: " + item.optimized;

    const actions = document.createElement("div");
    actions.className = "scanner-suggestion-actions";
    const keep = document.createElement("button");
    keep.type = "button"; keep.className = "primary-btn"; keep.textContent = "Keep optimized";
    keep.addEventListener("click",() => {
      item.bullet.editedText = item.optimized;
      item.bullet.accepted = true;
      persist(); renderTailorStudio(); scheduleTailoredScannerScore();
    });
    const revert = document.createElement("button");
    revert.type = "button"; revert.className = "secondary-btn"; revert.textContent = "Use original";
    revert.disabled = !item.original;
    revert.addEventListener("click",() => {
      if (!item.original) return;
      item.bullet.editedText = item.original;
      item.bullet.accepted = true;
      markTailoredDirty("Reverted an optimized bullet to its uploaded source wording.");
      persist(); renderTailorStudio(); scheduleTailoredScannerScore();
    });
    actions.append(keep,revert);
    card.append(label,original,optimized,actions);
    root.appendChild(card);
  });
}
function renderResumeCoach() {
  const root = $("resumeCoachSuggestions");
  const summaryRoot = $("tailorSummarySuggestions");
  if (!root || !summaryRoot) return;

  root.innerHTML = "";
  summaryRoot.innerHTML = "";
  const draft = state.tailoredResume;
  if (!draft) {
    root.className = "coach-suggestions empty-state";
    root.textContent = "Generate a tailored resume to see recruiter and ATS improvement suggestions.";
    return;
  }

  const summary = draft.professionalSummary || {};
  if (summary.improvementTip || (summary.alternatives || []).length) {
    const details = document.createElement("details");
    details.className = "suggestion-details";
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Improve this summary";
    details.appendChild(summaryEl);

    if (summary.improvementTip) {
      const tip = document.createElement("p");
      tip.className = "suggestion-tip";
      tip.textContent = summary.improvementTip;
      details.appendChild(tip);
    }

    (summary.alternatives || []).forEach((text,index) => {
      const option = document.createElement("div");
      option.className = "rewrite-option";
      const copy = document.createElement("p");
      copy.textContent = text;
      const use = document.createElement("button");
      use.type = "button";
      use.className = "suggestion-use-btn";
      use.textContent = "Use option " + (index + 1);
      use.addEventListener("click", () => applySummarySuggestion(text));
      option.append(copy,use);
      details.appendChild(option);
    });
    summaryRoot.appendChild(details);
  }

  const suggestions = (draft.optimizationSuggestions || []).slice().sort((a,b) => {
    const rank = {high:0,medium:1,low:2};
    return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
  });

  if (!suggestions.length) {
    root.className = "coach-suggestions empty-state";
    root.textContent = "No additional resume-level recommendations were returned. Review the line-by-line alternatives beside each bullet.";
    return;
  }

  root.className = "coach-suggestions";
  suggestions.forEach(item => {
    const card = document.createElement("div");
    card.className = "coach-suggestion " + (item.priority || "medium");
    const top = document.createElement("div");
    top.className = "coach-suggestion-top";
    const section = document.createElement("strong");
    section.textContent = item.section || "Resume";
    const priority = document.createElement("span");
    priority.className = "coach-priority";
    priority.textContent = (item.priority || "medium") + " priority";
    top.append(section,priority);
    const issue = document.createElement("p");
    issue.className = "coach-issue";
    issue.textContent = item.issue || "";
    const recommendation = document.createElement("p");
    recommendation.className = "coach-recommendation";
    recommendation.textContent = item.recommendation || "";
    card.append(top,issue,recommendation);
    root.appendChild(card);
  });
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
    p.className = "resume-summary resume-live-edit";
    p.textContent = resume.summary;
    p.contentEditable = "true";
    p.spellcheck = true;
    p.setAttribute("role","textbox");
    p.setAttribute("aria-label","Edit professional summary");
    p.title = "Click to edit professional summary";
    p.addEventListener("input", () => {
      if (!state.tailoredResume?.professionalSummary) return;
      state.tailoredResume.professionalSummary.text = p.innerText;
      const side = $("tailorSummary");
      if (side && side !== document.activeElement) side.value = p.innerText;
      setLiveEditDirty("The professional summary was edited directly on the resume and must be revalidated.");
      scheduleTailorHistory("Live edit professional summary");
      persist();
    });
    p.addEventListener("blur", () => {
      if (!state.tailoredResume?.professionalSummary) return;
      const cleaned = cleanResumeEditText(p.innerText);
      state.tailoredResume.professionalSummary.text = cleaned;
      p.textContent = cleaned;
      const side = $("tailorSummary");
      if (side) side.value = cleaned;
      persist();
      renderTailorAudit();
      measureResumeFit();
    });
    p.addEventListener("keydown", event => {
      if (event.key === "Escape") p.blur();
    });
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
      exp.bullets.forEach((text,index) => {
        const li = document.createElement("li");
        li.textContent = text;
        const roleId = exp._roleId || "";
        const bulletId = (exp._bulletIds || [])[index] || "";
        if (roleId && bulletId) {
          li.className = "resume-live-edit resume-live-bullet";
          li.contentEditable = "true";
          li.spellcheck = true;
          li.dataset.roleId = roleId;
          li.dataset.bulletId = bulletId;
          li.setAttribute("role","textbox");
          li.setAttribute("aria-label","Edit resume bullet");
          li.title = "Click to edit this bullet";
          li.addEventListener("input", () => {
            const bullet = tailorBulletById(roleId, bulletId);
            if (!bullet) return;
            bullet.editedText = li.innerText;
            bullet.accepted = true;
            syncBulletEditorValue(bulletId, li.innerText);
            setLiveEditDirty("A resume bullet was edited directly on the resume and must be revalidated.");
            scheduleTailorHistory("Live edit resume bullet");
            persist();
          });
          li.addEventListener("blur", () => {
            const bullet = tailorBulletById(roleId, bulletId);
            if (!bullet) return;
            const cleaned = cleanResumeEditText(li.innerText);
            bullet.editedText = cleaned;
            li.textContent = cleaned;
            syncBulletEditorValue(bulletId, cleaned);
            persist();
            renderTailorAudit();
            measureResumeFit();
          });
          li.addEventListener("keydown", event => {
            if (event.key === "Enter") {
              event.preventDefault();
              li.blur();
            } else if (event.key === "Escape") {
              li.blur();
            }
          });
        }
        ul.appendChild(li);
      });
      job.appendChild(ul);
      section.appendChild(job);
    });
    paper.appendChild(section);
  }

  if ((resume.projects || []).length) {
    const section = document.createElement("section");
    section.className = "resume-section";
    section.appendChild(sectionTitle("Projects"));
    resume.projects.forEach(item => {
      const project = document.createElement("div");
      project.className = "resume-job";
      const head = document.createElement("div");
      head.className = "resume-job-head";
      const strong = document.createElement("strong");
      strong.textContent = [item.name, item.role].filter(Boolean).join(" — ") || "Project";
      head.appendChild(strong);
      project.appendChild(head);

      if (item.description) {
        const desc = document.createElement("div");
        desc.className = "resume-job-meta";
        desc.textContent = item.description;
        project.appendChild(desc);
      }

      const detailLines = [];
      if ((item.tools || []).length) detailLines.push("Tools: " + item.tools.join(" | "));
      if ((item.skills || []).length) detailLines.push("Skills: " + item.skills.join(" | "));
      detailLines.forEach(text => {
        const meta = document.createElement("div");
        meta.className = "resume-job-meta";
        meta.textContent = text;
        project.appendChild(meta);
      });

      if ((item.outcomes || []).length) {
        const ul = document.createElement("ul");
        item.outcomes.forEach(text => {
          const li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
        });
        project.appendChild(ul);
      }

      section.appendChild(project);
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
      markTailoredMatchStale();
      if (state.tailoredResume?.versionLoaded) state.tailoredResume.versionModified = true;
      recordTailorState("Toggle skill: " + skill.name);
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
        markTailoredMatchStale();
        if (state.tailoredResume?.versionLoaded) state.tailoredResume.versionModified = true;
        recordTailorState("Accept resume bullet");
        state.applicationPackage = null;
        persist(); renderTailorStudio();
      });
      reject.addEventListener("click", () => {
        bullet.accepted = false;
        markTailoredMatchStale();
        if (state.tailoredResume?.versionLoaded) state.tailoredResume.versionModified = true;
        recordTailorState("Reject resume bullet");
        state.applicationPackage = null;
        persist(); renderTailorStudio();
      });
      actions.append(accept,reject);
      top.append(confidence,actions);

      const textarea = document.createElement("textarea");
      textarea.className = "bullet-editor";
      textarea.dataset.roleId = exp.roleId || "";
      textarea.dataset.bulletId = bullet.bulletId || "";
      textarea.value = bullet.editedText || bullet.text || "";
      textarea.addEventListener("input", () => {
        bullet.editedText = textarea.value;
        markTailoredDirty("A bullet was edited and must be revalidated against its cited evidence.");
        scheduleTailorHistory("Edit resume bullet");
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

      const suggestionBox = document.createElement("details");
      suggestionBox.className = "bullet-suggestion-box";
      const suggestionSummary = document.createElement("summary");
      const altCount = (bullet.alternatives || []).length;
      suggestionSummary.textContent = altCount
        ? "Improve this bullet · " + altCount + (altCount === 1 ? " option" : " options")
        : "Improvement guidance";
      suggestionBox.appendChild(suggestionSummary);

      if (bullet.improvementTip) {
        const tip = document.createElement("p");
        tip.className = "suggestion-tip";
        tip.textContent = bullet.improvementTip;
        suggestionBox.appendChild(tip);
      }

      (bullet.alternatives || []).forEach((text,index) => {
        const option = document.createElement("div");
        option.className = "rewrite-option";
        const copy = document.createElement("p");
        copy.textContent = text;
        const use = document.createElement("button");
        use.type = "button";
        use.className = "suggestion-use-btn";
        use.textContent = "Use stronger option " + (index + 1);
        use.addEventListener("click", () => applyBulletSuggestion(exp.roleId, bullet.bulletId, text));
        option.append(copy,use);
        suggestionBox.appendChild(option);
      });

      card.append(top,textarea,rationale,sourceBox,suggestionBox);
      wrap.appendChild(card);
    });
    editor.appendChild(wrap);
  });
}


function markTailoredDirty(reason) {
  if (!state.tailoredResume) return;
  state.tailoredResume.versionModified = true;
  markTailoredMatchStale();
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

  const exportBlocked = !state.tailoredResume;
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
    small.textContent = [version.automatic ? "Automatic checkpoint" : "Saved version", version.targetRole, new Date(version.createdAt).toLocaleString(), version.template + " template", version.onePageMode ? "one-page" : "standard"].filter(Boolean).join(" · ");
    info.append(strong,small);

    const actions = document.createElement("div");
    actions.className = "version-actions";
    const load = document.createElement("button");
    load.textContent = "Load";
    load.addEventListener("click", () => {
      state.tailoredResume = version.tailoredResume ? JSON.parse(JSON.stringify(version.tailoredResume)) : null;
      if (state.tailoredResume) {
        state.tailoredResume.versionLoaded = true;
        state.tailoredResume.versionModified = false;
        state.tailoredResume.versionApprovedResume = version.approvedResume ? JSON.parse(JSON.stringify(version.approvedResume)) : null;
      }
      if (version.resumeText && $("scannerLiveEditor")) {
        $("scannerLiveEditor").value = version.resumeText;
        state.masterResume = version.resumeText;
        state.importedResumeText = version.resumeText;
      }
      state.applicationPackage = version.applicationPackage ? JSON.parse(JSON.stringify(version.applicationPackage)) : null;
      persist();
      renderDashboard();
      if (version.resumeText && $("scannerLiveEditor")) $("scannerLiveEditor").value = version.resumeText;
      switchView("tailor");
      toast(version.automatic ? "Automatic checkpoint loaded" : "Saved resume version loaded");
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
    actions.append(load);
    if (version.approvedResume) actions.append(docx,pdf);
    actions.append(del);
    row.append(info,actions);
    list.appendChild(row);
  });
}

function captureAutomaticResumeVersion(label = "Recovery checkpoint") {
  const approved = approvedResumePayload();
  const hasResume = approved || state.tailoredResume || scannerCurrentResumeText();
  if (!hasResume) return;
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    name: "Auto checkpoint · " + label,
    automatic: true,
    targetRole: state.tailoredResume?.targetRole || latestTargetScan()?.result?.role || "",
    scanId: state.tailoredResume?.generatedForScanId || latestTargetScan()?.id || "",
    createdAt: new Date().toISOString(),
    template: state.tailoredResume?.template || "classic",
    onePageMode: !!state.tailoredResume?.onePageMode,
    tailoredResume: state.tailoredResume ? JSON.parse(JSON.stringify(state.tailoredResume)) : null,
    approvedResume: approved ? JSON.parse(JSON.stringify(approved)) : null,
    applicationPackage: state.applicationPackage ? JSON.parse(JSON.stringify(state.applicationPackage)) : null
  };
  record.resumeText = scannerCurrentResumeText();
  state.resumeVersions = [record].concat(state.resumeVersions || []);
  const automatic = state.resumeVersions.filter(version => version.automatic);
  const keepAutomatic = new Set(automatic.slice(0, 20).map(version => version.id));
  state.resumeVersions = state.resumeVersions.filter(version => !version.automatic || keepAutomatic.has(version.id)).slice(0, 50);
  persist();
  renderResumeVersions();
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
    automatic: false,
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


function workspaceSnapshot() {
  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    masterResume: state.masterResume,
    evidence: state.evidence,
    scans: state.scans,
    applications: state.applications,
    careerGraph: state.careerGraph,
    resumeSource: state.resumeSource,
    tailoredResume: state.tailoredResume,
    resumeVersions: state.resumeVersions,
    analysisCache: state.analysisCache,
    applicationPackage: state.applicationPackage,
    changeHistory: state.changeHistory,
    historyIndex: state.historyIndex,
    careerAgentJobs: state.careerAgentJobs
  };
}

function restoreWorkspaceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid workspace snapshot");
  state.masterResume = snapshot.masterResume || "";
  state.evidence = Array.isArray(snapshot.evidence) ? snapshot.evidence : [];
  state.scans = Array.isArray(snapshot.scans) ? snapshot.scans : [];
  state.applications = Array.isArray(snapshot.applications) ? snapshot.applications : [];
  state.careerGraph = snapshot.careerGraph || null;
  state.resumeSource = snapshot.resumeSource || null;
  state.tailoredResume = snapshot.tailoredResume || null;
  state.resumeVersions = Array.isArray(snapshot.resumeVersions) ? snapshot.resumeVersions : [];
  state.analysisCache = snapshot.analysisCache && typeof snapshot.analysisCache === "object" ? snapshot.analysisCache : {};
  state.applicationPackage = snapshot.applicationPackage || null;
  state.changeHistory = Array.isArray(snapshot.changeHistory) ? snapshot.changeHistory : [];
  state.historyIndex = Number.isFinite(snapshot.historyIndex) ? snapshot.historyIndex : state.changeHistory.length - 1;
  state.careerAgentJobs = Array.isArray(snapshot.careerAgentJobs) ? snapshot.careerAgentJobs : [];
  persist();
  renderDashboard();
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function deriveWorkspaceKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({
    name:"PBKDF2",
    salt,
    iterations:250000,
    hash:"SHA-256"
  }, keyMaterial, {
    name:"AES-GCM",
    length:256
  }, false, ["encrypt","decrypt"]);
}

async function encryptWorkspace(snapshot, passphrase) {
  if (!passphrase || passphrase.length < 8) throw new Error("Use an encryption passphrase of at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveWorkspaceKey(passphrase, salt);
  const plain = new TextEncoder().encode(JSON.stringify(snapshot));
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, plain);
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    algorithm: "AES-256-GCM/PBKDF2-SHA256-250000"
  };
}

async function decryptWorkspace(payload, passphrase) {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveWorkspaceKey(passphrase, salt);
  const encrypted = base64ToBytes(payload.ciphertext);
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv}, key, encrypted);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function getCloudClient() {
  if (state.cloudClient) return state.cloudClient;
  if (!state.cloudConfig) {
    const response = await fetch("/api/cloud-config");
    const data = await response.json();
    state.cloudConfig = data;
    if ($("agentSearchProviderTag")) {
      $("agentSearchProviderTag").textContent = data.jobDiscoveryEnabled ? "Live discovery ready" : "Provider not configured";
    }
  }
  if (!state.cloudConfig?.enabled) throw new Error("Cloud sync is not configured on this deployment");
  const module = await import(SUPABASE_ESM_URL);
  state.cloudClient = module.createClient(state.cloudConfig.url, state.cloudConfig.publishableKey, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  return state.cloudClient;
}

async function refreshCloudStatus() {
  const tag = $("cloudStatusTag");
  const line = $("cloudStatusLine");
  try {
    const client = await getCloudClient();
    const {data} = await client.auth.getSession();
    const user = data?.session?.user;
    tag.textContent = user ? "Signed in" : "Cloud ready";
    line.textContent = user
      ? "Signed in as " + user.email + ". Cloud data is stored as a client-side encrypted blob."
      : "Cloud sync is configured. Sign in with a secure email link when you want cross-device sync.";
  } catch (error) {
    tag.textContent = "Local-only";
    line.textContent = error.message + ". Local mode continues to work normally.";
    try {
      if (!state.cloudConfig) {
        const response = await fetch("/api/cloud-config");
        state.cloudConfig = await response.json();
      }
      if ($("agentSearchProviderTag")) {
        $("agentSearchProviderTag").textContent = state.cloudConfig?.jobDiscoveryEnabled ? "Live discovery ready" : "Provider not configured";
      }
    } catch (_) {}
  }
}

function recordTailorState(label) {
  if (!state.tailoredResume) return;
  const snapshot = JSON.parse(JSON.stringify(state.tailoredResume));
  const current = state.changeHistory[state.historyIndex];
  if (current && JSON.stringify(current.snapshot) === JSON.stringify(snapshot)) return;
  if (state.historyIndex < state.changeHistory.length - 1) {
    state.changeHistory = state.changeHistory.slice(0, state.historyIndex + 1);
  }
  state.changeHistory.push({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    label: label || "Resume change",
    createdAt: new Date().toISOString(),
    snapshot
  });
  state.changeHistory = state.changeHistory.slice(-30);
  state.historyIndex = state.changeHistory.length - 1;
  persist();
  renderChangeHistory();
}

let historyDebounce;
function scheduleTailorHistory(label) {
  clearTimeout(historyDebounce);
  historyDebounce = setTimeout(() => recordTailorState(label), 650);
}

function undoTailorChange() {
  if (state.historyIndex <= 0) return toast("No earlier resume change");
  state.historyIndex--;
  state.tailoredResume = JSON.parse(JSON.stringify(state.changeHistory[state.historyIndex].snapshot));
  state.applicationPackage = null;
  persist(); renderDashboard(); toast("Undid resume change");
}

function redoTailorChange() {
  if (state.historyIndex >= state.changeHistory.length - 1) return toast("No later resume change");
  state.historyIndex++;
  state.tailoredResume = JSON.parse(JSON.stringify(state.changeHistory[state.historyIndex].snapshot));
  state.applicationPackage = null;
  persist(); renderDashboard(); toast("Redid resume change");
}

function renderChangeHistory() {
  if (!$("tailorChangeHistory")) return;
  const root = $("tailorChangeHistory");
  $("historyCountTag").textContent = state.changeHistory.length + (state.changeHistory.length === 1 ? " change" : " changes");
  root.innerHTML = "";
  if (!state.changeHistory.length) {
    root.className = "empty-state";
    root.textContent = "Resume edits will appear here and can be undone/redone.";
  } else {
    root.className = "";
    state.changeHistory.slice().reverse().slice(0,12).forEach((event,reverseIndex) => {
      const actualIndex = state.changeHistory.length - 1 - reverseIndex;
      const div = document.createElement("div");
      div.className = "history-event";
      const strong = document.createElement("strong");
      strong.textContent = (actualIndex === state.historyIndex ? "Current · " : "") + event.label;
      const small = document.createElement("small");
      small.textContent = new Date(event.createdAt).toLocaleString();
      div.append(strong,small);
      root.appendChild(div);
    });
  }
  $("undoTailor").disabled = state.historyIndex <= 0;
  $("redoTailor").disabled = state.historyIndex < 0 || state.historyIndex >= state.changeHistory.length - 1;
}

function measureResumeFit() {
  const paper = $("tailoredResumePreview");
  const tag = $("pageFitStatus");
  if (!paper || !tag || !state.tailoredResume) return;
  requestAnimationFrame(() => {
    if (!state.tailoredResume.onePageMode) {
      tag.textContent = "Standard length";
      tag.className = "tag";
      paper.classList.remove("ultra-compact");
      return;
    }
    paper.classList.remove("ultra-compact");
    const allowed = paper.clientHeight || 1056;
    const overflow = paper.scrollHeight - allowed;
    if (overflow <= 4) {
      tag.textContent = "Fits one page";
      tag.className = "tag page-fit-ok";
      return;
    }
    paper.classList.add("ultra-compact");
    requestAnimationFrame(() => {
      const overflow2 = paper.scrollHeight - (paper.clientHeight || 1056);
      if (overflow2 <= 4) {
        tag.textContent = "Fits after compression";
        tag.className = "tag page-fit-ok";
      } else {
        const pct = Math.max(1, Math.round((overflow2 / (paper.clientHeight || 1056)) * 100));
        tag.textContent = "Over by ~" + pct + "%";
        tag.className = "tag page-fit-bad";
      }
    });
  });
}

function careerAgentGapStats() {
  const map = new Map();
  state.careerAgentJobs.forEach(job => {
    (job.recurringGapTags || []).forEach(tag => {
      const key = String(tag || "").trim();
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
  });
  return [...map.entries()].sort((a,b) => b[1] - a[1]);
}

function renderCareerAgent() {
  if (!$("agentOpportunityCount")) return;
  const jobs = state.careerAgentJobs || [];
  const gaps = careerAgentGapStats();
  $("agentOpportunityCount").textContent = jobs.length;
  $("agentStrongCount").textContent = jobs.filter(j => j.fitLevel === "Strong").length;
  $("agentGapCount").textContent = gaps.length;
  $("agentNextSkill").textContent = gaps[0]?.[0] || "—";
  $("agentQueueTag").textContent = jobs.length + (jobs.length === 1 ? " job" : " jobs");

  const list = $("agentOpportunityList");
  list.innerHTML = "";
  if (!jobs.length) {
    list.className = "empty-state";
    list.textContent = "Add a job to start the opportunity queue.";
  } else {
    list.className = "";
    jobs.forEach(job => {
      const card = document.createElement("div");
      card.className = "agent-job-card";
      const head = document.createElement("div");
      head.className = "agent-job-head";
      const left = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = [job.title,job.company].filter(Boolean).join(" — ") || "Imported job";
      const small = document.createElement("small");
      small.textContent = [job.location,job.fitLevel + " evidence fit",new Date(job.createdAt).toLocaleDateString()].filter(Boolean).join(" · ");
      left.append(strong,small);
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = job.fitLevel || "Triage";
      head.append(left,tag);
      const p = document.createElement("p");
      p.textContent = job.summary || "";
      const scores = document.createElement("div");
      scores.className = "agent-score-grid";
      [["Requirement",job.scores?.requirementMatch],["Evidence",job.scores?.evidenceStrength],["Readiness",job.scores?.readiness]].forEach(pair => {
        const box = document.createElement("div");
        const span = document.createElement("span"); span.textContent = pair[0];
        const val = document.createElement("strong"); val.textContent = (pair[1] ?? 0) + "/100";
        box.append(span,val); scores.appendChild(box);
      });
      const actions = document.createElement("div");
      actions.className = "agent-job-actions";
      const target = document.createElement("button");
      target.textContent = "Set as target";
      target.addEventListener("click", () => {
        $("jobInput").value = job.jobDescription || "";
        $("jobChars").textContent = (job.jobDescription || "").length;
        switchView("match");
        toast(job.source === "Adzuna discovery" ? "Discovery snippet loaded; use Deep import for a fuller posting when possible" : "Job loaded into Match Lab");
      });

      if (job.sourceUrl) {
        const deepImport = document.createElement("button");
        deepImport.textContent = "Deep import";
        deepImport.addEventListener("click", async () => {
          deepImport.disabled = true;
          const oldText = deepImport.textContent;
          deepImport.textContent = "Importing...";
          try {
            const response = await fetch("/api/job-intake", {
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({url:job.sourceUrl,careerGraph:ensureCareerGraphIds()})
            });
            const data = await response.json();
            if (!response.ok || !data?.ok || !data?.result) throw new Error(data?.message || "Deep import failed");
            const result = data.result;
            Object.assign(job,result,{
              source:job.source || "Deep import",
              sourceUrl:result.sourceUrl || job.sourceUrl,
              createdAt:job.createdAt
            });
            persist(); renderCareerAgent();
            toast("Full job import complete");
          } catch (error) {
            toast(error.message || "Deep import failed");
          } finally {
            deepImport.disabled = false;
            deepImport.textContent = oldText;
          }
        });
        actions.appendChild(deepImport);

        const open = document.createElement("button");
        open.textContent = "Open listing";
        open.addEventListener("click", () => window.open(job.sourceUrl,"_blank","noopener,noreferrer"));
        actions.appendChild(open);
      }

      const remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        state.careerAgentJobs = state.careerAgentJobs.filter(x => x.id !== job.id);
        persist(); renderCareerAgent();
      });
      actions.prepend(target);
      actions.append(remove);
      card.append(head,p,scores,actions);
      list.appendChild(card);
    });
  }

  const gapRoot = $("agentGapList");
  gapRoot.innerHTML = "";
  if (!gaps.length) {
    gapRoot.className = "empty-state";
    gapRoot.textContent = "Analyze multiple roles to see which missing skills or tools recur most often.";
  } else {
    gapRoot.className = "";
    gaps.slice(0,15).forEach(([name,count]) => {
      const row = document.createElement("div");
      row.className = "agent-gap-row";
      const strong = document.createElement("strong"); strong.textContent = name;
      const span = document.createElement("span"); span.textContent = count + (count === 1 ? " job" : " jobs");
      row.append(strong,span);
      gapRoot.appendChild(row);
    });
  }
}

async function exportCoverLetter(format) {
  if (!state.applicationPackage?.coverLetter?.text) throw new Error("Generate an application package first");
  const context = applicationTargetContext();
  const response = await fetch("/api/export-letter", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      format,
      letter:{
        candidateName: state.careerGraph?.profile?.fullName || "",
        candidateEmail: state.careerGraph?.profile?.email || "",
        candidatePhone: state.careerGraph?.profile?.phone || "",
        targetRole: context.role || "",
        text: state.applicationPackage.coverLetter.text
      }
    })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Cover letter export failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Deep-Nexivra-Cover-Letter-" + String(context.role || "Application").replace(/[^a-z0-9]+/gi,"-") + "." + format;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url),2000);
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
  if ($("currentResumeMatchInTailor")) {
    const original = Math.max(0, Math.min(100, Math.round(Number(
      scan?.result?.originalKeywordScore ?? scan?.result?.scores?.requirementMatch
    ) || 0)));
    $("currentResumeMatchInTailor").textContent = scan ? original + "%" : "—";
  }
  $("tailorGraphStatus").textContent = graph ? ((graph.evidenceRecords || []).length + " evidence records") : "Not ready";
  $("acceptedBulletCount").textContent = countAcceptedBullets();
  $("tailorGrounding").textContent = draft?.quality?.groundingCoverage != null ? Math.round(draft.quality.groundingCoverage) + "%" : "—";
  renderTailoredMatchScore();

  const empty = $("tailorEmpty");
  const workspace = $("tailorWorkspace");
  const tailorView = $("view-tailor");
  const ready = !!scan;

  if (tailorView) tailorView.classList.toggle("has-tailored-resume", !!draft);

  if (!draft) {
    empty.classList.remove("hidden");
    workspace.classList.add("hidden");
    const heading = empty.querySelector("h3");
    const text = empty.querySelector("p");
    if (ready) {
      heading.textContent = "Your Deep Scan is ready.";
      text.textContent = "Use Generate Tailored Resume in the result above. Deep Nexivra will prepare the supporting evidence automatically and build the strongest truthful version it can.";
    } else {
      heading.textContent = "Run a Deep Scan first.";
      text.textContent = "Your tailored resume will appear here after you scan the current resume against a target job.";
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
  renderResumeCoach();
  renderScannerSuggestions();
  renderTailorPreview();
  renderTailorAudit();
  renderIntegrityGate();
  renderChangeHistory();
  measureResumeFit();
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
  if (!state.tailoredResume) throw new Error("Generate a tailored resume first");

  if (currentIntegrityStatus() !== "valid") {
    const validation = await revalidateTailoredResume();
    state.tailoredResume.integrity = validation;
    persist();

    if (validation.status !== "valid") {
      renderIntegrityGate();
      throw new Error("One or more edits are not supported by the uploaded resume. Correct them before export.");
    }

    if (state.tailoredResume?.postTailorAnalysis?.stale) {
      try {
        await scoreCurrentTailoredResume({quiet:true});
      } catch (error) {
        console.warn("Re-score after export validation was unavailable:", error);
      }
    }
  }

  const resume = approvedResumePayload();
  if (!resume) throw new Error("Generate a tailored resume first");
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
    state.changeHistory = [];
    state.historyIndex = -1;
    recordTailorState("Generated tailored resume");
    persist();
    renderDashboard();
    btn.textContent = "Scoring generated resume...";
    try {
      await scoreCurrentTailoredResume({quiet:true});
      renderTailorStudio();
      toast("Tailored resume generated · match " + (state.tailoredResume?.postTailorAnalysis?.match ?? "—") + "%");
    } catch (scoreError) {
      console.warn("Post-tailor scoring failed:", scoreError);
      renderTailorStudio();
      toast("Resume generated · match score unavailable");
    }
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
  scheduleTailorHistory("Edit professional summary");
  persist();
  renderTailorPreview();
});

$("resumeTemplate").addEventListener("change", event => {
  if (!state.tailoredResume) return;
  state.tailoredResume.template = event.target.value;
  if (state.tailoredResume.versionLoaded) state.tailoredResume.versionModified = true;
  recordTailorState("Change resume template");
  persist();
  renderTailorPreview();
});

$("onePageMode").addEventListener("change", event => {
  if (!state.tailoredResume) return;
  state.tailoredResume.onePageMode = event.target.checked;
  markTailoredMatchStale();
  if (state.tailoredResume.versionLoaded) state.tailoredResume.versionModified = true;
  recordTailorState(event.target.checked ? "Enable one-page mode" : "Disable one-page mode");
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
    if (result.status === "valid" && state.tailoredResume?.postTailorAnalysis?.stale) {
      try {
        await scoreCurrentTailoredResume({quiet:true});
        renderTailorStudio();
        toast("Claims validated · updated match " + (state.tailoredResume?.postTailorAnalysis?.match ?? "—") + "%");
      } catch (scoreError) {
        console.warn("Automatic re-score after validation failed:", scoreError);
        toast("Claims validated · re-score unavailable");
      }
    } else {
      toast(result.status === "valid" ? "All accepted claims validated" : "Validation found claims that need correction");
    }
  } catch (error) {
    toast(error.message || "Validation failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});


document.querySelectorAll(".scanner-filter").forEach(button => {
  button.addEventListener("click", () => {
    scannerKeywordFilter = button.dataset.keywordFilter || "all";
    document.querySelectorAll(".scanner-filter").forEach(item => item.classList.toggle("active",item === button));
    renderScannerKeywordReport(scannerCurrentResumeText());
  });
});


async function exportScannerLiveResume(format) {
  const text = String($("scannerLiveEditor")?.value || "").trim();
  if (text.length < 100) throw new Error("Resume text is too short to export");

  const structured = approvedResumePayload();
  if (structured) {
    const structuredText = resumePayloadToAnalysisText(structured);
    if (structuredText.trim() === text) {
      return exportResumePayload(format,structured,"Deep-Nexivra");
    }
  }

  const scan = latestTargetScan();
  const role = String(scan?.result?.role || "Resume").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
  const response = await fetch("/api/export-resume", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      format,
      rawText:text,
      filename:"Deep-Nexivra-" + (role || "Resume")
    })
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
  link.href = url;
  link.download = "Deep-Nexivra-" + (role || "Resume") + "." + format;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),2000);
}

$("scannerLiveEditor")?.addEventListener("input", event => {
  clearTimeout(scannerLiveTimer);
  scannerLiveTimer = setTimeout(() => {
    const text = event.target.value;
    renderScannerKeywordReport(text);
    renderScannerChecks(text);
  },100);
});

$("applyLiveEditorResume")?.addEventListener("click", () => {
  const text = $("scannerLiveEditor").value.trim();
  if (text.length < 200) return toast("Resume text is too short");
  captureAutomaticResumeVersion("before applying live edit");
  state.importedResumeText = text;
  state.masterResume = text;
  state.careerGraph = null;
  state.tailoredResume = null;
  const scan = latestTargetScan();
  if (scan) {
    scan.resumeSnapshot = text.slice(0,30000);
    const model = scannerModelForText(text,latestScannerKeywords(scan),latestScannerJob(scan));
    scan.result.keywords = model.items;
    scan.result.keywordStats = {score:model.score,matched:model.matched,missing:model.missing,total:model.total,model:"weighted-keyword-v1"};
    scan.result.scores = scan.result.scores || {};
    scan.result.scores.requirementMatch = model.score;
    state.latest = scan.result;
    scannerApplyScoreModel(model);
  }
  persist();
  renderDashboard();
  renderScannerKeywordReport(text);
  renderScannerChecks(text);
  toast("Edited resume is now the active version");
});


$("scannerExportDocx")?.addEventListener("click", async () => {
  const btn = $("scannerExportDocx");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Exporting...";
  try {
    await exportScannerLiveResume("docx");
    toast("DOCX exported");
  } catch (error) {
    toast(error.message || "DOCX export failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("scannerExportPdf")?.addEventListener("click", async () => {
  const btn = $("scannerExportPdf");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Exporting...";
  try {
    await exportScannerLiveResume("pdf");
    toast("PDF exported");
  } catch (error) {
    toast(error.message || "PDF export failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("scannerApplyAll")?.addEventListener("click", () => {
  if (!state.tailoredResume) return;
  (state.tailoredResume.experiences || []).forEach(exp => {
    (exp.bullets || []).forEach(bullet => {
      bullet.accepted = true;
      bullet.editedText = bullet.text || bullet.editedText || "";
    });
  });
  persist();
  renderTailorStudio();
  scheduleTailoredScannerScore();
  toast("All supported optimized changes applied");
});

$("rescanTailoredMatch").addEventListener("click", async () => {
  const btn = $("rescanTailoredMatch");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Scoring...";
  try {
    await scoreCurrentTailoredResume();
    renderTailorStudio();
  } catch (error) {
    toast(error.message || "Unable to score tailored resume");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("maximizeTailoredMatch").addEventListener("click", async () => {
  const btn = $("maximizeTailoredMatch");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Maximizing...";
  try {
    await maximizeTailoredMatch({switchToTailor:false});
    renderTailorStudio();
  } catch (error) {
    console.error(error);
    toast(error.message || "Unable to maximize tailored match");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("maximizeMatchFromScan").addEventListener("click", async () => {
  const btn = $("maximizeMatchFromScan");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generating + optimizing...";
  try {
    await maximizeTailoredMatch({switchToTailor:true});
  } catch (error) {
    console.error(error);
    toast(error.message || "Unable to maximize resume match");
    setAutoOptimizeStage("Optimization failed — " + (error.message || "Please retry. Your current resume was kept."));
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

$("undoTailor").addEventListener("click", undoTailorChange);
$("redoTailor").addEventListener("click", redoTailorChange);

$("cloudSignIn").addEventListener("click", async () => {
  try {
    const email = $("cloudEmail").value.trim();
    if (!email) throw new Error("Enter your email first");
    const client = await getCloudClient();
    const {error} = await client.auth.signInWithOtp({
      email,
      options:{emailRedirectTo:window.location.origin}
    });
    if (error) throw error;
    toast("Secure sign-in link sent");
    refreshCloudStatus();
  } catch (error) { toast(error.message || "Cloud sign-in failed"); }
});

$("cloudSignOut").addEventListener("click", async () => {
  try {
    const client = await getCloudClient();
    await client.auth.signOut();
    refreshCloudStatus();
    toast("Signed out");
  } catch (error) { toast(error.message || "Sign-out failed"); }
});

$("cloudPush").addEventListener("click", async () => {
  try {
    const client = await getCloudClient();
    const {data} = await client.auth.getSession();
    const user = data?.session?.user;
    if (!user) throw new Error("Sign in before syncing");
    const payload = await encryptWorkspace(workspaceSnapshot(), $("cloudPassphrase").value);
    const {error} = await client.from("career_workspaces").upsert({
      user_id:user.id,
      encrypted_blob:payload.ciphertext,
      salt:payload.salt,
      iv:payload.iv,
      algorithm:payload.algorithm,
      updated_at:new Date().toISOString()
    }, {onConflict:"user_id"});
    if (error) throw error;
    toast("Encrypted workspace synced");
    refreshCloudStatus();
  } catch (error) { toast(error.message || "Cloud sync failed"); }
});

$("cloudPull").addEventListener("click", async () => {
  try {
    const client = await getCloudClient();
    const {data:sessionData} = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) throw new Error("Sign in before restoring");
    const {data,error} = await client.from("career_workspaces")
      .select("encrypted_blob,salt,iv,algorithm,updated_at")
      .eq("user_id",user.id)
      .single();
    if (error) throw error;
    const snapshot = await decryptWorkspace({
      ciphertext:data.encrypted_blob,
      salt:data.salt,
      iv:data.iv
    }, $("cloudPassphrase").value);
    if (!confirm("Replace this browser's local Deep Nexivra workspace with the decrypted cloud workspace?")) return;
    restoreWorkspaceSnapshot(snapshot);
    toast("Cloud workspace restored");
  } catch (error) { toast(error.message || "Cloud restore failed"); }
});

$("agentSearchJobs").addEventListener("click", async () => {
  const btn = $("agentSearchJobs");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Searching & triaging...";
  try {
    if (!state.careerGraph) throw new Error("Build your Career Graph first");
    const keywords = $("agentSearchKeywords").value.trim();
    const location = $("agentSearchLocation").value.trim();
    const country = $("agentSearchCountry").value.trim().toLowerCase() || "ca";
    if (!keywords) throw new Error("Enter a target role or keywords");

    const response = await fetch("/api/job-search", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        keywords,
        location,
        country,
        careerGraph:ensureCareerGraphIds()
      })
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.message || "Job discovery failed");
    const incoming = data.result?.jobs || [];
    const existing = new Set(state.careerAgentJobs.map(job => job.externalId || job.sourceUrl || normalize((job.title || "") + "|" + (job.company || ""))));
    let added = 0;
    incoming.forEach(job => {
      const key = job.externalId || job.sourceUrl || normalize((job.title || "") + "|" + (job.company || ""));
      if (existing.has(key)) return;
      existing.add(key);
      state.careerAgentJobs.push(Object.assign({
        id:crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + "-" + added,
        createdAt:new Date().toISOString()
      },job));
      added++;
    });
    state.careerAgentJobs.sort((a,b) => (b.scores?.readiness || 0) - (a.scores?.readiness || 0));
    state.careerAgentJobs = state.careerAgentJobs.slice(0,50);
    persist(); renderCareerAgent();
    toast(added ? (added + " new jobs added") : "No new jobs found");
  } catch (error) {
    toast(error.message || "Job discovery failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$("agentAnalyzeJob").addEventListener("click", async () => {
  const btn = $("agentAnalyzeJob");
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = "Importing & triaging...";
  try {
    if (!state.careerGraph) throw new Error("Build your Career Graph first");
    const url = $("agentJobUrl").value.trim();
    const jobText = $("agentJobText").value.trim();
    if (!url && jobText.length < 200) throw new Error("Add a job URL or paste the full posting");
    const response = await fetch("/api/job-intake", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url,jobText,careerGraph:ensureCareerGraphIds()})
    });
    const data = await response.json();
    if (!response.ok || !data?.ok || !data?.result) throw new Error(data?.message || "Job intake failed");
    state.careerAgentJobs.unshift(Object.assign({
      id:crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt:new Date().toISOString()
    },data.result));
    state.careerAgentJobs = state.careerAgentJobs.slice(0,50);
    persist(); renderCareerAgent();
    $("agentJobUrl").value = ""; $("agentJobText").value = "";
    toast("Opportunity added to Career Agent");
  } catch (error) { toast(error.message || "Job triage failed"); }
  finally { btn.disabled = false; btn.textContent = old; }
});

$("exportCoverLetterDocx").addEventListener("click", async () => {
  try { await exportCoverLetter("docx"); toast("Cover letter DOCX created"); }
  catch (error) { toast(error.message || "Cover letter export failed"); }
});
$("exportCoverLetterPdf").addEventListener("click", async () => {
  try { await exportCoverLetter("pdf"); toast("Cover letter PDF created"); }
  catch (error) { toast(error.message || "Cover letter export failed"); }
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
  state.masterResume = "";
  state.careerGraph = null;
  state.tailoredResume = null;
  state.evidence = [];
  resumePreparationPromise = null;
  resumePreparationFingerprint = "";
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
  const resume = String(state.importedResumeText || state.masterResume || $("resumeInput").value || "").trim();
  const job = $("jobInput").value.trim();
  if (resume.length < 200) return toast("Upload your resume first");
  if (job.length < 250) return toast("Paste the full job description first");

  const btn = $("runScan");
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Analyzing...";
  $("scanStatus").textContent = "Mapping requirements to evidence";

  try {
    captureAutomaticResumeVersion("before new scan");
    const resumeChanged = normalize(state.masterResume || "") !== normalize(resume);
    if (resumeChanged) {
      state.masterResume = resume;
      state.careerGraph = null;
      state.tailoredResume = null;
      state.applicationPackage = null;
    }
    primeResumePreparation(resume);
    const cacheKey = analysisCacheKey(resume, job);
    const cachedAnalysis = !!state.analysisCache[cacheKey];
    let result = cachedAnalysis ? JSON.parse(JSON.stringify(state.analysisCache[cacheKey])) : null;
    if (!result) {
      result = await deepAnalyze(resume, job, {analysisMode:"tailored-resume"});
      state.analysisCache[cacheKey] = JSON.parse(JSON.stringify(result));
      const cacheKeys = Object.keys(state.analysisCache);
      cacheKeys.slice(0, Math.max(0, cacheKeys.length - 12)).forEach(key => delete state.analysisCache[key]);
    }
    const frozenModel = scannerModelForText(resume, result.keywords || [], job);
    result.keywords = frozenModel.items;
    result.keywordStats = {score:frozenModel.score, matched:frozenModel.matched, missing:frozenModel.missing, total:frozenModel.total, model:"weighted-keyword-v1"};
    result.scores = Object.assign({}, result.scores, {requirementMatch:frozenModel.score});
    renderScan(result);
    state.tailoredResume = null;
    state.applicationPackage = null;
    const scanRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt:new Date().toISOString(),
      result,
      resumeSnapshot: resume.slice(0,30000),
      jobSnapshot: job.slice(0,30000),
      scoringModel: {version:"weighted-keyword-v1", jobText:job.slice(0,30000), keywords:JSON.parse(JSON.stringify(frozenModel.items))},
      analysisCacheKey: cacheKey,
      analysisSource: cachedAnalysis ? "cache" : "server"
    };
    state.scans.unshift(scanRecord);
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
    resumeVersionId: null,
    createdAt: new Date().toISOString()
  });
  persist(); renderDashboard(); toast("Application saved to pipeline");
});

$("clearLocalData").addEventListener("click", () => {
  if (!confirm("Reset all Deep Nexivra local career data on this browser?")) return;
  ["dn_master_resume","dn_evidence","dn_scans","dn_applications","dn_career_graph","dn_resume_source","dn_tailored_resume","dn_resume_versions","dn_analysis_cache","dn_application_package","dn_change_history","dn_history_index","dn_agent_jobs"].forEach(k => localStorage.removeItem(k));
  state.masterResume = ""; state.evidence = []; state.scans = []; state.applications = []; state.careerGraph = null; state.resumeSource = null; state.tailoredResume = null; state.resumeVersions = []; state.analysisCache = {}; state.applicationPackage = null; state.changeHistory = []; state.historyIndex = -1; state.careerAgentJobs = []; state.importedResumeText = ""; state.importedFile = null; state.latest = null;
  $("resumeInput").value = ""; $("jobInput").value = ""; $("scanResults").classList.add("hidden");
  persist(); renderDashboard(); toast("Local data reset");
});


function initializeSimplifiedWorkflow() {
  document.body.classList.add("simplified-product");

  const uploadMount = $("matchResumeUpload");
  const uploadPanel = document.querySelector("#view-resume .upload-panel");
  if (uploadMount && uploadPanel && uploadPanel.parentElement !== uploadMount) {
    uploadPanel.classList.add("match-upload-panel");
    const eyebrow = uploadPanel.querySelector(".eyebrow");
    const heading = uploadPanel.querySelector("h3");
    const tag = uploadPanel.querySelector(".tag");
    const zoneStrong = uploadPanel.querySelector(".upload-zone strong");
    const zoneSmall = uploadPanel.querySelector(".upload-zone small");
    if (eyebrow) eyebrow.textContent = "Resume";
    if (heading) heading.textContent = "Upload your resume";
    if (tag) tag.textContent = "Required";
    if (zoneStrong) zoneStrong.textContent = "Drop your resume here or choose a file";
    if (zoneSmall) zoneSmall.textContent = "PDF, DOCX, or TXT · Deep Nexivra extracts it automatically.";
    uploadMount.appendChild(uploadPanel);
  }

  switchView("match");
}

initializeSimplifiedWorkflow();
renderDashboard();
refreshCloudStatus();
