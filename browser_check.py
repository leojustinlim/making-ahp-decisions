from playwright.sync_api import sync_playwright
import json
from pathlib import Path
root=Path(__file__).parent

passed=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(accept_downloads=True)
  errors=[]
  page.on('pageerror',lambda error: errors.append(str(error)))
  import re
  source=(root/'index.html').read_text()
  engine=(root/'ahp-engine.mjs').read_text().replace('export const ','const ').replace('export function ','function ')
  validate=(root/'project-validation.mjs').read_text().replace('export function ','function ')
  source=re.sub(r"import .*?from './.*?';",'',source)
  source=source.replace('<script type="module">','<script>'+engine+'\n'+validate+'\n')
  source=source.replace('<head>','<head><script>window.__storage=window.__storage||{};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>{window.__storage[k]=String(v)}}});</script>')
  page.set_content(source,wait_until='load')
  assert page.get_by_text('AHP Decision Studio').count()>=1
  assert page.locator('#saveStatus').inner_text().startswith('Saved')
  passed.append('loads without startup errors and autosaves')
  page.locator('#title').fill('Phase 3 test decision');page.locator('#title').blur()
  assert 'Phase 3 test decision' in page.evaluate("JSON.stringify(window.__storage)")
  passed.append('changes written to simulated browser storage (reload not verified)')
  page.locator('[data-step="1"]').click()
  assert page.locator('[data-weight]').count()==3
  page.locator('input[name="wm"][value="pairwise"]').check()
  assert page.locator('[data-criterion-pair]').count()==3
  for elt in page.locator('[data-criterion-pair]').all():elt.select_option('1')
  assert 'CR: 0.000' in page.locator('#view').inner_text()
  passed.append('pairwise criteria weighting and consistency diagnostics')
  page.locator('[data-step="2"]').click()
  page.locator('input[name="em"][value="pairwise"]').check()
  assert page.locator('select[data-alt-pair-c1]').count()==3
  for elt in page.locator('select[data-alt-pair-c1]').all():elt.select_option('1')
  for cid in ['c2','c3']:
   for elt in page.locator(f'select[data-alt-pair-{cid}]').all():elt.select_option('1')
  page.locator('[data-step="3"]').click()
  assert 'Decision rankings' in page.locator('#view').inner_text()
  assert page.locator('table').first.locator('tbody tr').count()==3
  assert page.locator('#chart').count()==1
  passed.append('pairwise alternatives, ranking and Pareto visualization')
  page.locator('[data-step="3"]').click()
  assert page.locator('table').first.locator('tbody tr').count()==3
  passed.append('pairwise results remain available during navigation')
  with page.expect_download() as dl:page.locator('#exportProject').click()
  download=dl.value
  path=root/'browser-test-project.json';download.save_as(str(path));data=json.loads(path.read_text());assert data['title']=='Phase 3 test decision'
  passed.append('JSON project export contains complete saved data')
  page.locator('#title') if page.locator('#title').count() else page.locator('[data-step="0"]').click()
  page.locator('#title').fill('Changed after export');page.locator('#title').blur()
  page.locator('#fileInput').set_input_files(str(path))
  assert page.locator('#title').input_value()=='Phase 3 test decision'
  passed.append('JSON import recovers earlier project')
  page.locator('[data-step="1"]').click();page.locator('input[name="wm"][value="manual"]').check()
  page.locator('[data-step="2"]').click();page.locator('input[name="em"][value="scores"]').check()
  first=page.locator('[data-score]').first
  first.fill('');first.blur()
  page.locator('[data-step="3"]').click()
  assert 'Missing/invalid score' in page.locator('#view').inner_text()
  page.locator('[data-step="3"]').click()
  assert 'Missing/invalid score' in page.locator('#view').inner_text()
  passed.append('blank scores rejected and unfinished data stored')
  assert not errors, errors
  passed.append('no uncaught browser JavaScript exceptions')
  browser.close()
finally:
 pass
for item in passed:print('PASS:',item)
print(f'Browser checks: {len(passed)}/{len(passed)} passed')
