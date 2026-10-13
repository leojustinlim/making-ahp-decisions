// Dependency-free OOXML spreadsheet export. ZIP entries use STORE compression.
const enc=new TextEncoder();
const xml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const cell=(v,r,c)=>{const col=column(c),ref=`${col}${r}`;if(valid(v))return `<c r="${ref}"><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`};
function column(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
const sheet=rows=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>cell(v,i+1,j)).join('')}</row>`).join('')}</sheetData></worksheet>`;
const filesFromReport=r=>{
 const tabs=[
 ['Ranking',[['Rank','Alternative','Priority'],...r.rankings.map(z=>[z.rank,z.name,z.score])]],
 ['Criteria',[['Group','Criterion','Global weight'],...r.criteria.map(c=>[c.group,c.name,c.weight])]],
 ['Contributions',[['Alternative',...r.criteria.map(c=>c.name),'Overall'],...r.contributions.map(z=>[z.name,...z.values,z.total])]],
 ['Diagnostics',[['Matrix','Consistency ratio'],...r.consistency.map(z=>[z.name,z.cr])]],
 ['Objectives',[['Objective','Direction',...r.alternatives.map(a=>a.name)],...r.objectives.map(o=>[o.name,o.direction,...o.values])]],
 ['Pareto',[['Alternative','Nondominated'],...(r.frontier??[]).map(f=>[f.name,f.efficient?'Yes':'No'])]],
 ['Scenarios',[['Scenario',...r.criteria.map(c=>c.name)],...r.scenarios.map(s=>[s.name,...s.weights])]],
 ['Methodology',[['Methodological notes'],...r.limits.map(s=>[s])]]
 ];
 const content=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tabs.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 const workbook=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs.map(([name],i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
 const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabs.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
 return [['[Content_Types].xml',content],['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',rels],...tabs.map(([_,rows],i)=>[`xl/worksheets/sheet${i+1}.xml`,sheet(rows)])];
};
let table=null;
function crc32(bytes){if(!table){table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});}let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
const le16=(a,p,v)=>{a[p]=v&255;a[p+1]=(v>>>8)&255;};const le32=(a,p,v)=>{le16(a,p,v);le16(a,p+2,v>>>16)};
export function buildXLSX(report){const entries=filesFromReport(report),chunks=[],central=[];let offset=0;
 for(const [name,content] of entries){const nameBytes=enc.encode(name),data=enc.encode(content),crc=crc32(data);const header=new Uint8Array(30+nameBytes.length);le32(header,0,0x04034b50);le16(header,4,20);le16(header,8,0);le32(header,14,crc);le32(header,18,data.length);le32(header,22,data.length);le16(header,26,nameBytes.length);header.set(nameBytes,30);chunks.push(header,data);
 const dir=new Uint8Array(46+nameBytes.length);le32(dir,0,0x02014b50);le16(dir,4,20);le16(dir,6,20);le32(dir,16,crc);le32(dir,20,data.length);le32(dir,24,data.length);le16(dir,28,nameBytes.length);le32(dir,42,offset);dir.set(nameBytes,46);central.push(dir);offset+=header.length+data.length;}
 const dirSize=central.reduce((s,b)=>s+b.length,0);const end=new Uint8Array(22);le32(end,0,0x06054b50);le16(end,8,entries.length);le16(end,10,entries.length);le32(end,12,dirSize);le32(end,16,offset);return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
