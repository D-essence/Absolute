
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCmNMhbz1G35de_AkkebVW53xAZc1kYwI",
  authDomain: "pinomaro-managing.firebaseapp.com",
  projectId: "pinomaro-managing",
  storageBucket: "pinomaro-managing.firebasestorage.app",
  messagingSenderId: "619245174856",
  appId: "1:619245174856:web:b008494174a47c77b0d87d",
  measurementId: "G-CSTVB7S3FL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const toastHost = $("#toastHost");
function toast(msg, type="info") {
  const box = document.createElement("div"); box.className = "card flex items-center gap-2 animate-slide-up";
  const icon = document.createElement("span"); icon.className = "i " + (type==="error" ? "i-trash" : "i-check");
  const txt = document.createElement("div"); txt.className = "text-sm"; txt.textContent = msg;
  box.append(icon, txt); toastHost.appendChild(box);
  setTimeout(()=>{ box.style.opacity="0"; box.style.transform="translateY(-6px)"; }, 3000);
  setTimeout(()=> box.remove(), 3600);
}
function todayJST(){ return new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Tokyo' }); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function percent(num,den){ if(!den) return 0; return Math.round((num/den)*100); }
function el(tag, cn, html){ const e = document.createElement(tag); if(cn) e.className = cn; if(html!==undefined) e.innerHTML = html; return e; }

const views = { ideals: $("#view-ideals"), quests: $("#view-quests"), scenes: $("#view-scenes"), detail: $("#view-ideal-detail") };
const tabs = $$(".tab-btn");
const gate = $("#gate");
const authArea = $("#authArea");
const fabAddIdeal = $("#fabAddIdeal");
const modalAdd = $("#modalAdd");
const formAddIdeal = $("#formAddIdeal");
const btnAddQuestRow = $("#btnAddQuestRow");
const btnAddSceneRow = $("#btnAddSceneRow");
const questRows = $("#questRows");
const sceneRows = $("#sceneRows");
const idealTitleInput = $("#idealTitle");
const modalTitle = $("#modalTitle");
const btnBackHome = $("#btnBackHome");
const idealDetailCard = $("#idealDetailCard");
const idealDetailQuests = $("#idealDetailQuests");
const idealDetailScenes = $("#idealDetailScenes");
const btnEditIdeal = $("#btnEditIdeal");
const btnDeleteIdeal = $("#btnDeleteIdeal");
const btnAddQuestDetail = $("#btnAddQuestDetail");
const btnAddSceneDetail = $("#btnAddSceneDetail");
const btnAddQuestInline = $("#btnAddQuestInline");
const btnAddSceneInline = $("#btnAddSceneInline");

const idealsActiveEl = $("#idealsActive");
const idealsRealizedEl = $("#idealsRealized");
const questsActiveEl = $("#questsActive");
const questsCompletedEl = $("#questsCompleted");
const scenesDoneEl = $("#scenesDone");
const scenesTodoEl = $("#scenesTodo");

let uid = null;
let currentView = "ideals";
let currentIdealId = null;
let unsubscribeIdeals = null;
let unsubscribeQuestsGroup = null;
let unsubscribeScenesGroup = null;
const idealsCache = new Map();
let currentDateJST = todayJST();

function renderAuth(user){
  authArea.innerHTML = "";
  if(!user){
    gate.classList.remove("hidden");
    const btn = el("button","btn-primary",'<span class="i i-google"></span>Googleでサインイン');
    btn.addEventListener("click", async ()=>{
      try{ await signInWithPopup(auth, new GoogleAuthProvider()); }
      catch(e){ alert("サインインに失敗: "+e.message+"\nFirebaseでGoogle認証を有効化してください。"); }
    });
    authArea.appendChild(btn);
  } else {
    gate.classList.add("hidden");
    const avatar = el("div","rounded-xl w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500");
    const name = el("span","text-sm font-semibold", user.displayName ?? "User");
    const btn = el("button","btn-ghost","サインアウト");
    btn.addEventListener("click", ()=> signOut(auth));
    const wrap = el("div","flex items-center gap-3"); wrap.append(avatar, name, btn);
    authArea.appendChild(wrap);
  }
}

tabs.forEach((b)=>{
  b.addEventListener("click", ()=>{
    tabs.forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); switchView(b.dataset.view);
  });
});
btnBackHome.addEventListener("click", ()=> switchView("ideals"));
function switchView(view){
  currentView = view;
  Object.values(views).forEach(v=>v.classList.add("hidden"));
  if(view==="ideals"){ views.ideals.classList.remove("hidden"); fabAddIdeal.classList.remove("hidden"); }
  else if(view==="quests"){ views.quests.classList.remove("hidden"); fabAddIdeal.classList.add("hidden"); }
  else if(view==="scenes"){ views.scenes.classList.remove("hidden"); fabAddIdeal.classList.add("hidden"); }
  else if(view==="detail"){ views.detail.classList.remove("hidden"); fabAddIdeal.classList.add("hidden"); }
}

