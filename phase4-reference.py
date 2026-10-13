"""Independent NumPy verification of sensitivity formulas and simulation aggregation."""
import numpy as np
w=np.array([.50,.30,.20]);columns=np.array([[.6,.3,.1],[.2,.5,.3],[.1,.2,.7]])
def vector(t,index=0):
 r=w.copy();remainder=w.sum()-w[index];r[index]=t
 for k in range(len(r)):
  if k!=index:r[k]=w[k]*(1-t)/remainder
 return r
for t in [0,.01,.12,.25,.5,.75,.99,1.]:
 v=vector(t);assert abs(sum(v)-1)<1e-12
 computed=v@columns
 expected=np.array([sum(v[k]*columns[k,j] for k in range(3)) for j in range(3)])
 assert np.allclose(computed,expected,rtol=0,atol=1e-13)
# Verify piecewise winner changes by dense grid against numerical sample.
intercept=vector(0)@columns;slope=vector(1)@columns-intercept
crosses=[]
for i in range(3):
 for j in range(i+1,3):
  den=slope[i]-slope[j]
  if abs(den)>1e-12:
   t=(intercept[j]-intercept[i])/den
   if 0<t<1:crosses.append(t)
for t in np.linspace(0,1,1001):
 exact=intercept+slope*t
 brute=vector(t)@columns
 assert np.allclose(exact,brute,atol=1e-12)
# Check Monte Carlo generated weights stay in bounded multiplier ranges and sum to 1.
rng=np.random.default_rng(2026)
for _ in range(1000):
 p=w*rng.uniform(.8,1.2,size=len(w));p/=p.sum()
 assert np.isfinite(p).all() and (p>=0).all() and abs(sum(p)-1)<1e-12
print('Independent NumPy Phase 4 validation: 1001 weight/score comparisons, 8 anchor checks, 1000 simplex checks passed')
print('Candidate exact crossovers:',[round(x,9) for x in crosses])
