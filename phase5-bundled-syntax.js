/** AHP calculation engine v0.1.0. No DOM, dependencies, persistence or network calls. */
const RI_SAATY = Object.freeze([0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49]);
const EPS = 1e-12;
function fail(message) { throw new Error(message); }
function finite(v, label) { if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${label} must be a finite number`); return v; }
function normalize(v) { const s = v.reduce((a,b)=>a+b,0); if (!(s>0)) fail('Weights must have positive sum'); return v.map(x=>x/s); }
function manualWeights(values, {percent=false}={}) {
  if (!Array.isArray(values) || !values.length) fail('Enter at least one weight');
  const w = values.map((v,i)=>finite(v,`Weight ${i+1}`));
  if (w.some(x=>x<0)) fail('Manual weights cannot be negative');
  const sum = w.reduce((a,b)=>a+b,0);
  if (!(sum>0)) fail('At least one weight must be positive');
  // Percent mode is a validation contract; it does not silently rescale an invalid sum.
  if (percent && Math.abs(sum-100)>1e-8) fail(`Percentage weights must sum to 100 (got ${sum})`);
  return normalize(w);
}
function pairwiseMatrix(n, comparisons) {
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
function calculatePairwise(matrix,{tolerance=1e-13,maxIterations=100000}={}) {
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
function calculateComparisons(n,entries) { return calculatePairwise(pairwiseMatrix(n,entries)); }
/** Tree: {id, weight?:number, children?:[]}. Weight is local to its parent; roots are an array. */
function hierarchyGlobalWeights(roots) {
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
function synthesize(alternativeIds, criteriaWeights, prioritiesByCriterion) {
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
function linearUtility(value,{worst,best,direction='maximize'}={}) {
  finite(value,'Value');finite(worst,'Worst anchor');finite(best,'Best anchor');
  if(direction!=='minimize' && direction!=='maximize') fail('Direction must be minimize or maximize');
  if(worst===best) fail('Best and worst anchors must differ');
  if(direction==='maximize' && !(best>worst)) fail('For maximize, best must exceed worst');
  if(direction==='minimize' && !(best<worst)) fail('For minimize, best must be smaller than worst');
  return Math.max(0,Math.min(1,(value-worst)/(best-worst)));
}
/** Points are {id,objectives:{key:finiteNumber}}; directions maps key to minimize/maximize. */
function paretoFront(points,directions,{epsilon=1e-10}={}) {
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

/** Validate untrusted JSON before loading it into the interface. */
function validateProject(p) {
  const fail=m=>{throw new Error(`Invalid project: ${m}`)};
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  if(!object(p)||p.version!==1)fail('unsupported version');
  if(typeof p.title!=='string'||p.title.length>300)fail('title');
  const collection=(list,label,min,max)=>{
    if(!Array.isArray(list)||list.length<min||list.length>max)fail(label+' count');
    const ids=new Set();
    for(const x of list){if(!object(x)||typeof x.id!=='string'||!x.id||x.id.length>80||x.id.includes('|')||['__proto__','constructor','prototype'].includes(x.id)||ids.has(x.id)||typeof x.name!=='string'||x.name.length>200)fail(label+' items');ids.add(x.id)}
    return ids;
  };
  const criteria=collection(p.criteria,'criteria',1,10),alts=collection(p.alternatives,'alternatives',1,10),objectives=collection(p.objectives,'objectives',1,8);
  if(!['manual','pairwise'].includes(p.weightMethod)||!['scores','pairwise'].includes(p.evaluationMethod))fail('method');
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  for(const c of p.criteria)if(!(c.weight===null||finite(c.weight))||(finite(c.weight)&&c.weight<0))fail('criterion weight');
  const record=(x,label)=>{if(!object(x))fail(label);return x};
  const judgements=(x,ids,label)=>{record(x,label);for(const [key,v] of Object.entries(x)){const pair=key.split('|');if(pair.length!==2||!ids.has(pair[0])||!ids.has(pair[1])||pair[0]===pair[1]||!finite(v)||v<1/9-1e-12||v>9+1e-12)fail(label+' values')}};
  judgements(p.criteriaComparisons,criteria,'criterion comparisons');
  record(p.altComparisons,'alternative comparisons');for(const [cid,vals] of Object.entries(p.altComparisons)){if(!criteria.has(cid))fail('unknown criterion');judgements(vals,alts,'alternative comparisons')}
  record(p.scores,'scores');for(const [cid,vals] of Object.entries(p.scores)){if(!criteria.has(cid))fail('unknown score criterion');record(vals,'score values');for(const [aid,v] of Object.entries(vals))if(!alts.has(aid)||!(v===null||finite(v))||(finite(v)&&v<0))fail('scores')}
  for(const o of p.objectives){if(!['minimize','maximize'].includes(o.direction))fail('objective direction');record(o.values,'objective values');for(const [aid,v] of Object.entries(o.values))if(!alts.has(aid)||!(v===''||finite(v)))fail('objective values')}
  if(p.weightAdjustment!==null){if(!Array.isArray(p.weightAdjustment)||p.weightAdjustment.length!==p.criteria.length||p.weightAdjustment.some(x=>!finite(x)||x<0)||Math.abs(p.weightAdjustment.reduce((a,b)=>a+b,0)-1)>1e-8)fail('sensitivity weights')}
  if(p.scenarios!==undefined){if(!Array.isArray(p.scenarios)||p.scenarios.length>12)fail('scenarios count');for(const s of p.scenarios){if(!object(s)||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!Array.isArray(s.criteriaIds)||s.criteriaIds.length!==p.criteria.length||s.criteriaIds.some((id,i)=>id!==p.criteria[i].id)||!Array.isArray(s.weights)||s.weights.length!==p.criteria.length||s.weights.some(x=>!finite(x)||x<0)||Math.abs(s.weights.reduce((a,b)=>a+b,0)-1)>1e-8)fail('scenario data')}}
  return p;
}

/** Pure Phase 4 analytics. All weights nonnegative and normalized. */
const advancedFinite=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(x))throw Error(`${label} must be advancedFinite`);return x};
function validate(w,cols){const weights=manualWeights(w);if(!Array.isArray(cols)||cols.length!==weights.length)throw Error('Criterion columns do not match weights');const n=cols[0]?.length;if(!n||cols.some(c=>!Array.isArray(c)||c.length!==n))throw Error('Invalid alternative columns');for(const c of cols)for(const v of c)if(advancedFinite(v,'Priority')<0)throw Error('Negative priority');return {weights,n};}
function scoreBreakdown(weights,columns,ids){const {weights:w,n}=validate(weights,columns);if(!Array.isArray(ids)||ids.length!==n||new Set(ids).size!==n)throw Error('Invalid alternative IDs');return ids.map((id,j)=>({id,contributions:w.map((weight,i)=>weight*columns[i][j]),score:w.reduce((s,weight,i)=>s+weight*columns[i][j],0)}));}
/** Vary selected weight t from 0 to 1; redistribute all remaining weights in their original proportions. */
function weightsAt(weights,index,t){const w=manualWeights(weights);if(!Number.isInteger(index)||index<0||index>=w.length)throw Error('Invalid criterion index');advancedFinite(t,'Selected weight');if(t<0||t>1)throw Error('Selected weight outside 0..1');if(w.length===1)return [1];const rest=1-w[index];return w.map((v,i)=>i===index?t:rest>1e-14?v*(1-t)/rest:(1-t)/(w.length-1));}
/** Exact piecewise-linear winner boundaries; ties reported at boundaries. */
function sensitivityThresholds(weights,columns,index,ids,{epsilon=1e-9}={}){const {n}=validate(weights,columns);if(!Array.isArray(ids)||ids.length!==n||new Set(ids).size!==n)throw Error('Invalid alternative IDs');const left=scoreBreakdown(weightsAt(weights,index,0),columns,ids),right=scoreBreakdown(weightsAt(weights,index,1),columns,ids);const intercept=left.map(x=>x.score),slope=right.map((x,i)=>x.score-intercept[i]);const points=[0,1];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const den=slope[i]-slope[j];if(Math.abs(den)<1e-13)continue;const t=(intercept[j]-intercept[i])/den;if(t>epsilon&&t<1-epsilon)points.push(t)}points.sort((a,b)=>a-b);const unique=points.filter((v,i)=>!i||v-points[i-1]>epsilon);const getWinners=t=>{const scores=intercept.map((x,i)=>x+slope[i]*t);const best=Math.max(...scores);return ids.filter((id,i)=>best-scores[i]<=epsilon)};return {boundaries:unique.map(t=>({weight:t,winners:getWinners(t)})),intervals:unique.slice(1).map((end,i)=>({from:unique[i],to:end,winners:getWinners((unique[i]+end)/2)})).filter(x=>x.to-x.from>epsilon)};}
function compareScenarios(scenarios,columns,ids){if(!Array.isArray(scenarios)||!scenarios.length)throw Error('Scenarios required');return scenarios.map(s=>{if(typeof s.name!=='string'||!s.name.trim())throw Error('Scenario name required');const rows=scoreBreakdown(s.weights,columns,ids).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));return {name:s.name,weights:manualWeights(s.weights),results:rows.map((x,i)=>({...x,rank:i+1}))};});}
/** Repeatable Monte Carlo over a bounded simplex: rejection sampler, explicitly reports effective draws. */
function robustness(weights,columns,ids,{relativeRange=0.2,samples=2000,seed=2026}={}){const {weights:w,n}=validate(weights,columns);if(!Array.isArray(ids)||ids.length!==n||new Set(ids).size!==n)throw Error('Invalid alternative IDs');advancedFinite(relativeRange,'Range');if(relativeRange<0||relativeRange>1)throw Error('Range must be 0..1');if(!Number.isInteger(samples)||samples<1||samples>100000)throw Error('Invalid sample count');if(!Number.isInteger(seed))throw Error('Seed must be integer');let rngState=seed>>>0;function rand(){rngState=(Math.imul(1664525,rngState)+1013904223)>>>0;return rngState/4294967296;}const wins=Array(n).fill(0),rankSums=Array(n).fill(0);let tieDraws=0;for(let s=0;s<samples;s++){const perturbed=w.map(x=>x*(1+relativeRange*(2*rand()-1)));const ww=manualWeights(perturbed);const scores=ids.map((_,j)=>ww.reduce((acc,wt,i)=>acc+wt*columns[i][j],0));const best=Math.max(...scores);const winners=scores.map((x,i)=>best-x<=1e-12?i:-1).filter(i=>i>=0);if(winners.length>1)tieDraws++;for(const i of winners)wins[i]+=1/winners.length;const order=[...scores.keys()].sort((a,b)=>scores[b]-scores[a]||a-b);order.forEach((j,r)=>rankSums[j]+=r+1);}return {samples,seed,relativeRange,tieDraws,results:ids.map((id,j)=>({id,firstShare:wins[j]/samples,meanRank:rankSums[j]/samples})),interpretation:'Simulation under independently bounded uniform weight multipliers, followed by normalization; not a probability of real-world success.'};}
function projectionFront(points,directions,xKey,yKey){if(xKey===yKey)throw Error('Choose two different axes');const all=paretoFront(points,directions);const subset=paretoFront(points,{[xKey]:directions[xKey],[yKey]:directions[yKey]});return all.map((p,i)=>({...p,efficient2D:subset[i].efficient,efficientAll:p.efficient}));}

function hierarchyWeights(project){
  const h=project.hierarchy;
  if(!h?.enabled) throw Error('Hierarchy is not enabled');
  const groups=h.groups;
  if(!Array.isArray(groups)||groups.length<1||groups.length>10)throw Error('Add between 1 and 10 groups');
  const derive=(items,method,comparisons,label)=>{
    if(method==='manual')return manualWeights(items.map(x=>x.weight),{percent:true});
    if(method!=='pairwise')throw Error(`Invalid weighting method for ${label}`);
    const edges=[];
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const v=comparisons?.[`${items[i].id}|${items[j].id}`];
      if(v===undefined)throw Error(`Complete comparisons for ${label}: ${items[i].name} vs ${items[j].name}`);
      edges.push([i,j,v]);
    }
    return calculateComparisons(items.length,edges).weights;
  };
  const root=derive(groups,h.method,h.groupComparisons,'groups');
  const byId=new Map();const diagnostics=[];
  if(h.method==='pairwise')diagnostics.push({name:'Groups',cr:calcCR(groups,h.groupComparisons)});
  groups.forEach((g,i)=>{
    const children=project.criteria.filter(c=>c.groupId===g.id);
    if(children.length<1)throw Error(`Group ${g.name} has no criteria`);
    const local=derive(children,h.method,h.childComparisons?.[g.id],`group ${g.name}`);
    if(h.method==='pairwise')diagnostics.push({name:g.name,cr:calcCR(children,h.childComparisons?.[g.id])});
    children.forEach((c,j)=>byId.set(c.id,root[i]*local[j]));
  });
  if(byId.size!==project.criteria.length)throw Error('Assign every criterion to exactly one group');
  return {weights:project.criteria.map(c=>byId.get(c.id)),diagnostics};
}
function calcCR(items,comparisons){
  const edges=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)edges.push([i,j,comparisons[`${items[i].id}|${items[j].id}`]]);
  return calculateComparisons(items.length,edges).consistencyRatio;
}
function validateHierarchy(project){
  const h=project.hierarchy;if(h===undefined)return true;
  const fail=s=>{throw Error('Invalid hierarchy: '+s)};
  if(!h||typeof h!=='object'||Array.isArray(h)||typeof h.enabled!=='boolean'||!['manual','pairwise'].includes(h.method))fail('configuration');
  if(!Array.isArray(h.groups)||h.groups.length<1||h.groups.length>10)fail('group count');
  const ids=new Set();for(const g of h.groups){if(!g||typeof g.id!=='string'||!g.id||g.id.includes('|')||['__proto__','constructor','prototype'].includes(g.id)||ids.has(g.id)||typeof g.name!=='string'||g.name.length>200||!(g.weight===null||typeof g.weight==='number'&&Number.isFinite(g.weight)&&g.weight>=0))fail('group');ids.add(g.id)}
  if(h.enabled){for(const c of project.criteria)if(!ids.has(c.groupId))fail('unassigned criterion');for(const g of h.groups)if(!project.criteria.some(c=>c.groupId===g.id))fail('empty group')}
  for(const [record,validIds] of [[h.groupComparisons,ids]]){if(!record||typeof record!=='object'||Array.isArray(record))fail('group comparisons');checkPairs(record,validIds,fail)}
  if(!h.childComparisons||typeof h.childComparisons!=='object'||Array.isArray(h.childComparisons))fail('child comparisons');
  for(const [gid,pairs] of Object.entries(h.childComparisons)){if(!ids.has(gid))fail('unknown child group');checkPairs(pairs,new Set(project.criteria.filter(c=>c.groupId===gid).map(c=>c.id)),fail)}
  return true;
}
function checkPairs(record,ids,fail){if(!record||typeof record!=='object'||Array.isArray(record))fail('comparison record');for(const [k,v] of Object.entries(record)){const [a,b,...extra]=k.split('|');if(extra.length||!ids.has(a)||!ids.has(b)||a===b||typeof v!=='number'||!Number.isFinite(v)||v<1/9-1e-12||v>9+1e-12)fail('comparison judgment')}}
function resetHierarchyComparisons(p){if(p.hierarchy){p.hierarchy.groupComparisons={};p.hierarchy.childComparisons={};}p.weightAdjustment=null;p.scenarios=[];}

const reportEscape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x).toFixed(6);
function reportData(project,results,{consistency=[]}={}){
  if(!results||!Array.isArray(results.weights)||!Array.isArray(results.columns)||!Array.isArray(results.ranked))throw Error('Complete the analysis before exporting');
  const {criteria,alternatives,objectives}=project;
  const directions=Object.fromEntries(objectives.map(o=>[o.id,o.direction]));
  const complete=alternatives.every(a=>objectives.every(o=>typeof o.values[a.id]==='number'&&Number.isFinite(o.values[a.id])));
  const frontier=complete?paretoFront(alternatives.map(a=>({id:a.id,objectives:Object.fromEntries(objectives.map(o=>[o.id,o.values[a.id]]))})),directions):null;
  return {title:project.title,weightMethod:project.hierarchy?.enabled?`Hierarchical ${project.hierarchy.method}`:project.weightMethod,evaluationMethod:project.evaluationMethod,criteria:criteria.map((c,i)=>({id:c.id,name:c.name,group:project.hierarchy?.enabled?project.hierarchy.groups.find(g=>g.id===c.groupId)?.name:'',weight:results.weights[i]})),alternatives:alternatives.map(a=>({id:a.id,name:a.name})),contributions:alternatives.map((a,j)=>({id:a.id,name:a.name,values:criteria.map((c,i)=>results.weights[i]*results.columns[i][j]),total:results.weights.reduce((s,w,i)=>s+w*results.columns[i][j],0)})),rankings:results.ranked.map(r=>({name:alternatives.find(a=>a.id===r.id)?.name,rank:r.rank,score:r.score})),objectives:objectives.map(o=>({name:o.name,direction:o.direction,values:alternatives.map(a=>o.values[a.id])})),frontier:frontier?.map(f=>({name:alternatives.find(a=>a.id===f.id)?.name,efficient:f.efficient}))??null,consistency,scenarios:project.scenarios??[],limits:['Scores are relative distributive priorities and may exhibit rank reversal.','Direct score inputs must represent nonnegative benefits, not raw costs.','Manual weights do not have a consistency ratio.','Pareto results describe only the specified measurable objectives, not overall AHP ranking.','Weight sensitivity and stochastic robustness have different interpretations.']};
}
function reportHTML(r){
  const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${reportEscape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${reportEscape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${reportEscape(r.title)} — Decision report</title><style>body{font:14px system-ui,Arial;color:#1d2939;max-width:980px;margin:35px auto;padding:0 24px;line-height:1.5}h1{color:#163f70}h2{border-bottom:1px solid #cfd8e3;padding-top:22px}table{border-collapse:collapse;width:100%;margin:12px 0 20px;font-size:12px}td,th{padding:8px;text-align:left;border:1px solid #d8dee8}th{background:#edf3fa}small{color:#536376}.note{border-left:3px solid #2d6fac;padding:10px 14px;background:#f3f7fc}.no-print{margin-bottom:22px}button{padding:10px 16px;cursor:pointer}@media print{.no-print{display:none}body{margin:0;max-width:none}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}</style></head><body><div class="no-print"><button onclick="window.print()">Print / Save as PDF</button> <small>Use your browser's PDF destination.</small></div><h1>${reportEscape(r.title)}</h1><p>Decision analysis report · ${reportEscape(r.weightMethod)} weighting · ${reportEscape(r.evaluationMethod)} evaluation</p><h2>Decision ranking</h2>${table(['Rank','Alternative','Priority'],r.rankings.map(z=>[z.rank,z.name,fmt(z.score)]))}<h2>Global criterion weights</h2>${table(['Group','Criterion','Global weight'],r.criteria.map(c=>[c.group||'—',c.name,fmt(c.weight)]))}<h2>Weighted score breakdown</h2>${table(['Alternative',...r.criteria.map(c=>c.name),'Overall'],r.contributions.map(z=>[z.name,...z.values.map(fmt),fmt(z.total)]))}<h2>Pairwise consistency diagnostics</h2>${r.consistency.length?table(['Matrix','Consistency ratio'],r.consistency.map(z=>[z.name,fmt(z.cr)])):'<p>No pairwise consistency diagnostic for the selected weighting/evaluation mode.</p>'}<h2>Measured objectives</h2>${table(['Objective','Direction',...r.alternatives.map(a=>a.name)],r.objectives.map(o=>[o.name,o.direction,...o.values.map(v=>v??'Missing')]))}<h2>Pareto status</h2>${r.frontier?table(['Alternative','Full-dimensional status'],r.frontier.map(f=>[f.name,f.efficient?'Nondominated':'Dominated'])):'<p>Objective values incomplete — no Pareto classification available.</p>'}<h2>Saved scenarios</h2>${r.scenarios.length?table(['Scenario',...r.criteria.map(c=>c.name)],r.scenarios.map(s=>[s.name,...s.weights.map(fmt)])):'<p>No saved scenarios.</p>'}<h2>Methodological notes</h2><div class="note"><ul>${r.limits.map(x=>`<li>${reportEscape(x)}</li>`).join('')}</ul></div><p><small>Values are calculated locally. This report represents project inputs at the time of export.</small></p></body></html>`;
}
function workbookXML(r){
 const x=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const sheet=(name,rows)=>`<Worksheet ss:Name="${x(name)}"><Table>${rows.map(row=>`<Row>${row.map(v=>`<Cell><Data ss:Type="${typeof v==='number'&&Number.isFinite(v)?'Number':'String'}">${x(v)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet>`;
 return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet('Ranking',[['Rank','Alternative','Priority'],...r.rankings.map(z=>[z.rank,z.name,z.score])])}${sheet('Criteria',[['Group','Criterion','Global weight'],...r.criteria.map(c=>[c.group,c.name,c.weight])])}${sheet('Contributions',[['Alternative',...r.criteria.map(c=>c.name),'Overall'],...r.contributions.map(z=>[z.name,...z.values,z.total])])}${sheet('Diagnostics',[['Matrix','Consistency ratio'],...r.consistency.map(z=>[z.name,z.cr])])}${sheet('Objectives',[['Objective','Direction',...r.alternatives.map(a=>a.name)],...r.objectives.map(o=>[o.name,o.direction,...o.values])])}${sheet('Pareto',[['Alternative','Nondominated'],...(r.frontier??[]).map(f=>[f.name,f.efficient?'Yes':'No'])])}</Workbook>`;
}







const KEY='ahp-decision-studio-v1';const names=['Setup','Criteria weights','Evaluate options','Results & frontier'];let step=0;
const newProject=()=>({version:1,title:'Selecting a service provider',criteria:[{id:'c1',name:'Cost',weight:40},{id:'c2',name:'Service quality',weight:35},{id:'c3',name:'Sustainability',weight:25}],alternatives:[{id:'a1',name:'Provider A'},{id:'a2',name:'Provider B'},{id:'a3',name:'Provider C'}],weightMethod:'manual',criteriaComparisons:{},evaluationMethod:'scores',scores:{c1:{a1:8,a2:6,a3:9},c2:{a1:7,a2:9,a3:5},c3:{a1:6,a2:8,a3:7}},altComparisons:{},objectives:[{id:'o1',name:'Annual cost (S$ thousand)',direction:'minimize',values:{a1:90,a2:110,a3:80}},{id:'o2',name:'Technical quality',direction:'maximize',values:{a1:75,a2:90,a3:65}}],weightAdjustment:null,scenarios:[]});
let p;try{const raw=localStorage.getItem(KEY);p=raw?JSON.parse(raw):newProject();validateProject(p);validateHierarchy(p);p.scenarios??=[];}catch{p=newProject();}
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const uid=()=>Math.random().toString(36).slice(2,11);const uiFmt=v=>Number(v).toFixed(3);const sum=a=>a.reduce((x,y)=>x+y,0);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(p));$('saveStatus').textContent='Saved locally ✓';}catch{$('saveStatus').textContent='Autosave unavailable — export your file';}}
function update(fn){fn();persist();render();}
function options(items,current){return items.map(x=>`<option value="${esc(x.id)}" ${x.id===current?'selected':''}>${esc(x.name)}</option>`).join('');}
function pairKey(a,b){return `${a}|${b}`;}
function comparisonRows(items,data,handler){let html='<div class="table-scroll"><table><thead><tr><th>Compared with</th><th>Preference</th><th>Judgment</th></tr></thead><tbody>';for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j],k=pairKey(a.id,b.id),v=data[k]??1;html+=`<tr><td>${esc(a.name)} vs ${esc(b.name)}</td><td><select data-${handler}="${esc(k)}">${[9,8,7,6,5,4,3,2,1,1/2,1/3,1/4,1/5,1/6,1/7,1/8,1/9].map(x=>`<option value="${x}" ${Math.abs(x-v)<1e-9?'selected':''}>${x>=1?`${x}: ${esc(a.name)} preferred`:`1/${Math.round(1/x)}: ${esc(b.name)} preferred`}${x===1?' (equal)':''}</option>`).join('')}</select></td><td><span class="tag">${v===1?'Equal':v>1?`${v} : 1`:`1 : ${Math.round(1/v)}`}</span></td></tr>`;}
return html+'</tbody></table></div>';}
function entries(items,data){const e=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const v=data[pairKey(items[i].id,items[j].id)];if(v===undefined)throw Error(`Complete all pairwise judgments (${items[i].name} versus ${items[j].name})`);e.push([i,j,v]);}return e;}
function getWeights(){if(p.hierarchy?.enabled)return hierarchyWeights(p).weights;return p.weightMethod==='manual'?manualWeights(p.criteria.map(c=>c.weight),{percent:true}):calculateComparisons(p.criteria.length,entries(p.criteria,p.criteriaComparisons)).weights;}
function getResults(){const w=p.weightAdjustment??getWeights();const columns=p.criteria.map(c=>{if(p.evaluationMethod==='scores'){const v=p.alternatives.map(a=>p.scores[c.id]?.[a.id]);if(v.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0))throw Error(`Missing/invalid score under ${c.name}`);return manualWeights(v);}return calculateComparisons(p.alternatives.length,entries(p.alternatives,p.altComparisons[c.id]??{})).weights;});return {weights:w,columns,ranked:synthesize(p.alternatives.map(a=>a.id),w,columns)};}
function baseView(){return `<section class="card"><label>Decision/project title<input id="title" type="text" value="${esc(p.title)}"></label><div class="grid"><div><h2>Criteria <span class="tag">${p.criteria.length} / 10</span></h2><div id="criteriaFields">${p.criteria.map((c,i)=>`<div class="row"><input class="grow" data-criterion="${esc(c.id)}" aria-label="Criterion ${i+1}" value="${esc(c.name)}"><button class="danger" data-delete-criterion="${esc(c.id)}" ${p.criteria.length<=1?'disabled':''}>×</button></div>`).join('')}</div><button id="addCriterion" ${p.criteria.length>=10?'disabled':''}>+ Add criterion</button></div><div><h2>Alternatives <span class="tag">${p.alternatives.length} / 10</span></h2>${p.alternatives.map((a,i)=>`<div class="row"><input class="grow" data-alternative="${esc(a.id)}" aria-label="Alternative ${i+1}" value="${esc(a.name)}"><button class="danger" data-delete-alternative="${esc(a.id)}" ${p.alternatives.length<=1?'disabled':''}>×</button></div>`).join('')}<button id="addAlternative" ${p.alternatives.length>=10?'disabled':''}>+ Add alternative</button></div></div><p>Up to 10 leaf criteria and 10 alternatives in this release. Use concise, distinct names.</p>${hierarchySetupView()}</section>`;}
function initHierarchy(){if(!p.hierarchy)p.hierarchy={enabled:false,method:'manual',groups:[{id:'g1',name:'Primary objectives',weight:100}],groupComparisons:{},childComparisons:{}};for(const c of p.criteria)c.groupId??=p.hierarchy.groups[0].id;}
function hierarchySetupView(){const h=p.hierarchy;return `<div class="outline"><h2>Decision hierarchy</h2><label class="inline"><input type="checkbox" id="hierarchyEnabled" ${h?.enabled?'checked':''}> Use criterion groups / subcriteria</label><p class="help">Two-level hierarchy: group → leaf criterion → alternatives. Local weights multiply to global weights. Flat AHP remains available when unchecked.</p>${h?.enabled?`<div class="grid">${h.groups.map(g=>`<div class="card"><div class="row"><input class="grow" data-group-name="${esc(g.id)}" aria-label="Group name" value="${esc(g.name)}"><button data-delete-group="${esc(g.id)}" class="danger" ${h.groups.length===1?'disabled':''}>Remove</button></div><div class="outline">${p.criteria.filter(c=>c.groupId===g.id).map(c=>`<div class="row"><span>${esc(c.name)}</span></div>`).join('')||'<span class="warning">Assign a criterion to this group.</span>'}</div></div>`).join('')}</div><button id="addGroup" ${h.groups.length>=10?'disabled':''}>+ Add group</button><h3>Assign leaf criteria to groups</h3>${p.criteria.map(c=>`<div class="row"><span class="grow">${esc(c.name)}</span><select aria-label="Group for ${esc(c.name)}" data-criterion-group="${esc(c.id)}">${options(h.groups,c.groupId)}</select></div>`).join('')}`:''}</div>`;}
function hierarchyWeightsView(){const h=p.hierarchy, pair=h.method==='pairwise';let out=`<section class="card"><h2>Hierarchical weighting</h2><p>First weight the parent groups; then weight the leaf criteria within each parent. Global leaf weight = group priority × local leaf priority. Both manual and classical pairwise judgments are supported within each set of siblings.</p><div class="row"><label class="inline"><input type="radio" name="hm" value="manual" ${!pair?'checked':''}> Direct percentages</label><label class="inline"><input type="radio" name="hm" value="pairwise" ${pair?'checked':''}> Pairwise AHP</label></div>`;
const block=(items,data,label,key)=>{if(!pair){const total=items.reduce((s,x)=>s+(typeof x.weight==='number'?x.weight:0),0);return `<p class="help">Local weights must total 100% (currently ${total.toFixed(2)}%).</p><div class="grid">${items.map(i=>`<label>${esc(i.name)} (%)<input type="number" min="0" max="100" step="any" data-hier-weight="${esc(key)}|${esc(i.id)}" value="${esc(i.weight??'')}"></label>`).join('')}</div>`;}
let status='';try{const e=entries(items,data);const z=calculateComparisons(items.length,e);status=`<p class="${z.consistent?'good':'warning'}">CR = ${uiFmt(z.consistencyRatio)} · ${z.consistent?'Within 0.10 guideline':'Review judgments'}</p>`;}catch(err){status=`<p class="warning">${esc(err.message)}</p>`;}
return comparisonRows(items,data,'hier-pair-'+key)+status;};
out+=`<h3>Level 1 — Parent groups</h3>${block(h.groups,h.groupComparisons,'Groups','root')}`;
for(const g of h.groups){const kids=p.criteria.filter(c=>c.groupId===g.id);out+=`<h3>Level 2 — ${esc(g.name)}</h3>${kids.length?block(kids,h.childComparisons[g.id]??{},g.name,g.id):'<p class="alert">Assign a leaf criterion to this group.</p>'}`;}
try{const z=hierarchyWeights(p);out+=`<h3>Global leaf weights</h3>${z.weights.map((w,i)=>`<p>${esc(p.criteria[i].name)}: <strong>${(100*w).toFixed(2)}%</strong></p>`).join('')}`;}catch(e){out+=`<div class="alert">${esc(e.message)}</div>`;}
return out+'</section>';}
function weightsView(){if(p.hierarchy?.enabled)return hierarchyWeightsView();const isAHP=p.weightMethod==='pairwise';let out=`<section class="card"><h2>Choose weighting method</h2><div class="row"><label class="inline"><input type="radio" name="wm" value="manual" ${!isAHP?'checked':''}> Direct percentages</label><label class="inline"><input type="radio" name="wm" value="pairwise" ${isAHP?'checked':''}> AHP pairwise comparisons</label></div><p>Manual percentages must sum to exactly 100. AHP derives weights using the principal eigenvector and displays a consistency ratio.</p>`;
if(isAHP){out+=comparisonRows(p.criteria,p.criteriaComparisons,'criterion-pair');try{const r=calculateComparisons(p.criteria.length,entries(p.criteria,p.criteriaComparisons));out+=`<p class="${r.consistent?'good':'warning'}">CR: ${uiFmt(r.consistencyRatio)} · ${r.consistent?'Within 0.10 guideline':'Review inconsistent judgments'}</p>`;}catch(e){out+=`<p class="warning">${esc(e.message)}</p>`;}}else{out+=`<div class="grid">${p.criteria.map(c=>`<label>${esc(c.name)} (%)<input type="number" min="0" max="100" step="any" data-weight="${esc(c.id)}" value="${esc(c.weight)}"></label>`).join('')}</div><p>Total: ${uiFmt(sum(p.criteria.map(c=>c.weight)))}%</p>`;}return out+'</section>';}
function evaluationView(){let out=`<section class="card"><h2>Evaluate each alternative</h2><div class="row"><label class="inline"><input type="radio" name="em" value="scores" ${p.evaluationMethod==='scores'?'checked':''}> Direct scores</label><label class="inline"><input type="radio" name="em" value="pairwise" ${p.evaluationMethod==='pairwise'?'checked':''}> Pairwise comparisons</label></div><p>For direct scores, enter nonnegative values where higher means better. Scores are normalized within each criterion, so raw costs should not be entered here without a documented utility transformation. Pairwise mode uses the AHP 1–9 scale.</p>`;
if(p.evaluationMethod==='scores'){out+='<div class="table-scroll"><table><thead><tr><th>Alternative</th>'+p.criteria.map(c=>`<th>${esc(c.name)}</th>`).join('')+'</tr></thead><tbody>'+p.alternatives.map(a=>`<tr><th>${esc(a.name)}</th>${p.criteria.map(c=>`<td><input type="number" min="0" step="any" data-score="${esc(c.id)}|${esc(a.id)}" value="${esc(p.scores[c.id]?.[a.id]??'')}"></td>`).join('')}</tr>`).join('')+'</tbody></table></div>';}else{out+=p.criteria.map(c=>`<h3>${esc(c.name)}</h3>${comparisonRows(p.alternatives,p.altComparisons[c.id]??{},'alt-pair-'+c.id)}${(()=>{try{const r=calculateComparisons(p.alternatives.length,entries(p.alternatives,p.altComparisons[c.id]??{}));return `<p class="${r.consistent?'good':'warning'}">CR ${uiFmt(r.consistencyRatio)}</p>`;}catch{return '<p class="warning">Comparisons incomplete</p>';}})()}`).join('');}return out+'</section>';}
function resultsView(){let out='<section class="card"><h2>Decision rankings</h2>';let results;try{results=getResults();const namesMap=Object.fromEntries(p.alternatives.map(a=>[a.id,a.name]));out+=`<div class="table-scroll"><table><thead><tr><th>Rank</th><th>Alternative</th><th>Priority</th><th>Visual</th></tr></thead><tbody>${results.ranked.map(r=>`<tr><td class="rank">${r.rank}</td><td>${esc(namesMap[r.id])}</td><td>${(100*r.score).toFixed(2)}%</td><td style="width:35%"><div class="bar" style="width:${100*r.score/Math.max(...results.ranked.map(x=>x.score))}%"></div></td></tr>`).join('')}</tbody></table></div><h3>Criterion weights & sensitivity</h3><p>Adjust a weight to explore rankings. Other weights are redistributed proportionally. "Reset" returns to the specified weights.</p>${p.criteria.map((c,i)=>`<div class="row"><label class="grow">${esc(c.name)} <strong>${(100*results.weights[i]).toFixed(1)}%</strong><input style="width:100%" type="range" min="0" max="100" step="1" value="${100*results.weights[i]}" data-sens="${i}"></label></div>`).join('')}<button id="resetSensitivity">Reset weights</button>`;}catch(e){out+=`<div class="alert">Complete the prior steps first: ${esc(e.message)}</div>`;}out+='</section>';out+=advancedView(results);
 out+=`<section class="card"><h2>Trade-offs & Pareto-efficient alternatives</h2><p>Add real, measurable objectives separately from AHP priorities. Smaller costs and larger benefits are interpreted using their selected directions. A non-dominated alternative is not necessarily the highest AHP-ranked option.</p><div class="buttons"><button id="addObjective" ${p.objectives.length>=8?'disabled':''}>+ Add objective</button></div>${p.objectives.map(o=>`<div class="card"><div class="row"><label class="grow">Objective name<input data-objective-name="${esc(o.id)}" type="text" value="${esc(o.name)}"></label><label>Direction<select data-direction="${esc(o.id)}"><option value="minimize" ${o.direction==='minimize'?'selected':''}>Lower is better</option><option value="maximize" ${o.direction==='maximize'?'selected':''}>Higher is better</option></select></label><button data-delete-objective="${esc(o.id)}" class="danger" ${p.objectives.length<=1?'disabled':''}>Delete</button></div><div class="grid">${p.alternatives.map(a=>`<label>${esc(a.name)}<input type="number" step="any" data-objective-value="${esc(o.id)}|${esc(a.id)}" value="${esc(o.values[a.id]??'')}"></label>`).join('')}</div></div>`).join('')}`;
if(p.objectives.length>=2){out+=`<div class="row"><label>Horizontal axis<select id="xAxis">${options(p.objectives,p.objectives[0].id)}</select></label><label>Vertical axis<select id="yAxis">${options(p.objectives,p.objectives[1].id)}</select></label></div>`;}out+='<div id="frontier"></div></section>';return out;}

function advancedView(results){if(!results)return '';const namesMap=Object.fromEntries(p.alternatives.map(a=>[a.id,a.name]));const ids=p.alternatives.map(a=>a.id),w=results.weights,cols=results.columns;
const breakdown=scoreBreakdown(w,cols,ids),max=Math.max(...breakdown.map(x=>x.score));let out=`<section class="card"><h2>Advanced analytics</h2><p>Exact one-at-a-time weight thresholds, saved weighting scenarios, deterministic simulation and transparent score contributions. Simulated stability is not a probability of real-world success.</p><h3>Weighted contributions</h3><div class="table-scroll"><table><thead><tr><th>Alternative</th>${p.criteria.map(c=>`<th>${esc(c.name)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${breakdown.map(b=>`<tr><td>${esc(namesMap[b.id])}</td>${b.contributions.map(x=>`<td>${(100*x).toFixed(2)}%</td>`).join('')}<td><strong>${(100*b.score).toFixed(2)}%</strong></td></tr>`).join('')}</tbody></table></div>`;
const idx=Math.min(analyticsCriterion,p.criteria.length-1);let sensitivity=sensitivityThresholds(w,cols,idx,ids);out+=`<h3>Exact winner-switch sensitivity</h3><div class="row"><label>Adjust one criterion (others proportionally redistributed)<select id="thresholdCriterion">${options(p.criteria,p.criteria[idx].id)}</select></label></div><p>Winner across intervals of ${esc(p.criteria[idx].name)} weight:</p><div class="table-scroll"><table><thead><tr><th>Weight range</th><th>Highest-ranked alternative(s)</th></tr></thead><tbody>${sensitivity.intervals.map(t=>`<tr><td>${(t.from*100).toFixed(2)}% – ${(t.to*100).toFixed(2)}%</td><td>${t.winners.map(id=>esc(namesMap[id])).join(', ')}</td></tr>`).join('')}</tbody></table></div><p class="muted">Calculated by exact line intersections for this fixed set of alternative priorities. At a boundary, multiple alternatives can tie. Does not model changes to pairwise judgments.</p>`;
let scenarios=(p.scenarios??[]);out+=`<h3>Saved weighting scenarios</h3><div class="row"><input type="text" id="scenarioName" maxlength="100" placeholder="Scenario name, e.g. Cost focused"><button id="saveScenario" ${scenarios.length>=12?'disabled':''}>Save current weights</button></div>`;
if(scenarios.length){const comparison=compareScenarios(scenarios,cols,ids);out+=`<div class="table-scroll"><table><thead><tr><th>Scenario</th><th>Top alternative(s)</th><th>Weights</th><th>Action</th></tr></thead><tbody>${comparison.map((sc,i)=>`<tr><td>${esc(sc.name)}</td><td>${sc.results.filter(r=>sc.results[0].score-r.score<1e-10).map(r=>esc(namesMap[r.id])).join(', ')}</td><td>${sc.weights.map((x,j)=>`${esc(p.criteria[j].name)} ${(100*x).toFixed(1)}%`).join(' · ')}</td><td><button data-load-scenario="${i}">Apply</button> <button class="danger" data-remove-scenario="${i}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;}
out+=`<h3>Ranking robustness (Monte Carlo)</h3><div class="row"><label>Weight perturbation<select id="robustRange"><option value="0.1" ${analyticsRange===.1?'selected':''}>±10%</option><option value="0.2" ${analyticsRange===.2?'selected':''}>±20%</option><option value="0.4" ${analyticsRange===.4?'selected':''}>±40%</option></select></label><span class="muted">2,000 reproducible samples · fixed random seed</span></div>`;
const sim=robustness(w,cols,ids,{relativeRange:analyticsRange,samples:2000,seed:2026});out+=`<div class="table-scroll"><table><thead><tr><th>Alternative</th><th>First-place share</th><th>Mean rank</th></tr></thead><tbody>${sim.results.map(r=>`<tr><td>${esc(namesMap[r.id])}</td><td>${(100*r.firstShare).toFixed(1)}%</td><td>${r.meanRank.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Each criterion weight is independently multiplied by a uniform random factor in the indicated range, then all weights are renormalised. These are simulation frequencies, not confidence levels; structural zero weights remain zero. First-place ties share credit. Average rank breaks ties by the fixed input order.</p></section>`;return out;}
let analyticsCriterion=0,analyticsRange=.2;

function renderFrontier(){const target=$('frontier');if(!target)return;try{const directions=Object.fromEntries(p.objectives.map(o=>[o.id,o.direction]));const pts=p.alternatives.map(a=>({id:a.id,objectives:Object.fromEntries(p.objectives.map(o=>[o.id,o.values[a.id]]))}));for(const a of p.alternatives)for(const o of p.objectives)if(typeof o.values[a.id]!=='number'||!Number.isFinite(o.values[a.id]))throw Error(`Enter ${o.name} for ${a.name}`);
const ranked=paretoFront(pts,directions);const efficient=ranked.filter(r=>r.efficient).length;let html=`<p><strong>${efficient} of ${ranked.length}</strong> alternatives are nondominated across all ${p.objectives.length} objective(s).</p><p>${ranked.map(r=>`${esc(p.alternatives.find(a=>a.id===r.id).name)}: <strong class="${r.efficient?'good':'warning'}">${r.efficient?'Efficient':'Dominated'}</strong>`).join(' · ')}</p>`;
if(p.objectives.length>=2){const x=p.objectives.find(o=>o.id===$('xAxis').value)??p.objectives[0],y=p.objectives.find(o=>o.id===$('yAxis').value)??p.objectives[1];const projected=projectionFront(pts,directions,x.id,y.id);const mismatch=projected.filter(z=>z.efficientAll!==z.efficient2D).length;const xv=pts.map(z=>z.objectives[x.id]),yv=pts.map(z=>z.objectives[y.id]);let xmin=Math.min(...xv),xmax=Math.max(...xv),ymin=Math.min(...yv),ymax=Math.max(...yv);const dx=xmax-xmin||1,dy=ymax-ymin||1;const coord=(v,min,d)=> (v-min)/d;html+=`<p class="muted">${mismatch} alternative(s) have different Pareto status in the selected 2D projection versus the full ${p.objectives.length}-objective analysis.</p><svg id="chart" viewBox="0 0 670 370" role="img" aria-label="Scatterplot of ${esc(x.name)} and ${esc(y.name)}"><rect x="65" y="18" width="570" height="296" fill="#f6f9fd"/><line x1="65" x2="635" y1="314" y2="314" stroke="#68778a"/><line x1="65" x2="65" y1="18" y2="314" stroke="#68778a"/><text x="350" y="358" text-anchor="middle" font-size="13" fill="#526074">${esc(x.name)} (${x.direction})</text><text x="12" y="180" transform="rotate(-90 12 180)" text-anchor="middle" font-size="13" fill="#526074">${esc(y.name)} (${y.direction})</text><text x="65" y="334" font-size="12" fill="#526074">${xmin}</text><text x="600" y="334" font-size="12" fill="#526074">${xmax}</text><text x="20" y="312" font-size="12" fill="#526074">${ymin}</text><text x="20" y="25" font-size="12" fill="#526074">${ymax}</text>${ranked.map(z=>{const a=p.alternatives.find(a=>a.id===z.id),cx=65+570*coord(z.objectives[x.id],xmin,dx),cy=314-296*coord(z.objectives[y.id],ymin,dy);return `<circle cx="${cx}" cy="${cy}" r="7" fill="${z.efficient?'#16839c':'#c48036'}" stroke="white" stroke-width="2"><title>${esc(a.name)}</title></circle><text x="${Math.min(cx+9,588)}" y="${Math.max(cy-10,15)}" font-size="12" fill="#26354a">${esc(a.name)}</text>`;}).join('')}</svg><p><span style="color:#16839c">●</span> Nondominated across all objectives · <span style="color:#c48036">●</span> Dominated. The plot is a projection; efficient points in higher dimensions may overlap or appear dominated in these two displayed dimensions.</p>`;}
target.innerHTML=html;}catch(e){target.innerHTML=`<div class="alert">${esc(e.message)}</div>`;}}
function render(){ $('steps').innerHTML=names.map((n,i)=>`<button data-step="${i}" class="${step===i?'selected':''}">${i+1}. ${n}</button>`).join('');$('view').innerHTML= (step===0?baseView():step===1?weightsView():step===2?evaluationView():resultsView())+`<div class="buttons"><button id="prev" ${step===0?'disabled':''}>← Back</button><span class="spacer"></span><button id="next" class="primary" ${step===3?'disabled':''}>Continue →</button></div>`;
$('prev').onclick=()=>{step--;render()};$('next').onclick=()=>{step++;render()};document.querySelectorAll('[data-step]').forEach(el=>el.onclick=()=>{step=Number(el.dataset.step);render()});
function bind(selector,event,fn){document.querySelectorAll(selector).forEach(el=>el.addEventListener(event,()=>update(()=>fn(el))));}
if(step===0){bind('#title','change',el=>p.title=el.value);bind('[data-criterion]','change',el=>p.criteria.find(c=>c.id===el.dataset.criterion).name=el.value);bind('[data-alternative]','change',el=>p.alternatives.find(a=>a.id===el.dataset.alternative).name=el.value);bind('[data-delete-criterion]','click',el=>{const id=el.dataset.deleteCriterion;p.criteria=p.criteria.filter(c=>c.id!==id);delete p.scores[id];delete p.altComparisons[id];p.criteriaComparisons={};resetHierarchyComparisons(p);});bind('[data-delete-alternative]','click',el=>{const id=el.dataset.deleteAlternative;p.alternatives=p.alternatives.filter(a=>a.id!==id);for(const row of Object.values(p.scores))delete row[id];for(const o of p.objectives)delete o.values[id];p.altComparisons={};});$('addCriterion').onclick=()=>update(()=>{p.criteria.push({id:uid(),name:'New criterion',weight:0,...(p.hierarchy?.enabled?{groupId:p.hierarchy.groups[0].id}:{})});p.criteriaComparisons={};resetHierarchyComparisons(p);});$('addAlternative').onclick=()=>update(()=>{p.alternatives.push({id:uid(),name:'New alternative'});p.altComparisons={};});$('hierarchyEnabled').onchange=el=>update(()=>{initHierarchy();p.hierarchy.enabled=el.target.checked;resetHierarchyComparisons(p);});if(p.hierarchy?.enabled){if($('addGroup'))$('addGroup').onclick=()=>update(()=>{p.hierarchy.groups.push({id:uid(),name:'New group',weight:0});resetHierarchyComparisons(p);});bind('[data-group-name]','change',el=>p.hierarchy.groups.find(g=>g.id===el.dataset.groupName).name=el.value);bind('[data-criterion-group]','change',el=>{p.criteria.find(c=>c.id===el.dataset.criterionGroup).groupId=el.value;resetHierarchyComparisons(p);});bind('[data-delete-group]','click',el=>{const id=el.dataset.deleteGroup;const groups=p.hierarchy.groups;const replacement=groups.find(g=>g.id!==id);if(!replacement)return;for(const c of p.criteria)if(c.groupId===id)c.groupId=replacement.id;p.hierarchy.groups=groups.filter(g=>g.id!==id);resetHierarchyComparisons(p);});}}
if(step===1&&p.hierarchy?.enabled){bind('[name=hm]','change',el=>{p.hierarchy.method=el.value;resetHierarchyComparisons(p);});bind('[data-hier-weight]','change',el=>{const [g,id]=el.dataset.hierWeight;const item=g==='root'?p.hierarchy.groups.find(x=>x.id===id):p.criteria.find(x=>x.id===id);item.weight=el.value===''?null:Number(el.value);p.weightAdjustment=null;});document.querySelectorAll('select').forEach(el=>{const key=Object.keys(el.dataset).find(k=>k.startsWith('hierPair'));if(!key)return;el.onchange=()=>update(()=>{const group=key.slice('hierPair'.length).replace(/^./,c=>c.toLowerCase());const gid=group;const record=gid==='root'?p.hierarchy.groupComparisons:(p.hierarchy.childComparisons[gid]??={});record[el.dataset[key]]=Number(el.value);p.weightAdjustment=null;});});}
if(step===1&&!p.hierarchy?.enabled){bind('[name=wm]','change',el=>{p.weightMethod=el.value;p.weightAdjustment=null;});bind('[data-weight]','change',el=>{p.criteria.find(c=>c.id===el.dataset.weight).weight=el.value===''?null:Number(el.value);p.weightAdjustment=null;});bind('[data-criterion-pair]','change',el=>{p.criteriaComparisons[el.dataset.criterionPair]=Number(el.value);p.weightAdjustment=null;});}
if(step===2){bind('[name=em]','change',el=>p.evaluationMethod=el.value);bind('[data-score]','change',el=>{const [c,a]=el.dataset.score.split('|');(p.scores[c]??={})[a]=el.value===''?null:Number(el.value)});document.querySelectorAll('[data-alt-pair-]').forEach(()=>{});document.querySelectorAll('select').forEach(el=>{const key=Object.keys(el.dataset).find(k=>k.startsWith('altPair'));if(!key)return;el.onchange=()=>update(()=>{const criterion=key.slice('altPair'.length).replace(/^./,ch=>ch.toLowerCase());const c=p.criteria.find(x=>key.toLowerCase()==='altpair'+x.id.toLowerCase());if(c)(p.altComparisons[c.id]??={})[el.dataset[key]]=Number(el.value);});});}
if(step===3){bind('[data-sens]','change',el=>{const i=Number(el.dataset.sens),raw=p.weightAdjustment??getWeights(),desired=Number(el.value)/100;p.weightAdjustment=weightsAt(raw,i,desired);});if($('resetSensitivity'))$('resetSensitivity').onclick=()=>update(()=>p.weightAdjustment=null);if($('thresholdCriterion'))$('thresholdCriterion').onchange=el=>{analyticsCriterion=p.criteria.findIndex(c=>c.id===el.target.value);render();};if($('robustRange'))$('robustRange').onchange=el=>{analyticsRange=Number(el.target.value);render();};if($('saveScenario'))$('saveScenario').onclick=()=>{const name=$('scenarioName').value.trim();if(!name){alert('Enter a scenario name');return;}update(()=>{p.scenarios??=[];if(p.scenarios.length>=12)throw Error('Scenario limit');p.scenarios.push({name,weights:[...(p.weightAdjustment??getWeights())],criteriaIds:p.criteria.map(c=>c.id)});});};document.querySelectorAll('[data-load-scenario]').forEach(el=>el.onclick=()=>update(()=>{p.weightAdjustment=[...p.scenarios[Number(el.dataset.loadScenario)].weights];}));document.querySelectorAll('[data-remove-scenario]').forEach(el=>el.onclick=()=>update(()=>{p.scenarios.splice(Number(el.dataset.removeScenario),1);}));$('addObjective').onclick=()=>update(()=>p.objectives.push({id:uid(),name:'New objective',direction:'maximize',values:{}}));bind('[data-objective-name]','change',el=>p.objectives.find(o=>o.id===el.dataset.objectiveName).name=el.value);bind('[data-direction]','change',el=>p.objectives.find(o=>o.id===el.dataset.direction).direction=el.value);bind('[data-objective-value]','change',el=>{const [oid,aid]=el.dataset.objectiveValue.split('|');p.objectives.find(o=>o.id===oid).values[aid]=el.value===''?'':Number(el.value)});bind('[data-delete-objective]','click',el=>p.objectives=p.objectives.filter(o=>o.id!==el.dataset.deleteObjective));if($('xAxis')){$('xAxis').onchange=renderFrontier;$('yAxis').onchange=renderFrontier;}renderFrontier();}}
function diagnostics(){const out=[];const add=(name,items,record)=>{try{out.push({name,cr:calculateComparisons(items.length,entries(items,record)).consistencyRatio});}catch{}};if(p.hierarchy?.enabled){if(p.hierarchy.method==='pairwise'){add('Parent groups',p.hierarchy.groups,p.hierarchy.groupComparisons);for(const g of p.hierarchy.groups)add(g.name,p.criteria.filter(c=>c.groupId===g.id),p.hierarchy.childComparisons[g.id]??{});}}else if(p.weightMethod==='pairwise')add('Criteria',p.criteria,p.criteriaComparisons);if(p.evaluationMethod==='pairwise')for(const c of p.criteria)add('Alternatives: '+c.name,p.alternatives,p.altComparisons[c.id]??{});return out;}
function downloadContent(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);}
function safeName(){return (p.title||'ahp-report').replace(/[^a-z0-9-]/gi,'_').slice(0,80);}
function currentReport(){return reportData(p,getResults(),{consistency:diagnostics()});}
$('exportExcel').onclick=()=>{try{downloadContent(workbookXML(currentReport()),safeName()+'-report.xml','application/vnd.ms-excel;charset=utf-8');}catch(e){alert('Complete the analysis first: '+e.message);}};
$('exportReport').onclick=()=>{try{downloadContent(reportHTML(currentReport()),safeName()+'-print-report.html','text/html;charset=utf-8');alert('Open the downloaded HTML report in your browser, then select Print / Save as PDF.');}catch(e){alert('Complete the analysis first: '+e.message);}};
$('exportProject').onclick=()=>{const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(p.title||'ahp-project').replace(/[^a-z0-9-]/gi,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
$('importProject').onclick=()=>$('fileInput').click();$('fileInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());validateProject(d);validateHierarchy(d);p=d;step=0;persist();render();}catch(err){alert('Could not open project: '+err.message)}e.target.value='';};
render();persist();
