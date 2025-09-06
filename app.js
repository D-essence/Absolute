
/**
 * IdealQuest Web App
 * - Manage '本質的理想' (Ideals), their 'クエスト' (quant goals), and '絵になる姿' (daily habits/scenes).
 * - Firebase Auth (Google) + Firestore for real-time, multi-device sync.
 * - UI: TailwindCSS via CDN
 */

// ===== Firebase (v10 modular) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, collectionGroup, doc, addDoc, setDoc,
  getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
  onSnapshot, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// === Config (provided by user) ===
const firebaseConfig = {
  apiKey: "AIzaSyCCmNMhbz1G35de_AkkebVW53xAZc1kYwI",
  authDomain: "pinomaro-managing.firebaseapp.com",
  projectId: "pinomaro-managing",
  storageBucket: "pinomaro-managing.firebasestorage.app",
  messagingSenderId: "619245174856",
  appId: "1:619245174856:web:b008494174a47c77b0d87d",
  measurementId: "G-CSTVB7S3FL"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function todayJST() {
  // YYYY-MM-DD in JST
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function percent(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}
function createEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}
function toast(msg) {
  console.log(msg);
}

// ===== Auth UI =====
const authArea = $("#authArea");
const gate = $("#gate");

function renderAuth(user) {
  authArea.innerHTML = "";
  if (!user) {
    gate.classList.remove("hidden");
    const btn = createEl("button", "btn-primary", "Googleでサインイン");
    btn.addEventListener("click", async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        alert("サインインに失敗しました。FirebaseコンソールでGoogle認証を有効化してください。\n" + e.message);
      }
    });
    authArea.appendChild(btn);
  } else {
    gate.classList.add("hidden");
    const avatar = createEl("div",
      "rounded-xl w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500");
    const name = createEl("span", "text-sm font-semibold", user.displayName ?? "User");
    const btn = createEl("button", "btn-ghost", "サインアウト");
    btn.addEventListener("click", () => signOut(auth));
    const wrap = createEl("div", "flex items-center gap-3");
    wrap.append(avatar, name, btn);
    authArea.appendChild(wrap);
  }
}

// ===== Views & Navigation =====
const tabs = $$(".tab-btn");
const views = {
  ideals: $("#view-ideals"),
  quests: $("#view-quests"),
  scenes: $("#view-scenes"),
  detail: $("#view-ideal-detail"),
};
const fabAddIdeal = $("#fabAddIdeal");
const modalAdd = $("#modalAdd");
const formAddIdeal = $("#formAddIdeal");
const btnAddQuestRow = $("#btnAddQuestRow");
const btnAddSceneRow = $("#btnAddSceneRow");
const questRows = $("#questRows");
const sceneRows = $("#sceneRows");
const idealTitleInput = $("#idealTitle");
const btnBackHome = $("#btnBackHome");
const idealDetailCard = $("#idealDetailCard");
const idealDetailQuests = $("#idealDetailQuests");
const idealDetailScenes = $("#idealDetailScenes");

// current user state
let uid = null;

// UI State
let currentView = "ideals";
let unsubscribeIdeals = null;
let unsubscribeQuestsGroup = null;
let unsubscribeScenesGroup = null;
const idealsCache = new Map(); // idealId -> {title, realized}

// Tab switching
tabs.forEach((b) => {
  b.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    switchView(b.dataset.view);
  });
});

btnBackHome.addEventListener("click", () => switchView("ideals"));

function switchView(view) {
  currentView = view;
  Object.values(views).forEach(v => v.classList.add("hidden"));
  if (view === "ideals") {
    views.ideals.classList.remove("hidden");
    fabAddIdeal.classList.remove("hidden");
  } else if (view === "quests") {
    views.quests.classList.remove("hidden");
    fabAddIdeal.classList.add("hidden");
  } else if (view === "scenes") {
    views.scenes.classList.remove("hidden");
    fabAddIdeal.classList.add("hidden");
  } else if (view === "detail") {
    views.detail.classList.remove("hidden");
    fabAddIdeal.classList.add("hidden");
  }
}

// FAB
fabAddIdeal.addEventListener("click", () => {
  resetAddForm();
  modalAdd.showModal();
});

