'use strict';
const M=CSModel,$=id=>document.getElementById(id);
const defaults=()=>({first:2,firstAdvantage:0,final:4,advantage:1,p23:.5,p12:.5,p13:.5});
let config=defaults(), generation=0, running=false;
try{const saved=JSON.parse(localStorage.getItem('cs-rule-lab-v2'));if(saved&&!M.validate(saved).length)config={firstAdvantage:0,...saved};}catch{}
const pct=x=>(x*100).toFixed(2)+'%';
const fields=[['first','CSファーストステージの先取勝数','勝',1,30,1],['firstAdvantage','ファースト：2位に最初から与える勝数','勝',0,29,1],['final','CSファイナルステージの先取勝数','勝',1,30,1],['advantage','ファイナル：1位に最初から与える勝数','勝',0,29,1],['p23','2位が3位に勝つ確率','%',0,100,.1],['p12','1位が2位に勝つ確率','%',0,100,.1],['p13','1位が3位に勝つ確率','%',0,100,.1]];
function forms(){
 $('forms').innerHTML=`<label class="small" for="preset">ルールのひな形</label><select id="preset"><option value="">自分で設定する</option>${M.presets.map((r,i)=>`<option value="${i}" ${['first','firstAdvantage','final','advantage'].every(f=>config[f]===r[f])?'selected':''}>${r.name}</option>`).join('')}</select>${fields.map(([key,label,unit,min,max,step],i)=>`${i===4?'<p class="subhead">1試合ごとの勝率</p>':''}<label class="field" for="${key}"><span>${label}</span><span><input id="${key}" data-key="${key}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(config[key])?(key.startsWith('p')?Number((config[key]*100).toFixed(8)):config[key]):''}"><em>${unit}</em></span></label>`).join('')}`;
}
function chart(r){return `<div class="stack" role="img" aria-label="${r.map((v,i)=>`${i+1}位 ${pct(v)}`).join('、')}">${r.map(v=>`<span style="width:${100*v}%"></span>`).join('')}</div><div class="rank-values">${r.map((v,i)=>`<span class="r${i+1}">${i+1}位 <strong>${pct(v)}</strong></span>`).join('')}</div>`;}
function clearSimulation(){generation++;running=false;$('run').disabled=false;$('stop').hidden=true;$('simOutput').hidden=true;$('simStatus').textContent='現在のルールで試してみましょう。実行するたびに新しく集計します。';$('progress').value=0;}
function render(){
 const errors=M.validate(config);
 document.querySelectorAll('[data-key]').forEach(el=>{const v=el.valueAsNumber;el.setAttribute('aria-invalid',String(!Number.isFinite(v)||v<+el.min||v>+el.max||(!el.dataset.key.startsWith('p')&&!Number.isInteger(v))||(el.dataset.key==='firstAdvantage'&&v>=config.first)||(el.dataset.key==='advantage'&&v>=config.final)));});
 $('errors').hidden=!errors.length;$('errors').textContent=errors.join(' ');$('results').hidden=!!errors.length;
 if(errors.length)return;
 try{localStorage.setItem('cs-rule-lab-v2',JSON.stringify(config));}catch{}
 const r=M.league(config),upset=r.ranks[1]+r.ranks[2];
 $('upset').innerHTML=(upset*100).toFixed(2)+'<small>%</small>';$('champion').textContent=pct(r.ranks[0]);
 $('ruleSummary').textContent=`CSファイナルは${config.final}勝に到達すると突破（1位には最初から${config.advantage}勝を付与）。`;
 $('firstSummary').textContent=`2位 vs 3位：${config.first}勝先取・2位に${config.firstAdvantage}勝付与。2位は実際にあと${config.first-config.firstAdvantage}勝、3位は${config.first}勝でCSファイナルへ。`;
 $('finalSummary').textContent=`1位 vs ファーストの勝者：1位は実際にあと${config.final-config.advantage}勝、挑戦側は${config.final}勝するとCS突破。`;
 $('rankCharts').innerHTML=chart(r.ranks);
 const rows=[{name:'自分のルール',result:r},...M.presets.map(rule=>({name:rule.name,result:M.league({...config,...rule})}))];
 $('comparison').innerHTML=rows.map((row,i)=>{const u=row.result.ranks[1]+row.result.ranks[2];return `<div class="compare-row"><div><div class="compare-name">${row.name}</div><div class="compare-detail">1位のCS突破 ${pct(row.result.ranks[0])}</div><div class="mini-track" role="img" aria-label="下剋上 ${pct(u)}、軸0〜100%"><span style="width:${u*100}%"></span></div></div><div class="compare-value">${pct(u)}<small>下剋上の確率</small></div>${i?`<button class="apply" data-preset="${i-1}" aria-label="${row.name}を適用">適用</button>`:'<span class="small">選択中</span>'}</div>`;}).join('');
}
function changed(){clearSimulation();render();document.dispatchEvent(new Event('cs-settings-changed'));}
function applyRule(i){for(const f of ['first','firstAdvantage','final','advantage'])config[f]=M.presets[i][f];forms();changed();}
$('forms').addEventListener('input',e=>{const el=e.target;if(!el.dataset.key)return;config[el.dataset.key]=el.valueAsNumber/(el.dataset.key.startsWith('p')?100:1);$('preset').value='';changed();});
$('forms').addEventListener('change',e=>{if(e.target.id==='preset'&&e.target.value!=='')applyRule(+e.target.value);});
$('reset').addEventListener('click',()=>{config=defaults();forms();changed();});
$('comparison').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)applyRule(+b.dataset.preset);});
function validRuns(){const n=$('runs').valueAsNumber,ok=Number.isInteger(n)&&n>=1&&n<=100000;$('simError').hidden=ok;$('runs').setAttribute('aria-invalid',String(!ok));return ok?n:null;}
$('runs').addEventListener('input',validRuns);
$('stop').addEventListener('click',()=>{generation++;running=false;$('run').disabled=false;$('stop').hidden=true;$('simStatus').textContent+='（途中停止・完了した回だけを集計）';});
$('run').addEventListener('click',async()=>{
 const target=validRuns();if(!target||M.validate(config).length||running)return;
 const token=++generation,snapshot={...config},theory=M.league(snapshot),theoretical=theory.ranks[1]+theory.ranks[2];
 let done=0,counts=[0,0,0],winners=[];running=true;$('run').disabled=true;$('stop').hidden=false;$('simOutput').hidden=true;$('progress').max=target;$('progress').value=0;
 $('simStatus').textContent='1試合ずつ勝敗を抽選しています…';
 while(done<target){
   await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;
   const batch=M.simulate(snapshot,Math.min(250,target-done));done+=batch.total;counts=counts.map((v,i)=>v+batch.counts[i]);winners=winners.concat(batch.winners).slice(0,100);
   const upsets=counts[1]+counts[2];$('simOutput').hidden=false;$('progress').value=done;
   $('simStatus').textContent=`${done.toLocaleString('ja-JP')} / ${target.toLocaleString('ja-JP')} 回完了`;
   $('simCount').textContent=`${upsets.toLocaleString('ja-JP')} 回`;$('simRate').textContent=pct(upsets/done);$('simTheory').textContent=pct(theoretical);
   $('simDifference').textContent=`理論値との差：${(100*(upsets/done-theoretical)).toFixed(2)} ポイント`;
   $('simRanks').innerHTML=counts.map((v,i)=>`<div class="r${i+1}"><span>${i+1}位がCS突破</span><strong>${v.toLocaleString('ja-JP')} 回</strong><span>${pct(v/done)}</span></div>`).join('');
   $('simChart').innerHTML=chart(counts.map(v=>v/done));
   $('trialLabel').textContent=`最初の${winners.length}回の結果（数字はCSを突破したチームの順位）`;
   $('trials').innerHTML=winners.map((v,i)=>`<span class="winner w${v}" title="${i+1}回目：${v}位がCS突破">${v}</span>`).join('');
 }
 running=false;$('run').disabled=false;$('stop').hidden=true;$('simStatus').textContent+='・集計完了';
});
forms();clearSimulation();render();
