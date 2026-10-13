/** AHP calculation engine v0.1.0. No DOM, dependencies, persistence or network calls. */
export const RI_SAATY = Object.freeze([0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49]);
const EPS = 1e-12;
function fail(message) { throw new Error(message); }
function finite(v, label) { if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${label} must be a finite number`); return v; }
function normalize(v) { const s = v.reduce((a,b)=>a+b,0); if (!(s>0)) fail('Weights must have positive sum'); return v.map(x=>x/s); }
export function manualWeights(values, {percent=false}={}) {
  if (!Array.isArray(values) || !values.length) fail('Enter at least one weight');
  const w = values.map((v,i)=>finite(v,`Weight ${i+1}`));
  if (w.some(x=>x<0)) fail('Manual weights cannot be negative');
  const sum = w.reduce((a,b)=>a+b,0);
  if (!(sum>0)) fail('At least one weight must be positive');
  // Percent mode is a validation contract; it does not silently rescale an invalid sum.
  if (percent && Math.abs(sum-100)>1e-8) fail(`Percentage weights must sum to 100 (got ${sum})`);
  return normalize(w);
}
export function pairwiseMatrix(n, comparisons) {
  if (!Number.isInteger(n) || n<1 || n>10) fail('Pairwise matrix size must be 1 to 10 (published RI table support)');
  const a = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:null));
  for (const entry of comparisons) {
    if (!Array.isArray(entry) || entry.length!==3) fail('Comparison must be [row, column, value]');
    const [i,j,v] = entry;
    if (!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>=n||j>=n||i===j) fail('Comparison indices invalid');
    finite(v,'Comparison');
    if (v<1/9- EPS || v>9+EPS || v<=0) fail('Comparisons must be between 1/9 and 9');
    if (a[i][j]!==null && Math.abs(a[i][j]-v)>1e-10) fail(`Conflicting duplicate comparison ${i},${j}`);
    a[i][j]=v;a[j][i]=1/v;
  }
  return a;
}
export function calculatePairwise(matrix,{tolerance=1e-13,maxIterations=100000}={}) {
  if (!Array.isArray(matrix)||!matrix.length) fail('Matrix cannot be empty');
  const n=matrix.length;
  if(n>10) fail('Pairwise matrix exceeds supported RI table (10)');
  for(let i=0;i<n;i++) {
    if(!Array.isArray(matrix[i])||matrix[i].length!==n) fail('Matrix must be square');
    for(let j=0;j<n;j++) {
      const a=matrix[i][j];
      if(a===null || a===undefined) fail(`Missing comparison between ${i+1} and ${j+1}`);
      finite(a,`Matrix[${i}][${j}]`);
      if(a<=0) fail('Pairwise values must be positive');
      if(i===j && Math.abs(a-1)>1e-10) fail('Matrix diagonal must be 1');
      if(Math.abs(a*matrix[j][i]-1)>1e-9) fail('Matrix must be reciprocal');
    }
  }
  let w=Array(n).fill(1/n),iterations=0,converged=false;
  for(;iterations<maxIterations;iterations++) {
    const next=normalize(matrix.map(row=>row.reduce((s,a,j)=>s+a*w[j],0)));
    const difference=Math.max(...next.map((v,i)=>Math.abs(v-w[i])));
    w=next;
    if(difference<tolerance){converged=true;iterations++;break;}
  }
  if(!converged) fail('Eigenvector iteration did not converge');
  const aw=matrix.map(row=>row.reduce((s,a,j)=>s+a*w[j],0));
  const lambda=aw.reduce((s,v,i)=>s+v/w[i],0)/n;
  const residual=Math.max(...aw.map((v,i)=>Math.abs(v-lambda*w[i])));
  if(residual>1e-8) fail('Eigenvector residual exceeds acceptable tolerance');
  const ci=n<=2?0:Math.max(0,(lambda-n)/(n-1));
  const cr=n<=2?0:ci/RI_SAATY[n];
  return {weights:w,lambdaMax:lambda,consistencyIndex:ci,consistencyRatio:cr,consistent:cr<=0.1+1e-12,iterations,residual,ri:RI_SAATY[n],method:'principal-eigenvector'};
}
export function calculateComparisons(n,entries) { return calculatePairwise(pairwiseMatrix(n,entries)); }
/** Tree: {id, weight?:number, children?:[]}. Weight is local to its parent; roots are an array. */
export function hierarchyGlobalWeights(roots) {
  if(!Array.isArray(roots)||!roots.length) fail('Hierarchy requires root criteria');
  const leaf=[];const seen=new Set();
  function visit(children,parentWeight,path) {
    const weights=manualWeights(children.map(c=>c.weight));
    children.forEach((node,i)=>{
      if(!node || typeof node.id!=='string'||!node.id.trim()||seen.has(node.id)) fail('Hierarchy IDs must be unique, non-empty strings');
      seen.add(node.id);
      const global=parentWeight*weights[i];
      if(node.children!==undefined && (!Array.isArray(node.children)||!node.children.length)) fail('Children must be nonempty');
      if(node.children) visit(node.children,global,[...path,node.id]);
      else leaf.push({id:node.id,globalWeight:global,path:[...path,node.id]});
    });
  }
  visit(roots,1,[]);
  return leaf;
}
/** Distributive AHP synthesis. Each criterion column is a probability distribution over alternatives. */
export function synthesize(alternativeIds, criteriaWeights, prioritiesByCriterion) {
  if(!Array.isArray(alternativeIds)||!alternativeIds.length || new Set(alternativeIds).size!==alternativeIds.length) fail('Unique alternatives required');
  const weights=manualWeights(criteriaWeights);
  if(!Array.isArray(prioritiesByCriterion)||prioritiesByCriterion.length!==weights.length) fail('Priority columns must match criteria');
  const columns=prioritiesByCriterion.map((c,i)=>{
    if(!Array.isArray(c)||c.length!==alternativeIds.length) fail(`Criterion ${i+1} has incorrect alternative count`);
    const scores=c.map((v,j)=>finite(v,`Priority ${i+1},${j+1}`));
    if(scores.some(v=>v<0)) fail('Priorities cannot be negative');
    const sum=scores.reduce((a,b)=>a+b,0);
    if(Math.abs(sum-1)>1e-8) fail(`Criterion ${i+1} priorities must sum to 1`);
    return scores;
  });
  const results=alternativeIds.map((id,j)=>({id,score:weights.reduce((s,w,i)=>s+w*columns[i][j],0)}));
  results.sort((a,b)=>b.score-a.score || String(a.id).localeCompare(String(b.id)));
  return results.map((r,i)=>({...r,rank:i+1}));
}
/** Optional objective data conversion, NOT classical AHP pairwise priorities. Explicit fixed anchors. */
export function linearUtility(value,{worst,best,direction='maximize'}={}) {
  finite(value,'Value');finite(worst,'Worst anchor');finite(best,'Best anchor');
  if(direction!=='minimize' && direction!=='maximize') fail('Direction must be minimize or maximize');
  if(worst===best) fail('Best and worst anchors must differ');
  if(direction==='maximize' && !(best>worst)) fail('For maximize, best must exceed worst');
  if(direction==='minimize' && !(best<worst)) fail('For minimize, best must be smaller than worst');
  return Math.max(0,Math.min(1,(value-worst)/(best-worst)));
}
/** Points are {id,objectives:{key:finiteNumber}}; directions maps key to minimize/maximize. */
export function paretoFront(points,directions,{epsilon=1e-10}={}) {
  if(!Array.isArray(points)||!points.length) fail('Points required');
  if(!directions||!Object.keys(directions).length) fail('At least one objective required');
  if(!Number.isFinite(epsilon)||epsilon<0) fail('Invalid epsilon');
  const keys=Object.keys(directions);
  const ids=new Set();
  for(const p of points){
    if(ids.has(p.id)) fail('Point IDs must be unique'); ids.add(p.id);
    keys.forEach(k=>{if(!['minimize','maximize'].includes(directions[k])) fail('Objective direction invalid');finite(p.objectives?.[k],`Objective ${k}`);});
  }
  function dominates(a,b){
    let strictlyBetter=false;
    for(const k of keys){
      const sign=directions[k]==='maximize'?1:-1;
      const delta=sign*(a.objectives[k]-b.objectives[k]);
      if(delta< -epsilon)return false;
      if(delta>epsilon)strictlyBetter=true;
    }
    return strictlyBetter;
  }
  return points.map(p=>({...p,efficient:!points.some(other=>other!==p&&dominates(other,p)),dominatedBy:points.filter(other=>other!==p&&dominates(other,p)).map(o=>o.id)}));
}