// Add form row builders
function buildQuestRow() {
  const row = createEl("div", "row");
  const title = createEl("input", "input col-span-6");
  title.placeholder = "クエスト名 (例: 筋トレする)";
  const num = createEl("input", "input col-span-3");
  num.type = "number"; num.min = "0"; num.placeholder = "目標数値 (例: 5)";
  const unit = createEl("input", "input col-span-2");
  unit.placeholder = "単位 (例: 回)";
  const del = createEl("button", "btn-ghost col-span-1", "✕");
  del.type = "button";
  del.addEventListener("click", () => row.remove());
  row.append(title, num, unit, del);
  return row;
}
function buildSceneRow() {
  const row = createEl("div", "row");
  const text = createEl("input", "input col-span-11");
  text.placeholder = "絵になる姿（1行メモ）";
  const del = createEl("button", "btn-ghost col-span-1", "✕");
  del.type = "button";
  del.addEventListener("click", () => row.remove());
  row.append(text, del);
  return row;
}
btnAddQuestRow.addEventListener("click", () => questRows.appendChild(buildQuestRow()));
btnAddSceneRow.addEventListener("click", () => sceneRows.appendChild(buildSceneRow()));

function resetAddForm() {
  idealTitleInput.value = "";
  questRows.innerHTML = "";
  sceneRows.innerHTML = "";
  questRows.appendChild(buildQuestRow());
  sceneRows.appendChild(buildSceneRow());
}

