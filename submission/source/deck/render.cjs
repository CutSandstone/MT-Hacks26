const fs = require('fs');
const PptxGenJS = require('pptxgenjs');
const path = require('node:path');
const {chromium} = require('playwright');
const stem = path.resolve(__dirname, '../..', 'What Would Hedge This - Pitch Deck');
const C = {paper:'F5F1E8', ink:'152622', forest:'10362C', lime:'DDF768', rust:'B74732', rule:'C8C9B9', mute:'4C5F56', green:'E6ECD7', grid:'3A5B4C', soft:'C5D1C1'};
const H = 'Georgia', S = 'Arial', M = 'Menlo';
const W=13.3333333, Z=7.5;
let slides=[], a, bg;
function start(dark=false) { bg = dark ? C.forest : C.paper; a=[]; slides.push({bg,a}); }
function rect(x,y,w,h,fill,line=null,rotate=0) { a.push({kind:'rect',x,y,w,h,fill,line,rotate}); }
function rule(x,y,w,color=C.rule,h=.012) { rect(x,y,w,h,color); }
function v(x,y,h,color=C.rule,w=.012) { rect(x,y,w,h,color); }
function text(value,x,y,w,h,opts={}) { a.push({kind:'text',value,x,y,w,h,face:S,pt:20,c:C.ink,b:false,align:'left',...opts}); }
function d(value,x,y,w,h,pt,c=C.ink,opts={}) { text(value,x,y,w,h,{face:H,pt,c,b:true,...opts}); }
function m(value,x,y,w,h=.25,c=C.mute,pt=10,opts={}) { text(value,x,y,w,h,{face:M,pt,c,...opts}); }
function body(value,x,y,w,h=.38,c=C.ink,pt=19,opts={}) { text(value,x,y,w,h,{pt,c,...opts}); }
function top(n,tag,dark=false,right='WHAT WOULD HEDGE THIS?') {
  const light = dark ? C.soft : C.mute;
  m(`${n}  /  ${tag}`,.69,.33,7,.25,light);
  m(right,8.2,.33,4.44,.25,light,10,{align:'right'});
  rule(.69,.72,11.95,dark ? C.grid : C.rule);
}
function foot(n,label,dark=false) {
  rule(.69,6.82,11.95,dark?C.grid:C.rule);
  m(label,.69,6.92,10.9,.23,dark?C.soft:C.mute,9.5);
  m(`${n} / 07`,11.71,6.92,.93,.23,dark?C.soft:C.mute,9.5,{align:'right'});
}

// 01 — Dark opening; a small paper intervention interrupts the stage.
start(true); top('01','THE WORRY',true,'MT-haCks 2026 / FINTECH');
rect(.7,1.19,.035,3.55,C.lime);
m('A FRIEND STUDYING COMPUTER SCIENCE',.93,1.26,8,.25,C.lime,11);
d('“What if AI takes',.9,1.78,9.3,1.03,62,C.paper);
d('the job I’m',.9,2.83,8.8,1.03,62,C.paper);
d('studying for?”',.9,3.88,8.7,1.03,62,C.paper);
rect(8.7,4.15,3.94,1.62,C.ink);
rect(8.63,4.07,3.94,1.62,C.lime);
rect(9.94,3.94,1.27,.25,C.paper,null, -7);
m('MY FIRST IDEA',8.91,4.38,3.41,.22,C.forest,9.5);
d('“What if you',8.91,4.67,3.47,.35,24,C.forest);
d('bought AI stocks?”',8.91,5.09,3.49,.36,24,C.forest);
m('A real worry. A tempting answer.',.92,6.15,10.5,.32,C.paper,13);
foot('01','THE STARTING POINT',true);

