(() => {
  const dateStyle = document.createElement('link');
  dateStyle.rel = 'stylesheet';
  dateStyle.href = './date-fields.css?v=20260831g';
  document.head.appendChild(dateStyle);
  const dateScript = document.createElement('script');
  dateScript.src = './date-fields.js?v=20260831g';
  dateScript.defer = true;
  document.head.appendChild(dateScript);

  const scanStyle = document.createElement('link');
  scanStyle.rel = 'stylesheet';
  scanStyle.href = './vehicle-scan.css?v=20260831i';
  document.head.appendChild(scanStyle);
  const scanScript = document.createElement('script');
  scanScript.src = './vehicle-scan.js?v=20260831i';
  scanScript.defer = true;
  scanScript.addEventListener('load', () => {
    const makes = document.createElement('script');
    makes.src = './vehicle-brand-rescue.js?v=20260831r';
    makes.defer = true;
    makes.addEventListener('load', () => {
      const reset = document.createElement('script');
      reset.src = './vehicle-scan-new-source.js?v=20260831b';
      reset.defer = true;
      reset.addEventListener('load', () => {
        const ocr = document.createElement('script');
        ocr.src = './vehicle-scan-v6.js?v=20260831ac';
        ocr.defer = true;
        document.head.appendChild(ocr);
      }, {once:true});
      document.head.appendChild(reset);
    }, {once:true});
    document.head.appendChild(makes);
  }, {once:true});
  document.head.appendChild(scanScript);

  const RED = [177/255, 15/255, 63/255];
  const branded = new WeakSet();
  const urls = [];

  async function stampPdf(link, pageIndex = 0, combined = false) {
    if (!link || branded.has(link) || !window.PDFLib || !link.href) return;
    branded.add(link);
    try {
      const bytes = await fetch(link.href).then(r => r.arrayBuffer());
      const doc = await window.PDFLib.PDFDocument.load(bytes);
      const pages = doc.getPages();
      const page = pages[Math.min(pageIndex, pages.length - 1)];
      const bold = await doc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
      const h = page.getHeight();
      page.drawRectangle({x:38,y:h-62,width:290,height:25,color:window.PDFLib.rgb(1,1,1)});
      page.drawText('gA · TRASPASO · FICHA DE GESTIÓN',{x:44,y:h-49,size:8,font:bold,color:window.PDFLib.rgb(...RED)});
      const out = await doc.save();
      const blob = new Blob([out], {type:'application/pdf'});
      const url = URL.createObjectURL(blob);
      urls.push(url);
      link.href = url;
      link.dataset.gaBranded = '1';

      if (combined) {
        const row = link.closest('.download-row');
        const share = row?.querySelector('.share-link');
        if (share && navigator.share) {
          const fresh = share.cloneNode(true);
          const filename = link.download || 'Transferencia completa.pdf';
          const file = new File([blob], filename, {type:'application/pdf'});
          fresh.addEventListener('click', async () => {
            try { await navigator.share({files:[file], title:'Traspaso · gA'}); }
            catch (err) { if (err?.name !== 'AbortError') console.error(err); }
          });
          share.replaceWith(fresh);
        }
      }
    } catch (err) {
      console.error('No se pudo aplicar la identidad gA al PDF', err);
    }
  }

  function scan() {
    const rows = document.querySelectorAll('.downloads .download-row');
    rows.forEach(row => {
      const link = row.querySelector('a.download-link');
      if (!link) return;
      if (row.classList.contains('combined')) {
        setTimeout(() => stampPdf(link, 4, true), 160);
        return;
      }
      const label = row.querySelector('.download-copy strong')?.textContent || '';
      if (/ficha para el gestor|ficha del gestor/i.test(label)) {
        setTimeout(() => stampPdf(link, 0, false), 120);
      }
    });
  }

  const target = document.getElementById('downloads');
  if (target) new MutationObserver(scan).observe(target, {childList:true,subtree:true,attributes:true});
  scan();
  window.addEventListener('beforeunload', () => urls.splice(0).forEach(URL.revokeObjectURL));
})();