// Submit new Ideal
formAddIdeal.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!uid) return;
  const title = idealTitleInput.value.trim();
  if (!title) return;

  // Collect rows
  const questSpecs = [];
  questRows.querySelectorAll(".row").forEach((row) => {
    const [titleEl, numEl, unitEl] = row.querySelectorAll("input");
    const t = titleEl.value.trim();
    const n = Number(numEl.value);
    const u = unitEl.value.trim();
    if (t && !isNaN(n) && u) {
      questSpecs.push({ title: t, target: n, unit: u });
    }
  });

  const scenes = [];
  sceneRows.querySelectorAll(".row input").forEach((inp) => {
    const t = inp.value.trim();
    if (t) scenes.push({ text: t });
  });

  try {
    // Create ideal
    const idealRef = await addDoc(collection(db, "users", uid, "ideals"), {
      title, realized: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    const idealId = idealRef.id;

    // Create quests
    for (const [i, q] of questSpecs.entries()) {
      await addDoc(collection(db, "users", uid, "ideals", idealId, "quests"), {
        userId: uid,
        idealId, idealTitle: title,
        title: q.title,
        target: q.target,
        unit: q.unit,
        value: 0,
        status: "active",
        order: i,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
    // Create scenes
    for (const [i, s] of scenes.entries()) {
      await addDoc(collection(db, "users", uid, "ideals", idealId, "scenes"), {
        userId: uid,
        idealId, idealTitle: title,
        text: s.text,
        lastCheckedDate: "",
        order: i,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }

    modalAdd.close();
    toast("理想を追加しました");
  } catch (err) {
    alert("追加に失敗しました: " + err.message);
  }
});

// ===== Renderers =====
const idealsActiveEl = $("#idealsActive");
const idealsRealizedEl = $("#idealsRealized");
const questsActiveEl = $("#questsActive");
const questsCompletedEl = $("#questsCompleted");
const scenesDoneEl = $("#scenesDone");
const scenesTodoEl = $("#scenesTodo");

function renderIdealCard({ id, title, realized, completionRate }) {
  const wrap = createEl("div", "card");
  const head = createEl("div", "flex items-start justify-between gap-3");
  const titleEl = createEl("h3", "text-lg font-bold cursor-pointer hover:underline", title);
  titleEl.addEventListener("click", () => openIdealDetail(id));
  const checkWrap = createEl("label", "inline-flex items-center gap-2");
  const check = createEl("input");
  check.type = "checkbox"; check.checked = !!realized;
  check.addEventListener("change", async () => {
    await updateDoc(doc(db, "users", uid, "ideals", id), {
      realized: check.checked, updatedAt: serverTimestamp()
    });
  });
  checkWrap.append(check, createEl("span", "text-sm", "叶った"));
  head.append(titleEl, checkWrap);

  const bar = createEl("div", "progress mt-4");
  const barFill = createEl("span");
  barFill.style.width = `${clamp(completionRate, 0, 100)}%`;
  bar.appendChild(barFill);

  const meta = createEl("div", "mt-2 text-sm text-slate-600", `クエスト達成率 ${completionRate}%`);

  wrap.append(head, bar, meta);
  return wrap;
}

function renderQuestItem(q) {
  const item = createEl("div", "card");
  const top = createEl("div", "flex items-center justify-between");
  top.append(
    createEl("div", "text-sm text-slate-500", q.idealTitle),
    createEl("div", "badge border-sky-300 text-sky-700", q.status === "completed" ? "達成" : "進行中")
  );
  const title = createEl("div", "mt-1 text-base font-semibold", q.title);

  const ctl = createEl("div", "mt-3 flex items-center gap-2");
  const minus = createEl("button", "btn-secondary", "−");
  const num = createEl("div", "min-w-[5rem] text-center font-bold", `${q.value} ${q.unit} / ${q.target} ${q.unit}`);
  const plus = createEl("button", "btn-secondary", "＋");

  minus.addEventListener("click", () => adjustQuest(q, -1));
  plus.addEventListener("click", () => adjustQuest(q, +1));

  ctl.append(minus, num, plus);
  item.append(top, title, ctl);
  return item;
}

function renderSceneItem(s, options = { inDetail: false }) {
  const item = createEl("div", "card");
  const top = createEl("div", "flex items-center justify-between");
  if (!options.inDetail) {
    top.append(createEl("div", "text-sm text-slate-500", s.idealTitle));
  } else {
    top.append(createEl("div"));
  }
  const actions = createEl("div", "flex items-center gap-2");
  const del = createEl("button", "btn-ghost text-red-600", "削除");
  del.addEventListener("click", async () => {
    if (!confirm("この項目を削除しますか？")) return;
    await deleteDoc(doc(db, "users", uid, "ideals", s.idealId, "scenes", s.id));
  });
  actions.append(del);
  top.append(actions);

  const row = createEl("div", "mt-2 flex items-center gap-3");
  const chk = createEl("input");
  chk.type = "checkbox";
  const isToday = s.lastCheckedDate === todayJST();
  chk.checked = isToday;
  chk.addEventListener("change", async () => {
    const newDate = chk.checked ? todayJST() : "";
    await updateDoc(doc(db, "users", uid, "ideals", s.idealId, "scenes", s.id), {
      lastCheckedDate: newDate, updatedAt: serverTimestamp()
    });
  });
  row.append(chk, createEl("div", "font-semibold", s.text));

  item.append(top, row);
  return item;
}

// ===== Firestore listeners =====
async function attachListeners() {
  detachListeners();

  // Ideals (list)
  unsubscribeIdeals = onSnapshot(
    query(collection(db, "users", uid, "ideals"), orderBy("createdAt", "desc")),
    async (snap) => {
      idealsCache.clear();
      const ideals = [];
      for (const d of snap.docs) {
        const id = d.id;
        const data = d.data();
        idealsCache.set(id, { title: data.title, realized: !!data.realized });
        // compute completion rate for display
        const qSnap = await getDocs(collection(db, "users", uid, "ideals", id, "quests"));
        const total = qSnap.size;
        let completed = 0;
        qSnap.forEach(qd => { const q = qd.data(); if ((q.value ?? 0) >= (q.target ?? 0)) completed++; });
        const completionRate = percent(completed, total);
        ideals.push({ id, title: data.title, realized: !!data.realized, completionRate });
      }
      // render
      idealsActiveEl.innerHTML = "";
      idealsRealizedEl.innerHTML = "";
      for (const it of ideals) {
        const card = renderIdealCard(it);
        if (it.completionRate === 100 && it.realized) {
          idealsRealizedEl.appendChild(card);
        } else {
          idealsActiveEl.appendChild(card);
        }
      }
    }
  );

  // Quests (collectionGroup)
  unsubscribeQuestsGroup = onSnapshot(
    query(
      collectionGroup(db, "quests"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc")
    ),
    (snap) => {
      const active = [];
      const completed = [];
      snap.forEach((docSnap) => {
        const q = { id: docSnap.id, ...docSnap.data() };
        const isDone = (q.value ?? 0) >= (q.target ?? 0);
        q.status = isDone ? "completed" : "active";
        (isDone ? completed : active).push(q);
      });
      questsActiveEl.innerHTML = "";
      questsCompletedEl.innerHTML = "";
      active.forEach(q => questsActiveEl.appendChild(renderQuestItem(q)));
      completed.forEach(q => questsCompletedEl.appendChild(renderQuestItem(q)));
    }
  );

  // Scenes (collectionGroup)
  const today = todayJST();
  unsubscribeScenesGroup = onSnapshot(
    query(
      collectionGroup(db, "scenes"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc")
    ),
    (snap) => {
      const done = [];
      const todo = [];
      snap.forEach((docSnap) => {
        const s = { id: docSnap.id, ...docSnap.data() };
        if (s.lastCheckedDate === today) done.push(s);
        else todo.push(s);
      });
      scenesDoneEl.innerHTML = "";
      scenesTodoEl.innerHTML = "";
      done.forEach(s => scenesDoneEl.appendChild(renderSceneItem(s)));
      todo.forEach(s => scenesTodoEl.appendChild(renderSceneItem(s)));
    }
  );
}

function detachListeners() {
  if (unsubscribeIdeals) { unsubscribeIdeals(); unsubscribeIdeals = null; }
  if (unsubscribeQuestsGroup) { unsubscribeQuestsGroup(); unsubscribeQuestsGroup = null; }
  if (unsubscribeScenesGroup) { unsubscribeScenesGroup(); unsubscribeScenesGroup = null; }
}

// Open ideal detail view
async function openIdealDetail(idealId) {
  const ref = doc(db, "users", uid, "ideals", idealId);
  const d = await getDoc(ref);
  if (!d.exists()) return;
  const data = d.data();

  // compute completion
  const qSnap = await getDocs(collection(db, "users", uid, "ideals", idealId, "quests"));
  const total = qSnap.size;
  let completed = 0;
  qSnap.forEach(qd => { const q = qd.data(); if ((q.value ?? 0) >= (q.target ?? 0)) completed++; });
  const completionRate = percent(completed, total);

  idealDetailCard.innerHTML = "";
  const card = createEl("div", "space-y-3");
  const title = createEl("h2", "text-2xl font-extrabold", data.title);
  const meta = createEl("div", "text-sm text-slate-600", `クエスト達成率 ${completionRate}%`);
  const lab = createEl("label", "inline-flex items-center gap-2");
  const chk = createEl("input");
  chk.type = "checkbox"; chk.checked = !!data.realized;
  chk.addEventListener("change", async () => {
    await updateDoc(ref, { realized: chk.checked, updatedAt: serverTimestamp() });
  });
  lab.append(chk, createEl("span", "text-sm", "叶った"));
  card.append(title, meta, lab);
  idealDetailCard.appendChild(card);

  // quests list within ideal
  idealDetailQuests.innerHTML = "";
  qSnap.forEach(qd => {
    const qdata = qd.data();
    const q = { id: qd.id, ...qdata };
    idealDetailQuests.appendChild(renderQuestItem(q));
  });

  // scenes list within ideal
  idealDetailScenes.innerHTML = "";
  const sSnap = await getDocs(collection(db, "users", uid, "ideals", idealId, "scenes"));
  sSnap.forEach(sd => {
    const sdata = sd.data();
    const s = { id: sd.id, ...sdata };
    idealDetailScenes.appendChild(renderSceneItem(s, { inDetail: true }));
  });

  switchView("detail");
}

// Adjust quest value
async function adjustQuest(q, delta) {
  const newVal = clamp((q.value ?? 0) + delta, 0, 1e9);
  const idealId = q.idealId;
  const questRef = doc(db, "users", uid, "ideals", idealId, "quests", q.id);
  const isDone = newVal >= (q.target ?? Number.MAX_SAFE_INTEGER);
  try {
    await updateDoc(questRef, {
      value: newVal,
      status: isDone ? "completed" : "active",
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    alert("更新に失敗しました: " + e.message);
  }
}

// ===== Auth state =====
onAuthStateChanged(auth, async (user) => {
  renderAuth(user);
  if (user) {
    uid = user.uid;
    switchView(currentView);
    fabAddIdeal.classList.remove("hidden");
    await attachListeners();
  } else {
    uid = null;
    fabAddIdeal.classList.add("hidden");
    detachListeners();
    // reset UI lists
    idealsActiveEl.innerHTML = "";
    idealsRealizedEl.innerHTML = "";
    questsActiveEl.innerHTML = "";
    questsCompletedEl.innerHTML = "";
    scenesDoneEl.innerHTML = "";
    scenesTodoEl.innerHTML = "";
  }
});

// Initial view
switchView("ideals");
