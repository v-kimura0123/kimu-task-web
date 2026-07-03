const KEY='kimu-task-lite-v1';
const $=s=>document.querySelector(s);
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source=/iPhone|iPad|iPod/i.test(navigator.userAgent)?'iphone':'web';
const sourceLabel=s=>({mac:'Mac',web:'WEB',iphone:'iPhone'}[s]||'クラウド');
const cloudDefaults={url:'https://qlepvmxyinathcicesfv.supabase.co',key:'sb_publishable_PkdyTEB-pvuchkJqm3f7Pw_8GGJK4Au'};
const safeJSON=(k,f={})=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
let cloudConfig={...cloudDefaults,...safeJSON('kimu-cloud-config',{})};
let cloudClient=null,cloudUser=null,page='dashboard',remotePayload=null,backup={tasks:[],categories:[],templates:[],trash:[],workdays:[],quickLaunchItems:[],favoriteLinks:[],imageMemos:[]};
let local=safeJSON(KEY,{lastSync:null,lastSource:null});
const deviceID=localStorage.getItem('kimu-device-id')||uid();
localStorage.setItem('kimu-device-id',deviceID);

function setTitle(title,sub=''){
  $('#pageTitle').textContent=title;
  $('#pageSub').textContent=sub||new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(new Date());
}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800)}
function setSave(text){$('#saveState').textContent=text}
function statusText(t){return t.isDone?'完了':(t.status||'早め')}
function dateOnly(value){if(!value)return'';const s=String(value);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
function isIdea(t){return t.isIdea===true||t.category==='思いつき'||t.status==='思いつき'}
function isMemo(t){return t.isWorkMemo===true||t.category==='memo'||t.status==='仕事メモ'}
function isWork(t){return !isIdea(t)&&!isMemo(t)&&!t.archivedAt}
function activeTasks(){return (backup.tasks||[]).filter(t=>!t.isDone&&!t.archivedAt)}
function visibleWork(){return activeTasks().filter(isWork)}
function statusRank(t){
  const s=statusText(t);
  return ['完了','★絶対今日','早め','できればやる','いつかやる','毎日・定期','まち','一時保留'].indexOf(s)+1||99;
}
function sortWork(a,b){
  const da=dateOnly(a.taskDate||a.sheetBatchDate),db=dateOnly(b.taskDate||b.sheetBatchDate);
  if(da!==db)return (da||'9999').localeCompare(db||'9999');
  const ra=statusRank(a),rb=statusRank(b);
  if(ra!==rb)return ra-rb;
  return String(a.createdAt||'').localeCompare(String(b.createdAt||''));
}
function memoSort(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''))}
function updateFooter(){
  const when=local.lastSync?new Date(local.lastSync).toLocaleString('ja-JP'):'未同期';
  document.querySelector('.sync').textContent=`最終同期：${sourceLabel(local.lastSource)} ${when}`;
}

function renderNav(){
  const items=[
    ['dashboard','▦','ダッシュボード'],
    ['today','☀','今日の仕事'],
    ['future','🌅','次の日以降'],
    ['done','✓','完了'],
    ['idea','💡','思いつきBOX'],
    ['memo','📝','仕事メモ'],
    ['sync','↻','同期設定']
  ];
  $('#nav').innerHTML=`<div class="nav-top">${items.map(([id,icon,label])=>`<button class="nav-item ${page===id?'active':''}" data-page="${id}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
  document.querySelectorAll('[data-page]').forEach(b=>{
    b.classList.toggle('active',b.dataset.page===page);
    b.onclick=()=>{page=b.dataset.page;closeSidebar();render()};
  });
}

function setSidebar(open){
  const sidebar=$('#sidebar'),scrim=$('#scrim');
  document.body.classList.toggle('sidebar-open',open);
  sidebar?.classList.toggle('open',open);
  scrim?.classList.toggle('open',open);
  if(open){
    sidebar?.setAttribute('data-open','true');
    scrim?.setAttribute('data-open','true');
  }else{
    sidebar?.removeAttribute('data-open');
    scrim?.removeAttribute('data-open');
  }
}
function openSidebar(){setSidebar(true)}
function closeSidebar(){setSidebar(false)}

function cardTask(t,{memo=false}={}){
  const d=dateOnly(t.taskDate||t.sheetBatchDate);
  return `<article class="lite-task readonly-task" data-id="${t.id}">
    <span class="check ${t.isDone?'done':''}">${t.isDone?'✓':''}</span>
    <div class="lite-main">
      <h3>${esc(t.title)}</h3>
      <div class="meta"><span class="pill">${esc(t.category||'')}</span><span class="pill">${esc(statusText(t))}</span>${d?`<span>${esc(d)}</span>`:''}${t.minutes?`<span>${t.minutes}分</span>`:''}</div>
      ${memo&&t.note?`<p class="memo-preview">${esc(t.note)}</p>`:''}
    </div>
  </article>`;
}

