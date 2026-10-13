from playwright.sync_api import sync_playwright
from pathlib import Path
import re,json,tempfile
root=Path(__file__).parent
s=(root/'index.html').read_text()
mods=[]
for fname in ['ahp-engine.mjs','project-validation.mjs','advanced-analytics.mjs']:
 src=(root/fname).read_text();src=re.sub(r'^import .*?;\s*','',src,flags=re.M);src=re.sub(r'\bexport (const|function)\b',r'\1',src)
 mods.append(src)
s=re.sub(r"import .*?from './.*?';",'',s)
s=s.replace('<script type="module">','<script>'+'\n'.join(mods)+'\n')
s=s.replace('<head>','<head><script>window.__storage=window.__storage||{};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>{window.__storage[k]=String(v)}}});</script>')
checks=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(s)
 page.locator('[data-step="3"]').click()
 assert page.get_by_text('Advanced analytics').count()==1
 checks.append('advanced analytics renders in isolated Chromium')
 assert page.locator('#thresholdCriterion option').count()==3
 page.locator('#thresholdCriterion').select_option('c2');assert 'Service quality weight' in page.locator('#view').inner_text()
 checks.append('threshold selector works')
 page.locator('#robustRange').select_option('0.4');assert '40%' in page.locator('#view').inner_text()
 checks.append('simulation controls work')
 page.locator('#scenarioName').fill('Stress scenario');page.locator('#saveScenario').click();assert 'Stress scenario' in page.locator('#view').inner_text()
 checks.append('scenario save updates UI and simulated storage')
 page.locator('[data-load-scenario]').click();page.locator('[data-remove-scenario]').click();assert 'Stress scenario' not in page.locator('#view').inner_text()
 checks.append('scenario apply and remove works')
 page.locator('#scenarioName').fill('Portable scenario');page.locator('#saveScenario').click()
 with page.expect_download() as dl:page.locator('#exportProject').click()
 with tempfile.TemporaryDirectory() as d:
  file=Path(d)/'project.json';dl.value.save_as(file);project=json.loads(file.read_text());assert project['scenarios'][0]['name']=='Portable scenario'
  page.locator('[data-remove-scenario]').click();page.locator('#fileInput').set_input_files(str(file));page.locator('[data-step="3"]').click()
  assert 'Portable scenario' in page.locator('#view').inner_text()
 checks.append('JSON scenario export/import roundtrip')
 assert not errors,errors
 checks.append('no JavaScript page errors')
 browser.close()
for c in checks:print('PASS',c)
print(f'{len(checks)} isolated Chromium checks passed')
