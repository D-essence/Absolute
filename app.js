
import { initializeApp } from \"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js\";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from \"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js\";
import { getFirestore, collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, where, orderBy } from \"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js\";

const firebaseConfig = { apiKey: \"AIzaSyCCmNMhbz1G35de_AkkebVW53xAZc1kYwI\", authDomain: \"pinomaro-managing.firebaseapp.com\", projectId: \"pinomaro-managing\", storageBucket: \"pinomaro-managing.firebasestorage.app\", messagingSenderId: \"619245174856\", appId: \"1:619245174856:web:b008494174a47c77b0d87d\", measurementId: \"G-CSTVB7S3FL\" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
function todayJST(){ return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function percent(num,den){ if(!den) return 0; return Math.round((num/den)*100); }
function createEl(tag, className, html){ const el=document.createElement(tag); if(className) el.className=className; if(html!==undefined) el.innerHTML=html; return el; }

const toastHost = $("#toastHost");
function toast(message, variant=\"ok\"){ const wrap=createEl(\"div\", \"rounded-xl px-4 py-2 shadow-soft bg-white/95 border animate-slide-up \"+(variant===\"error\"?\"border-red-200 text-red-700\":\"border-sky-200 text-slate-900\"), message); toastHost.appendChild(wrap); setTimeout(()=>{ wrap.style.opacity=\"0\"; wrap.style.transform=\"translateY(-4px)\"; setTimeout(()=>wrap.remove(),250); },2400); }

const authArea=$("#authArea"), gate=$("#gate");
function renderAuth(user){
  authArea.innerHTML=\"\";
  if(!user){
    gate.classList.remove(\"hidden\");
    const btn=createEl(\"button\", \"btn-primary\", \"Googleでサインイン\");
    btn.addEventListener(\"click\", async()=>{ try{ await signInWithPopup(auth, new GoogleAuthProvider()); }catch(e){ toast(\"サインインに失敗: \"+e.message, \"error\"); } });
    authArea.appendChild(btn);
  }else{
    gate.classList.add(\"hidden\");
    const avatar=createEl(\"div\", \"rounded-xl w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500\");
    const name=createEl(\"span\", \"text-sm font-semibold\", user.displayName ?? \"User\");
    const btn=createEl(\"button\", \"btn-ghost\", \"サインアウト\"); btn.addEventListener(\"click\",()=>signOut(auth));
    const wrap=createEl(\"div\", \"flex items-center gap-3\"); wrap.append(avatar,name,btn); authArea.appendChild(wrap);
  }
}

const tabs=$$(\".tab-btn\");
const views={ ideals: $("#view-ideals"), quests: $("#view-quests"), scenes: $("#view-scenes"), detail: $("#view-ideal-detail") };
const fabAddIdeal=$("#fabAddIdeal"), modalAdd=$("#modalAdd"), formAddIdeal=$("#formAddIdeal");
const btnAddQuestRow=$("#btnAddQuestRow"), btnAddSceneRow=$("#btnAddSceneRow"), questRows=$("#questRows"), sceneRows=$("#sceneRows"), idealTitleInput=$("#idealTitle");
const btnBackHome=$("#btnBackHome"), btnCancel=$("#btnCancel"), btnCloseModal=$("#btnCloseModal");
const idealDetailCard=$("#idealDetailCard"), idealDetailQuests=$("#idealDetailQuests"), idealDetailScenes=$("#idealDetailScenes");

let uid=null, currentView=\"ideals\", unsubscribeIdeals=null, unsubscribeQuestsGroup=null, unsubscribeScenesGroup=null; const idealsCache=new Map();
tabs.forEach((b)=>{ b.addEventListener(\"click\",()=>{ tabs.forEach(x=>x.classList.remove(\"active\")); b.classList.add(\"active\"); switchView(b.dataset.view); }); });
btnBackHome.addEventListener(\"click\",()=>switchView(\"ideals\"));
function switchView(view){ currentView=view; Object.values(views).forEach(v=>v.classList.add(\"hidden\")); if(view===\"ideals\"){ views.ideals.classList.remove(\"hidden\"); fabAddIdeal.classList.remove(\"hidden\"); } else if(view===\"quests\"){ views.quests.classList.remove(\"hidden\"); fabAddIdeal.classList.add(\"hidden\"); } else if(view===\"scenes\"){ views.scenes.classList.remove(\"hidden\"); fabAddIdeal.classList.add(\"hidden\"); } else if(view===\"detail\"){ views.detail.classList.remove(\"hidden\"); fabAddIdeal.classList.add(\"hidden\"); } }
fabAddIdeal.addEventListener(\"click\",()=>{ resetAddForm(); modalAdd.showModal(); });
btnCancel.addEventListener(\"click\",()=>modalAdd.close());
btnCloseModal.addEventListener(\"click\",()=>modalAdd.close());

function buildQuestRow(){ const row=createEl(\"div\", \"row\"); const title=createEl(\"input\", \"input col-span-6\"); title.placeholder=\"クエスト名 (例: 筋トレする)\"; const num=createEl(\"input\", \"input col-span-3\"); num.type=\"number\"; num.min=\"0\"; num.placeholder=\"目標数値 (例: 5)\"; const unit=createEl(\"input\", \"input col-span-2\"); unit.placeholder=\"単位 (例: 回)\"; const del=createEl(\"button\", \"btn-ghost col-span-1\", \"✕\"); del.type=\"button\"; del.addEventListener(\"click\",()=>row.remove()); row.append(title,num,unit,del); return row; }
function buildSceneRow(){ const row=createEl(\"div\", \"row\"); const text=createEl(\"input\", \"input col-span-11\"); text.placeholder=\"絵になる姿（1行メモ）\"; const del=createEl(\"button\", \"btn-ghost col-span-1\", \"✕\"); del.type=\"button\"; del.addEventListener(\"click\",()=>row.remove()); row.append(text,del); return row; }
btnAddQuestRow.addEventListener(\"click\",()=>questRows.appendChild(buildQuestRow()));
btnAddSceneRow.addEventListener(\"click\",()=>sceneRows.appendChild(buildSceneRow()));
function resetAddForm(){ idealTitleInput.value=\"\"; questRows.innerHTML=\"\"; sceneRows.innerHTML=\"\"; questRows.appendChild(buildQuestRow()); sceneRows.appendChild(buildSceneRow()); }

const idealsActiveEl=$("#idealsActive"), idealsRealizedEl=$("#idealsRealized"), questsActiveEl=$("#questsActive"), questsCompletedEl=$("#questsCompleted"), scenesDoneEl=$("#scenesDone"), scenesTodoEl=$("#scenesTodo"), emptyIdealsEl=$("#emptyIdeals");

function renderIdealCard({id,title,realized,completionRate}){
  const wrap=createEl(\"div\", \"card\");
  const head=createEl(\"div\", \"flex items-start justify-between gap-3\"); const titleEl=createEl(\"h3\", \"text-lg font-bold cursor-pointer hover:underline\", title); titleEl.addEventListener(\"click\",()=>openIdealDetail(id));
  const checkWrap=createEl(\"label\", \"inline-flex items-center gap-2\"); const check=createEl(\"input\"); check.type=\"checkbox\"; check.checked=!!realized; check.addEventListener(\"change\", async()=>{ await updateDoc(doc(db, \"users\", uid, \"ideals\", id), { realized: check.checked, updatedAt: serverTimestamp() }); toast(check.checked?\"「叶った」をONにしました\":\"「叶った」をOFFにしました\"); }); checkWrap.append(check, createEl(\"span\", \"text-sm\", \"叶った\"));
  head.append(titleEl, checkWrap);
  const bar=createEl(\"div\", \"progress mt-4\"); const barFill=createEl(\"span\"); barFill.style.width = `${Math.max(0, Math.min(100, completionRate))}%`; bar.appendChild(bar);
  bar.innerHTML = \"\"; bar.appendChild(barFill);
  const meta=createEl(\"div\", \"mt-2 text-sm text-slate-600\", \"クエスト達成率 \")+completionRate+\"%\";
  wrap.append(head, bar, createEl(\"div\", \"mt-2 text-sm text-slate-600\", `クエスト達成率 ${completionRate}%`));
  return wrap;
}

function renderQuestItem(q){
  const item=createEl(\"div\", \"card\"); const top=createEl(\"div\", \"flex items-center justify-between\"); top.append(createEl(\"div\", \"text-sm text-slate-500\", q.idealTitle), createEl(\"div\", \"badge border-sky-300 text-sky-700\", q.status===\"completed\"?\"達成\":\"進行中\"));
  const title=createEl(\"div\", \"mt-1 text-base font-semibold\", q.title);
  const ctl=createEl(\"div\", \"mt-3 flex items-center gap-2\"); const minus=createEl(\"button\", \"btn-secondary\", \"−\"), num=createEl(\"div\", \"min-w-[5rem] text-center font-bold\", `${q.value} ${q.unit} / ${q.target} ${q.unit}`), plus=createEl(\"button\", \"btn-secondary\", \"＋\");
  minus.addEventListener(\"click\",()=>adjustQuest(q,-1)); plus.addEventListener(\"click\",()=>adjustQuest(q,+1)); ctl.append(minus,num,plus);
  item.append(top,title,ctl); return item;
}

function renderSceneItem(s, options={inDetail:false}){
  const item=createEl(\"div\", \"card\"); const top=createEl(\"div\", \"flex items-center justify-between\"); if(!options.inDetail) top.append(createEl(\"div\", \"text-sm text-slate-500\", s.idealTitle)); else top.append(createEl(\"div\"));
  const actions=createEl(\"div\", \"flex items-center gap-2\"); const del=createEl(\"button\", \"btn-ghost text-red-600\", \"削除\"); del.addEventListener(\"click\", async()=>{ if(!confirm(\"この項目を削除しますか？\")) return; await deleteDoc(doc(db, \"users\", uid, \"ideals\", s.idealId, \"scenes\", s.id)); toast(\"削除しました\"); }); actions.append(del); top.append(actions);
  const row=createEl(\"div\", \"mt-2 flex items-center gap-3\"); const chk=createEl(\"input\"); chk.type=\"checkbox\"; const isToday=s.lastCheckedDate===todayJST(); chk.checked=isToday; chk.addEventListener(\"change\", async()=>{ const newDate = chk.checked ? todayJST() : \"\\"; await updateDoc(doc(db, \"users\", uid, \"ideals\", s.idealId, \"scenes\", s.id), { lastCheckedDate: newDate, updatedAt: serverTimestamp() }); toast(chk.checked?\"今日のチェックを記録しました\":\"チェックを外しました\"); }); row.append(chk, createEl(\"div\", \"font-semibold\", s.text));
  item.append(top,row); return item;
}

async function attachListeners(){
  detachListeners();
  unsubscribeIdeals = onSnapshot(query(collection(db, \"users\", uid, \"ideals\"), orderBy(\"createdAt\", \"desc\")), async(snap)=>{
    idealsCache.clear(); const ideals=[];
    for(const d of snap.docs){ const id=d.id; const data=d.data(); idealsCache.set(id,{ title:data.title, realized:!!data.realized }); const qSnap=await getDocs(collection(db, \"users\", uid, \"ideals\", id, \"quests\")); const total=qSnap.size; let completed=0; qSnap.forEach(qd=>{ const q=qd.data(); if((q.value??0)>=(q.target??0)) completed++; }); ideals.push({ id, title:data.title, realized:!!data.realized, completionRate: Math.round((completed/(total||1))*100) }); }
    idealsActiveEl.innerHTML=\"\"; idealsRealizedEl.innerHTML=\"\"; if(ideals.length===0) document.getElementById(\"emptyIdeals\").classList.remove(\"hidden\"); else document.getElementById(\"emptyIdeals\").classList.add(\"hidden\");
    for(const it of ideals){ const card=renderIdealCard(it); if(it.completionRate===100 && it.realized) idealsRealizedEl.appendChild(card); else idealsActiveEl.appendChild(card); }
  }, (err)=>toast(\"理想の読み込みに失敗: \"+err.message, \"error\"));

  unsubscribeQuestsGroup = onSnapshot(query(collectionGroup(db, \"quests\"), where(\"userId\", \"==\", uid)), (snap)=>{
    const active=[], completed=[]; const rows=snap.docs.map(d=>({ id:d.id, ...d.data() })); rows.sort((a,b)=>(b.createdAt?.seconds??0)-(a.createdAt?.seconds??0));
    rows.forEach((q)=>{ const isDone=(q.value??0)>=(q.target??0); q.status=isDone?\"completed\":\"active\"; (isDone?completed:active).push(q); });
    questsActiveEl.innerHTML=\"\"; questsCompletedEl.innerHTML=\"\"; active.forEach(q=>questsActiveEl.appendChild(renderQuestItem(q))); completed.forEach(q=>questsCompletedEl.appendChild(renderQuestItem(q)));
  }, (err)=>toast(\"クエストの読み込みに失敗: \"+err.message, \"error\"));

  unsubscribeScenesGroup = onSnapshot(query(collectionGroup(db, \"scenes\"), where(\"userId\", \"==\", uid)), (snap)=>{
    const done=[], todo=[]; const rows=snap.docs.map(d=>({ id:d.id, ...d.data() })); rows.sort((a,b)=>(b.createdAt?.seconds??0)-(a.createdAt?.seconds??0));
    const today=todayJST(); rows.forEach((s)=>{ (s.lastCheckedDate===today?done:todo).push(s); });
    scenesDoneEl.innerHTML=\"\"; scenesTodoEl.innerHTML=\"\"; done.forEach(s=>scenesDoneEl.appendChild(renderSceneItem(s))); todo.forEach(s=>scenesTodoEl.appendChild(renderSceneItem(s)));
  }, (err)=>toast(\"絵になる姿の読み込みに失敗: \"+err.message, \"error\"));
}
function detachListeners(){ if(unsubscribeIdeals){unsubscribeIdeals();unsubscribeIdeals=null;} if(unsubscribeQuestsGroup){unsubscribeQuestsGroup();unsubscribeQuestsGroup=null;} if(unsubscribeScenesGroup){unsubscribeScenesGroup();unsubscribeScenesGroup=null;} }

formAddIdeal.addEventListener(\"submit\", async(e)=>{
  e.preventDefault();
  if(!uid){ toast(\"サインインしてください\", \"error\"); return; }
  const title=idealTitleInput.value.trim(); if(!title){ toast(\"タイトルは必須です\", \"error\"); return; }
  const questSpecs=[]; questRows.querySelectorAll(\".row\").forEach((row)=>{ const [titleEl,numEl,unitEl]=row.querySelectorAll(\"input\"); const t=titleEl.value.trim(); const n=Number(numEl.value); const u=unitEl.value.trim(); if(t && !isNaN(n) && u) questSpecs.push({ title:t, target:n, unit:u }); });
  const scenes=[]; sceneRows.querySelectorAll(\".row input\").forEach((inp)=>{ const t=inp.value.trim(); if(t) scenes.push({ text:t }); });
  try{
    const createdAt=serverTimestamp();
    const idealRef=await addDoc(collection(db, \"users\", uid, \"ideals\"), { userId: uid, title, realized:false, createdAt, updatedAt: createdAt });
    const idealId=idealRef.id;
    for(const [i,q] of questSpecs.entries()){ await addDoc(collection(db, \"users\", uid, \"ideals\", idealId, \"quests\"), { userId: uid, idealId, idealTitle: title, title:q.title, target:q.target, unit:q.unit, value:0, status:\"active\", order:i, createdAt, updatedAt: createdAt }); }
    for(const [i,s] of scenes.entries()){ await addDoc(collection(db, \"users\", uid, \"ideals\", idealId, \"scenes\"), { userId: uid, idealId, idealTitle: title, text:s.text, lastCheckedDate:\"\", order:i, createdAt, updatedAt: createdAt }); }
    modalAdd.close(); toast(\"理想を追加しました\");
  }catch(err){ console.error(err); toast(\"追加に失敗: \"+err.message, \"error\"); alert(\"追加に失敗しました。Firestoreのセキュリティルール/認証設定を確認してください。\\n\\nエラー: \"+err.message); }
});

async function openIdealDetail(idealId){
  const ref=doc(db, \"users\", uid, \"ideals\", idealId); const d=await getDoc(ref); if(!d.exists()) return; const data=d.data();
  const qSnap=await getDocs(collection(db, \"users\", uid, \"ideals\", idealId, \"quests\")); const total=qSnap.size; let completed=0; qSnap.forEach(qd=>{ const q=qd.data(); if((q.value??0)>=(q.target??0)) completed++; }); const completionRate=Math.round((completed/(total||1))*100);
  idealDetailCard.innerHTML=\"\"; const card=createEl(\"div\", \"space-y-3\"); const title=createEl(\"h2\", \"text-2xl font-extrabold\", data.title); const meta=createEl(\"div\", \"text-sm text-slate-600\", \"クエスト達成率 \"+completionRate+\"%\"); const lab=createEl(\"label\", \"inline-flex items-center gap-2\"); const chk=createEl(\"input\"); chk.type=\"checkbox\"; chk.checked=!!data.realized; chk.addEventListener(\"change\", async()=>{ await updateDoc(ref, { realized: chk.checked, updatedAt: serverTimestamp() }); toast(chk.checked?\"「叶った」をONにしました\":\"「叶った」をOFFにしました\"); }); lab.append(chk, createEl(\"span\", \"text-sm\", \"叶った\")); card.append(title, meta, lab); idealDetailCard.appendChild(card);
  idealDetailQuests.innerHTML=\"\"; qSnap.forEach(qd=>{ const q={ id: qd.id, ...qd.data() }; idealDetailQuests.appendChild(renderQuestItem(q)); });
  idealDetailScenes.innerHTML=\"\"; const sSnap=await getDocs(collection(db, \"users\", uid, \"ideals\", idealId, \"scenes\")); sSnap.forEach(sd=>{ const s={ id: sd.id, ...sd.data() }; idealDetailScenes.appendChild(renderSceneItem(s, { inDetail: true })); });
  switchView(\"detail\");
}

async function adjustQuest(q, delta){
  const newVal=clamp((q.value??0)+delta, 0, 1e9); const ref=doc(db, \"users\", uid, \"ideals\", q.idealId, \"quests\", q.id); const isDone = newVal >= (q.target ?? Number.MAX_SAFE_INTEGER);
  try{ await updateDoc(ref, { value: newVal, status: isDone? \"completed\": \"active\", updatedAt: serverTimestamp() }); } catch(e){ toast(\"更新に失敗: \"+e.message, \"error\"); }
}

onAuthStateChanged(auth, async(user)=>{
  renderAuth(user);
  if(user){ uid=user.uid; switchView(currentView); fabAddIdeal.classList.remove(\"hidden\"); await attachListeners(); }
  else{ uid=null; fabAddIdeal.classList.add(\"hidden\"); detachListeners(); idealsActiveEl.innerHTML=\"\";
 idealsRealizedEl.innerHTML=\"\";
 questsActiveEl.innerHTML=\"\";
 questsCompletedEl.innerHTML=\"\";
 scenesDoneEl.innerHTML=\"\";
 scenesTodoEl.innerHTML=\"\";
 }
});
switchView(\"ideals\");