fabAddIdeal.addEventListener("click", ()=> openAddModal());
function openAddModal(existing=null){
  resetAddForm();
  if(existing){ modalTitle.textContent="理想を編集"; idealTitleInput.value = existing.title; currentIdealId = existing.id; }
  else { modalTitle.textContent="理想を追加"; currentIdealId = null; }
  modalAdd.showModal();
}
function buildQuestRow(def={title:"", target:"", unit:""}){
  const row = el("div","row");
  const title = el("input","input col-span-6"); title.placeholder="クエスト名"; title.value = def.title ?? "";
  const num = el("input","input col-span-3"); num.type="number"; num.min="0"; num.placeholder="目標数値"; num.value = def.target ?? "";
  const unit = el("input","input col-span-2"); unit.placeholder="単位"; unit.value = def.unit ?? "";
  const del = el("button","btn-ghost col-span-1","✕"); del.type="button"; del.addEventListener("click", ()=> row.remove());
  row.append(title,num,unit,del); return row;
}
function buildSceneRow(def={text:""}){
  const row = el("div","row");
  const text = el("input","input col-span-11"); text.placeholder="絵になる姿（1行）"; text.value = def.text ?? "";
  const del = el("button","btn-ghost col-span-1","✕"); del.type="button"; del.addEventListener("click", ()=> row.remove());
  row.append(text,del); return row;
}
btnAddQuestRow.addEventListener("click", ()=> questRows.appendChild(buildQuestRow()));
btnAddSceneRow.addEventListener("click", ()=> sceneRows.appendChild(buildSceneRow()));
function resetAddForm(){ idealTitleInput.value=""; questRows.innerHTML=""; sceneRows.innerHTML=""; questRows.appendChild(buildQuestRow()); sceneRows.appendChild(buildSceneRow()); }