// 02 — Big product reveal, followed by a native process graphic and three paths.
start(); top('02','THE PRODUCT',false,'MT-haCks 2026 / FINTECH');
d('What Would Hedge This?',.67,1.02,12,.94,60);
body('If the decision costs you money, how many dollars',.71,2.18,11,.42,C.ink,25);
body('would the hedge actually cover?',.71,2.59,11,.42,C.ink,25);
const tiles = [
  {x:.71,k:'01 / INPUT', label:'Life decision',fill:C.paper,c:C.ink},
  {x:4.82,k:'02 / MEASURE', label:'Dollar exposure',fill:C.paper,c:C.ink},
  {x:8.93,k:'03 / TEST', label:'Compare outcomes',fill:C.forest,c:C.paper},
];
tiles.forEach(t=>{rect(t.x,3.55,3.69,1.42,t.fill,t.fill===C.paper ? C.rule : null);
  m(t.k,t.x+.19,3.77,3.17,.22,t.fill===C.paper ? C.mute : C.lime,9.5);
  d(t.label,t.x+.19,4.14,3.36,.48,23,t.c);
});
function arrow(x,y,c) {rule(x,y,.24,c,.016);rect(x+.15,y-.044,.105,.014,c,null,43);rect(x+.15,y+.046,.105,.014,c,null,-43);}
arrow(4.48,4.25,C.mute); arrow(8.59,4.25,C.mute);
m('THREE GUIDED PATHS',.71,5.56,4,.25,C.mute,10);
rule(.71,5.98,11.91);
[['01','First job',.71],['02','Gas commute',4.82],['03','Tuition abroad',8.93]].forEach(([n,t,x])=>{
  m(n,x,6.16,.37,.26,C.rust,10);
  body(t,x+.45,6.08,3.26,.41,C.ink,19,{b:true});
});
foot('02','HYPOTHETICAL SCENARIOS • NO PERSONALIZED INVESTMENT ADVICE');

// 03 — Missed pay calculation versus the proposed stock’s failure case.
start(); top('03','CASE NOTE / FIRST JOB');
d('A $3,000 gap.',.67,.93,11.95,.89,54);
d('No hedge recommended.',.67,1.80,11.95,.72,45);
m('CS STUDENT PLANNING A FIRST JOB IN SECURITY OPERATIONS',.71,2.75,11.8,.29,C.mute,10.5);
rect(.72,3.29,11.9,1.2,C.green);
d('2 months × ($4,500 − $3,000) = $3,000',.96,3.47,11.39,.52,35);
m('EXTRA MONTHS',.99,4.09,2.15,.21,C.mute,9.5);
m('TARGET PAY − ALTERNATIVE PAY',3.88,4.09,4.64,.21,C.mute,9.5);
m('MISSED PAY',9.23,4.09,2.75,.21,C.mute,9.5);
v(4.95,4.93,1.56);
m('IF HIRING STAYS ON SCHEDULE',.73,4.98,4.02,.21,C.mute,9.5);
d('$0 loss',.7,5.37,3.93,.6,38);
m('WHERE THE STOCK IDEA FAILS',5.24,4.98,7.03,.21,C.rust,9.5);
body('A spending freeze can hit both hiring and AI-vendor sales.',5.24,5.35,7.31,.34,C.ink,18);
body('The stock can compound the exposure.',5.24,5.78,7.31,.34,C.ink,18,{b:true});
foot('03','ILLUSTRATIVE MONTHLY PAY • NO STOCK PURCHASE SUGGESTED');

// 04 — Same obligation, different dollars; bars share a zero origin.
start(); top('04','CASE NOTE / TUITION ABROAD');
d('Same bill. $800 more.',.67,1.03,12,.87,53);
rect(.71,2.14,11.91,1.20,C.forest);
d('¥600,000',.92,2.28,7.76,.89,55,C.paper);
m('TUITION DUE  /  FIXED IN YEN',8.14,2.64,4.22,.25,C.lime,10,{align:'right'});
m('BUDGET',.73,3.66,3.88,.24,C.mute,10.5);
m('STRESS',5.14,3.66,3.88,.24,C.rust,10.5);
body('¥150/$',.73,4.03,3.88,.34,C.ink,20);
body('¥125/$',5.14,4.03,3.88,.34,C.ink,20);
d('$4,000',.69,4.48,4.03,.62,43);
d('$4,800',5.1,4.48,4.03,.62,43);
rect(.73,5.32,3.16,.19,C.forest);
rect(5.14,5.32,3.16,.19,C.forest);
rect(8.30,5.32,.632,.19,C.rust);
v(4.66,3.68,1.99);
v(9.29,3.68,1.99);
m('GAP',9.63,3.66,2.95,.24,C.rust,10.5);
d('+$800',9.60,4.45,3.02,.69,42,C.rust);
body('The bill didn’t change. The exchange rate did.',.73,6.05,11.85,.38,C.ink,21,{b:true});
foot('04','HYPOTHETICAL EXCHANGE RATES');

