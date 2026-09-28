const thinkingStyles = document.createElement('link');
thinkingStyles.rel = 'stylesheet';
thinkingStyles.href = '/thinking.css';
document.head.appendChild(thinkingStyles);

const thinkingScenarios = {
  growth: {
    label: 'Growth is creating chaos',
    note: 'Demand is rising faster than the operating system can absorb.',
    summary: 'Growth can expose weak ownership, overloaded handoffs, invisible capacity limits, and decision latency.',
    lenses: [
      ['Problem', 'What exactly is getting harder as volume rises?', ['Where is work visibly slowing down?', 'What new failure appears only at higher volume?', 'What is everyone calling the problem?'], 'I am separating the symptom from the operating failure underneath it.'],
      ['Process', 'How does the work actually move today?', ['What enters the process?', 'What are the real steps, not the documented ones?', 'Where does work wait or loop backward?'], 'I am looking for the real flow of work and where complexity entered it.'],
      ['Ownership', 'Who owns each decision and handoff?', ['Where does ownership change?', 'Which decisions need a person who is not clearly accountable?', 'Where do two teams both think the other team owns it?'], 'I am looking for ambiguity that becomes expensive as volume grows.'],
      ['Capacity', 'What can the system truly absorb?', ['Which role or step reaches its limit first?', 'Is capacity visible before failure?', 'How much work depends on one person or specialist?'], 'I am looking for the first constraint, not the loudest team.'],
      ['Handoffs', 'Where does work lose momentum between people or teams?', ['What information is repeatedly re-explained?', 'Where does a request arrive incomplete?', 'Which handoff creates the most chasing?'], 'I am looking for delay created by coordination, not by the work itself.'],
      ['Metrics', 'What tells us the system is becoming unstable?', ['What do we measure before the customer feels the issue?', 'Can we see queue, age, capacity, quality and exceptions?', 'Which metric triggers action?'], 'I am looking for operating visibility, not reporting for its own sake.'],
      ['System', 'What must become repeatable before we add more people or tools?', ['Which decisions can be standardized?', 'What should become an SOP, rule, cadence or control?', 'Where can technology support an already-clear process?'], 'I am looking for the minimum operating system needed to scale.'],
      ['Execution', 'How will the new system become normal behavior?', ['Who must adopt the change?', 'What changes in meetings, tools and ownership?', 'How will drift back into the old way be detected?'], 'I am looking for implementation that survives after the redesign meeting ends.']
    ]
  },
  delivery: {
    label: 'Delivery keeps slipping',
    note: 'Deadlines move, queues grow, and teams spend more time explaining than delivering.',
    summary: 'Delivery problems often sit across planning, priorities, dependencies, capacity, escalation, and quality—not in one team.',
    lenses: [
      ['Problem', 'What does “late” actually mean in this system?', ['Which work is late most often?', 'Is the issue start delay, execution delay or completion delay?', 'What changed before performance declined?'], 'I am defining the failure precisely enough to trace it.'],
      ['Process', 'What path does work take from commitment to completion?', ['Where does work enter?', 'How are priorities changed after work starts?', 'Where are dependencies discovered?'], 'I am mapping the path from promise to delivered value.'],
      ['Ownership', 'Who can make the decisions that keep work moving?', ['Who owns priority conflicts?', 'Who can unblock a dependency?', 'Where does escalation stop?'], 'I am testing whether accountability matches decision authority.'],
      ['Capacity', 'Is the problem too much work, the wrong work, or uneven capacity?', ['How much work is active at once?', 'Which skills are chronically overloaded?', 'How much capacity is consumed by exceptions?'], 'I am looking for overload and work-in-progress that the team may have normalized.'],
      ['Handoffs', 'Which transfer creates the most waiting?', ['What has to be approved before the next step?', 'Where does work bounce back for missing information?', 'Which dependency is outside the team’s control?'], 'I am looking for queue time hidden between active-work steps.'],
      ['Metrics', 'Can we see lateness before the due date?', ['Do we track work age and blocked time?', 'Can we distinguish active time from waiting time?', 'Do we know why work misses commitment?'], 'I am looking for leading indicators instead of post-mortem reporting.'],
      ['System', 'What operating rules would make delivery more predictable?', ['How should intake be controlled?', 'What deserves escalation?', 'What cadence should surface risks and dependencies?'], 'I am looking for a system that protects flow from constant reprioritization.'],
      ['Execution', 'How do we make predictability part of the operating rhythm?', ['Which behaviors must change first?', 'Who reviews flow and exceptions?', 'How do we prevent urgent work from becoming the default?'], 'I am looking for disciplined execution, not a one-time recovery push.']
    ]
  },
  handoffs: {
    label: 'Sales and operations are disconnected',
    note: 'Promises are made upstream that create pain downstream.',
    summary: 'Cross-functional friction usually comes from mismatched definitions, ownership, information, incentives, and timing.',
    lenses: [
      ['Problem', 'Where does the promise stop matching operational reality?', ['What gets promised that operations struggles to deliver?', 'Where do expectations change after the sale?', 'Which complaints repeat?'], 'I am locating the exact gap between commercial commitment and delivery capability.'],
      ['Process', 'How does a customer commitment become executable work?', ['What information is captured before handoff?', 'What must operations clarify later?', 'Where does scope change?'], 'I am tracing the conversion of a promise into work.'],
      ['Ownership', 'Who owns the handoff—not just each department?', ['Who confirms readiness?', 'Who resolves scope ambiguity?', 'Who owns exceptions after the customer has committed?'], 'I am looking for ownership across the seam between functions.'],
      ['Capacity', 'Does commercial demand reflect operational capacity?', ['Can sales see constraints?', 'Can operations see future demand?', 'What happens when demand exceeds capability?'], 'I am looking for whether demand and capacity are managed as one system.'],
      ['Handoffs', 'What has to be true before work crosses the boundary?', ['What information is mandatory?', 'What definition of “ready” do both teams share?', 'Where does work get rejected or sent back?'], 'I am looking for a clean acceptance contract between functions.'],
      ['Metrics', 'Do both teams see the same outcomes?', ['Is handoff quality measured?', 'Can we trace downstream rework to upstream decisions?', 'Which metric encourages the wrong behavior?'], 'I am testing whether incentives and measurement pull the teams in opposite directions.'],
      ['System', 'What shared operating mechanism is missing?', ['Do we need stage gates, service levels or readiness rules?', 'What information should move automatically?', 'Which exceptions need a defined path?'], 'I am looking for a cross-functional system instead of more meetings.'],
      ['Execution', 'How will both teams operate the shared system?', ['Who owns adoption on each side?', 'What changes in CRM, intake and delivery tools?', 'How are disputes resolved quickly?'], 'I am looking for a handoff that works under pressure, not only when everyone remembers the process.']
    ]
  },
  founder: {
    label: 'The founder is still the bottleneck',
    note: 'Too many approvals, decisions, exceptions, and customer issues still route through one person.',
    summary: 'Founder dependence is usually a system-design problem: decision rights, standards, visibility, capability, and escalation are not mature enough yet.',
    lenses: [
      ['Problem', 'What specifically cannot move without the founder?', ['Which decisions wait?', 'Which exceptions always escalate?', 'What knowledge exists only in one person’s head?'], 'I am identifying the dependency instead of simply saying “delegate more.”'],
      ['Process', 'Where has founder involvement become a process step?', ['Which workflows include informal approval?', 'Where do teams stop and ask?', 'What work returns to the founder repeatedly?'], 'I am looking for founder involvement that became embedded in the workflow.'],
      ['Ownership', 'Which decisions can have a real owner?', ['Who is closest to the information?', 'What decision can move one level down?', 'What remains genuinely founder-level?'], 'I am separating strategic authority from habitual involvement.'],
      ['Capacity', 'What founder time is being consumed by operating noise?', ['How much time is spent on repeat decisions?', 'Which issues could be resolved by standards?', 'Where is management capability missing?'], 'I am treating founder attention as a scarce operating resource.'],
      ['Handoffs', 'Why does work keep escalating upward?', ['What information is missing at the frontline?', 'Where are confidence and authority misaligned?', 'What exception path is undefined?'], 'I am looking for why the system cannot close the loop without escalation.'],
      ['Metrics', 'Can the founder trust the system without touching every decision?', ['What visibility is missing?', 'What thresholds should trigger escalation?', 'Which metrics indicate control versus risk?'], 'I am looking for confidence through visibility, not control through involvement.'],
      ['System', 'What must exist so decisions can move without the founder?', ['Decision rights?', 'Operating standards?', 'Management cadence?', 'Escalation thresholds?'], 'I am looking for the smallest system that safely removes dependency.'],
      ['Execution', 'How does the founder actually step out?', ['Which decisions stop coming upstairs first?', 'Who gets coaching and authority?', 'How do we handle early mistakes without pulling everything back?'], 'I am looking for a controlled transfer of operating ownership.']
    ]
  },
  approvals: {
    label: 'Too many approvals and meetings',
    note: 'The company is trying to control risk but has slowed decision flow.',
    summary: 'Approval-heavy systems often confuse visibility with permission and collaboration with attendance.',
    lenses: [
      ['Problem', 'Which decisions are slow enough to hurt execution?', ['What waits longest?', 'Which approval rarely changes the outcome?', 'What risk is the approval supposed to control?'], 'I am testing whether the control is proportional to the risk.'],
      ['Process', 'Where are approvals embedded in the workflow?', ['Which steps are sequential but could be parallel?', 'Where does work wait for a meeting?', 'Which approval exists only because “we always do it”?'], 'I am locating delay that was designed into the process.'],
      ['Ownership', 'Who should actually have the decision right?', ['Who has the context?', 'Who is accountable for the result?', 'Who is being consulted when they do not need approval authority?'], 'I am separating owner, approver, contributor and informed stakeholder.'],
      ['Capacity', 'How much management time is spent checking routine work?', ['Which leaders are approval bottlenecks?', 'How many decisions require senior attention?', 'What important work is displaced?'], 'I am looking at decision capacity as part of operating capacity.'],
      ['Handoffs', 'How many times does a decision change hands?', ['Where is context lost?', 'How often does work return with new questions?', 'Could thresholds replace case-by-case approval?'], 'I am looking for unnecessary transfer of decision responsibility.'],
      ['Metrics', 'Do we know the cost of slow decisions?', ['How long does approval take?', 'How often is approval rejected?', 'What happens downstream while work waits?'], 'I am looking for evidence that a control creates more value than delay.'],
      ['System', 'What control can replace repetitive approval?', ['Decision thresholds?', 'Policies?', 'Exception rules?', 'Audit visibility?'], 'I am looking for control by system design instead of control by queue.'],
      ['Execution', 'How do we remove approvals without creating chaos?', ['Which low-risk decisions move first?', 'What guardrails stay?', 'How are exceptions reviewed?'], 'I am looking for faster decisions with explicit boundaries.']
    ]
  },
  productivity: {
    label: 'Everyone is busy, but output is not improving',
    note: 'Activity is high while throughput, quality, or customer outcomes stay flat.',
    summary: 'Busy systems can hide too much work-in-progress, rework, unclear priorities, fragmented attention, and local optimization.',
    lenses: [
      ['Problem', 'What output should all this activity be producing?', ['What result is flat?', 'What activity has increased?', 'Where does work feel busy but not complete?'], 'I am separating effort from value-producing flow.'],
      ['Process', 'How much work starts compared with how much finishes?', ['How many active items are open?', 'Where does work pause?', 'How much motion does not change the outcome?'], 'I am looking for work-in-progress and non-value activity.'],
      ['Ownership', 'Are people clear on what “done” means?', ['Who owns completion?', 'Where does work remain shared indefinitely?', 'Which priorities conflict?'], 'I am looking for accountability that ends in outcomes, not participation.'],
      ['Capacity', 'Is capacity fragmented across too many priorities?', ['How many priorities compete at once?', 'What interrupts planned work?', 'Where are specialist skills spread too thin?'], 'I am looking for focus as a capacity decision.'],
      ['Handoffs', 'How much productive time is lost coordinating?', ['How many meetings exist to synchronize work?', 'Where is status repeatedly requested?', 'Which handoff creates rework?'], 'I am looking for coordination overhead that masquerades as productivity.'],
      ['Metrics', 'What are we rewarding: activity or completed value?', ['Are teams measured on volume started or outcomes completed?', 'Can we see cycle time and rework?', 'Which vanity metrics encourage motion?'], 'I am looking for measures that reinforce flow and quality.'],
      ['System', 'What operating rhythm would protect focus and completion?', ['How should priorities enter the system?', 'What WIP limits or review cadence are needed?', 'What visibility can replace status chasing?'], 'I am looking for a system that helps people finish before starting more.'],
      ['Execution', 'How do we make focus visible in daily behavior?', ['What stops immediately?', 'What changes in meetings?', 'How will leaders respond when new “urgent” work appears?'], 'I am looking for leadership behavior that protects the redesigned system.']
    ]
  }
};