formAddIdeal.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!uid){ alert("サインインが必要です"); return; }
  const title = idealTitleInput.value.trim();
  if(!title){ toast("タイトルを入力してください","error"); return; }
  const questSpecs = [];
  questRows.querySelectorAll(".row").forEach((row)=>{
    const [titleEl, numEl, unitEl] = row.querySelectorAll("input");
    const t = titleEl.value.trim(); const n = Number(numEl.value); const u = unitEl.value.trim();
    if(t && !isNaN(n) && u){ questSpecs.push({title:t, target:n, unit:u}); }
  });
  const scenes = [];
  sceneRows.querySelectorAll(".row input").forEach((inp)=>{ const t = inp.value.trim(); if(t) scenes.push({text:t}); });

  const submitBtn = $("#btnSubmitIdeal"); submitBtn.disabled = True if False else False
  submitBtn.disabled = true;
  try {
    let idealId = currentIdealId;
    if(!idealId){
      const idealRef = await addDoc(collection(db,"users",uid,"ideals"),{
        title, realized:false, createdAt:serverTimestamp(), updatedAt:serverTimestamp()
      });
      idealId = idealRef.id;
      for (const [i,q] of questSpecs.entries()){
        await addDoc(collection(db,"users",uid,"ideals",idealId,"quests"),{
          userId: uid, idealId, idealTitle: title, title:q.title, target:q.target, unit:q.unit,
          value:0, status:"active", order:i, createdAt:serverTimestamp(), updatedAt:serverTimestamp()
        });
      }
      for (const [i,s] of scenes.entries()){
        await addDoc(collection(db,"users",uid,"ideals",idealId,"scenes"),{
          userId: uid, idealId, idealTitle: title, text:s.text, lastCheckedDate:"", order:i,
          createdAt:serverTimestamp(), updatedAt:serverTimestamp()
        });
      }
      toast("理想を追加しました");
    } else {
      await updateDoc(doc(db,"users",uid,"ideals",idealId),{ title, updatedAt:serverTimestamp() });
      const qSnap = await getDocs(collection(db,"users",uid,"ideals",idealId,"quests"));
      for (const qd of qSnap.docs){ await updateDoc(qd.ref,{ idealTitle:title }); }
      const sSnap = await getDocs(collection(db,"users",uid,"ideals",idealId,"scenes"));
      for (const sd of sSnap.docs){ await updateDoc(sd.ref,{ idealTitle:title }); }
      toast("理想を更新しました");
    }
    modalAdd.close();
  } catch(err){
    alert("保存に失敗: " + err.message + "\nFirestoreルールをご確認ください。");
  } finally {
    submitBtn.disabled = false;
    currentIdealId = null;
  }
});

const idealsActiveEl2 = idealsActiveEl; // just to avoid unused warnings

function renderIdealCard({ id, title, realized, completionRate }){
  const wrap = el("div","card hover:bg-white/10 transition animate-pop");
  const head = el("div","flex items-start justify-between gap-3");
  const titleEl = el("h3","text-lg font-bold cursor-pointer hover:underline flex-1", title);
  titleEl.addEventListener("click", ()=> openIdealDetail(id));
  const right = el("div","flex items-center gap-3");
  const donut = el("div","donut"); donut.style.setProperty("--p", completionRate + "%");
  const checkWrap = el("label","inline-flex items-center gap-2");
  const check = document.createElement("input"); check.type="checkbox"; check.checked = !!realized;
  check.addEventListener("change", async ()=>{
    await updateDoc(doc(db,"users",uid,"ideals",id),{ realized: check.checked, updatedAt: serverTimestamp() });
  });
  checkWrap.append(check, el("span","text-xs","叶った"));
  right.append(donut, checkWrap); head.append(titleEl, right);
  const bar = el("div","progress mt-4"); const barFill = document.createElement("span"); barFill.style.width = clamp(completionRate,0,100) + "%"; bar.appendChild(barFill);
  const meta = el("div","mt-2 text-sm text-slate-300", `クエスト達成率 ${completionRate}%`);
  wrap.append(head, bar, meta); return wrap;
}

