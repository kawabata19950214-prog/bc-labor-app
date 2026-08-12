
const QKEY='bc_labor_questions_v3',HKEY='bc_labor_history_v3',FKEY='bc_labor_favs_v3',LKEY='bc_labor_level_v3';
const DBNAME='bc_labor_db_v1',DBSTORE='data',DBQKEY='questions';
let QUESTIONS=[],history=JSON.parse(localStorage.getItem(HKEY)||'[]'),favs=new Set(JSON.parse(localStorage.getItem(FKEY)||'[]')),level=localStorage.getItem(LKEY)||'2級';

function openBCDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DBNAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DBSTORE))db.createObjectStore(DBSTORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function idbGet(key){
  const db=await openBCDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(DBSTORE,'readonly');
    const req=tx.objectStore(DBSTORE).get(key);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function idbSet(key,value){
  const db=await openBCDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(DBSTORE,'readwrite');
    tx.objectStore(DBSTORE).put(value,key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}
async function loadQuestionData(){
  try{
    let p=await idbGet(DBQKEY);
    if(Array.isArray(p)&&p.length){QUESTIONS=p;return;}
    const old=localStorage.getItem(QKEY);
    if(old){
      try{
        p=JSON.parse(old);
        if(Array.isArray(p)&&p.length){
          QUESTIONS=p;
          await idbSet(DBQKEY,p);
          localStorage.removeItem(QKEY);
          return;
        }
      }catch(e){}
    }
  }catch(e){
    console.error('IndexedDB load error',e);
  }
  QUESTIONS=[];
}
let quiz=[],idx=0,selected={},submitted={},timerId=null,remain=0,exam=false;
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function pool(){return QUESTIONS.filter(q=>q.level===level)}
function setLevel(v){level=v;localStorage.setItem(LKEY,v);document.querySelectorAll('.level').forEach(b=>b.classList.toggle('active',b.dataset.level===v));refresh()}
document.querySelectorAll('.level').forEach(b=>b.onclick=()=>setLevel(b.dataset.level));
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function switchTab(id){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.tab===id));if(id==='review')renderReview('wrong');if(id==='search')renderSearch();}
function refresh(){document.querySelectorAll('.level').forEach(b=>b.classList.toggle('active',b.dataset.level===level));$('noData').classList.toggle('hidden',QUESTIONS.length>0);$('statQ').textContent=pool().length;let h=history.filter(a=>a.level===level);$('statA').textContent=h.length;$('statR').textContent=h.length?Math.round(h.filter(a=>a.correct).length/h.length*100)+'%':'-';$('dataStatus').textContent=QUESTIONS.length?`端末内：${QUESTIONS.length}問（2級 ${QUESTIONS.filter(q=>q.level==='2級').length}問／3級 ${QUESTIONS.filter(q=>q.level==='3級').length}問）`:'問題データ未読込';renderWeak();filters();}
function renderWeak(){let h=history.filter(a=>a.level===level),m={};h.forEach(a=>{m[a.category]??={n:0,c:0};m[a.category].n++;if(a.correct)m[a.category].c++});let arr=Object.entries(m).map(([k,v])=>({k,n:v.n,r:v.c/v.n})).filter(x=>x.n>=2).sort((a,b)=>a.r-b.r).slice(0,5);$('weak').innerHTML=arr.length?arr.map(x=>`<div>${esc(x.k)}：<b>${Math.round(x.r*100)}%</b>（${x.n}問）</div>`).join(''):'まだ十分な回答履歴がありません。';}
function filters(){let p=pool(),y=$('fYear'),c=$('fCat'),yv=y.value,cv=c.value;y.innerHTML='<option value="">すべて</option>'+[...new Set(p.map(q=>q.year))].map(x=>`<option>${x}</option>`).join('');c.innerHTML='<option value="">すべて</option>'+[...new Set(p.map(q=>q.category))].sort().map(x=>`<option>${esc(x)}</option>`).join('');if([...y.options].some(o=>o.value===yv))y.value=yv;if([...c.options].some(o=>o.value===cv))c.value=cv;}
function ensure(){if(!QUESTIONS.length){switchTab('data');alert('先に問題データを読み込んでください。');return false}return true}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function quick(n){if(!ensure())return;launch(shuffle([...pool()]).slice(0,n),false)}
function quickWrong(){if(!ensure())return;let last={};history.filter(a=>a.level===level).forEach(a=>last[a.qid]=a);let p=pool().filter(q=>last[q.id]&&!last[q.id].correct);if(!p.length)return alert('現在、間違い復習の対象はありません。');launch(shuffle(p),false)}
function quickFav(){if(!ensure())return;let p=pool().filter(q=>favs.has(q.id));if(!p.length)return alert('お気に入りがありません。');launch(p,false)}
function startFiltered(asExam){if(!ensure())return;let p=pool().filter(q=>(!$('fYear').value||q.year===$('fYear').value)&&(!$('fTerm').value||q.term===$('fTerm').value)&&(!$('fCat').value||q.category===$('fCat').value));p=shuffle(p).slice(0,Number($('fCount').value));if(!p.length)return alert('条件に合う問題がありません。');launch(p,asExam)}
function launch(p,asExam){quiz=p;idx=0;selected={};submitted={};exam=asExam;$('setup').classList.add('hidden');$('result').classList.add('hidden');$('quiz').classList.remove('hidden');if(exam){remain=110*60;startTimer()}else{$('timer').textContent='';stopTimer()}switchTab('practice');renderQ();window.scrollTo({top:0,behavior:'smooth'})}

function renderDetailedExplanation(q){
  if(!q.simple_explanations){
    return `<div class="explain-text">${esc(q.explanation||'')}</div>`;
  }
  let html=`<section class="simple-ex-section"><h4>各選択肢の解説</h4>`;
  for(const [k,stmt] of Object.entries(q.choices||{})){
    const verdict=(q.choice_explanations&&q.choice_explanations[k]&&q.choice_explanations[k].verdict)||'';
    const good=String(verdict).startsWith('○');
    const ex=q.simple_explanations[k]||'';
    html+=`<div class="simple-option ${good?'simple-good':'simple-bad'}">
      <div class="simple-head"><span class="option-label">${esc(k)}</span><strong>${esc(verdict)}</strong></div>
      <div class="simple-statement">${esc(stmt)}</div>
      <div class="simple-explanation">${esc(ex)}</div>
    </div>`;
  }
  html+=`</section>`;
  html+=`<div class="reference-date">この問題の法令基準日：${esc(q.exam_reference_date||'-')}</div>`;
  if(q.current_note)html+=`<div class="current-note"><b>⚠ 現行制度メモ</b><div>${esc(q.current_note)}</div></div>`;
  return html;
}
function renderQ(){let q=quiz[idx];if(!q)return;$('progress').textContent=`${idx+1} / ${quiz.length}`;$('meta').textContent=`${q.level} ${q.year}${q.term} 問${q.qno}`;$('progressBar').style.width=`${(idx+1)/quiz.length*100}%`;$('date').textContent=`出題基準：${q.exam_reference_date||'-'}｜${q.category}`;$('favBtn').classList.toggle('on',favs.has(q.id));$('qtext').textContent=q.text;$('choices').innerHTML=Object.entries(q.choices).map(([k,v])=>{let cls='choice';if(submitted[q.id]){if(k===q.answer)cls+=' correct';else if(selected[q.id]===k)cls+=' wrong'}return `<label class="${cls}"><input type="radio" name="ans" value="${k}" ${selected[q.id]===k?'checked':''} ${submitted[q.id]?'disabled':''} onchange="selected['${q.id}']=this.value"><b>${k}</b><span>${esc(v)}</span></label>`}).join('');let fb=$('feedback');if(submitted[q.id]){let ok=selected[q.id]===q.answer;fb.className='feedback '+(ok?'ok':'ng');fb.innerHTML=`<div class="answer-result"><b>${ok?'✅ 正解':'❌ 不正解'}　正解：${q.answer}</b></div><div class="explain">${renderDetailedExplanation(q)}<div class="muted" style="margin-top:14px">${esc(q.explanation_kind||'')}</div></div>`;fb.classList.remove('hidden');$('submit').disabled=true;$('submit').textContent='回答済み'}else{fb.className='feedback hidden';fb.innerHTML='';$('submit').disabled=false;$('submit').textContent='回答する'}}
function submitQ(){let q=quiz[idx],a=selected[q.id];if(!a)return alert('選択肢を選んでください。');if(submitted[q.id])return;let rec={qid:q.id,level:q.level,year:q.year,term:q.term,category:q.category,selected:a,answer:q.answer,correct:a===q.answer,at:new Date().toISOString()};history.push(rec);localStorage.setItem(HKEY,JSON.stringify(history));submitted[q.id]=true;renderQ();refresh()}
function prevQ(){if(idx>0){idx--;renderQ();scrollTo(0,0)}}
function nextQ(){if(idx<quiz.length-1){idx++;renderQ();scrollTo(0,0)}else finish()}
function finish(){stopTimer();let done=quiz.filter(q=>submitted[q.id]),c=done.filter(q=>selected[q.id]===q.answer).length,r=done.length?Math.round(c/done.length*100):0;$('quiz').classList.add('hidden');$('setup').classList.remove('hidden');$('result').classList.remove('hidden');$('result').innerHTML=`<h2>結果</h2><div style="font-size:36px;font-weight:900">${c} / ${done.length}</div><div style="font-size:22px;font-weight:800">${r}%</div><p>${r>=80?'🎯 8割達成。':'間違い復習で弱点を潰しましょう。'}</p><button class="btn secondary" onclick="quickWrong()">間違いを復習</button>`}
function startTimer(){stopTimer();let tick=()=>{let m=Math.floor(remain/60),s=remain%60;$('timer').textContent=`${m}:${String(s).padStart(2,'0')}`;if(remain--<=0){stopTimer();finish();alert('制限時間が終了しました。')}};tick();timerId=setInterval(tick,1000)}function stopTimer(){if(timerId)clearInterval(timerId);timerId=null}
function toggleFavCurrent(){let q=quiz[idx];if(!q)return;if(favs.has(q.id))favs.delete(q.id);else favs.add(q.id);localStorage.setItem(FKEY,JSON.stringify([...favs]));renderQ()}
function renderReview(kind){if(!QUESTIONS.length){$('reviewList').innerHTML='<div class="muted">問題データ未読込</div>';return}let p;if(kind==='fav')p=pool().filter(q=>favs.has(q.id));else{let last={};history.filter(a=>a.level===level).forEach(a=>last[a.qid]=a);p=pool().filter(q=>last[q.id]&&!last[q.id].correct)}$('reviewList').innerHTML=p.length?p.map(q=>`<div class="item"><div class="meta">${q.year}${q.term} 問${q.qno}｜${esc(q.category)}</div><div>${esc(q.text)}</div><button class="btn ghost" style="margin-top:8px" onclick="launchById('${q.id}')">この問題を解く</button></div>`).join(''):'<div class="muted">対象の問題はありません。</div>'}
function renderSearch(){let el=$('searchList');if(!QUESTIONS.length){el.innerHTML='<div class="muted">問題データ未読込</div>';return}let s=($('searchBox').value||'').trim().toLowerCase(),p=pool().filter(q=>!s||(q.text+' '+Object.values(q.choices).join(' ')+' '+q.category).toLowerCase().includes(s)).slice(0,100);el.innerHTML=p.map(q=>`<div class="item"><div class="meta">${q.year}${q.term} 問${q.qno}｜${esc(q.category)}</div><div>${esc(q.text)}</div><button class="btn ghost" style="margin-top:8px" onclick="launchById('${q.id}')">解く</button></div>`).join('')||'<div class="muted">該当なし</div>'}
function launchById(id){let q=QUESTIONS.find(x=>x.id===id);if(q)launch([q],false)}
function importQuestions(f){
  if(!f)return;
  let r=new FileReader;
  r.onload=async()=>{
    try{
      let d=JSON.parse(r.result),p=Array.isArray(d)?d:d.questions;
      if(!Array.isArray(p)||p.length<1)throw new Error('invalid question data');
      await idbSet(DBQKEY,p);
      QUESTIONS=p;
      try{localStorage.removeItem(QKEY)}catch(e){}
      refresh();
      let total=0,complete=0;
      p.forEach(q=>Object.values(q.choice_explanations||{}).forEach(v=>{
        total++;
        if((v.correct_rule||v.correct_statement||v.correct)&&(v.reason||v.why)&&(v.error_point||v.wrong_part||v.point))complete++;
      }));
      alert(`${p.length}問を端末に保存しました。\n保存先：IndexedDB\n選択肢解説：${complete}/${total}件 読込確認済み`);
    }catch(e){
      console.error(e);
      alert('問題データを読み込めませんでした。\nJSONファイルを選び直してください。');
    }finally{
      const input=document.getElementById('qImport');
      if(input)input.value='';
    }
  };
  r.onerror=()=>alert('ファイルを読み込めませんでした。');
  r.readAsText(f);
}
async function exportHistory(){let data={version:3,history,favs:[...favs]};let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),file=new File([blob],'BC労務_学習履歴.json',{type:'application/json'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'BC労務 学習履歴'});return}catch(e){}}let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click()}
function importHistory(f){if(!f)return;let r=new FileReader;r.onload=()=>{try{let d=JSON.parse(r.result);history=d.history||[];favs=new Set(d.favs||[]);localStorage.setItem(HKEY,JSON.stringify(history));localStorage.setItem(FKEY,JSON.stringify([...favs]));refresh();alert('学習履歴を復元しました。')}catch(e){alert('復元できませんでした。')}};r.readAsText(f)}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
(async function boot(){await loadQuestionData();refresh();})();
