const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../api/career-analyze.js'), 'utf8');

// Load the actual production functions, without booting unrelated DOM handlers.
function extract(text, name, indent = '') {
  const pattern = new RegExp('^' + indent + '(?:async )?function ' + name + '\\(', 'm');
  const match = pattern.exec(text);
  assert.ok(match, name);
  const end = text.indexOf('\n' + indent + '}', match.index);
  return text.slice(match.index, end + indent.length + 2);
}
const keywords = [
  {keyword:'Excel', points:25}, {keyword:'SQL', points:25},
  {keyword:'Python', points:25}, {keyword:'Power BI', aliases:['PowerBI'], points:25}
];
const resume = terms => 'Experienced operations analyst. '.repeat(9) + terms;
function setup(terms = 'Excel SQL') {
  const editor = {value:resume(terms)};
  const scan = {result:{keywords:structuredClone(keywords)},jobSnapshot:'Excel SQL Python Power BI'};
  const previous = {text:resume('Excel')};
  const state = {tailoredResume:previous, applicationPackage:{saved:true}, changeHistory:['old'], historyIndex:0, careerGraph:{}};
  const saved = [];
  const stages = [];
  const c = {
    state, editor, scan, saved, stages, console,
    $:id => id === 'scannerLiveEditor' ? editor : null,
    latestTargetScan:()=>scan,
    scannerCurrentResumeText:()=>editor.value.trim(),
    ensureTailoringGraph:async()=>state.careerGraph,
    setAutoOptimizeStage:x=>stages.push(x),
    requestTailoredResume:async(feedback, context)=>{c.requestContext=context; return {text:resume('Excel SQL Python')};},
    boostSupportedJobTerms:x=>x,
    approvedResumePayload:(draft=state.tailoredResume)=>draft,
    resumePayloadToAnalysisText:x=>x.text,
    persist:()=>saved.push(state.tailoredResume),
    toast:()=>{}, renderScannerKeywordReport:()=>{},renderScannerChecks:()=>{},
    recordTailorState:()=>{}, renderDashboard:()=>{},renderTailoredMatchScore:()=>{},renderScannerSuggestions:()=>{},
    setTimeout:()=>{}
  };
  vm.createContext(c);
  for (const name of ['scannerNormalize','scannerPhraseCount','scannerPhrasePresent','scannerKeywordPresent','scannerModelForText','maximizeTailoredMatch']) {
    vm.runInContext(extract(source,name),c);
  }
  vm.runInContext(extract(server,'normalizeScanText','  ') + '\n' + extract(server,'phraseCount','  '),c);
  return c;
}
test('server and browser agree on punctuation, boundaries and technical terms',()=>{
  const c=setup();
  for(const [text,term,count] of [
    ['Used Excel.','Excel',1],['SQL. SQL!','SQL',2],['excellent','Excel',0],
    ['C++. C# .NET Node.js.','C++',1],['C++. C# .NET Node.js.','.NET',1],
    ['C++. C# .NET Node.js.','Node.js',1],['C++. C# .NET Node.js.','C#',1],
    ['SQL SQL SQL','SQL',3]
  ]) {
    assert.equal(c.scannerPhraseCount(text,term),count);
    assert.equal(c.phraseCount(text,term),count);
  }
});
test('score is repeatable, bounded, supports aliases/exclusion and ignores repetition',()=>{
  const c=setup();
  for(let i=0;i<20;i++) assert.equal(c.scannerModelForText('Excel.',keywords).score,25);
  assert.equal(c.scannerModelForText('Excel Excel Excel',keywords).score,25);
  assert.equal(c.scannerModelForText('',keywords).score,0);
  assert.equal(c.scannerModelForText('Excel SQL Python PowerBI.',keywords).score,100);
  assert.equal(c.scannerModelForText('Excel',[{...keywords[0]},{...keywords[1],excluded:true}]).score,100);
  assert.equal(c.scannerModelForText('',[]).score,0);
});
test('candidate below live edits is discarded, despite exceeding old draft',async()=>{
  const c=setup('Excel SQL Python');
  const previous=c.state.tailoredResume;
  c.requestTailoredResume=async()=>({text:resume('Excel SQL')});
  assert.equal(await c.maximizeTailoredMatch(),75);
  assert.equal(c.state.tailoredResume,previous);
  assert.equal(c.saved.length,0);
  assert.ok(c.state.applicationPackage.saved);
  assert.match(c.editor.value,/Excel SQL Python$/);
});
test('equal-scoring candidate is kept out with an explicit outcome',async()=>{
  const c=setup('Excel SQL Python');
  await c.maximizeTailoredMatch();
  assert.equal(c.saved.length,0);
  assert.match(c.stages.at(-1),/generated version scored 75/);
});
test('incomplete candidate cannot replace or persist over previous draft',async()=>{
  const c=setup(); const previous=c.state.tailoredResume;
  c.requestTailoredResume=async()=>({text:'short'});
  await assert.rejects(c.maximizeTailoredMatch(),/incomplete/);
  assert.equal(c.state.tailoredResume,previous);
  assert.equal(c.saved.length,0);
  assert.ok(c.state.applicationPackage.saved);
});
test('request failure preserves active draft and editor',async()=>{
  const c=setup(); const previous=c.state.tailoredResume; const text=c.editor.value;
  c.requestTailoredResume=async()=>{throw Error('network failed');};
  await assert.rejects(c.maximizeTailoredMatch(),/network failed/);
  assert.equal(c.state.tailoredResume,previous);
  assert.equal(c.editor.value,text);
  assert.equal(c.saved.length,0);
});
test('successful optimization uses live text and persists only improved candidate',async()=>{
  const c=setup(); const text=c.editor.value;
  assert.equal(await c.maximizeTailoredMatch(),75);
  assert.equal(c.requestContext.sourceText,text);
  assert.equal(c.state.tailoredResume.postTailorAnalysis.match,75);
  assert.match(c.editor.value,/Excel SQL Python$/);
  assert.equal(c.saved.length,1);
});
test('edits made during generation are not overwritten',async()=>{
  const c=setup(); const previous=c.state.tailoredResume;
  c.requestTailoredResume=async()=>{c.editor.value=resume('new manual edit'); return {text:resume('Excel SQL Python PowerBI')};};
  await c.maximizeTailoredMatch();
  assert.equal(c.state.tailoredResume,previous);
  assert.match(c.editor.value,/new manual edit$/);
  assert.equal(c.saved.length,0);
});
test('100% skips generation; empty editor is not silently replaced by saved text',async()=>{
  const c=setup('Excel SQL Python PowerBI');
  c.requestTailoredResume=async()=>{throw Error('must not call');};
  assert.equal(await c.maximizeTailoredMatch(),100);
  c.editor.value='';
  await assert.rejects(c.maximizeTailoredMatch(),/too short/);
});