function renderQuestItem(q){
  const item = el("div","card animate-fade-in");
  const top = el("div","flex items-center justify-between");
  top.append( el("div","text-xs text-slate-400", q.idealTitle), el("div","badge border-sky-300/30 text-sky-200", q.status==="completed"?"達成":"進行中") );
  const title = el("div","mt-1 text-base font-semibold", q.title);
  const ctl = el("div","mt-3 flex items-center gap-2");
  const minus = el("button","btn-secondary","−");
  const num = el("div","min-w-[6.5rem] text-center font-bold", `${q.value ?? 0} ${q.unit} / ${q.target} ${q.unit}`);
  const plus = el("button","btn-secondary","＋");
  minus.addEventListener("click", ()=> adjustQuest(q,-1));
  plus.addEventListener("click", ()=> adjustQuest(q,+1));
  ctl.append(minus, num, plus); item.append(top, title, ctl); return item;
}
function renderSceneItem(s, opts={inDetail:false}){
  const item = el("div","card animate-fade-in");
  const top = el("div","flex items-center justify-between");
  if(!opts.inDetail) top.append(el("div","text-xs text-slate-400", s.idealTitle)); else top.append(el("div"));
  const actions = el("div","flex items-center gap-2");
  const del = el("button","btn-ghost text-rose-300","削除");
  del.addEventListener("click", async ()=>{
    if(!confirm("この項目を削除しますか？")) return;
    await deleteDoc(doc(db,"users",uid,"ideals",s.idealId,"scenes",s.id));
  });
  actions.append(del); top.append(actions);
  const row = el("div","mt-2 flex items-center gap-3");
  const chk = document.createElement("input"); chk.type="checkbox"; const isToday = s.lastCheckedDate === todayJST(); chk.checked = isToday;
  chk.addEventListener("change", async ()=>{
    const newDate = chk.checked ? todayJST() : "";
    await updateDoc(doc(db,"users",uid,"ideals",s.idealId,"scenes",s.id),{ lastCheckedDate:newDate, updatedAt:serverTimestamp() });
  });
  row.append(chk, el("div","font-semibold", s.text)); item.append(top, row); return item;
}

async function attachListeners(){
  detachListeners();
  idealsActiveEl.innerHTML = ""; idealsRealizedEl.innerHTML = "";
  for(let i=0;i<3;i++){ const sk = el("div","skeleton"); idealsActiveEl.appendChild(sk); }

  unsubscribeIdeals = onSnapshot(
    query(collection(db,"users",uid,"ideals"), orderBy("createdAt","desc")),
    async (snap)=>{
      idealsCache.clear();
      const ideals = [];
      for (const d of snap.docs){
        const id = d.id; const data = d.data();
        idealsCache.set(id,{ title:data.title, realized: !!data.realized });
        const qSnap = await getDocs(collection(db,"users",uid,"ideals",id,"quests"));
        const total = qSnap.size; let completed = 0;
        qSnap.forEach(qd=>{ const q = qd.data(); if((q.value ?? 0) >= (q.target ?? 0)) completed++; });
        const completionRate = percent(completed, total);
        ideals.push({ id, title:data.title, realized: !!data.realized, completionRate });
      }
      idealsActiveEl.innerHTML=""; idealsRealizedEl.innerHTML="";
      for (const it of ideals){
        const card = renderIdealCard(it);
        if(it.completionRate===100 && it.realized) idealsRealizedEl.appendChild(card);
        else idealsActiveEl.appendChild(card);
      }
    }
  );

  unsubscribeQuestsGroup = onSnapshot(
    query(collectionGroup(db,"quests"), where("userId","==",uid), orderBy("createdAt","desc")),
    (snap)=>{
      const active=[]; const completed=[];
      snap.forEach((docSnap)=>{
        const q = { id: docSnap.id, ...docSnap.data() };
        const isDone = (q.value ?? 0) >= (q.target ?? 0);
        q.status = isDone ? "completed":"active";
        (isDone ? completed : active).push(q);
      });
      questsActiveEl.innerHTML=""; questsCompletedEl.innerHTML="";
      active.forEach(q=> questsActiveEl.appendChild(renderQuestItem(q)));
      completed.forEach(q=> questsCompletedEl.appendChild(renderQuestItem(q)));
    }
  );

  unsubscribeScenesGroup = onSnapshot(
    query(collectionGroup(db,"scenes"), where("userId","==",uid), orderBy("createdAt","desc")),
    (snap)=>{
      const today = todayJST(); const done=[]; const todo=[];
      snap.forEach((docSnap)=>{
        const s = { id: docSnap.id, ...docSnap.data() };
        if(s.lastCheckedDate === today) done.push(s); else todo.push(s);
      });
      scenesDoneEl.innerHTML=""; scenesTodoEl.innerHTML="";
      done.forEach(s=> scenesDoneEl.appendChild(renderSceneItem(s)));
      todo.forEach(s=> scenesTodoEl.appendChild(renderSceneItem(s)));
    }
  );
}