function renderDashboard(){
  const todayItems=visibleWork().filter(t=>dateOnly(t.taskDate||t.sheetBatchDate)===today());
  const future=visibleWork().filter(t=>dateOnly(t.taskDate||t.sheetBatchDate)>today());
  const ideas=activeTasks().filter(isIdea).sort(memoSort).slice(0,5);
  const memos=activeTasks().filter(isMemo).sort(memoSort).slice(0,5);
  setTitle('Kimu Task Lite','閲覧＋メモ送信用');
  $('#content').innerHTML=`<section class="panel dashboard-hero"><div><h2>Web版はLite運用だよ</h2><p class="meta">仕事は閲覧のみ。思いつきBOXと仕事メモだけ編集して、Macへ送れる形にしているよ。</p></div><button id="syncNow" class="secondary">同期・更新</button></section>
  <section class="panel dashboard-quick"><span>💡</span><input id="quickIdea" placeholder="思いつきをここにメモ"><button id="quickIdeaAdd" class="primary">思いつきBOXへ送る</button></section>
  <div class="summary"><div class="metric"><small>今日の仕事</small><strong>${todayItems.length}件</strong></div><div class="metric"><small>次の日以降</small><strong>${future.length}件</strong></div><div class="metric"><small>思いつき</small><strong>${ideas.length}件</strong></div></div>
  <div class="dashboard-grid"><section class="panel"><h2>今日の仕事</h2>${todayItems.slice(0,8).map(cardTask).join('')||'<p class="meta">今はなし</p>'}</section><section class="panel"><h2>思いつきメモ</h2>${ideas.map(t=>cardTask(t,{memo:true})).join('')||'<p class="meta">今はなし</p>'}</section><section class="panel"><h2>仕事メモ</h2>${memos.map(t=>cardTask(t,{memo:true})).join('')||'<p class="meta">今はなし</p>'}</section></div>`;
  $('#syncNow').onclick=()=>pullCloud(false);
  $('#quickIdeaAdd').onclick=()=>quickAdd('idea');
  $('#quickIdea').onkeydown=e=>{if(e.key==='Enter')quickAdd('idea')};
}
function renderList(kind){
  const title={today:'今日の仕事',future:'次の日以降',done:'完了'}[kind];
  let tasks=[];
  if(kind==='today')tasks=visibleWork().filter(t=>dateOnly(t.taskDate||t.sheetBatchDate)===today()).sort(sortWork);
  if(kind==='future')tasks=visibleWork().filter(t=>dateOnly(t.taskDate||t.sheetBatchDate)>today()).sort(sortWork);
  if(kind==='done')tasks=(backup.tasks||[]).filter(t=>t.isDone&&!isIdea(t)&&!isMemo(t)&&!t.archivedAt).sort(sortWork);
  setTitle(title,'閲覧のみ');
  $('#content').innerHTML=`<div class="summary"><div class="metric"><small>表示中</small><strong>${tasks.length}件</strong></div></div><div class="task-list">${tasks.map(cardTask).join('')||'<div class="empty">ここにはまだ何もないよ</div>'}</div>`;
}
function renderMemo(kind){
  const isIdeaKind=kind==='idea';
  const title=isIdeaKind?'思いつきBOX':'仕事メモ';
  const tasks=activeTasks().filter(isIdeaKind?isIdea:isMemo).sort(memoSort);
  setTitle(title,'追加・編集OK');
  $('#content').innerHTML=`<section class="panel"><h2>${title}へ追加</h2><div class="field"><label>内容</label><input id="memoTitle" placeholder="${title}に入れる内容"></div><div class="field"><label>メモ</label><textarea id="memoNote" placeholder="補足があれば"></textarea></div><button id="memoAdd" class="primary">追加してMacへ送る</button></section>
  <div class="task-list">${tasks.map(t=>`<article class="lite-task memo-edit" data-id="${t.id}"><div class="lite-main"><h3>${esc(t.title)}</h3><p class="memo-preview">${esc(t.note||'')}</p><div class="meta"><span>${dateOnly(t.taskDate||t.createdAt)||''}</span></div></div><button class="secondary editMemo">編集</button><button class="danger deleteMemo">削除</button></article>`).join('')||'<div class="empty">まだないよ</div>'}</div>`;
  $('#memoAdd').onclick=()=>addMemo(kind);
  document.querySelectorAll('.editMemo').forEach(b=>b.onclick=e=>openMemoEditor(e.target.closest('[data-id]').dataset.id,kind));
  document.querySelectorAll('.deleteMemo').forEach(b=>b.onclick=e=>deleteMemo(e.target.closest('[data-id]').dataset.id));
}
function renderSync(){
  setTitle('同期設定','Supabase接続');
  const history=(remotePayload?.updateHistory||[]).slice(0,5);
  $('#content').innerHTML=`<section class="panel"><h2>同期設定</h2><p class="meta">${cloudUser?`接続中：${esc(cloudUser.email||'ログイン済み')}`:'Macと同じSupabaseへ接続してね。'}</p>
  <div class="field"><label>Project URL</label><input id="cloudURL" value="${esc(cloudConfig.url||'')}"></div>
  <div class="field"><label>Publishable key</label><input id="cloudKey" type="password" value="${esc(cloudConfig.key||'')}"></div>
  <div class="field"><label>メール</label><input id="cloudEmail" type="email" value="${esc(cloudConfig.email||'')}"></div>
  <div class="field"><label>パスワード</label><input id="cloudPassword" type="password"></div>
  <div class="row"><button id="connectCloud" class="primary">${cloudUser?'再接続':'接続'}</button><button id="pullCloud" class="secondary" ${cloudUser?'':'disabled'}>今すぐ読込</button></div><p id="cloudStatus" class="meta">${local.lastSync?'最終同期：'+new Date(local.lastSync).toLocaleString('ja-JP'):'未同期'}</p></section>
  <section class="panel"><h2>最近の更新履歴</h2>${history.map(h=>`<div class="row spread"><span>${sourceLabel(h.source)}</span><small>${new Date(h.updatedAt).toLocaleString('ja-JP')}</small></div>`).join('')||'<p class="meta">まだないよ</p>'}</section>`;
  $('#connectCloud').onclick=connectCloud;
  $('#pullCloud').onclick=()=>pullCloud(false);
}
function render(){
  renderNav();updateFooter();
  $('#importButton').style.display='none';$('#exportButton').style.display='none';
  $('#addButton').textContent='＋ メモ追加';$('#addButton').onclick=()=>{page='idea';render();setTimeout(()=>$('#memoTitle')?.focus(),0)};
  if(page==='dashboard')return renderDashboard();
  if(['today','future','done'].includes(page))return renderList(page);
  if(page==='idea'||page==='memo')return renderMemo(page);
  if(page==='sync')return renderSync();
}

