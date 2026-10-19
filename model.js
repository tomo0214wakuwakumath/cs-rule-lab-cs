(function (root) {
  'use strict';
  const presets = [
    {name:'通常方式', first:2, firstAdvantage:0, final:4, advantage:1},
    {name:'2勝付与・5勝先取', first:2, firstAdvantage:0, final:5, advantage:2},
    {name:'2勝付与・4勝先取', first:2, firstAdvantage:0, final:4, advantage:2}
  ];
  function validate(c) {
    const errors=[];
    const fa=c.firstAdvantage===undefined?0:c.firstAdvantage;
    if(!Number.isInteger(fa)||fa<0||fa>=c.first)errors.push('ファーストの2位への付与勝数は0以上、ファースト先取勝数未満の整数にしてください。');
    for (const key of ['first','final']) if (!Number.isInteger(c[key]) || c[key]<1 || c[key]>30) errors.push(`${key==='first'?'ファースト':'ファイナル'}の先取勝数は1〜30の整数にしてください。`);
    if (!Number.isInteger(c.advantage) || c.advantage<0 || c.advantage>=c.final) errors.push('アドバンテージは0以上、ファイナル先取勝数未満の整数にしてください。');
    for (const key of ['p23','p12','p13']) if (!Number.isFinite(c[key]) || c[key]<0 || c[key]>1) errors.push(`${{p23:'2位が3位に',p12:'1位が2位に',p13:'1位が3位に'}[key]}勝つ確率は0〜100%にしてください。`);
    return errors;
  }
  // State (a,b): wins still needed. Each step decreases a or b.
  function series(a,b,p) {
    if (!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>60||b>60||!Number.isFinite(p)||p<0||p>1) throw new RangeError('Invalid series input');
    const dp=Array.from({length:a+1},()=>Array(b+1).fill(0));
    for(let j=0;j<=b;j++) dp[0][j]=1;
    for(let i=1;i<=a;i++) for(let j=1;j<=b;j++) dp[i][j]=p*dp[i-1][j]+(1-p)*dp[i][j-1];
    return dp[a][b];
  }
  function league(c) {
    const errors=validate(c); if(errors.length) throw new RangeError(errors.join('\n'));
    const q=series(c.first-(c.firstAdvantage??0),c.first,c.p23);
    const r2=series(c.final-c.advantage,c.final,c.p12);
    const r3=series(c.final-c.advantage,c.final,c.p13);
    return {ranks:[q*r2+(1-q)*r3,q*(1-r2),(1-q)*(1-r3)],firstSecond:q,finalVsSecond:r2,finalVsThird:r3};
  }
  function simulate(c,n,rng=Math.random) {
    const errors=validate(c); if(errors.length) throw new RangeError(errors.join('\n'));
    if(!Number.isInteger(n)||n<1||n>100000) throw new RangeError('実行回数は1〜100000の整数にしてください。');
    const counts=[0,0,0], winners=[];
    function play(a,b,p){
      while(a>0&&b>0){const draw=rng();if(!Number.isFinite(draw)||draw<0||draw>=1)throw new RangeError('Invalid random value');if(draw<p)a--;else b--;}
      return a===0;
    }
    for(let i=0;i<n;i++){
      const challenger=play(c.first-(c.firstAdvantage??0),c.first,c.p23)?2:3;
      const winner=play(c.final-c.advantage,c.final,challenger===2?c.p12:c.p13)?1:challenger;
      counts[winner-1]++;if(winners.length<100)winners.push(winner);
    }
    return {counts,winners,upsets:counts[1]+counts[2],total:n};
  }
  function searchRules(c,options) {
    if(validate(c).length)throw new RangeError('対戦勝率・ルールの設定を確認してください。');
    const {target,rank=1,maxFirst=5,maxFirstAdvantage=0,maxFinal=10,maxAdvantage=3}=options;
    if(!Number.isFinite(target)||target<0||target>1||![1,2,3].includes(rank))throw new RangeError('目標突破率は0〜100%で指定してください。');
    for(const v of [maxFirst,maxFinal])if(!Number.isInteger(v)||v<1||v>30)throw new RangeError('先取勝数の探索上限は1〜30の整数にしてください。');
    if(!Number.isInteger(maxAdvantage)||maxAdvantage<0||maxAdvantage>29)throw new RangeError('付与勝数の探索上限は0〜29の整数にしてください。');
    if(!Number.isInteger(maxFirstAdvantage)||maxFirstAdvantage<0||maxFirstAdvantage>29)throw new RangeError('ファースト付与勝数の探索上限は0〜29の整数にしてください。');
    const rows=[],qs=Array.from({length:maxFirst},(_,i)=>Array.from({length:Math.min(maxFirstAdvantage,i)+1},(_,a)=>series(i+1-a,i+1,c.p23)));
    for(let final=1;final<=maxFinal;final++)for(let advantage=0;advantage<=Math.min(maxAdvantage,final-1);advantage++){
      const r2=series(final-advantage,final,c.p12),r3=series(final-advantage,final,c.p13);
      for(let first=1;first<=maxFirst;first++)for(let firstAdvantage=0;firstAdvantage<=Math.min(maxFirstAdvantage,first-1);firstAdvantage++){
        const q=qs[first-1][firstAdvantage],ranks=[q*r2+(1-q)*r3,q*(1-r2),(1-q)*(1-r3)];
        rows.push({first,firstAdvantage,final,advantage,ranks,gap:Math.abs(ranks[rank-1]-target),maxGames:2*first-firstAdvantage-1+2*final-advantage-1});
      }
    }
    return rows.sort((a,b)=>a.gap-b.gap||a.maxGames-b.maxGames||a.first-b.first||a.final-b.final||a.advantage-b.advantage);
  }
  function searchFinal({target,p,maxFinal=10,maxAdvantage=3}) {
    if(!Number.isFinite(target)||target<0||target>1||!Number.isFinite(p)||p<0||p>1)throw new RangeError('目標突破率と1試合勝率は0〜100%にしてください。');
    if(!Number.isInteger(maxFinal)||maxFinal<1||maxFinal>30||!Number.isInteger(maxAdvantage)||maxAdvantage<0||maxAdvantage>29)throw new RangeError('先取勝数の上限は1〜30、付与勝数の上限は0〜29の整数にしてください。');
    const rows=[];
    for(let final=1;final<=maxFinal;final++)for(let advantage=0;advantage<=Math.min(maxAdvantage,final-1);advantage++){
      const probability=series(final-advantage,final,p);
      rows.push({final,advantage,ranks:[probability],gap:Math.abs(probability-target),maxGames:2*final-advantage-1});
    }
    return rows.sort((a,b)=>a.gap-b.gap||a.maxGames-b.maxGames||a.final-b.final||a.advantage-b.advantage);
  }
  const api={presets,validate,series,league,simulate,searchRules,searchFinal};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.CSModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
