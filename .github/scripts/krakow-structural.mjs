import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve('Krakow_Pocket_iOS_PRO_AUTO_FIX2/Krakow_Pocket_iOS_PRO_AUTO_FIX2');
const failures = [];
const pass = (condition, message) => { if (!condition) failures.push(message); };

const dataSource = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(dataSource, sandbox, { filename: 'data.js' });
const D = sandbox.window.KP_DATA;
pass(!!D && typeof D === 'object', 'KP_DATA missing');

const pois = Array.isArray(D?.pois) ? D.pois : [];
const quests = Array.isArray(D?.quests) ? D.quests : [];
const days = Array.isArray(D?.days) ? D.days : [];
const categories = D?.categories || {};
const poiIds = pois.map(p => p.id);
const questIds = quests.map(q => q.id);
const questPois = quests.map(q => q.poi);
const unique = values => new Set(values).size === values.length;

pass(pois.length >= 12, 'Too few POIs');
pass(quests.length === 12, `Expected 12 quests, found ${quests.length}`);
pass(days.length === 3, `Expected 3 trip days, found ${days.length}`);
pass(unique(poiIds), 'Duplicate POI ids');
pass(unique(questIds), 'Duplicate quest ids');
pass(unique(questPois), 'More than one quest targets the same POI');
pass(quests.every(q => poiIds.includes(q.poi)), 'A quest references a missing POI');
pass(quests.every(q => typeof q.title === 'string' && q.title.trim() && typeof q.text === 'string' && q.text.trim()), 'Quest copy missing');
pass(quests.every(q => Number.isFinite(q.points) && q.points > 0), 'Quest points must be positive numbers');
pass(pois.every(p => typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim()), 'POI id/name missing');
pass(pois.every(p => categories[p.category]), 'POI references an unknown category');
pass(pois.every(p => Array.isArray(p.days) && p.days.length && p.days.every(d => Number.isInteger(d) && d >= 1 && d <= days.length)), 'POI has invalid trip day');
pass(pois.every(p => typeof p.mapsQuery === 'string' && p.mapsQuery.trim()), 'POI mapsQuery missing');
pass(pois.every(p => typeof p.story === 'string' && p.story.trim()), 'POI story missing');
pass(pois.every(p => (p.lat == null && p.lon == null) || (Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180)), 'Invalid POI coordinates');

const parseDate = value => Number.isFinite(Date.parse(value));
pass(parseDate(D?.trip?.start) && parseDate(D?.trip?.end), 'Trip start/end date invalid');
pass(Date.parse(D?.trip?.start) < Date.parse(D?.trip?.end), 'Trip start must be before trip end');
pass(parseDate(D?.trip?.outbound) && parseDate(D?.trip?.stationTarget), 'Outbound/station target invalid');
pass(Date.parse(D?.trip?.stationTarget) <= Date.parse(D?.trip?.outbound), 'Station target must not be after outbound departure');
pass(parseDate(D?.trip?.returnDepart) && parseDate(D?.trip?.returnArrive), 'Return dates invalid');
pass(Date.parse(D?.trip?.returnDepart) < Date.parse(D?.trip?.returnArrive), 'Return departure must be before arrival');
pass(days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(Date.parse(`${d.date}T12:00:00Z`))), 'Invalid day date');
pass(Object.keys(D?.expenseCategories || {}).length >= 5, 'Expense categories missing');

const requiredFiles = [
  'index.html','manifest.webmanifest','sw.js','data.js','app.js','enhancements.js','runtime.js','stability.js',
  'compat.js','state-bridge.js','mission-fix.js','celebration-guard.js','game.js','visuals.js','styles.css','game.css','storybook.css',
  'compat.css','profiles.css','assets/game-art.svg','assets/characters.svg','assets/village.svg','assets/world-map.svg',
  'icon-192.svg','icon-512.svg'
];
for (const file of requiredFiles) pass(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const script of ['data.js','compat.js','runtime.js','stability.js','app.js','enhancements.js','game.js','visuals.js']) {
  pass(index.includes(script), `index.html does not reference ${script}`);
}
pass(index.includes('manifest.webmanifest'), 'Manifest is not linked from index.html');

const compat = fs.readFileSync(path.join(root, 'compat.js'), 'utf8');
for (const script of ['state-bridge.js','mission-fix.js','celebration-guard.js']) {
  pass(compat.includes(script), `compat.js does not load ${script}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
pass(typeof manifest.name === 'string' && manifest.name.trim(), 'Manifest name missing');
pass(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest icons missing');
pass(manifest.display === 'standalone' || manifest.display === 'fullscreen', 'Manifest is not installable standalone/fullscreen');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const file of ['index.html','compat.js','state-bridge.js','mission-fix.js','celebration-guard.js','app.js','enhancements.js','manifest.webmanifest']) {
  pass(sw.includes(file), `Service worker core does not include ${file}`);
}

console.log(JSON.stringify({
  checks: failures.length ? 'FAILED' : 'PASS',
  counts: { pois: pois.length, quests: quests.length, days: days.length, categories: Object.keys(categories).length },
  failures
}, null, 2));
if (failures.length) process.exit(1);
