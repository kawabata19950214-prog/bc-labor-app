
let QA=[], qlist=[], qi=0, revealed=false;
const $q=s=>document.querySelector(s);
fetch('./qa-data.json').then(r=>r.json()).then(d=>{QA=d.cards||[]; initQA();});
function initQA(){
  const lev=$q('#qaLevel');
  function rebuild(){
    const L=lev.value;
    const topics=[...new Set(QA.filter(x=>x.level===L).map(x=>x.topic))].sort();
    $q('#qaTopic').innerHTML='<option value="">全分野</option>'+topics.map(t=>`<option>${escQA(t)}</option>`).join('');
    filterQA();
  }
  lev.onchange=rebuild; $q('#qaTopic').onchange=filterQA;
  $q('#qaLauncher').onclick=()=>{$q('#qaOverlay').classList.remove('hidden'); filterQA();};
  $q('#qaClose').onclick=()=> $q('#qaOverlay').classList.add('hidden');
  $q('#qaReveal').onclick=()=>{revealed=true; renderQA();};
  $q('#qaNext').onclick=()=>{if(qlist.length){qi=(qi+1)%qlist.length;revealed=false;renderQA();}};
  $q('#qaPrev').onclick=()=>{if(qlist.length){qi=(qi-1+qlist.length)%qlist.length;revealed=false;renderQA();}};
  $q('#qaShuffle').onclick=()=>{qlist.sort(()=>Math.random()-.5);qi=0;revealed=false;renderQA();};
  rebuild();
}
function filterQA(){
  const L=$q('#qaLevel').value,T=$q('#qaTopic').value;
  qlist=QA.filter(x=>x.level===L && (!T||x.topic===T));
  qi=0;revealed=false;renderQA();
}
function escQA(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function renderQA(){
  if(!qlist.length){$q('#qaCard').innerHTML='<p>該当する一問一答がありません。</p>';return;}
  const c=qlist[qi];
  $q('#qaProgress').textContent=`${qi+1} / ${qlist.length}`;
  $q('#qaCard').innerHTML=`<div class="qa-badge">${escQA(c.level)}｜${escQA(c.topic)}</div>
    <div class="qa-q"><span>Q</span>${escQA(c.question)}</div>
    ${revealed?`<div class="qa-answer"><b>A</b><div>${escQA(c.answer)}</div></div>
      <div class="qa-explain">${escQA(c.explanation).replace(/\n/g,'<br>')}</div>
      <div class="qa-ref">元過去問：${escQA(c.source_question_id||'')}　基準日：${escQA(c.exam_reference_date||'')}</div>`:''}`;
  $q('#qaReveal').textContent=revealed?'答え表示中':'答えを見る';
}
