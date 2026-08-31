(() => {
  const form = document.getElementById('vehicleForm');
  if (!form) return;

  ['version','engine'].forEach(name => {
    const input = form.elements.namedItem(name);
    const field = input?.closest('.field');
    if (field) field.remove();
  });

  const result = document.querySelector('.vehicle-scan-result');
  if (result) {
    const cleanResult = () => {
      result.textContent = result.textContent
        .replace(/\s*·\s*Versión comprobada\.?/gi, '')
        .replace(/6 datos completados/gi, '4 datos completados');
    };
    new MutationObserver(cleanResult).observe(result, { childList:true, subtree:true, characterData:true });
    cleanResult();
  }
})();