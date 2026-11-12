// End-to-end check of the front end in demo mode. Run: node tests/browser.test.js  (needs Playwright)
const { chromium } = require('playwright'); const path = require('path'); const assert = require('assert');
const url = 'file://' + path.join(__dirname, '..', 'index.html') + '?demo=1'; const shots = process.env.SHOTS;
(async () => {
  const b = await chromium.launch(); const errors = [];
  const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(url); await page.waitForSelector('#term-grid .tcard');
  assert.equal(await page.locator('#term-grid .tcard').count(), 10);
  assert.ok((await page.textContent('h1')).includes('terms score 7 or more'));
  assert.ok(await page.locator('#chart-usage svg rect').count() > 10); assert.ok(await page.locator('#chart-fudge svg circle').count() === 17);
  await page.hover('#chart-usage svg rect[fill=transparent] >> nth=12'); assert.ok((await page.textContent('#chart-usage .tip')).includes('Run of'));
  if (shots) await page.screenshot({ path: shots + '/dash.png', fullPage: true });
  await page.click('.seg button:has-text("New-meaning hits")'); assert.equal(await page.getAttribute('.seg button:has-text("New-meaning hits")', 'aria-pressed'), 'true');
  await page.click('.tcard[data-term] >> text=yapless'); assert.equal(await page.textContent('#detail h2'), 'yapless');
  assert.equal(await page.locator('#instrument tbody tr').count(), 2);
  // search
  await page.click('nav a:has-text("Search")'); await page.fill('#search-form input[name=word]', 'glorpish'); await page.click('#search-form button[type=submit]');
  await page.waitForSelector('#search-results .hit'); assert.ok((await page.textContent('#search-results h2')).includes('glorpish'));
  // summary + match bands (simulated search, new word)
  const bandN = async (b) => +(await page.textContent(`#search-summary .band[data-band=${b}] .bn`));
  const total = await bandN('all'); assert.ok(total >= 10); assert.ok(await bandN('exact') > 0 && await bandN('close') > 0 && await bandN('similar') > 0);
  assert.equal(await page.locator('#search-list .hit').count(), total);
  for (const b of ['exact', 'close', 'similar']) { await page.click(`#search-summary .band[data-band=${b}]`); const n = await bandN(b);
    assert.equal(await page.locator('#search-list .hit').count(), n, b + ' filter count'); assert.equal(await page.locator(`#search-list .hit:not([data-band=${b}])`).count(), 0);
    const pcts = await page.locator('#search-list .mpct').allTextContents(); pcts.forEach(t => { const v = parseInt(t); assert.ok(b === 'exact' ? v === 100 : b === 'close' ? v >= 80 && v <= 99 : v >= 60 && v <= 79, b + ' ' + t); }); }
  if (shots) await page.screenshot({ path: shots + '/search-new-close.png', fullPage: true });
  await page.click('#search-summary .band[data-band=all]'); assert.equal(await page.locator('#search-list .hit').count(), total);
  assert.equal(await page.locator('#summary-table tbody tr').count(), 6);
  // simulated search, existing word with clue and older-meaning words
  await page.fill('#search-form input[name=word]', 'kettling'); await page.fill('#search-form input[name=forms]', 'kettled, kettler'); await page.selectOption('#search-form select[name=kind]', 'existing');
  await page.fill('#search-form input[name=cues]', 'quietly, angry, fine but'); await page.fill('#search-form input[name=exclude]', 'police, tea, boil'); await page.fill('#search-form input[name=meaning]', 'getting quietly angrier until you suddenly boil over');
  await page.click('#search-form button[type=submit]'); await page.waitForFunction(() => /kettling/.test(document.querySelector('#search-summary h2').textContent));
  const ex = await bandN('exact'), cl = await bandN('close'), si = await bandN('similar'), al = await bandN('all'); assert.ok(ex > 0 && cl > 0 && si > 0 && al > ex + cl + si, 'existing word spreads over all groups, with some under 60%');
  assert.ok((await page.textContent('#search-summary')).includes('under 60%')); assert.ok(await page.locator('#search-list .hit:has-text("older meaning")').count() > 0);
  if (shots) await page.screenshot({ path: shots + '/search-existing.png', fullPage: true });
  await page.fill('#search-form input[name=word]', 'glorpish'); await page.fill('#search-form input[name=forms]', ''); await page.selectOption('#search-form select[name=kind]', 'new'); await page.fill('#search-form input[name=cues]', ''); await page.fill('#search-form input[name=exclude]', ''); await page.fill('#search-form input[name=meaning]', '');
  await page.click('#search-form button[type=submit]'); await page.waitForFunction(() => /glorpish/.test(document.querySelector('#search-summary h2').textContent));
  if (shots) await page.screenshot({ path: shots + '/search.png', fullPage: true });
  // terms: full, delete one, add from search
  await page.click('#search-results button:has-text("Track this term")'); await page.waitForSelector('#slots');
  assert.ok((await page.textContent('#slots')).startsWith('10 of 10'));
  await page.click('#term-form button[type=submit]'); await page.waitForTimeout(400); assert.ok((await page.textContent('#toast')).includes('slots are in use'));
  await page.click('#term-form button:has-text("Cancel")');
  await page.click('#terms-table tr:has-text("drovish") button:has-text("Delete")'); await page.waitForFunction(() => document.querySelector('#slots').textContent.startsWith('9 of 10'));
  await page.fill('#term-form input[name=word]', 'glorpish'); await page.fill('#term-form input[name=coiner]', 'Tester'); await page.click('#term-form button[type=submit]');
  await page.waitForFunction(() => document.querySelector('#slots').textContent.startsWith('10 of 10'));
  await page.click('#terms-table tr:has-text("glorpish") button:has-text("Run now")'); await page.waitForFunction(() => /\d/.test(document.querySelector('#terms-table tr:nth-last-child(1) td:nth-child(4)').textContent));
  await page.click('#terms-table tr:has-text("kettling") button:has-text("Edit")'); await page.waitForSelector('#term-form h2:has-text("Edit")');
  assert.ok((await page.inputValue('#term-form input[name=exclude]')).includes('police')); assert.ok((await page.inputValue('#term-form input[name=owned]')).includes('kettling.project'));
  if (shots) await page.screenshot({ path: shots + '/terms.png', fullPage: true });
  // review + sighting
  await page.click('nav a:has-text("Review")'); await page.waitForSelector('#review-table, #review-body .card');
  await page.click('.seg button:has-text("All hits")'); await page.waitForSelector('#review-table tbody tr');
  const before = await page.evaluate(() => LexApp.state().state.terms.find(t => t.word === 'kettling').series.at(-1).earned);
  await page.selectOption('main select[aria-label=Term]', { label: await page.locator('main select[aria-label=Term] option:has-text("kettling")').first().textContent() }); await page.waitForSelector('#sighting-form h2:has-text("kettling")');
  await page.fill('#sighting-form input[name=who]', 'M5 student A'); await page.selectOption('#sighting-form select[name=ownership]', 'earned_out'); await page.click('#sighting-form button[type=submit]');
  await page.waitForFunction((n) => LexApp.state().state.terms.find(t => t.word === 'kettling').series.at(-1).earned === n + 1, before);
  if (shots) await page.screenshot({ path: shots + '/review.png', fullPage: false });
  // settings
  await page.click('nav a:has-text("Settings")'); await page.waitForSelector('#budget'); assert.ok((await page.textContent('#budget')).includes('about 520 a month'));
  await page.uncheck('#settings-form input[name=d4]'); await page.click('#settings-form button[type=submit]'); await page.waitForFunction(() => LexApp.state().state.settings.days === '1');
  if (shots) await page.screenshot({ path: shots + '/settings.png', fullPage: true });
  // phone width: no sideways scroll on any view; dark theme renders
  const phone = await b.newPage({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' }); phone.on('pageerror', e => errors.push(e.message));
  for (const hsh of ['#/', '#/search', '#/terms', '#/review', '#/settings']) { await phone.goto(url + hsh); await phone.waitForTimeout(500); const w = await phone.evaluate(() => document.documentElement.scrollWidth); assert.ok(w <= 391, hsh + ' overflows: ' + w); }
  await phone.goto(url + '#/'); await phone.waitForSelector('#chart-usage svg'); if (shots) await phone.screenshot({ path: shots + '/phone.png', fullPage: true });
  await b.close();
  assert.deepEqual(errors, []); console.log('browser tests passed');
})().catch(e => { console.error(e); process.exit(1); });