function taskBase(kind,title,note=''){
  const now=new Date().toISOString();
  const idea=kind==='idea';
  return {id:uid(),title,category:idea?'思いつき':'memo',minutes:null,timeLabel:null,status:idea?'思いつき':'仕事メモ',statusBeforeCompletion:null,isDone:false,taskDate:now,createdAt:now,note,isIdea:idea,isWorkMemo:!idea,isPinned:false,manualOrder:null,memoGroup:null,startedAt:null,completedAt:null,archivedAt:null,excludeFromSheet:true};
}
async function withLatestBackup(mutator){
  await pullCloud(true);
  mutator();
  await pushCloud(false);
}
function quickAdd(kind){
  const input=$('#quickIdea'),title=input.value.trim();
  if(!title)return;
  input.value='';
  withLatestBackup(()=>backup.tasks.unshift(taskBase(kind,title))).then(()=>{toast('Macへ送ったよ');render()}).catch(e=>toast('保存できなかったよ：'+e.message));
}
function addMemo(kind){
  const title=$('#memoTitle').value.trim(),note=$('#memoNote').value.trim();
  if(!title)return toast('内容を入れてね');
  withLatestBackup(()=>backup.tasks.unshift(taskBase(kind,title,note))).then(()=>{toast('Macへ送ったよ');render()}).catch(e=>toast('保存できなかったよ：'+e.message));
}
function openMemoEditor(id,kind){
  const t=(backup.tasks||[]).find(x=>x.id===id); if(!t)return;
  const f=$('#taskForm');
  f.innerHTML=`<h2>${kind==='idea'?'思いつき':'仕事メモ'}を編集</h2><div class="field"><label>内容</label><input name="title" value="${esc(t.title)}"></div><div class="field"><label>メモ</label><textarea name="note">${esc(t.note||'')}</textarea></div><menu><button value="cancel" class="secondary">戻る</button><button value="save" class="primary">保存してMacへ送る</button></menu>`;
  f.onsubmit=e=>{if(e.submitter?.value!=='save')return;e.preventDefault();const data=Object.fromEntries(new FormData(f));$('#taskDialog').close();withLatestBackup(()=>{const item=backup.tasks.find(x=>x.id===id);if(item){item.title=data.title;item.note=data.note;item.updatedAt=new Date().toISOString();}}).then(()=>{toast('更新したよ');render()}).catch(err=>toast('保存できなかったよ：'+err.message))};
  $('#taskDialog').showModal();
}
function deleteMemo(id){
  if(!confirm('このメモを削除する？'))return;
  withLatestBackup(()=>{backup.tasks=(backup.tasks||[]).filter(t=>t.id!==id)}).then(()=>{toast('削除したよ');render()}).catch(e=>toast('削除できなかったよ：'+e.message));
}

