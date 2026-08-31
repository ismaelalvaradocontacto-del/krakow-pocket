(() => {
  const formatDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    try {
      return new Intl.DateTimeFormat('es-ES', { day:'numeric', month:'short', year:'numeric' }).format(date).replace(/\./g, '');
    } catch (_) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  };

  const icon = '<svg class="date-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

  function enhance(input) {
    if (!input || input.dataset.dateUi === '1') return;
    input.dataset.dateUi = '1';
    const host = document.createElement('span');
    host.className = 'date-ui';
    input.parentNode.insertBefore(host, input);
    host.appendChild(input);
    input.classList.add('date-ui-input');

    const display = document.createElement('span');
    display.className = 'date-ui-display';
    display.setAttribute('aria-hidden', 'true');
    display.innerHTML = `<span class="date-ui-value"></span>${icon}`;
    host.appendChild(display);

    const valueNode = display.querySelector('.date-ui-value');
    const refresh = () => {
      const text = formatDate(input.value);
      valueNode.textContent = text || 'Seleccionar fecha';
      valueNode.classList.toggle('empty', !text);
    };
    input.addEventListener('input', refresh);
    input.addEventListener('change', refresh);
    input.addEventListener('blur', refresh);
    input._refreshDateUi = refresh;
    refresh();
  }

  function enhanceAll() {
    document.querySelectorAll('input[type="date"]').forEach(enhance);
  }

  function refreshAll() {
    document.querySelectorAll('input[type="date"]').forEach(input => input._refreshDateUi?.());
  }

  enhanceAll();
  requestAnimationFrame(refreshAll);
  setTimeout(refreshAll, 80);
  setTimeout(refreshAll, 500);

  document.addEventListener('click', event => {
    if (event.target.closest('#newCase')) setTimeout(refreshAll, 520);
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(refreshAll, 50);
  });
})();