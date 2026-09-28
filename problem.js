const problemStyles = document.createElement('link');
problemStyles.rel = 'stylesheet';
problemStyles.href = '/problem.css';
document.head.appendChild(problemStyles);

const functionOptions = [
  ['REVENUE', 'Revenue & Sales'], ['MARKETING', 'Marketing'], ['PROJECTS', 'Projects'],
  ['PRODUCT', 'Product'], ['FINANCE', 'Finance'], ['PEOPLE', 'People & Workforce'],
  ['SUPPLY', 'Supply Chain'], ['SERVICE', 'Service & Delivery'], ['SYSTEMS', 'Systems & Automation']
];

function buildProblemIntake() {
  const section = document.querySelector('#contact');
  if (!section || section.dataset.problemReady) return;
  section.dataset.problemReady = 'true';
  section.classList.add('problem-intake');
  section.innerHTML = `
    <div class="problem-shell">
      <div class="problem-intro">
        <p class="eyebrow">PRIVATE CASE ENTRY</p>
        <h2>Bring the part of the business that feels <em>harder to run</em> than it should.</h2>
        <p>Give Deep Nexivra the operating context. The diagnosis, judgment, and next move stay human.</p>
        <div class="privacy-lock"><i>⌁</i><div><strong>Direct review</strong><span>No public diagnosis, automated recommendation, or instant answer.</span></div></div>
      </div>
      <form class="problem-form" id="problem-form" novalidate>
        <div class="problem-progress" aria-hidden="true"><i class="active"></i><i></i><i></i></div>
        <input class="hp-field" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <input type="hidden" name="signal" id="problem-signal" value="">
        <div class="room-context" id="room-context" hidden><small>OPERATING ROOM SIGNAL</small><strong></strong></div>
        <div class="form-step active" data-step="0">
          <small>01 · Operating area</small><h3>Where is the friction showing up?</h3>
          <div class="choice-grid" role="radiogroup" aria-label="Business function">
            ${functionOptions.map(([value,label],i)=>`<div class="choice"><input type="radio" id="fn-${i}" name="function" value="${value}" ${i===0?'required':''}><label for="fn-${i}">${label}</label></div>`).join('')}
          </div>
          <div class="problem-actions"><span></span><button class="problem-next" type="button">Continue →</button></div>
        </div>
        <div class="form-step" data-step="1">
          <small>02 · The problem</small><h3>What is happening?</h3>
          <div class="field full"><label for="problem-description">Describe the operating problem</label><textarea id="problem-description" name="problem" maxlength="2200" minlength="30" required placeholder="What keeps breaking, slowing down, creating rework, causing confusion, or depending too much on you?"></textarea><div class="field-meta"><span>Specific examples are useful.</span><span id="problem-count">0 / 2200</span></div></div>
          <div class="field-grid"><div class="field"><label for="company-size">Company size</label><select id="company-size" name="companySize" required><option value="">Select</option><option>1–10</option><option>11–50</option><option>51–200</option><option>201–500</option><option>501+</option></select></div><div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency" required><option value="">Select</option><option>Exploring</option><option>This quarter</option><option>This month</option><option>Urgent / active issue</option></select></div></div>
          <div class="problem-actions"><button class="problem-back" type="button">← Back</button><button class="problem-next" type="button">Continue →</button></div>
        </div>
        <div class="form-step" data-step="2">
          <small>03 · Contact</small><h3>Put the case in front of Deep.</h3>
          <div class="field-grid"><div class="field"><label for="problem-name">Name</label><input id="problem-name" name="name" type="text" maxlength="100" autocomplete="name" required></div><div class="field"><label for="problem-email">Email</label><input id="problem-email" name="email" type="email" maxlength="160" autocomplete="email" required></div><div class="field full"><label for="problem-company">Company</label><input id="problem-company" name="company" type="text" maxlength="140" autocomplete="organization" required></div></div>
          <label class="conversation-request"><input type="checkbox" name="requestConversation"> <span><strong>Request a private conversation with Deep</strong><small>If this case is a fit, I would like to discuss it directly.</small></span></label>
          <label class="intake-consent"><input type="checkbox" name="consent" required> <span>I agree to send this information to Deep Nexivra for a human follow-up about this operating problem.</span></label>
          <p class="problem-status" id="problem-status" role="status" aria-live="polite"></p>
          <div class="problem-actions"><button class="problem-back" type="button">← Back</button><button class="problem-submit" type="submit">Send case →</button></div>
        </div>
      </form>
    </div>`;

  const form = section.querySelector('#problem-form');
  const steps = [...form.querySelectorAll('.form-step')];
  const bars = [...form.querySelectorAll('.problem-progress i')];
  const textarea = form.querySelector('#problem-description');
  const count = form.querySelector('#problem-count');
  const status = form.querySelector('#problem-status');
  const submit = form.querySelector('.problem-submit');
  const signalInput = form.querySelector('#problem-signal');
  const roomContext = form.querySelector('#room-context');
  let current = 0;

  const show = (next) => {
    current = Math.max(0, Math.min(steps.length - 1, next));
    steps.forEach((step, i) => step.classList.toggle('active', i === current));
    bars.forEach((bar, i) => bar.classList.toggle('active', i <= current));
  };

  const valid = () => {
    if (current === 0 && !form.querySelector('input[name="function"]:checked')) {
      form.querySelector('input[name="function"]')?.reportValidity();
      return false;
    }
    for (const field of steps[current].querySelectorAll('input:not([type="radio"]), textarea, select')) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  };

  const setSignal = (line = '') => {
    const value = String(line || '').trim().slice(0, 240);
    signalInput.value = value;
    roomContext.hidden = !value;
    const strong = roomContext.querySelector('strong');
    if (strong) strong.textContent = value;
    if (value) sessionStorage.setItem('deepnexivra:operating-signal', value);
  };

  const storedSignal = sessionStorage.getItem('deepnexivra:operating-signal');
  if (storedSignal) setSignal(storedSignal);
  window.addEventListener('deepnexivra:operating-signal', (event) => setSignal(event.detail?.line || ''));

  form.querySelectorAll('.problem-next').forEach((button) => button.addEventListener('click', () => { if (valid()) show(current + 1); }));
  form.querySelectorAll('.problem-back').forEach((button) => button.addEventListener('click', () => show(current - 1)));
  textarea.addEventListener('input', () => { count.textContent = `${textarea.value.length} / 2200`; });

  const chooseFunction = (focus) => {
    const input = form.querySelector(`input[name="function"][value="${focus}"]`);
    if (input) input.checked = true;
  };
  const selected = document.querySelector('.ops-console')?.dataset.focus;
  if (selected && selected !== 'ALL') chooseFunction(selected);
  window.addEventListener('deepnexivra:operation-focus', (event) => {
    if (event.detail?.locked && event.detail.focus !== 'ALL') chooseFunction(event.detail.focus);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!valid()) return;

    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.consent = form.elements.consent.checked;
    payload.requestConversation = form.elements.requestConversation.checked;

    submit.disabled = true;
    status.className = 'problem-status';
    status.textContent = 'Sending the case securely…';

    try {
      const response = await fetch('/api/operating-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 503 && result.error === 'delivery_not_configured') {
          throw new Error('delivery_not_configured');
        }
        throw new Error(result.error || 'delivery_failed');
      }

      sessionStorage.removeItem('deepnexivra:operating-signal');
      form.innerHTML = `
        <div class="problem-success visible">
          <div class="success-mark">✓</div>
          <strong>The case is in.</strong>
          <p>Deep Nexivra received the operating problem${payload.requestConversation ? ' and your request for a private conversation' : ''}. No automated diagnosis was generated.</p>
          ${result.bookingUrl ? `<a class="problem-booking" href="${result.bookingUrl}" target="_blank" rel="noopener">Book a private conversation <span>→</span></a>` : ''}
        </div>`;
    } catch (error) {
      status.className = 'problem-status error';
      status.textContent = error.message === 'delivery_not_configured'
        ? 'Private delivery is not configured on this preview yet, so nothing was sent.'
        : 'The case could not be sent right now. Nothing was submitted. Please try again.';
      submit.disabled = false;
    }
  });
}

buildProblemIntake();
