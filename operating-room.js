const roomStyles = document.createElement('link');
roomStyles.rel = 'stylesheet';
roomStyles.href = '/operating-room.css';
document.head.appendChild(roomStyles);

const roomSignals = [
  { line: 'We hired more people. It did not get faster.', note: 'More capacity did not remove the operating friction.' },
  { line: 'Everything still comes back to me.', note: 'The business moves, but too much still depends on one person.' },
  { line: 'Sales says sold. Operations says impossible.', note: 'The promise and the operating reality are not moving together.' },
  { line: 'We have dashboards. We still cannot see what is stuck.', note: 'There is information everywhere, but not enough operating visibility.' },
  { line: 'Every urgent problem becomes a meeting.', note: 'The system is reacting faster than it is resolving.' },
  { line: 'Everyone is busy. The output barely moves.', note: 'Activity is high, but flow is weak.' }
];

function buildOperatingRoom() {
  const operations = document.querySelector('#operations');
  if (!operations || document.querySelector('#operating-room')) return;

  const section = document.createElement('section');
  section.id = 'operating-room';
  section.className = 'section shell operating-room';
  section.innerHTML = `
    <div class="section-kicker"><span>04</span><p>THE OPERATING ROOM</p></div>
    <div class="or-heading">
      <h2>Some business problems do not need another meeting. They need a closer look.</h2>
      <p>No public diagnosis. No instant score. No automated answer. If something in the business feels harder to run than it should, bring the real case.</p>
    </div>
    <div class="or-frame">
      <div class="or-toolbar"><div><span>PRIVATE CASE ENTRY</span><strong>DEEP NEXIVRA</strong></div><em>ONE PROBLEM · HUMAN JUDGMENT · DIRECT REVIEW</em></div>
      <div class="or-body">
        <div class="or-left">
          <div>
            <span class="or-case-label">Operating signal</span>
            <h3>Which sentence feels a little too <em>familiar?</em></h3>
          </div>
          <div class="or-left-copy"><p>You do not need to know the root cause before you reach out. Start with the part that keeps creating friction, delay, confusion, dependence, rework, or unnecessary effort.</p><span class="or-seal"><i></i> The thinking stays private</span></div>
        </div>
        <div class="or-right">
          <small>Select the one closest to what you are seeing</small>
          <div class="or-signals">
            ${roomSignals.map((signal,index)=>`<button type="button" class="or-signal" data-index="${index}"><i>${String(index+1).padStart(2,'0')}</i><strong>${signal.line}</strong><span>→</span></button>`).join('')}
          </div>
          <div class="or-reveal" id="or-reveal">
            <div class="or-reveal-copy"><small>THAT IS ENOUGH TO START</small><strong id="or-reveal-title">Pick the signal that feels familiar.</strong><p id="or-reveal-note">No explanation will be generated here. The next step is simply to bring the real operating problem to Deep Nexivra.</p></div>
            <a class="or-enter" href="#contact">Enter the Operating Room <span>→</span></a>
          </div>
        </div>
      </div>
      <div class="or-footnote"><span>THE WEBSITE STOPS HERE.</span><strong>THE REAL WORK STARTS WITH THE CONVERSATION.</strong></div>
    </div>`;

  operations.insertAdjacentElement('afterend', section);

  const nav = document.querySelector('.site-header nav');
  nav?.querySelector('a[href="#thinking"]')?.remove();
  if (nav && !nav.querySelector('a[href="#operating-room"]')) {
    const link = document.createElement('a');
    link.href = '#operating-room';
    link.textContent = 'Operating Room';
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

  const reveal = section.querySelector('#or-reveal');
  const revealTitle = section.querySelector('#or-reveal-title');
  const revealNote = section.querySelector('#or-reveal-note');
  section.querySelectorAll('.or-signal').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.index);
    const signal = roomSignals[index];
    section.querySelectorAll('.or-signal').forEach(item => item.classList.toggle('active', item === button));
    reveal.classList.add('active');
    revealTitle.textContent = signal.line;
    revealNote.textContent = signal.note;
  }));
}

buildOperatingRoom();
