const labStyles = document.createElement('link');
labStyles.rel = 'stylesheet';
labStyles.href = '/lab.css';
document.head.appendChild(labStyles);

const labDefaults = { demand: 100, capacity: 95, handoff: 1.2, rework: 7, approval: 0.8, automation: 12 };
const labPresets = {
  balanced: { label: 'Balanced system', note: 'Healthy operating buffer', values: { ...labDefaults } },
  growth: { label: 'Growth spike', note: 'Demand rises before capacity', values: { demand: 148, capacity: 98, handoff: 1.6, rework: 9, approval: 1.1, automation: 12 } },
  capacity: { label: 'Capacity squeeze', note: 'Workload outruns delivery', values: { demand: 118, capacity: 72, handoff: 1.3, rework: 8, approval: 0.9, automation: 8 } },
  approval: { label: 'Approval drag', note: 'Decisions wait in the system', values: { demand: 108, capacity: 102, handoff: 1.4, rework: 7, approval: 4.2, automation: 10 } },
  rework: { label: 'Rework loop', note: 'Quality failure consumes capacity', values: { demand: 108, capacity: 105, handoff: 1.2, rework: 26, approval: 0.9, automation: 10 } },
  automation: { label: 'Automation gain', note: 'Less manual motion and delay', values: { demand: 118, capacity: 92, handoff: 0.7, rework: 5, approval: 0.5, automation: 55 } }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function calculateLab(values) {
  const automation = values.automation / 100;
  const frictionLoss = Math.min(0.36, values.handoff * 0.045 + values.approval * 0.04);
  const reworkLoad = 1 + (values.rework / 100) * 0.85;
  const effectiveCapacity = values.capacity * (1 + automation * 0.38) * (1 - frictionLoss) / reworkLoad;
  const throughput = Math.min(values.demand, effectiveCapacity);
  const backlog = Math.max(0, values.demand - throughput);
  const utilization = values.demand / Math.max(1, effectiveCapacity) * 100;
  const cycleTime = clamp(2 + values.handoff + values.approval + values.rework * 0.055 + Math.max(0, utilization - 85) * 0.055 - automation * 1.1, 0.8, 18);
  const reliability = clamp(98 - (backlog / Math.max(1, values.demand)) * 45 - values.rework * 0.55 - values.handoff * 2.6 - values.approval * 2 + automation * 10, 35, 99);
  const costPressure = clamp(100 + Math.max(0, utilization - 90) * 0.7 + values.rework * 1.1 + values.handoff * 3 + values.approval * 2 - automation * 20, 70, 180);
  const flowScore = clamp(100 - (backlog / Math.max(1, values.demand)) * 45 - Math.max(0, utilization - 90) * 0.25 - values.rework * 0.55 - values.handoff * 2.5 - values.approval * 2.3 + automation * 8, 20, 99);

  const constraints = [
    { key: 'capacity', label: 'Capacity', score: Math.max(0, utilization - 82) * 1.45, node: 'delivery' },
    { key: 'handoff', label: 'Handoff delay', score: values.handoff * 18, node: 'planning' },
    { key: 'rework', label: 'Rework', score: values.rework * 2.7, node: 'feedback' },
    { key: 'approval', label: 'Approval drag', score: values.approval * 18, node: 'finance' }
  ].sort((a, b) => b.score - a.score);
  const constraint = constraints[0].score < 16 ? { key: 'balanced', label: 'No dominant constraint', score: 0, node: '' } : constraints[0];

  return { effectiveCapacity, throughput, backlog, utilization, cycleTime, reliability, costPressure, flowScore, constraint };
}

function buildLab() {
  const operations = document.querySelector('#operations');
  if (!operations || document.querySelector('#lab')) return;

  const lab = document.createElement('section');
  lab.id = 'lab';
  lab.className = 'section shell operations-lab lab-anchor';
  lab.innerHTML = `
    <div class="section-kicker"><span>04</span><p>DEEP NEXIVRA OPERATIONS LAB</p></div>
    <div class="lab-heading">
      <div><h2>Change one operating variable. Watch the whole system move.</h2></div>
      <div><p>This is a generic business-system simulation. It demonstrates how demand, capacity, delay, rework, approvals, and automation interact across an operating flow.</p><div class="lab-note"><span>◌</span><div><strong>Simulation, not diagnosis.</strong> These are modelled scenarios — not an assessment of your company and not a recommendation engine.</div></div></div>
    </div>
    <div class="lab-frame">
      <div class="lab-toolbar">
        <div class="lab-toolbar-left"><span class="lab-live">LIVE MODEL</span><strong>BUSINESS OPERATING DIGITAL TWIN</strong></div>
        <button class="lab-reset" type="button">Reset model</button>
      </div>
      <div class="lab-body">
        <aside class="lab-controls">
          <h3>Operating conditions</h3>
          <div class="lab-presets">
            ${Object.entries(labPresets).map(([key,preset])=>`<button class="lab-preset ${key==='balanced'?'active':''}" type="button" data-preset="${key}"><strong>${preset.label}</strong><span>${preset.note}</span></button>`).join('')}
          </div>
          <div class="lab-control"><div class="lab-control-head"><label for="lab-demand">Demand</label><output data-output="demand">100 units/wk</output></div><input id="lab-demand" data-control="demand" type="range" min="60" max="170" step="1" value="100"><small>Work entering the operating system.</small></div>
          <div class="lab-control"><div class="lab-control-head"><label for="lab-capacity">Base capacity</label><output data-output="capacity">95 units/wk</output></div><input id="lab-capacity" data-control="capacity" type="range" min="55" max="150" step="1" value="95"><small>Nominal throughput before operational friction.</small></div>
          <div class="lab-control"><div class="lab-control-head"><label for="lab-handoff">Handoff delay</label><output data-output="handoff">1.2 days</output></div><input id="lab-handoff" data-control="handoff" type="range" min="0" max="5" step="0.1" value="1.2"><small>Waiting between functions or owners.</small></div>
          <div class="lab-control"><div class="lab-control-head"><label for="lab-rework">Rework rate</label><output data-output="rework">7%</output></div><input id="lab-rework" data-control="rework" type="range" min="0" max="30" step="1" value="7"><small>Capacity consumed by work that must be done again.</small></div>
          <div class="lab-control"><div class="lab-control-head"><label for="lab-approval">Approval drag</label><output data-output="approval">0.8 days</output></div><input id="lab-approval" data-control="approval" type="range" min="0" max="5" step="0.1" value="0.8"><small>Decision time added by approvals and controls.</small></div>
          <div class="lab-control"><div class="lab-control-head"><label for="lab-automation">Automation coverage</label><output data-output="automation">12%</output></div><input id="lab-automation" data-control="automation" type="range" min="0" max="60" step="1" value="12"><small>Repeatable work shifted away from manual execution.</small></div>
        </aside>
        <div class="lab-stage">
          <div class="lab-stage-top"><div><h3>System flow</h3><div class="lab-lens">OPERATING LENS <strong id="lab-lens">WHOLE BUSINESS</strong></div></div><div class="lab-constraint"><small>Current dominant constraint</small><strong id="lab-constraint">No dominant constraint</strong></div></div>
          <div class="lab-map" aria-label="Simulated business operating flow">
            <div class="lab-flow-line"></div><div class="lab-flow-pulse"><i></i><i></i><i></i></div>
            <div class="lab-nodes">
              <div class="lab-node" data-node="demand"><span class="lab-node-dot"></span><strong>Demand</strong><small>Work enters</small></div>
              <div class="lab-node" data-node="revenue"><span class="lab-node-dot"></span><strong>Revenue</strong><small>Commitment</small></div>
              <div class="lab-node" data-node="planning"><span class="lab-node-dot"></span><strong>Planning</strong><small>Decisions</small></div>
              <div class="lab-node" data-node="people"><span class="lab-node-dot"></span><strong>People</strong><small>Capacity</small></div>
              <div class="lab-node" data-node="delivery"><span class="lab-node-dot"></span><strong>Delivery</strong><small>Execution</small></div>
              <div class="lab-node" data-node="finance"><span class="lab-node-dot"></span><strong>Finance</strong><small>Control</small></div>
              <div class="lab-node" data-node="feedback"><span class="lab-node-dot"></span><strong>Feedback</strong><small>Learning</small></div>
            </div>
            <span class="lab-map-caption">WORK → DECISIONS → CAPACITY → DELIVERY → FEEDBACK</span>
          </div>
          <div class="lab-metrics">
            <div class="lab-metric" data-metric="throughput"><small>Throughput</small><strong>0</strong><span>units / week</span></div>
            <div class="lab-metric" data-metric="backlog"><small>Backlog growth</small><strong>0</strong><span>units / week</span></div>
            <div class="lab-metric" data-metric="cycle"><small>Cycle time</small><strong>0</strong><span>modelled days</span></div>
            <div class="lab-metric" data-metric="util"><small>System load</small><strong>0%</strong><span>effective capacity</span></div>
            <div class="lab-metric" data-metric="reliability"><small>Reliability</small><strong>0%</strong><span>modelled service stability</span></div>
            <div class="lab-metric" data-metric="cost"><small>Cost pressure</small><strong>0</strong><span>index · 100 baseline</span></div>
          </div>
          <div class="lab-bottom">
            <div class="lab-effects"><h4>System effects</h4><ul id="lab-effects"></ul><p class="lab-disclaimer">The model is intentionally simplified. It illustrates operating relationships; it does not predict a real company's results.</p></div>
            <div class="lab-scorecard"><h4>Flow score</h4><div class="flow-score"><div class="flow-score-ring" id="flow-score-ring"><strong id="flow-score-value">0</strong></div><div class="flow-score-copy"><strong id="flow-score-label">Calculating system state</strong><span id="flow-score-copy">Flow score combines queue pressure, utilization, rework, delay, approvals, and automation.</span></div></div></div>
          </div>
        </div>
      </div>
    </div>`;
  operations.insertAdjacentElement('afterend', lab);

  const nav = document.querySelector('.site-header nav');
  if (nav && !nav.querySelector('a[href="#lab"]')) {
    const link = document.createElement('a'); link.href = '#lab'; link.textContent = 'Lab';
    const engage = nav.querySelector('a[href="#engage"]'); nav.insertBefore(link, engage || null);
  }

  const renumber = (selector, value) => { const el = document.querySelector(`${selector} .section-kicker span`); if (el) el.textContent = value; };
  renumber('.boundaries', '05'); renumber('#engage', '06'); renumber('.proof', '07');

  const controls = [...lab.querySelectorAll('[data-control]')];
  const outputs = Object.fromEntries([...lab.querySelectorAll('[data-output]')].map(el => [el.dataset.output, el]));
  const metric = (name) => lab.querySelector(`[data-metric="${name}"]`);
  const effects = lab.querySelector('#lab-effects');
  const constraintEl = lab.querySelector('#lab-constraint');
  const scoreRing = lab.querySelector('#flow-score-ring');
  const scoreValue = lab.querySelector('#flow-score-value');
  const scoreLabel = lab.querySelector('#flow-score-label');
  const scoreCopy = lab.querySelector('#flow-score-copy');
  const particles = [...lab.querySelectorAll('.lab-flow-pulse i')];

  const getValues = () => Object.fromEntries(controls.map(control => [control.dataset.control, Number(control.value)]));
  const setValues = (values) => controls.forEach(control => { if (values[control.dataset.control] !== undefined) control.value = values[control.dataset.control]; });

  function render() {
    const values = getValues();
    const result = calculateLab(values);
    outputs.demand.value = `${Math.round(values.demand)} units/wk`;
    outputs.capacity.value = `${Math.round(values.capacity)} units/wk`;
    outputs.handoff.value = `${values.handoff.toFixed(1)} days`;
    outputs.rework.value = `${Math.round(values.rework)}%`;
    outputs.approval.value = `${values.approval.toFixed(1)} days`;
    outputs.automation.value = `${Math.round(values.automation)}%`;

    metric('throughput').querySelector('strong').textContent = result.throughput.toFixed(0);
    metric('backlog').querySelector('strong').textContent = result.backlog.toFixed(0);
    metric('cycle').querySelector('strong').textContent = result.cycleTime.toFixed(1);
    metric('util').querySelector('strong').textContent = `${result.utilization.toFixed(0)}%`;
    metric('reliability').querySelector('strong').textContent = `${result.reliability.toFixed(0)}%`;
    metric('cost').querySelector('strong').textContent = result.costPressure.toFixed(0);

    metric('backlog').dataset.tone = result.backlog > 10 ? 'warning' : 'good';
    metric('util').dataset.tone = result.utilization > 100 ? 'warning' : result.utilization < 92 ? 'good' : '';
    metric('reliability').dataset.tone = result.reliability < 75 ? 'warning' : result.reliability > 88 ? 'good' : '';
    metric('cost').dataset.tone = result.costPressure > 120 ? 'warning' : result.costPressure < 100 ? 'good' : '';

    constraintEl.textContent = result.constraint.label;
    lab.querySelectorAll('.lab-node').forEach(node => node.classList.remove('bottleneck','pressure','healthy'));
    if (result.constraint.node) lab.querySelector(`[data-node="${result.constraint.node}"]`)?.classList.add('bottleneck');
    if (result.utilization > 100) { lab.querySelector('[data-node="people"]')?.classList.add('pressure'); lab.querySelector('[data-node="delivery"]')?.classList.add('pressure'); }
    if (result.flowScore > 85) lab.querySelectorAll('.lab-node').forEach(node => node.classList.add('healthy'));

    const messages = [];
    if (result.backlog > 1) messages.push(`Demand is exceeding effective capacity by about ${result.backlog.toFixed(0)} units each week, so the queue grows.`);
    else messages.push('Effective capacity is currently keeping pace with incoming demand, so the model is not accumulating material backlog.');
    if (result.utilization > 95) messages.push(`System load is ${result.utilization.toFixed(0)}%, leaving little recovery room for variability or exceptions.`);
    else if (result.utilization < 82) messages.push(`System load is ${result.utilization.toFixed(0)}%, leaving operating buffer for variability and exceptions.`);
    if (values.rework >= 15) messages.push(`A ${values.rework.toFixed(0)}% rework rate consumes capacity that could otherwise move new work forward.`);
    if (values.handoff >= 2.2) messages.push(`Handoff waiting is materially extending modelled cycle time before work reaches delivery.`);
    if (values.approval >= 2.2) messages.push(`Approval drag is slowing decision flow even where nominal capacity exists.`);
    if (values.automation >= 35) messages.push(`Automation coverage is recovering effective capacity and reducing manual operating pressure in this model.`);
    effects.innerHTML = messages.slice(0,4).map(message => `<li>${message}</li>`).join('');

    const score = Math.round(result.flowScore);
    scoreRing.style.setProperty('--score', score);
    scoreValue.textContent = score;
    if (score >= 88) { scoreLabel.textContent = 'Coordinated flow'; scoreCopy.textContent = 'The model has capacity buffer, low friction, and relatively stable execution.'; }
    else if (score >= 72) { scoreLabel.textContent = 'Manageable friction'; scoreCopy.textContent = 'The system is operating, but one or more constraints are beginning to tax execution.'; }
    else if (score >= 55) { scoreLabel.textContent = 'Operating strain'; scoreCopy.textContent = 'Friction is now changing throughput, queues, cycle time, or reliability.'; }
    else { scoreLabel.textContent = 'System under pressure'; scoreCopy.textContent = 'Multiple operating losses are compounding and the flow is no longer stable.'; }

    const duration = clamp(4.4 - score / 32, 1.25, 3.9);
    particles.forEach((particle,index) => { particle.style.animationDuration = `${duration}s`; particle.style.opacity = result.throughput < values.demand * .65 ? '.45' : '1'; });
  }

  controls.forEach(control => control.addEventListener('input', () => {
    lab.querySelectorAll('.lab-preset').forEach(button => button.classList.remove('active'));
    render();
  }));
  lab.querySelectorAll('.lab-preset').forEach(button => button.addEventListener('click', () => {
    const preset = labPresets[button.dataset.preset];
    if (!preset) return;
    setValues(preset.values);
    lab.querySelectorAll('.lab-preset').forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
  lab.querySelector('.lab-reset')?.addEventListener('click', () => {
    setValues(labDefaults);
    lab.querySelectorAll('.lab-preset').forEach(button => button.classList.toggle('active', button.dataset.preset === 'balanced'));
    render();
  });

  const lens = lab.querySelector('#lab-lens');
  window.addEventListener('deepnexivra:operation-focus', event => {
    if (!event.detail?.locked) return;
    lens.textContent = event.detail.focus === 'ALL' ? 'WHOLE BUSINESS' : event.detail.model?.label || event.detail.focus;
  });

  render();
}

buildLab();