// 05 — Editable diagram and full scenario matrix (no screenshot dependencies).
start(); top('05','CASE NOTE / COMPARE OUTCOMES');
d('Match the currency. See what’s left.',.67,1.00,12,.83,42);
rect(.71,2.04,11.91,1.09,C.forest);
const steps = [
  [.93,2.18,'START WITH','$1,000'],
  [3.29,2.46,'AT THE BUDGET RATE','¥150,000'],
  [6.11,2.36,'AT THE STRESS RATE','$1,200'],
  [9.01,3.13,'WHAT IT COVERS','$200 offset'],
];
steps.forEach(([x,w,k,val],i)=>{
  m(k,x,2.20,w,.18,C.soft,9);
  d(val,x,2.53,w,.40,27,i===3?C.lime:C.paper);
});
arrow(2.82,2.72,C.soft);arrow(5.68,2.72,C.soft);arrow(8.55,2.72,C.soft);
m('REMAINING IMPACT',.73,3.45,3.98,.25,C.mute,10);
m('YEN STRENGTHENS',4.91,3.45,3.93,.25,C.mute,10,{align:'center'});
m('RATE UNCHANGED',8.84,3.45,3.76,.25,C.mute,10,{align:'center'});
rect(.72,3.86,11.89,.71,C.green);
rule(.72,3.86,11.89);
rule(.72,4.57,11.89);
rule(.72,5.32,11.89);
v(4.91,3.86,1.46);v(8.84,3.86,1.46);
d('Hold yen',.91,4.02,3.8,.38,24);
d('Keep dollars',.91,4.76,3.8,.38,24);
[[4.91,3.93,4.01,'−$600',C.ink],[8.84,3.76,4.01,'$0',C.ink],
 [4.91,3.93,4.75,'−$800',C.rust],[8.84,3.76,4.75,'$0',C.ink]].forEach(([x,w,y,q,c])=>d(q,x,y,w,.38,26,c,{align:'center'}));
body('Convert $2,000 instead → −$400 remains in the same stress case.',.74,5.64,11.7,.39,C.ink,18,{b:true});
foot('05','Changes vs. budget; hypothetical; no fees or interest.');

// 06 — Three guardrails, each isolated on its own notebook line.
start(); top('06','DESIGN GUARDRAILS');
d('Show the uncertainty.',.67,1.01,12,.74,50);
d('Don’t sell certainty.',.67,1.80,12,.74,50);
const guards=[
  ['01','Interest',['0% assumed; no borrowing.']],
  ['02','Gharar',['Explicit assumptions; no assigned odds.','No suggested hedge where the link is unreliable.','Not a religious certification.'],'EXCESSIVE UNCERTAINTY'],
  ['03','Privacy & responsibility',['Calculations in browser; no financial account data,','trades, or personalized buy list.']]
];
const ys=[2.88,3.79,5.19];
guards.forEach(([num,title,lines,detail],i)=>{
  const y=ys[i];
  rule(.72,y,11.89);
  m(num,.74,y+.27,.50,.23,C.rust,10);
  d(title,1.35,y+.20,4.2,.41,23);
  if(detail) m(detail,1.37,y+.73,4.13,.20,C.mute,9);
  lines.forEach((line,j)=>body(line,5.78,y+.21+j*.33,6.80,.34,C.ink,17,{b: i===1 && j===2}));
});
foot('06','SYNTHETIC NUMBERS • EDUCATIONAL USE');

