import {buildXLSX} from './xlsx-export.mjs';
import fs from 'node:fs';
const r={rankings:[{rank:1,name:'Contractor & A',score:.7}],criteria:[{name:'Cost',group:'Financial',weight:.4},{name:'Quality',group:'Technical',weight:.6}],contributions:[{name:'Contractor & A',values:[.25,.45],total:.7}],consistency:[{name:'Criteria',cr:.023}],alternatives:[{name:'Contractor & A'}],objectives:[{name:'Cost < SGD',direction:'minimize',values:[100]}],frontier:[{name:'Contractor & A',efficient:true}],scenarios:[{name:'Test',weights:[.4,.6]}],limits:['Example <test>']};
let b=buildXLSX(r);fs.writeFileSync('/mnt/data/ahp-v06-work/report-test.xlsx',new Uint8Array(await b.arrayBuffer()));console.log('XLSX bytes',b.size);
