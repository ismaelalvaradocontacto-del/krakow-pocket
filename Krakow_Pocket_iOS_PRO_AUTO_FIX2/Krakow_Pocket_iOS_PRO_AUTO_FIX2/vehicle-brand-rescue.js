(() => {
  const form = document.getElementById('vehicleForm');
  const ui = document.querySelector('.vehicle-scan');
  if (!form || !ui || ui.dataset.brandRescue === '2') return;
  ui.dataset.brandRescue = '2';

  const brandInput = form.elements.namedItem('brand');
  const cameraInput = ui.querySelector('.scan-input-camera');
  const uploadInput = ui.querySelector('.scan-input-upload');
  const result = ui.querySelector('.vehicle-scan-result');
  if (!brandInput || !cameraInput || !uploadInput || !result) return;

  const CATALOG = [
    ['ABARTH'],['ACURA'],['AIWAYS'],['AIXAM'],['ALFA ROMEO','ALFAROMEO'],['ALPINA'],['ALPINE'],['APRILIA'],['ARCFOX'],['ASTON MARTIN','ASTONMARTIN'],['AUDI'],['AUSTIN'],['AUTOBIANCHI'],
    ['BAIC'],['BAJAJ'],['BENTLEY'],['BENELLI'],['BETA'],['BIMOTA'],['BMW'],['BORGWARD'],['BRILLIANCE'],['BRIXTON'],['BUELL'],['BUGATTI'],['BUICK'],['BYD'],
    ['CADILLAC'],['CAN-AM','CANAM'],['CATERHAM'],['CFMOTO','CF MOTO'],['CHANGAN'],['CHATENET'],['CHEVROLET'],['CHRYSLER'],['CITROEN','CITROËN'],['CUPRA'],
    ['DACIA'],['DAEWOO'],['DAF'],['DAIHATSU'],['DAIMLER'],['DENZA'],['DERBI'],['DODGE'],['DONGFENG'],['DS','DS AUTOMOBILES'],['DUCATI'],
    ['EBRO'],['FANTIC'],['FERRARI'],['FIAT'],['FORD'],['FORD TRUCKS','FORDTRUCKS'],['FUSO','MITSUBISHI FUSO'],
    ['GAC'],['GASGAS','GAS GAS'],['GEELY'],['GENESIS'],['GILERA'],['GMC'],['GREAT WALL','GWM','GREATWALL'],
    ['HARLEY-DAVIDSON','HARLEY DAVIDSON','HARLEY'],['HISPANO SUIZA','HISPANOSUIZA'],['HONDA'],['HUMMER'],['HUSQVARNA'],['HYUNDAI'],
    ['INDIAN'],['INEOS'],['INFINITI'],['IRIZAR'],['ISUZU'],['IVECO'],
    ['JAC'],['JAECOO'],['JAGUAR'],['JEEP'],['JINCHENG'],['KAWASAKI'],['KEEWAY'],['KGM','KGM MOTORS','SSANGYONG'],['KIA'],['KING LONG','KINGLONG'],['KTM'],['KYMCO'],
    ['LADA'],['LAMBORGHINI'],['LANCIA'],['LAND ROVER','LANDROVER'],['LEAPMOTOR','LEAP MOTOR'],['LEXUS'],['LIFAN'],['LIGIER'],['LINCOLN'],['LOTUS'],['LUCID'],
    ['MACBOR'],['MAHINDRA'],['MAN'],['MASERATI'],['MAXUS'],['MAYBACH'],['MAZDA'],['MCLAREN'],['MERCEDES-BENZ','MERCEDES BENZ','MERCEDES'],['MG','MG MOTOR'],['MICROCAR'],['MINI'],['MITSUBISHI'],['MONDIAL','FB MONDIAL'],['MORGAN'],['MOTO GUZZI','MOTOGUZZI'],['MV AGUSTA','MVAGUSTA'],
    ['NIO'],['NISSAN'],['NIU'],['OPEL'],['OMODA'],['ORA'],['OTOKAR'],
    ['PEUGEOT'],['PIAGGIO'],['POLESTAR'],['PONTIAC'],['PORSCHE'],['PROTON'],
    ['QJ MOTOR','QJMOTOR'],['RAM'],['RENAULT'],['RENAULT TRUCKS','RENAULTTRUCKS'],['RIEJU'],['RIVIAN'],['ROLLS-ROYCE','ROLLS ROYCE'],['ROVER'],['ROYAL ENFIELD','ROYALENFIELD'],
    ['SAAB'],['SANTANA'],['SCANIA'],['SEAT'],['SERES'],['SHERCO'],['SILENCE'],['SKODA','ŠKODA'],['SKYWELL'],['SMART'],['SOLARIS'],['SSANGYONG'],['SUBARU'],['SUPER SOCO','SUPERSOCO','VMOTO SOCO'],['SUZUKI'],['SYM'],
    ['TATA'],['TEMSA'],['TESLA'],['TOYOTA'],['TRIUMPH'],['TVR'],
    ['VAUXHALL'],['VDL'],['VESPA'],['VICTORY'],['VOGE'],['VOLKSWAGEN','VW'],['VOLVO'],['VOLVO TRUCKS','VOLVOTRUCKS'],
    ['XEV'],['XPENG','X PENG'],['YAMAHA'],['YUTONG'],['ZAIRON'],['ZEEKR'],['ZERO','ZERO MOTORCYCLES'],['ZONTES']
  ];

  window.TRASPASO_VEHICLE_MAKES_2026 = CATALOG.map(([canonical]) => canonical);

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const key = value => upper(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9]/g,'');

  const aliases = new Map();
  CATALOG.forEach(([canonical, ...others]) => {
    [canonical, ...others].forEach(alias => aliases.set(key(alias), canonical));
  });

  function distance(a,b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = Array.from({length:b.length+1},(_,i)=>i);
    for (let i=1;i<=a.length;i+=1) {
      let left=i;
      let diag=i-1;
      for (let j=1;j<=b.length;j+=1) {
        const up=prev[j];
        const value=Math.min(left+1,up+1,diag+(a[i-1]===b[j-1]?0:1));
        prev[j]=value;
        diag=up;
        left=value;
      }
    }
    return prev[b.length];
  }

  function canonicalize(raw) {
    const compact = key(raw);
    if (!compact) return '';
    if (aliases.has(compact)) return aliases.get(compact);

    if (compact.length >= 4) {
      let best = '';
      let bestDistance = Infinity;
      for (const [aliasKey, canonical] of aliases) {
        if (Math.abs(aliasKey.length - compact.length) > 2) continue;
        const d = distance(compact, aliasKey);
        if (d < bestDistance) {
          bestDistance = d;
          best = canonical;
        }
      }
      const allowed = compact.length <= 6 ? 1 : 2;
      if (bestDistance <= allowed) return best;
    }
    return '';
  }

  let pendingFile = null;
  let running = false;
  let lastSignature = '';

  function captureFile(event) {
    const file = event.target.files?.[0];
    if (file?.type?.startsWith('image/')) pendingFile = file;
  }
  cameraInput.addEventListener('change', captureFile, { capture:true });
  uploadInput.addEventListener('change', captureFile, { capture:true });

  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('BRAND_TIMEOUT')), ms);
      })
    ]).finally(() => clearTimeout(timer));
  }

  async function fileToCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const maxSide = 2800;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const source = document.createElement('canvas');
      source.width = Math.max(1, Math.round(image.naturalWidth * scale));
      source.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = source.getContext('2d', { alpha:false, willReadFrequently:true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, source.width, source.height);
      ctx.drawImage(image, 0, 0, source.width, source.height);
      return source;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function cropD1(source, mode = 'gray') {
    const ratio = source.width / source.height;
    if (ratio < 1.2 || ratio > 1.65) return null;

    // Recorta únicamente el valor de D.1. Evita C.4 y D.2, que antes contaminaban la lectura.
    const x = Math.round(source.width * .10);
    const y = Math.round(source.height * .72);
    const w = Math.round(source.width * .39);
    const h = Math.round(source.height * .065);
    const scale = 7;

    const out = document.createElement('canvas');
    out.width = Math.max(1, w * scale);
    out.height = Math.max(1, h * scale);
    const ctx = out.getContext('2d', { alpha:false, willReadFrequently:true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, x, y, w, h, 0, 0, out.width, out.height);

    const image = ctx.getImageData(0, 0, out.width, out.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2];
      let value = lum;
      if (mode === 'contrast') value = Math.max(0, Math.min(255, (lum - 128) * 2.15 + 128));
      if (mode === 'threshold') value = lum > 165 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  function candidateFromRaw(raw) {
    const originalLines = String(raw || '')
      .replace(/\r/g,'\n')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);

    let candidate = '';
    for (const line of originalLines) {
      const match = line.match(/D\s*[.·,:;\-]?\s*[1IL]\s*[:;,.\-–—]?\s*(.+)$/i);
      if (match?.[1]) { candidate = match[1]; break; }
    }
    if (!candidate) candidate = originalLines[0] || '';

    candidate = upper(candidate)
      .replace(/^.*?D\s*[.·,:;\-]?\s*[1IL]\s*[:;,.\-–—]?\s*/i, '')
      .replace(/\bD\s*[.·,:;\-]?\s*[2Z]\b.*$/i, '')
      .replace(/^(MARCA|BRAND)\s*[:;,.\-–—]?\s*/i, '')
      .replace(/[^A-ZÁÉÍÓÚÜÑ0-9 .&+\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (candidate.length < 2 || candidate.length > 35) return '';
    if (!/[A-ZÁÉÍÓÚÜÑ]{2}/.test(candidate)) return '';
    if (/^(DOCUMENTO|OBSERVACIONES|MATRICULA|MATRÍCULA|MODELO|BASTIDOR|TIPO|VARIANTE|VERSION|VERSIÓN)$/i.test(candidate)) return '';
    return canonicalize(candidate) || candidate;
  }

  async function recognizeBrand(worker, canvas, psm = 7) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode:String(psm),
        preserve_interword_spaces:'1',
        tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ0123456789 .&+-/'
      });
    } catch (_) {}
    const { data } = await withTimeout(worker.recognize(canvas), 7500);
    return candidateFromRaw(data?.text || '');
  }

  async function rescue(file) {
    if (!file || running || clean(brandInput.value) || brandInput.dataset.manualAfterOcr === '1') return;
    const signature = `${file.name}|${file.size}|${file.lastModified}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    running = true;

    let worker;
    try {
      if (!window.Tesseract?.createWorker) return;
      const source = await fileToCanvas(file);
      const gray = cropD1(source, 'gray');
      const contrast = cropD1(source, 'contrast');
      const threshold = cropD1(source, 'threshold');
      if (!gray || !contrast || !threshold) return;

      worker = await window.Tesseract.createWorker('spa');
      let brand = await recognizeBrand(worker, gray, 7);
      if (!brand) brand = await recognizeBrand(worker, contrast, 7);
      if (!brand) brand = await recognizeBrand(worker, threshold, 7);
      if (!brand) brand = await recognizeBrand(worker, gray, 6);
      if (!brand) return;

      brandInput.value = brand;
      brandInput.dataset.ocrFilled = '1';
      brandInput.dispatchEvent(new Event('input', { bubbles:true }));
      brandInput.dispatchEvent(new Event('change', { bubbles:true }));
      delete brandInput.dataset.manualAfterOcr;
      result.className = 'vehicle-scan-result success';
      result.textContent = '4 datos identificados.';
    } catch (error) {
      console.warn('No se pudo rescatar la marca D.1', error);
    } finally {
      try { await worker?.terminate?.(); } catch (_) {}
      running = false;
      pendingFile = null;
    }
  }

  const observer = new MutationObserver(() => {
    if (!pendingFile || running || clean(brandInput.value)) return;
    const text = result.textContent.trim();
    if (!text || /preparando|leyendo|completando/i.test(text)) return;
    if (/datos identificados|no he podido identificar|lectura ha tardado|no se ha podido leer/i.test(text)) {
      setTimeout(() => rescue(pendingFile), 60);
    }
  });
  observer.observe(result, { childList:true, subtree:true, characterData:true });
})();