// 07 — Return to the dark stage and exchange the initial question.
start(true); top('07','THE TAKEAWAY',true,'MT-haCks 2026 / FINTECH');
d('Don’t start with what',.68,1.07,12,.80,54,C.paper);
d('you could buy.',.68,1.91,12,.80,54,C.paper);
d('Start with what',.68,2.89,12,.80,54,C.lime);
d('you could lose.',.68,3.73,12,.80,54,C.lime);
rule(.71,4.95,11.89,C.grid);
v(7.00,5.23,1.28,C.grid);
m('BUILT TODAY',.73,5.27,5.85,.24,C.lime,10.5);
body('Three guided cases, explicit assumptions,',.73,5.67,6.1,.31,C.paper,17);
body('editable yen conversion and dollar comparison.',.73,6.01,6.15,.31,C.paper,17);
m('NEXT',7.28,5.27,5.29,.24,C.lime,10.5);
body('Test with students; account for',7.28,5.67,5.22,.31,C.paper,17);
body('exchange fees and spreads.',7.28,6.01,5.22,.31,C.paper,17);
foot('07','WHAT WOULD HEDGE THIS?',true);

const esc = s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function main(){
 const p=new PptxGenJS();
 p.defineLayout({name:'WWHT',width:W,height:Z});
 p.layout='WWHT'; p.author='What Would Hedge This?';p.title='What Would Hedge This?';p.subject='MT-haCks 2026 / Fintech';p.lang='en-US';
 let html=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>What Would Hedge This?</title><style>
 @page{size:13.3333333in 7.5in;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 section{width:1280px;height:720px;position:relative;overflow:hidden;page-break-after:always}section:last-child{page-break-after:auto}
 .box{position:absolute}.text{display:flex;align-items:center;white-space:pre;line-height:1.02}.text[data-align=right]{justify-content:flex-end}.text[data-align=center]{justify-content:center}
 </style></head><body>`;
 for(const {bg,a} of slides){
  const s=p.addSlide();s.background={color:bg};
  html+=`<section style="background:#${bg}">`;
  for(const o of a){
   const {x,y,w,h}=o;
   const box=`left:${x*96}px;top:${y*96}px;width:${w*96}px;height:${h*96}px;`;
   if(o.kind==='rect'){
    s.addShape(p.ShapeType.rect,{x,y,w,h,fill:{color:o.fill},line:{color:o.line||o.fill,transparency:o.line?0:100,width:.65},rotate:(o.rotate+360)%360});
    html+=`<div class="box" style="${box}background:#${o.fill};${o.line?`border:1px solid #${o.line};`:''}${o.rotate?`transform:rotate(${o.rotate}deg);`:''}"></div>`;
   }else{
    s.addText(o.value,{x,y,w,h,fontFace:o.face,fontSize:o.pt,color:o.c,bold:o.b,align:o.align,margin:0,valign:'mid',wrap:false,lang:'en-US'});
    html+=`<div class="box text" data-align="${o.align}" style="${box}font-family:${o.face};font-size:${o.pt}pt;font-weight:${o.b?700:400};color:#${o.c}">${esc(o.value)}</div>`;
   }
  }
  html+='</section>';
 }
 html+='</body></html>';
 fs.writeFileSync(path.join(__dirname, 'slides.html'),html);
 await p.writeFile({fileName:stem+'.pptx'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await page.setContent(html);
  await page.evaluate(()=>document.fonts.ready);
  const overs=await page.evaluate(()=>[...document.querySelectorAll('section')].flatMap((s,i)=>[...s.querySelectorAll('.text')].flatMap(el=>{
   const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect(),p=el.getBoundingClientRect();
   return b.width>p.width+1 || b.height>p.height+8 ? [[i+1,el.textContent,Math.round(b.width),Math.round(p.width),Math.round(b.height),Math.round(p.height)]]:[];
  })));
  console.log('Text bounds warnings:',JSON.stringify(overs));
  await page.pdf({path:stem+'.pdf',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  if(process.env.DECK_CONTACT_SHEET){
   await page.evaluate(()=>{document.body.style.cssText='display:grid;grid-template-columns: 422px 422px 422px;gap:6px;background:#aaa;padding:3px';for(const s of document.querySelectorAll('section'))s.style.zoom='.329';});
   await page.screenshot({path:process.env.DECK_CONTACT_SHEET,fullPage:true});
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1)});
