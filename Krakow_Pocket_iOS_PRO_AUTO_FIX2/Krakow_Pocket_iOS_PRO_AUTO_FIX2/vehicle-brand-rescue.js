(() => {
  if (window.TRASPASO_VEHICLE_MAKES_2026 && window.TRASPASO_CANONICALIZE_MAKE) return;

  const CATALOG = [
    ['ABARTH'],['ACURA'],['AIWAYS'],['AIXAM'],['ALFA ROMEO','ALFAROMEO'],['ALPINA'],['ALPINE'],['APRILIA'],['ARCFOX'],['ASTON MARTIN','ASTONMARTIN'],['AUDI'],['AUSTIN'],['AUTOBIANCHI'],['AVATR'],
    ['BAIC'],['BAJAJ'],['BENTLEY'],['BENELLI'],['BETA'],['BIMOTA'],['BMW'],['BORGWARD'],['BRILLIANCE'],['BRIXTON'],['BSA'],['BUELL'],['BUGATTI'],['BUICK'],['BYD'],
    ['CADILLAC'],['CAN-AM','CANAM'],['CATERHAM'],['CFMOTO','CF MOTO'],['CHANGAN'],['CHERY'],['CHATENET'],['CHEVROLET'],['CHRYSLER'],['CITROEN','CITROËN'],['CUPRA'],
    ['DACIA'],['DAEWOO'],['DAF'],['DAIHATSU'],['DAIMLER'],['DEEPAL'],['DENZA'],['DERBI'],['DFSK'],['DODGE'],['DONGFENG'],['DS','DS AUTOMOBILES'],['DUCATI'],
    ['EBRO'],['EXEED'],['FANTIC'],['FERRARI'],['FIAT'],['FORD'],['FORD TRUCKS','FORDTRUCKS'],['FUSO','MITSUBISHI FUSO'],
    ['GAC'],['GASGAS','GAS GAS'],['GEELY'],['GENESIS'],['GILERA'],['GMC'],['GREAT WALL','GWM','GREATWALL'],
    ['HARLEY-DAVIDSON','HARLEY DAVIDSON','HARLEY'],['HISPANO SUIZA','HISPANOSUIZA'],['HONDA'],['HONGQI'],['HUMMER'],['HUSQVARNA'],['HYUNDAI'],
    ['INDIAN'],['INEOS'],['INFINITI'],['IRIZAR'],['ISUZU'],['IVECO'],
    ['JAC'],['JAECOO'],['JAGUAR'],['JEEP'],['JETOUR'],['JINCHENG'],
    ['KAWASAKI'],['KEEWAY'],['KGM','KGM MOTORS','SSANGYONG'],['KIA'],['KING LONG','KINGLONG'],['KOVE'],['KTM'],['KYMCO'],
    ['LADA'],['LAMBORGHINI'],['LANCIA'],['LAND ROVER','LANDROVER'],['LEAPMOTOR','LEAP MOTOR'],['LEXUS'],['LIFAN'],['LIGIER'],['LINCOLN'],['LOTUS'],['LUCID'],['LYNK & CO','LYNK AND CO','LYNKCO'],
    ['MACBOR'],['MAHINDRA'],['MAN'],['MASERATI'],['MAXUS'],['MAYBACH'],['MAZDA'],['MCLAREN'],['MERCEDES-BENZ','MERCEDES BENZ','MERCEDES'],['MERCURY'],['MG','MG MOTOR'],['MICROCAR'],['MINI'],['MITSUBISHI'],['MONDIAL','FB MONDIAL'],['MORGAN'],['MOTO GUZZI','MOTOGUZZI'],['MOTO MORINI','MOTOMORINI'],['MV AGUSTA','MVAGUSTA'],
    ['NIO'],['NISSAN'],['NIU'],['OLDSMOBILE'],['OPEL'],['OMODA'],['ORA'],['OTOKAR'],
    ['PEUGEOT'],['PIAGGIO'],['PLYMOUTH'],['POLESTAR'],['PONTIAC'],['PORSCHE'],['PROTON'],
    ['QJ MOTOR','QJMOTOR'],['RAM'],['RENAULT'],['RENAULT TRUCKS','RENAULTTRUCKS'],['RIEJU'],['RIVIAN'],['ROLLS-ROYCE','ROLLS ROYCE'],['ROVER'],['ROYAL ENFIELD','ROYALENFIELD'],
    ['SAAB'],['SANTANA'],['SATURN'],['SCANIA'],['SEAT'],['SERES'],['SHERCO'],['SILENCE'],['SIMCA'],['SKODA','ŠKODA'],['SKYWELL'],['SMART'],['SOLARIS'],['SSANGYONG'],['SUBARU'],['SUPER SOCO','SUPERSOCO','VMOTO SOCO'],['SUZUKI'],['SWM'],['SYM'],
    ['TALBOT'],['TATA'],['TEMSA'],['TESLA'],['TOYOTA'],['TRIUMPH'],['TVR'],
    ['VAUXHALL'],['VDL'],['VESPA'],['VICTORY'],['VOGE'],['VOLKSWAGEN','VW'],['VOLVO'],['VOLVO TRUCKS','VOLVOTRUCKS'],['VOYAH'],
    ['XEV'],['XPENG','X PENG'],['YAMAHA'],['YUTONG'],['ZEEKR'],['ZERO','ZERO MOTORCYCLES'],['ZONTES']
  ];

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const key = value => upper(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

  const aliases = new Map();
  CATALOG.forEach(([canonical, ...others]) => {
    [canonical, ...others].forEach(alias => aliases.set(key(alias), canonical));
  });

  function distance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      let left = i;
      let diag = i - 1;
      for (let j = 1; j <= b.length; j += 1) {
        const up = prev[j];
        const value = Math.min(left + 1, up + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev[j] = value;
        diag = up;
        left = value;
      }
    }
    return prev[b.length];
  }

  function canonicalize(raw) {
    const compact = key(raw);
    if (!compact) return '';
    if (aliases.has(compact)) return aliases.get(compact);

    if (compact.length >= 3) {
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
      const allowed = compact.length <= 4 ? 1 : compact.length <= 8 ? 1 : 2;
      if (bestDistance <= allowed) return best;
    }
    return '';
  }

  window.TRASPASO_VEHICLE_MAKES_2026 = CATALOG.map(([canonical]) => canonical);
  window.TRASPASO_CANONICALIZE_MAKE = canonicalize;
})();