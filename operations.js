const operationModels = {
  ALL: {
    label: 'All Operations',
    short: 'OPERATIONS',
    promise: 'See the business as one connected operating system, not a collection of departments.',
    friction: ['Broken handoffs', 'Unclear ownership', 'Slow decisions', 'Invisible work'],
    redesign: ['Workflow', 'Decision rights', 'Operating cadence', 'Measurement'],
    target: ['Clear flow', 'Visible ownership', 'Faster coordination', 'Continuous improvement'],
    nodes: ['strategy', 'revenue', 'product', 'projects', 'people', 'delivery']
  },
  REVENUE: {
    label: 'Revenue & Sales',
    short: 'REVENUE',
    promise: 'Turn lead-to-revenue activity into a visible, disciplined flow instead of a collection of individual habits.',
    friction: ['Leads stall between stages', 'Follow-up depends on memory', 'Forecasts are unreliable', 'Sales-to-delivery handoffs break'],
    redesign: ['Qualification and pipeline stages', 'Ownership and response standards', 'Handoff rules and escalation', 'Forecasting and review cadence'],
    target: ['Cleaner pipeline flow', 'Consistent follow-up', 'Better handoffs', 'Higher execution visibility'],
    nodes: ['strategy', 'revenue', 'delivery']
  },
  MARKETING: {
    label: 'Marketing Operations',
    short: 'MARKETING',
    promise: 'Connect planning, content, campaigns, demand and sales handoffs into a repeatable operating rhythm.',
    friction: ['Priorities change constantly', 'Content gets stuck in approvals', 'Campaign ownership is unclear', 'Demand disappears after handoff'],
    redesign: ['Campaign workflow', 'Content production system', 'Approval and decision paths', 'Marketing-to-sales handoff'],
    target: ['Predictable cadence', 'Clear ownership', 'Fewer stalled assets', 'Closed-loop demand flow'],
    nodes: ['strategy', 'revenue', 'projects']
  },
  PROJECTS: {
    label: 'Project Operations',
    short: 'PROJECTS',
    promise: 'Create an execution system where dependencies, ownership, risk and delivery status are visible before they become emergencies.',
    friction: ['Status lives in meetings', 'Dependencies surface late', 'Ownership is ambiguous', 'Teams react instead of plan'],
    redesign: ['Planning and work breakdown', 'Dependency and risk system', 'Decision and escalation paths', 'Execution cadence and visibility'],
    target: ['Visible delivery', 'Earlier risk signals', 'Clear accountability', 'Stronger execution rhythm'],
    nodes: ['strategy', 'projects', 'people', 'delivery']
  },
  PRODUCT: {
    label: 'Product Operations',
    short: 'PRODUCT',
    promise: 'Connect customer learning, prioritization, product decisions, launches and cross-functional execution.',
    friction: ['Roadmap priorities compete', 'Feedback is fragmented', 'Launch readiness is unclear', 'Teams learn in separate loops'],
    redesign: ['Prioritization process', 'Feedback and insight flow', 'Launch operating model', 'Cross-functional decision cadence'],
    target: ['Sharper priorities', 'Visible readiness', 'Connected feedback', 'Faster learning cycles'],
    nodes: ['strategy', 'product', 'projects', 'delivery']
  },
  FINANCE: {
    label: 'Finance Operations',
    short: 'FINANCE',
    promise: 'Improve the operating flow around approvals, planning, reporting and the information leaders need to make decisions.',
    friction: ['Approvals wait in inboxes', 'Reporting is manually assembled', 'Budget ownership is unclear', 'Decision data arrives late'],
    redesign: ['Approval workflow', 'Reporting cadence', 'Ownership and controls', 'Planning-to-execution handoffs'],
    target: ['Faster visibility', 'Clearer controls', 'Cleaner approvals', 'Better decision flow'],
    nodes: ['strategy', 'projects', 'people']
  },
  PEOPLE: {
    label: 'People & Workforce Operations',
    short: 'PEOPLE',
    promise: 'Design roles, capacity, standards and communication so teams can execute without depending on constant intervention.',
    friction: ['Roles overlap or leave gaps', 'Capacity is reactive', 'Knowledge lives with individuals', 'Accountability changes by situation'],
    redesign: ['Role and decision clarity', 'Capacity and staffing logic', 'SOP and training system', 'Communication and review cadence'],
    target: ['Clear roles', 'Better capacity visibility', 'Repeatable execution', 'Stronger accountability'],
    nodes: ['strategy', 'people', 'projects', 'delivery']
  },
  SUPPLY: {
    label: 'Supply Chain Operations',
    short: 'SUPPLY CHAIN',
    promise: 'Make demand, sourcing, inventory, movement, suppliers and exceptions visible as one connected flow.',
    friction: ['Exceptions are found late', 'Inventory signals are disconnected', 'Supplier handoffs lack ownership', 'Service levels are hard to explain'],
    redesign: ['Demand and replenishment flow', 'Exception management', 'Supplier operating cadence', 'Inventory and service visibility'],
    target: ['Earlier exception signals', 'Cleaner handoffs', 'Visible inventory logic', 'More reliable flow'],
    nodes: ['strategy', 'delivery', 'projects', 'people']
  },
  SERVICE: {
    label: 'Service & Delivery Operations',
    short: 'DELIVERY',
    promise: 'Turn incoming work, queues, capacity, quality and escalation into a controllable service system.',
    friction: ['Queues grow invisibly', 'Urgent work overrides everything', 'Escalations are inconsistent', 'Quality issues create rework'],
    redesign: ['Work intake and prioritization', 'Queue and capacity logic', 'Quality controls', 'Escalation and service standards'],
    target: ['Visible workload', 'Predictable prioritization', 'Cleaner escalation', 'More reliable delivery'],
    nodes: ['delivery', 'people', 'projects']
  },
  SYSTEMS: {
    label: 'Systems & Automation',
    short: 'SYSTEMS',
    promise: 'Use technology as an operating layer—after the process is understood—not as a substitute for process design.',
    friction: ['Tools duplicate the same work', 'Data is re-entered manually', 'Automation preserves bad process', 'Dashboards measure without changing decisions'],
    redesign: ['Tool architecture', 'Automation opportunities', 'System-to-system handoffs', 'Decision-support and measurement'],
    target: ['Less manual motion', 'Connected information', 'Practical automation', 'Better decision visibility'],
    nodes: ['strategy', 'revenue', 'product', 'projects', 'people', 'delivery']
  }
};

