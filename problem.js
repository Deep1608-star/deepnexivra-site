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
        <p class="eyebrow">BRING US A PROBLEM</p>
        <h2>Tell us what feels <em>harder to run</em> than it should.</h2>
        <p>This is a direct intake for Deep Nexivra. Share the operating issue and enough business context for a human follow-up.</p>
        <div class="privacy-lock"><i>⌁</i><div><strong>Human review only</strong><span>No AI diagnosis, automated recommendations, or instant operations report.</span></div></div>
      </div>
      <form class="problem-form" id="problem-form" novalidate>
        <div class="problem-progress" aria-hidden="true"><i class="active"></i><i></i><i></i></div>
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
          <small>03 · Contact</small><h3>Send it to Deep Nexivra.</h3>
          <div class="field-grid"><div class="field"><label for="problem-name">Name</label><input id="problem-name" name="name" type="text" maxlength="100" autocomplete="name" required></div><div class="field"><label for="problem-email">Email</label><input id="problem-email" name="email" type="email" maxlength="160" autocomplete="email" required></div><div class="field full"><label for="problem-company">Company</label><input id="problem-company" name="company" type="text" maxlength="140" autocomplete="organization" required></div></div>
          <label class="intake-consent"><input type="checkbox" name="consent" required> <span>I agree to send this information to Deep Nexivra for a human follow-up about this operating problem.</span></label>
          <p class="problem-status" id="problem-status" role="status" aria-live="polite"></p>
          <div class="problem-actions"><button class="problem-back" type="button">← Back</button><button class="problem-submit" type="submit">Send problem →</button></div>
        </div>
      </form>
    </div>`;

  const form = section.querySelector('#problem-form');
  const steps = [...form.querySelectorAll('.form-step')];
  const bars = [...form.querySelectorAll('.problem-progress i')];
  const textarea = form.querySelector('#problem-description');
  const count = form.querySelector('#problem-count');
  const status = form.querySelector('#problem-status');
  let current = 0;

  const show = (next) => {
    current = Math.max(0, Math.min(steps.length - 1, next));
    steps.forEach((step, i) => step.classList.toggle('active', i === current));
    bars.forEach((bar, i) => bar.classList.toggle('active', i <= current));
  };
  const valid = () => {
    if (current === 0 && !form.querySelector('input[name="function"]:checked')) { form.querySelector('input[name="function"]')?.reportValidity(); return false; }
    for (const field of steps[current].querySelectorAll('input:not([type="radio"]), textarea, select')) { if (!field.checkValidity()) { field.reportValidity(); return false; } }
    return true;
  };

  form.querySelectorAll('.problem-next').forEach((button)=>button.addEventListener('click',()=>{ if(valid()) show(current+1); }));
  form.querySelectorAll('.problem-back').forEach((button)=>button.addEventListener('click',()=>show(current-1)));
  textarea.addEventListener('input',()=>{ count.textContent = `${textarea.value.length} / 2200`; });

  const chooseFunction = (focus) => { const input = form.querySelector(`input[name="function"][value="${focus}"]`); if(input) input.checked = true; };
  const selected = document.querySelector('.ops-console')?.dataset.focus;
  if(selected && selected !== 'ALL') chooseFunction(selected);
  window.addEventListener('deepnexivra:operation-focus',(event)=>{ if(event.detail?.locked && event.detail.focus !== 'ALL') chooseFunction(event.detail.focus); });

  form.addEventListener('submit',(event)=>{
    event.preventDefault();
    if(!valid()) return;
    status.className = 'problem-status';
    status.textContent = 'Preview mode: the private delivery channel is not connected yet, so this information has not been sent.';
  });

  document.querySelector('.header-cta')?.setAttribute('href','#contact');
  const primary = document.querySelector('.hero .button.primary');
  if(primary){ primary.setAttribute('href','#contact'); primary.innerHTML='Bring us an operations problem <span>→</span>'; }
  document.querySelector('.ops-cta')?.setAttribute('href','#contact');
}

buildProblemIntake();