function backupToLocal(){
  local.lastSync=remotePayload?.updatedAt||new Date().toISOString();
  local.lastSource=remotePayload?.source||'cloud';
  localStorage.setItem(KEY,JSON.stringify(local));
}
function history(updatedAt){
  const entry={source,deviceID,updatedAt};
  const old=remotePayload?.updateHistory||[];
  return [entry,...old.filter(x=>!(x.source===source&&x.deviceID===deviceID))].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,5);
}
function makePayload(){
  const now=new Date().toISOString();
  return {schemaVersion:2,updatedAt:now,deviceID,source,backup,webState:{tasks:(backup.tasks||[]).map(t=>({id:t.id,title:t.title,category:t.category,minutes:t.minutes??null,status:t.isDone?'完了':t.status,done:!!t.isDone,date:dateOnly(t.taskDate||t.sheetBatchDate||t.createdAt)||today(),note:t.note||'',kind:t.isIdea?'idea':(t.isWorkMemo?'memo':null),pinned:!!t.isPinned,startedAt:t.startedAt||null,completedAt:t.completedAt||null,archivedAt:t.archivedAt||null,excludeFromSheet:!!t.excludeFromSheet})),workdays:[]},updateHistory:history(now)};
}
async function ensureCloud(){
  if(cloudClient)return;
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
  cloudClient=createClient(cloudConfig.url,cloudConfig.key);
  const {data}=await cloudClient.auth.getSession();
  cloudUser=data.session?.user||null;
}
async function connectCloud(){
  const status=$('#cloudStatus');
  try{
    cloudConfig={url:$('#cloudURL').value.trim(),key:$('#cloudKey').value.trim(),email:$('#cloudEmail').value.trim()};
    localStorage.setItem('kimu-cloud-config',JSON.stringify(cloudConfig));
    cloudClient=null; status.textContent='接続中…';
    await ensureCloud();
    const {data,error}=await cloudClient.auth.signInWithPassword({email:cloudConfig.email,password:$('#cloudPassword').value});
    if(error)throw error;
    cloudUser=data.user; status.textContent='接続できたよ。読み込み中…';
    await pullCloud(false);
  }catch(e){status.textContent='接続できなかったよ：'+e.message}
}
async function pullCloud(silent=false){
  await ensureCloud();
  if(!cloudUser){if(!silent){page='sync';render();toast('先に同期設定で接続してね')}return}
  setSave('○ 読込中');
  const {data,error}=await cloudClient.from('kimu_snapshots').select('payload,client_updated_at').eq('user_id',cloudUser.id).maybeSingle();
  if(error)throw error;
  if(!data){remotePayload=null;backup={tasks:[],categories:[],templates:[],trash:[],workdays:[],quickLaunchItems:[],favoriteLinks:[],imageMemos:[]};return}
  remotePayload=data.payload||{};
  backup={tasks:[],categories:[],templates:[],trash:[],workdays:[],quickLaunchItems:[],favoriteLinks:[],imageMemos:[],...(remotePayload.backup||{})};
  backup.tasks=Array.isArray(backup.tasks)?backup.tasks:[];
  backupToLocal();setSave('● クラウド同期済み');updateFooter();
  if(!silent){toast('読み込んだよ');render()}
}
async function pushCloud(silent=false){
  await ensureCloud();
  if(!cloudUser)throw new Error('未接続です');
  setSave('○ 保存中');
  const payload=makePayload();
  const {error}=await cloudClient.from('kimu_snapshots').upsert({user_id:cloudUser.id,payload,client_updated_at:payload.updatedAt},{onConflict:'user_id'});
  if(error)throw error;
  remotePayload=payload;backupToLocal();setSave('● クラウド同期済み');updateFooter();
  if(!silent)toast('Macへ送ったよ');
}

$('#menuButton').onclick=openSidebar;
$('#closeSidebar').onclick=closeSidebar;
$('#scrim').onclick=closeSidebar;
render();
pullCloud(true).then(render).catch(()=>{page='sync';render()});
