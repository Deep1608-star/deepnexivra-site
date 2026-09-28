const roomStyles = document.createElement('link');
roomStyles.rel = 'stylesheet';
roomStyles.href = '/operating-room.css';
document.head.appendChild(roomStyles);

const roomSignals = [
  'We hired more people. It did not get faster.',
  'Everything still comes back to me.',
  'Sales says sold. Operations says impossible.',
  'We have dashboards. We still cannot see what is stuck.',
  'Every urgent problem becomes a meeting.',
  'Everyone is busy. The output barely moves.'
];

function routeIntoOperatingRoom() {
  const header = document.querySelector('.header-cta');
  if (header) {
    header.setAttribute('href', '#operating-room');
    header.innerHTML = 'Enter Operating Room <span>↗</span>';
  }
  const primary = document.querySelector('.hero .button.primary');
  if (primary) {
    primary.setAttribute('href', '#operating-room');
    primary.innerHTML = 'Enter the Operating Room <span>→</span>';
  }
  const opsCta = document.querySelector('.ops-cta');
  if (opsCta) {
    opsCta.setAttribute('href', '#operating-room');
    opsCta.innerHTML = 'Bring the friction into the Operating Room <span>→</span>';
  }
}

function buildOperatingRoom() {
  const operations = document.querySelector('#operations');
  if (!operations || document.querySelector('#operating-room')) return;

  const section = document.createElement('section');
  section.id = 'operating-room';
  section.className = 'section shell operating-room';
  section.innerHTML = `
    <div class="or-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="section-kicker"><span>04</span><p>THE OPERATING ROOM</p></div>
    <div class="or-heading">
      <h2>You already know the sentence you keep repeating.</h2>
      <p>Pick the one that sounds familiar. Keep the explanation for the room.</p>
    </div>
    <div class="or-frame">
      <div class="or-scan" aria-hidden="true"></div>
      <div class="or-toolbar">
        <div><span class="or-live"><i></i> PRIVATE CASE ENTRY</span><strong>DEEP NEXIVRA · OPERATING ROOM</strong></div>
        <em id="or-status">WAITING FOR A SIGNAL</em>
      </div>
      <div class="or-body">
        <div class="or-left">
          <div>
            <span class="or-case-label">Operating signal</span>
            <h3>Which line has been said inside your business <em>more than once?</em></h3>
          </div>
          <div class="or-left-copy">
            <p>You do not need a polished diagnosis. You only need the part that keeps feeling wrong.</p>
            <span class="or-seal"><i></i> The diagnosis stays off the website</span>
          </div>
        </div>
        <div class="or-right">
          <small>Select the line closest to what you are seeing</small>
          <div class="or-signals">
            ${roomSignals.map((line,index)=>`<button type="button" class="or-signal" data-index="${index}" style="--delay:${index * 65}ms"><i>${String(index+1).padStart(2,'0')}</i><strong>${line}</strong><span>→</span></button>`).join('')}
          </div>
          <div class="or-reveal" id="or-reveal">
            <div class="or-reveal-copy">
              <small id="or-reveal-label">THAT IS ENOUGH TO START</small>
              <strong id="or-reveal-title">Pick the line that feels familiar.</strong>
              <p id="or-reveal-note">No answer is produced here. The real case belongs in the conversation.</p>
            </div>
            <a class="or-enter" href="#contact">Enter the Operating Room <span>→</span></a>
          </div>
        </div>
      </div>
      <div class="or-footnote"><span>NO PUBLIC DIAGNOSIS.</span><strong>BRING THE REAL CASE.</strong></div>
    </div>`;

  operations.insertAdjacentElement('afterend', section);

  const nav = document.querySelector('.site-header nav');
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

  routeIntoOperatingRoom();

  const frame = section.querySelector('.or-frame');
  const reveal = section.querySelector('#or-reveal');
  const revealTitle = section.querySelector('#or-reveal-title');
  const revealNote = section.querySelector('#or-reveal-note');
  const revealLabel = section.querySelector('#or-reveal-label');
  const status = section.querySelector('#or-status');

  const selectSignal = (index, button) => {
    const line = roomSignals[index];
    if (!line) return;
    section.querySelectorAll('.or-signal').forEach((item) => item.classList.toggle('active', item === button));
    reveal.classList.add('active');
    revealLabel.textContent = `SIGNAL ${String(index + 1).padStart(2, '0')} SELECTED`;
    revealTitle.textContent = line;
    revealNote.textContent = 'That is enough to start. Bring the real case into the conversation.';
    status.textContent = `SIGNAL ${String(index + 1).padStart(2, '0')} · READY`;
    sessionStorage.setItem('deepnexivra:operating-signal', line);
    window.dispatchEvent(new CustomEvent('deepnexivra:operating-signal', { detail: { index, line } }));
  };

  section.querySelectorAll('.or-signal').forEach((button) => button.addEventListener('click', () => {
    selectSignal(Number(button.dataset.index), button);
  }));

  section.querySelector('.or-enter')?.addEventListener('click', () => {
    const active = section.querySelector('.or-signal.active');
    if (!active) return;
    const index = Number(active.dataset.index);
    window.dispatchEvent(new CustomEvent('deepnexivra:operating-signal', { detail: { index, line: roomSignals[index] } }));
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          section.classList.add('or-visible');
          observer.disconnect();
        }
      });
    }, { threshold: 0.18 });
    observer.observe(section);
  } else {
    section.classList.add('or-visible');
  }

  if (window.matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches) {
    let raf = 0;
    frame.addEventListener('pointermove', (event) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = frame.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.018;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.018;
        frame.style.setProperty('--or-x', `${x}px`);
        frame.style.setProperty('--or-y', `${y}px`);
      });
    });
    frame.addEventListener('pointerleave', () => {
      frame.style.setProperty('--or-x', '0px');
      frame.style.setProperty('--or-y', '0px');
    });
  }
}

buildOperatingRoom();
