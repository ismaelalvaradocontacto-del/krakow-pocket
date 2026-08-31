(() => {
  const RED = [177/255, 15/255, 63/255];
  const branded = new WeakSet();

  async function applyGaBrand(link) {
    if (!link || branded.has(link) || !window.PDFLib) return;
    const row = link.closest('.download-row');
    const label = row?.querySelector('.download-copy strong')?.textContent || '';
    if (!/ficha para el gestor|ficha del gestor/i.test(label)) return;
    branded.add(link);
    try {
      const bytes = await fetch(link.href).then(r => r.arrayBuffer());
      const doc = await window.PDFLib.PDFDocument.load(bytes);
      const page = doc.getPages()[0];
      const bold = await doc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
      const h = page.getHeight();
      page.drawRectangle({x:38,y:h-62,width:280,height:25,color:window.PDFLib.rgb(1,1,1)});
      page.drawText('gA · TRASPASO · FICHA DE GESTIÓN',{x:44,y:h-49,size:8,font:bold,color:window.PDFLib.rgb(...RED)});
      const out = await doc.save();
      const blob = new Blob([out], {type:'application/pdf'});
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.dataset.gaBranded = '1';
    } catch (err) {
      console.error('No se pudo aplicar la identidad gA al PDF', err);
    }
  }

  function scan() {
    document.querySelectorAll('.downloads .download-row .download-link').forEach(link => {
      setTimeout(() => applyGaBrand(link), 120);
    });
  }

  const target = document.getElementById('downloads');
  if (target) new MutationObserver(scan).observe(target, {childList:true, subtree:true, attributes:true});
  scan();
})();