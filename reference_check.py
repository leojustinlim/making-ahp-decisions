"""Independent NumPy reference: exact eigendecomposition, not power iteration."""
import json, subprocess
import numpy as np

cases = [
    [[1,2,4],[.5,1,2],[.25,.5,1]],
    [[1,3,5,7],[1/3,1,2,4],[1/5,.5,1,3],[1/7,.25,1/3,1]],
    [[1,9,1/9],[1/9,1,9],[9,1/9,1]],
    [[1,1,1],[1,1,1],[1,1,1]],
    [[1,7],[1/7,1]],
]
script='''import {calculatePairwise} from './ahp-engine.mjs'; let data=JSON.parse(process.argv[1]); console.log(JSON.stringify(data.map(m=>calculatePairwise(m))));'''
run=subprocess.run(['node','--input-type=module','-e',script,json.dumps(cases)],cwd=__import__('pathlib').Path(__file__).parent,capture_output=True,text=True,check=True)
actual=json.loads(run.stdout)
for i,(m,r) in enumerate(zip(cases,actual)):
    a=np.array(m,dtype=float)
    eigval,eigvec=np.linalg.eig(a)
    k=np.argmax(eigval.real)
    lam=eigval[k].real
    w=eigvec[:,k].real
    if np.sum(w)<0: w=-w
    w=w/w.sum()
    assert np.allclose(r['weights'],w,atol=1e-10), (i,r['weights'],w)
    assert abs(r['lambdaMax']-lam)<1e-9,(i,r['lambdaMax'],lam)
    assert np.linalg.norm(a@w-lam*w,ord=np.inf)<1e-9
    print(f'Case {i+1}: PASS | lambda={lam:.12f}, weights={np.round(w,9)}, CR={r["consistencyRatio"]:.8f}')
print(f'Independent NumPy eigensolver: {len(cases)}/{len(cases)} comparisons passed')
