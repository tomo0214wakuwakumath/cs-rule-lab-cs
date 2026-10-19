'use strict';
let searchRows=[],searchSnapshot=null,searchShown=20;
const searchFields=['goalRank','commonWinRate','goalRate','goalTolerance','maxFirst','maxFirstAdvantage','maxFinal','maxAdvantage'];
function switchMode(mode){
 for(const name of ['forward','inverse']){const active=mode===name;$(name+'Tab').setAttribute('aria-selected',String(active));$(name+'Tab').tabIndex=active?0:-1;$(name+'Panel').hidden=!active;}
 if(mode==='inverse'){syncSearchOdds();if(!searchSnapshot)runSearch();}
}
for(const name of ['forward','inverse'])$(name+'Tab').addEventListener('click',()=>switchMode(name));
$('modeTabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const mode=e.key==='Home'?'forward':e.key==='End'?'inverse':e.target.id==='forwardTab'?'inverse':'forward';switchMode(mode);$(mode+'Tab').focus();});
function syncSearchOdds(){
 const finalOnly=$('goalRank').value==='1';
 $('commonOdds').hidden=!finalOnly;$('firstSearchRange').hidden=finalOnly;$('fullSearchOdds').hidden=finalOnly;
 $('searchModeNote').textContent=finalOnly?'1位の突破率は、相手が2位でも3位でも同じ1試合勝率で計算します。ファーストは探索せず、ファイナルのルールだけを比較します。目標にぴったり合わない場合は近い候補を表示します。':'ファーストとファイナルのルールを組み合わせて探します。1試合勝率は「ルールから計算」タブの設定を使います。';
 $('maxGamesNote').textContent=finalOnly?'最大試合数はCSファイナルだけの実試合数です。付与された勝数は含めません。':'最大試合数はファーストとファイナルの実試合数の合計です。';
 $('searchOdds').textContent=`使用する1試合勝率：2位→3位 ${pct(config.p23)} ／ 1位→2位 ${pct(config.p12)} ／ 1位→3位 ${pct(config.p13)}`;}
function invalidateSearch(){searchSnapshot=null;searchRows=[];$('searchResults').hidden=true;$('searchStatus').textContent='条件が変わりました。「ルールを探す」で候補を更新してください。';syncSearchOdds();}
document.addEventListener('cs-settings-changed',invalidateSearch);
searchFields.forEach(id=>$(id).addEventListener('input',invalidateSearch));
$('editOdds').addEventListener('click',()=>{switchMode('forward');$('p23').focus();});
function runSearch(){
 $('searchResults').hidden=true;$('searchError').hidden=true;searchSnapshot=null;
 const options={rank:Number($('goalRank').value),target:$('goalRate').valueAsNumber/100,maxFirst:$('maxFirst').valueAsNumber,maxFirstAdvantage:$('maxFirstAdvantage').valueAsNumber,maxFinal:$('maxFinal').valueAsNumber,maxAdvantage:$('maxAdvantage').valueAsNumber,p:$('commonWinRate').valueAsNumber/100,finalOnly:$('goalRank').value==='1'};
 const tolerance=$('goalTolerance').valueAsNumber/100;
 try{
   if(!Number.isFinite(tolerance)||tolerance<0||tolerance>1)throw new RangeError('許容する差は0〜100ポイントで指定してください。');
   searchRows=options.finalOnly?M.searchFinal(options):M.searchRules(config,options);searchSnapshot={...options,tolerance};searchShown=20;drawSearch();
 }catch(e){searchRows=[];$('searchError').textContent=e.message;$('searchError').hidden=false;$('searchStatus').textContent='入力を確認してください。';}
}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();runSearch();});
$('searchSort').addEventListener('change',()=>{searchShown=20;drawSearch();});
$('showMore').addEventListener('click',()=>{searchShown+=20;drawSearch();});
function drawSearch(){
 if(!searchSnapshot)return;
 const s=searchSnapshot,matching=searchRows.filter(r=>r.gap<=s.tolerance+1e-12),hasMatches=matching.length>0;
 let pool=hasMatches?matching:[...searchRows];
 if(hasMatches&&$('searchSort').value==='games')pool=[...pool].sort((a,b)=>a.maxGames-b.maxGames||a.gap-b.gap||a.first-b.first||a.final-b.final||a.advantage-b.advantage);
 const visible=pool.slice(0,searchShown);
 $('searchResults').hidden=false;$('showMore').hidden=visible.length>=pool.length;
 $('searchStatus').textContent=`${searchRows.length.toLocaleString('ja-JP')}通りを探索。目標：${s.rank}位のCS突破率 ${pct(s.target)}、許容差 ±${(s.tolerance*100).toFixed(2)}ポイント。`;
 $('searchSummary').textContent=hasMatches?`条件に合う${matching.length}件のうち${visible.length}件を表示しています。`:`指定範囲に条件を満たすルールはありません。近い順に${visible.length}件を表示します（最も近い候補の差は${(searchRows[0].gap*100).toFixed(4)}ポイント）。`;
 $('searchCards').innerHTML=visible.map(row=>`<article class="rule-card"><div class="rule-card-top"><strong>${s.rank}位のCS突破率 ${pct(row.ranks[s.rank-1])}</strong><span>目標との差 ${(row.gap*100).toFixed(4)}ポイント</span></div><p>${s.finalOnly?'':`ファースト <b>${row.first}勝先取・2位に${row.firstAdvantage}勝付与</b> ／ `}ファイナル <b>${row.final}勝先取</b> ／ 1位に <b>${row.advantage}勝付与</b></p>${s.finalOnly?'':`<p class="hint">CSファースト：2位はあと${row.first-row.firstAdvantage}勝、3位は${row.first}勝で次のステージへ</p>`}<p class="hint">CSファイナル：1位はあと${row.final-row.advantage}勝、挑戦側は${row.final}勝で突破</p><div class="rank-values">${row.ranks.map((p,i)=>`<span class="r${i+1}">${i+1}位 ${pct(p)}</span>`).join('')}</div><div class="rule-card-bottom"><span>${s.finalOnly?'CSファイナル':'CS全体'}で最大 <strong>${row.maxGames}試合</strong></span><button class="apply" data-first="${row.first}" data-first-advantage="${row.firstAdvantage}" data-final="${row.final}" data-advantage="${row.advantage}">このルールを試す →</button></div></article>`).join('');
}
$('searchCards').addEventListener('click',e=>{const button=e.target.closest('[data-final]');if(!button||!searchSnapshot)return;const finalOnly=searchSnapshot.finalOnly;config={...config,...(finalOnly?{p12:searchSnapshot.p,p13:searchSnapshot.p}:{first:+button.dataset.first,firstAdvantage:+button.dataset.firstAdvantage}),final:+button.dataset.final,advantage:+button.dataset.advantage};forms();changed();switchMode('forward');$('forwardTab').focus();$('appliedNotice').hidden=false;$('appliedNotice').textContent=finalOnly?'ファイナルのルールと、対2位・対3位共通の1試合勝率を適用しました。ファーストの設定に関係なく、1位の理論上の突破率は候補と一致します。':'選んだルールを適用しました。このタブで確率の確認とシミュレーションができます。';});
syncSearchOdds();
