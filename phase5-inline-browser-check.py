from playwright.sync_api import sync_playwright
from pathlib import Path
import re,tempfile,json
root=Path(__file__).parent;s=(root/'index.html').read_text()
modules=[]
for f in ['ahp-engine.mjs','project-validation.mjs','advanced-analytics.mjs','hierarchy.mjs','reporting.mjs']:
 src=(root/f).read_text();src=re.sub(r'^import .*?;\s*','',src,flags=re.M);src=re.sub(r'\bexport (const|function)\b',r'\1',src);modules.append(src)
s=re.sub(r"import .*?from './.*?';",'',s)
s=s.replace('<script type="module">','<script>'+'\n'.join(modules)+'\n')
s=s.replace('<head>','<head><script>window.__storage=window.__storage||{};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>{window.__storage[k]=String(v)}}});</script>')
checks=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(s)
 assert page.get_by_text('AHP Decision Studio').count()==1;checks.append('app loaded')
 page.locator('#hierarchyEnabled').check()
 print('ERR',errors,'BODY',page.locator('#view').inner_text()[-500:]);assert page.locator('[data-criterion-group]').count()==3;checks.append('hierarchy editor visible')
 page.locator('[data-step="1"]').click()
 assert 'Global leaf weights' in page.locator('#view').inner_text();checks.append('hierarchical manual priorities computed')
 page.locator('input[name="hm"][value="pairwise"]').check()
 assert 'Hierarchical weighting' in page.locator('#view').inner_text();checks.append('hierarchical pairwise UI')
 page.locator('[data-step="0"]').click();page.locator('#hierarchyEnabled').uncheck()
 page.locator('[data-step="3"]').click()
 with page.expect_download() as dl:page.locator('#exportExcel').click()
 with tempfile.TemporaryDirectory() as d:
  file=Path(d)/'report.xml';dl.value.save_as(file)
  assert '<Workbook' in file.read_text();checks.append('Excel XML export')
 with page.expect_download() as dl:page.locator('#exportReport').click()
 with tempfile.TemporaryDirectory() as d:
  file=Path(d)/'report.html';dl.value.save_as(file)
  assert 'Print / Save as PDF' in file.read_text();checks.append('printable report export')
 assert not errors,errors
 checks.append('no browser script errors')
 browser.close()
print('\n'.join('PASS '+x for x in checks));print(len(checks),'isolated Chromium checks passed')