function detachListeners(){ if(unsubscribeIdeals){unsubscribeIdeals();unsubscribeIdeals=null;} if(unsubscribeQuestsGroup){unsubscribeQuestsGroup();unsubscribeQuestsGroup=null;} if(unsubscribeScenesGroup){unsubscribeScenesGroup();unsubscribeScenesGroup=null;} }

btnEditIdeal.addEventListener("click", async ()=>{
  if(!currentIdealId) return;
  const d = await getDoc(doc(db,"users",uid,"ideals",currentIdealId)); if(!d.exists()) return;
  openAddModal({ id: currentIdealId, title: d.data().title });
});
btnDeleteIdeal.addEventListener("click", async ()=>{
  if(!currentIdealId) return;
  if(!confirm("この理想を削除しますか？配下のクエスト/絵になる姿も削除されます。")) return;
  const qSnap = await getDocs(collection(db,"users",uid,"ideals",currentIdealId,"quests"));
  for (const qd of qSnap.docs) await deleteDoc(qd.ref);
  const sSnap = await getDocs(collection(db,"users",uid,"ideals",currentIdealId,"scenes"));
  for (const sd of sSnap.docs) await deleteDoc(sd.ref);
  await deleteDoc(doc(db,"users",uid,"ideals",currentIdealId));
  toast("理想を削除しました"); switchView("ideals");
});
btnAddQuestDetail.addEventListener("click", async ()=>{
  if(!currentIdealId) return;
  const idealTitle = idealsCache.get(currentIdealId)?.title ?? "";
  const title = prompt("クエスト名"); if(!title) return;
  const target = Number(prompt("目標数値")); if(isNaN(target)) return;
  const unit = prompt("単位（例: 回）") || "";
  await addDoc(collection(db,"users",uid,"ideals",currentIdealId,"quests"),{
    userId: uid, idealId: currentIdealId, idealTitle, title, target, unit, value:0, status:"active", order: Date.now(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  toast("クエストを追加しました");
});
btnAddSceneDetail.addEventListener("click", async ()=>{
  if(!currentIdealId) return;
  const idealTitle = idealsCache.get(currentIdealId)?.title ?? "";
  const text = prompt("絵になる姿（1行）"); if(!text) return;
  await addDoc(collection(db,"users",uid,"ideals",currentIdealId,"scenes"),{
    userId: uid, idealId: currentIdealId, idealTitle, text, lastCheckedDate:"", order: Date.now(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  toast("絵になる姿を追加しました");
});

btnAddQuestInline.addEventListener("click", async ()=>{
  const idealId = await pickIdeal(); if(!idealId) return; currentIdealId = idealId; btnAddQuestDetail.click();
});
btnAddSceneInline.addEventListener("click", async ()=>{
  const idealId = await pickIdeal(); if(!idealId) return; currentIdealId = idealId; btnAddSceneDetail.click();
});
async function pickIdeal(){
  const ids = [...idealsCache.keys()]; if(!ids.length){ alert("まず理想を作成してください"); return null; }
  const titles = ids.map((id,idx)=> `${idx+1}. ${idealsCache.get(id).title}`).join("\n");
  const no = Number(prompt("どの理想に紐づけますか？\n"+titles+"\n番号で入力"));
  if(isNaN(no) || no<1 || no>ids.length) return null;
  return ids[no-1];
}

async function openIdealDetail(idealId){
  currentIdealId = idealId;
  const ref = doc(db,"users",uid,"ideals",idealId);
  const d = await getDoc(ref); if(!d.exists()) return;
  const data = d.data();
  const qSnap = await getDocs(collection(db,"users",uid,"ideals",idealId,"quests"));
  const total = qSnap.size; let completed = 0;
  qSnap.forEach(qd=>{ const q = qd.data(); if((q.value ?? 0) >= (q.target ?? 0)) completed++; });
  const completionRate = percent(completed, total);
  idealDetailCard.innerHTML = "";
  const card = el("div","flex items-center justify-between gap-6");
  const left = el("div","space-y-2 flex-1");
  const title = el("h2","text-2xl font-extrabold", data.title);
  const meta = el("div","text-sm text-slate-300", `クエスト達成率 ${completionRate}%`);
  const lab = el("label","inline-flex items-center gap-2");
  const chk = document.createElement("input"); chk.type="checkbox"; chk.checked = !!data.realized;
  chk.addEventListener("change", async ()=>{
    await updateDoc(ref,{ realized: chk.checked, updatedAt: serverTimestamp() });
  });
  lab.append(chk, el("span","text-sm","叶った"));
  left.append(title, meta, lab);
  const ring = el("div","donut"); ring.style.setProperty("--p", completionRate + "%");
  card.append(left, ring); idealDetailCard.appendChild(card);
  idealDetailQuests.innerHTML=""; qSnap.forEach(qd=>{ const q = { id: qd.id, ...qd.data() }; idealDetailQuests.appendChild(renderQuestItem(q)); });
  idealDetailScenes.innerHTML=""; const sSnap = await getDocs(collection(db,"users",uid,"ideals",idealId,"scenes"));
  sSnap.forEach(sd=>{ const s = { id: sd.id, ...sd.data() }; idealDetailScenes.appendChild(renderSceneItem(s,{inDetail:true})); });
  switchView("detail");
}

async function adjustQuest(q, delta){
  const newVal = clamp((q.value ?? 0) + delta, 0, 1e9);
  const questRef = doc(db,"users",uid,"ideals",q.idealId,"quests",q.id);
  const isDone = newVal >= (q.target ?? Number.MAX_SAFE_INTEGER);
  try{ await updateDoc(questRef,{ value:newVal, status: isDone?"completed":"active", updatedAt: serverTimestamp() }); }
  catch(e){ alert("更新に失敗: "+e.message); }
}

setInterval(()=>{
  const d = todayJST();
  if(d !== currentDateJST){
    currentDateJST = d;
    if(uid){ if(unsubscribeScenesGroup){ unsubscribeScenesGroup(); unsubscribeScenesGroup=null; } attachScenesOnly(); }
  }
}, 60000);

async function attachScenesOnly(){
  unsubscribeScenesGroup = onSnapshot(
    query(collectionGroup(db,"scenes"), where("userId","==",uid), orderBy("createdAt","desc")),
    (snap)=>{
      const today = todayJST(); const done=[]; const todo=[];
      snap.forEach((docSnap)=>{ const s = { id: docSnap.id, ...docSnap.data() }; if(s.lastCheckedDate===today) done.push(s); else todo.push(s); });
      scenesDoneEl.innerHTML=""; scenesTodoEl.innerHTML="";
      done.forEach(s=> scenesDoneEl.appendChild(renderSceneItem(s)));
      todo.forEach(s=> scenesTodoEl.appendChild(renderSceneItem(s)));
    }
  );
}

onAuthStateChanged(auth, async (user)=>{
  renderAuth(user);
  if(user){
    uid = user.uid; switchView(currentView); fabAddIdeal.classList.remove("hidden"); await attachListeners();
  } else {
    uid = null; fabAddIdeal.classList.add("hidden"); detachListeners();
    idealsActiveEl.innerHTML=""; idealsRealizedEl.innerHTML=""; questsActiveEl.innerHTML=""; questsCompletedEl.innerHTML=""; scenesDoneEl.innerHTML=""; scenesTodoEl.innerHTML="";
  }
});
switchView("ideals");
