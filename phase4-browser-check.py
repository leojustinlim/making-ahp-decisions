from playwright.sync_api import sync_playwright
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,os,tempfile,json
root=Path(__file__).parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(root),**k)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/index.html'
checks=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(base,wait_until='load');page.locator('[data-step="3"]').click()
  assert page.get_by_text('Advanced analytics').count()==1
  checks.append('module imports and advanced analytics render in HTTP-served Chromium')
  assert page.locator('#thresholdCriterion option').count()==3
  assert 'Weighted contributions' in page.locator('#view').inner_text()
  checks.append('contributions and sensitivity render')
  page.locator('#thresholdCriterion').select_option('c2')
  assert 'Service quality weight' in page.locator('#view').inner_text()
  checks.append('threshold criterion switching')
  page.locator('#robustRange').select_option('0.4')
  assert '40%' in page.locator('#view').inner_text()
  checks.append('robustness recalculation control')
  page.locator('#scenarioName').fill('Stress scenario');page.locator('#saveScenario').click()
  assert 'Stress scenario' in page.locator('#view').inner_text()
  checks.append('scenario capture')
  page.locator('[data-load-scenario]').click()
  assert page.locator('#resetSensitivity').count()==1
  page.locator('[data-remove-scenario]').click()
  assert 'Stress scenario' not in page.locator('#view').inner_text()
  checks.append('scenario apply and delete')
  page.locator('#scenarioName').fill('Persisted scenario');page.locator('#saveScenario').click()
  page.reload();page.locator('[data-step="3"]').click()
  assert 'Persisted scenario' in page.locator('#view').inner_text()
  checks.append('real Chromium localStorage persistence across HTTP reload')
  with page.expect_download() as dl: page.locator('#exportProject').click()
  with tempfile.TemporaryDirectory() as d:
   file=Path(d)/'project.json';dl.value.save_as(file);data=json.loads(file.read_text());assert data['scenarios'][0]['name']=='Persisted scenario'
   page.locator('[data-remove-scenario]').click();page.locator('#fileInput').set_input_files(str(file))
   page.locator('[data-step="3"]').click();assert 'Persisted scenario' in page.locator('#view').inner_text()
  checks.append('JSON download and reimport of scenarios')
  assert not errors,errors
  checks.append('no uncaught JavaScript errors')
  browser.close()
finally:server.shutdown()
for c in checks:print('PASS:',c)
print(f'Phase4 HTTP browser tests: {len(checks)} passed')