function buildThinkingRoom() {
  const operations = document.querySelector('#operations');
  if (!operations || document.querySelector('#thinking')) return;

  const scenarioEntries = Object.entries(thinkingScenarios);
  let activeScenarioKey = scenarioEntries[0][0];
  let activeLens = 0;

  const section = document.createElement('section');
  section.id = 'thinking';
  section.className = 'section shell thinking-room thinking-anchor';
  section.innerHTML = `
    <div class="section-kicker"><span>04</span><p>HOW DEEP THINKS</p></div>
    <div class="thinking-heading">
      <div><h2>I do not start with the tool. I start with the operating system.</h2></div>
      <div><p>Pick a generic operating situation and walk through the sequence of questions I would use to understand it. This is not a diagnosis or a recommendation. It is a window into the thinking process.</p><div class="thinking-principle"><span>→</span><div><strong>The problem is rarely isolated.</strong> I follow the work across process, ownership, capacity, handoffs, measurement, system design, and execution.</div></div></div>
    </div>
    <div class="thinking-frame">
      <div class="thinking-toolbar"><div><span>STRATEGY ROOM</span><strong>DEEP NEXIVRA · OPERATING PROBLEM DECONSTRUCTION</strong></div><em>GENERIC SCENARIOS · HUMAN JUDGMENT</em></div>
      <div class="thinking-body">
        <aside class="scenario-panel"><small>Choose a situation</small><div class="scenario-list">${scenarioEntries.map(([key, scenario], index) => `<button type="button" class="scenario-button ${index===0?'active':''}" data-scenario="${key}"><strong>${scenario.label}</strong><span>${scenario.note}</span></button>`).join('')}</div></aside>
        <div class="thinking-stage">
          <div class="thinking-stage-head"><div><small>SELECTED SITUATION</small><h3 id="thinking-title"></h3><p id="thinking-summary"></p></div><div class="thinking-badge">HOW I WOULD FRAME IT</div></div>
          <div class="thinking-path" id="thinking-path"></div>
          <div class="thinking-detail">
            <div class="thinking-question"><small id="thinking-lens-label"></small><h4 id="thinking-question"></h4><ul id="thinking-prompts"></ul></div>
            <div class="thinking-signal"><small>WHAT I AM LOOKING FOR</small><strong id="thinking-signal-title"></strong><p>This lens is one part of the operating picture. I would connect it with the other lenses before deciding what should change.</p></div>
          </div>
          <div class="thinking-footer"><p>No automated answer is produced here. A real operating problem still requires context, judgment, and direct work with the people inside the system.</p><a href="#contact">Bring the real problem to Deep Nexivra <span>→</span></a></div>
        </div>
      </div>
    </div>`;

  operations.insertAdjacentElement('afterend', section);

  const nav = document.querySelector('.site-header nav');
  if (nav && !nav.querySelector('a[href="#thinking"]')) {
    const link = document.createElement('a');
    link.href = '#thinking';
    link.textContent = 'How I think';
    const engage = nav.querySelector('a[href="#engage"]');
    nav.insertBefore(link, engage || null);
  }

  const renumber = (selector, value) => {
    const el = document.querySelector(`${selector} .section-kicker span`);
    if (el) el.textContent = value;
  };
  renumber('.boundaries', '05');
  renumber('#engage', '06');
  renumber('.proof', '07');

  const title = section.querySelector('#thinking-title');
  const summary = section.querySelector('#thinking-summary');
  const path = section.querySelector('#thinking-path');
  const lensLabel = section.querySelector('#thinking-lens-label');
  const question = section.querySelector('#thinking-question');
  const prompts = section.querySelector('#thinking-prompts');
  const signal = section.querySelector('#thinking-signal-title');

  function render() {
    const scenario = thinkingScenarios[activeScenarioKey];
    const lens = scenario.lenses[activeLens];
    title.textContent = scenario.label;
    summary.textContent = scenario.summary;
    path.innerHTML = scenario.lenses.map((item, index) => `<button type="button" class="thinking-step ${index===activeLens?'active':''}" data-lens="${index}"><i>${String(index+1).padStart(2,'0')}</i><strong>${item[0]}</strong></button>`).join('');
    lensLabel.textContent = `${String(activeLens+1).padStart(2,'0')} · ${lens[0]}`;
    question.textContent = lens[1];
    prompts.innerHTML = lens[2].map(item => `<li>${item}</li>`).join('');
    signal.textContent = lens[3];
    path.querySelectorAll('.thinking-step').forEach(button => button.addEventListener('click', () => {
      activeLens = Number(button.dataset.lens);
      render();
    }));
  }

  section.querySelectorAll('.scenario-button').forEach(button => button.addEventListener('click', () => {
    activeScenarioKey = button.dataset.scenario;
    activeLens = 0;
    section.querySelectorAll('.scenario-button').forEach(item => item.classList.toggle('active', item === button));
    render();
  }));

  render();
}

buildThinkingRoom();