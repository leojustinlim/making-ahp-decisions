/** Validate untrusted JSON before loading it into the interface. */
export function validateProject(p) {
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