function list(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function buildOperationsConsole() {
  const section = document.querySelector('.operations');
  const grid = section?.querySelector('.operations-grid');
  if (!section || !grid || section.querySelector('.ops-console')) return;

  const consoleEl = document.createElement('div');
  consoleEl.className = 'ops-console';
  consoleEl.innerHTML = `
    <div class="ops-map" aria-hidden="true">
      <div class="ops-orbit ops-orbit-a"></div>
      <div class="ops-orbit ops-orbit-b"></div>
      <div class="ops-center"><span>OPERATIONS</span><strong>FLOW</strong></div>
      <i class="ops-node ops-node-strategy">Strategy</i>
      <i class="ops-node ops-node-revenue">Revenue</i>
      <i class="ops-node ops-node-product">Product</i>
      <i class="ops-node ops-node-projects">Projects</i>
      <i class="ops-node ops-node-people">People</i>
      <i class="ops-node ops-node-delivery">Delivery</i>
    </div>
    <div class="ops-detail" aria-live="polite">
      <div class="ops-detail-top"><span>SELECT A BUSINESS FUNCTION</span><strong id="ops-active-title">${operationModels.ALL.label}</strong></div>
      <p id="ops-active-promise">${operationModels.ALL.promise}</p>
      <div class="ops-detail-columns">
        <div><small>COMMON FRICTION</small><ul id="ops-friction">${list(operationModels.ALL.friction)}</ul></div>
        <div><small>WE REDESIGN</small><ul id="ops-redesign">${list(operationModels.ALL.redesign)}</ul></div>
        <div><small>TARGET STATE</small><ul id="ops-target">${list(operationModels.ALL.target)}</ul></div>
      </div>
      <a class="ops-cta" href="#engage">Bring this operating problem to Deep Nexivra <span>→</span></a>
    </div>`;

  grid.before(consoleEl);

  const activeTitle = consoleEl.querySelector('#ops-active-title');
  const activePromise = consoleEl.querySelector('#ops-active-promise');
  const friction = consoleEl.querySelector('#ops-friction');
  const redesign = consoleEl.querySelector('#ops-redesign');
  const target = consoleEl.querySelector('#ops-target');
  const center = consoleEl.querySelector('.ops-center strong');
  const cards = [...grid.querySelectorAll('.operation-card')];
  const heroCore = document.querySelector('.core-stage');
  const coreFocus = document.getElementById('core-focus');
  const coreSubcopy = document.querySelector('.hud-center small');
  const coreLabels = [...document.querySelectorAll('.core-label')];
  let lockedFocus = 'ALL';

  cards.forEach((card) => {
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', `Explore ${card.querySelector('h3')?.textContent || card.dataset.focus} operations`);
  });

  const apply = (focus, lock = false) => {
    const model = operationModels[focus] || operationModels.ALL;
    if (lock) lockedFocus = focus;

    activeTitle.textContent = model.label;
    activePromise.textContent = model.promise;
    friction.innerHTML = list(model.friction);
    redesign.innerHTML = list(model.redesign);
    target.innerHTML = list(model.target);
    center.textContent = model.short;
    consoleEl.dataset.focus = focus;

    cards.forEach((card) => {
      const selected = card.dataset.focus === focus && focus !== 'ALL';
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    consoleEl.querySelectorAll('.ops-node').forEach((node) => node.classList.remove('active'));
    model.nodes.forEach((node) => consoleEl.querySelector(`.ops-node-${node}`)?.classList.add('active'));

    if (heroCore) heroCore.dataset.operation = focus;
    if (coreFocus) coreFocus.textContent = model.short;
    if (coreSubcopy) coreSubcopy.textContent = focus === 'ALL' ? 'FRICTION → SYSTEM → EXECUTION' : 'FUNCTION → FLOW → EXECUTION';

    const labelMap = {
      strategy: '.label-strategy', revenue: '.label-revenue', product: '.label-product',
      projects: '.label-projects', people: '.label-people', delivery: '.label-delivery'
    };
    coreLabels.forEach((label) => label.classList.remove('operation-active'));
    model.nodes.forEach((node) => document.querySelector(labelMap[node])?.classList.add('operation-active'));

    window.dispatchEvent(new CustomEvent('deepnexivra:operation-focus', { detail: { focus, model, locked: lock } }));
  };

  cards.forEach((card) => {
    const focus = card.dataset.focus || 'ALL';
    card.addEventListener('click', () => apply(focus, true));
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      apply(focus, true);
    });
    card.addEventListener('pointerenter', () => {
      if (window.matchMedia('(hover: hover)').matches) apply(focus, false);
    });
    card.addEventListener('pointerleave', () => {
      if (window.matchMedia('(hover: hover)').matches) apply(lockedFocus, false);
    });
    card.addEventListener('focus', () => apply(focus, false));
    card.addEventListener('blur', () => apply(lockedFocus, false));
  });

  apply('ALL', true);
}

buildOperationsConsole();
