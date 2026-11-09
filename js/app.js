/* Clopos Retention Academy — приложение: вход, роли, курс, тесты, кабинет наставника. */
(function(){
"use strict";
const CFG=window.ACADEMY_CONFIG||{};
const ADMIN_EMAIL=String(CFG.adminEmail||"lsona2422@gmail.com").toLowerCase();
const ROLES={pending:"Ожидает доступа",intern:"Стажёр",mentor:"Наставник",admin:"Администратор",blocked:"Доступ закрыт"};
const TOUR_MAP=Object.fromEntries((window.TOURS||[]).map(t=>[t.id,t]));
const PASS=0.8;

/* ================= Хранилище браузера (безопасно) ================= */
const LS={get(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ================= Бэкенд: Supabase или демо-режим ================= */
function SupaBackend(){
 const sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);
 const ok=({data,error})=>{if(error)throw error;return data};
 return {mode:"supabase",
  async currentUser(){const {data}=await sb.auth.getSession();return data.session?data.session.user:null},
  onAuth(cb){sb.auth.onAuthStateChange((ev,s)=>cb(ev,s?s.user:null))},
  async signUp(email,pw,name){const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{full_name:name},emailRedirectTo:location.origin+location.pathname}});if(error)throw error;return {needsConfirm:!data.session}},
  async signIn(email,pw){ok(await sb.auth.signInWithPassword({email,password:pw}))},
  async reset(email){ok(await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}))},
  async setPassword(pw){ok(await sb.auth.updateUser({password:pw}))},
  async signOut(){await sb.auth.signOut()},
  async profile(uid){return ok(await sb.from("profiles").select("*").eq("id",uid).maybeSingle())},
  async loadProgress(uid){const r=ok(await sb.from("progress").select("state").eq("user_id",uid).maybeSingle());return r?r.state:null},
  async saveProgress(uid,state){ok(await sb.from("progress").upsert({user_id:uid,state,updated_at:new Date().toISOString()}))},
  async listProfiles(){return ok(await sb.from("profiles").select("*").order("created_at",{ascending:true}))},
  async listProgress(){return ok(await sb.from("progress").select("user_id,state,updated_at"))},
  async setRole(uid,role,mentor){ok(await sb.rpc("admin_set_role",{target:uid,new_role:role,new_mentor:mentor||null}))}
 };
}
function LocalBackend(){
 const K="clopos-academy-demo";
 let mem=LS.get(K)||{users:{},progress:{},session:null};
 const put=()=>LS.set(K,mem);
 const me=()=>mem.session&&mem.users[mem.session]?{id:mem.session,email:mem.users[mem.session].email}:null;
 const visible=(uid)=>{const u=mem.users[uid];if(!u)return [];if(u.role==="admin")return Object.keys(mem.users);if(u.role==="mentor")return Object.keys(mem.users).filter(id=>id===uid||mem.users[id].mentor_id===uid);return [uid]};
 const err=m=>{const e=new Error(m);e.message=m;return e};
 let cbs=[];
 return {mode:"demo",
  async currentUser(){return me()},
  onAuth(cb){cbs.push(cb)},
  async signUp(email,pw,name){email=email.trim().toLowerCase();if(Object.values(mem.users).some(u=>u.email===email))throw err("User already registered");
   const id="u"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
   mem.users[id]={email,pw,full_name:name,role:email===ADMIN_EMAIL?"admin":"pending",mentor_id:null,created_at:new Date().toISOString()};mem.session=id;put();cbs.forEach(c=>c("SIGNED_IN",me()));return {needsConfirm:false}},
  async signIn(email,pw){email=email.trim().toLowerCase();const id=Object.keys(mem.users).find(k=>mem.users[k].email===email);if(!id||mem.users[id].pw!==pw)throw err("Invalid login credentials");mem.session=id;put();cbs.forEach(c=>c("SIGNED_IN",me()))},
  async reset(){throw err("demo")},
  async setPassword(){},
  async signOut(){mem.session=null;put();cbs.forEach(c=>c("SIGNED_OUT",null))},
  async profile(uid){const u=mem.users[uid];return u?{id:uid,email:u.email,full_name:u.full_name,role:u.role,mentor_id:u.mentor_id,created_at:u.created_at}:null},
  async loadProgress(uid){return mem.progress[uid]?mem.progress[uid].state:null},
  async saveProgress(uid,state){mem.progress[uid]={state,updated_at:new Date().toISOString()};put()},
  async listProfiles(){return visible(mem.session).map(id=>({id,email:mem.users[id].email,full_name:mem.users[id].full_name,role:mem.users[id].role,mentor_id:mem.users[id].mentor_id,created_at:mem.users[id].created_at}))},
  async listProgress(){return visible(mem.session).filter(id=>mem.progress[id]).map(id=>({user_id:id,state:mem.progress[id].state,updated_at:mem.progress[id].updated_at}))},
  async setRole(uid,role,mentor){if(mem.users[mem.session]?.role!=="admin")throw err("forbidden");mem.users[uid].role=role;mem.users[uid].mentor_id=role==="intern"?(mentor||null):null;put()}
 };
}
const useSupa=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase&&window.supabase.createClient);
const BE=useSupa?SupaBackend():LocalBackend();

/* ================= Состояние ================= */
const blank=()=>({step:{},seen:{},tasks:{},res:{},card:{},sims:{},vids:{},last:null});
const App=window.App={user:null,profile:null,state:blank(),recovery:false,
 save(){this.state.last=new Date().toISOString();LS.set("clopos-academy-cache-"+(this.user?this.user.id:"x"),this.state);clearTimeout(this._t);this._t=setTimeout(()=>{if(this.user&&canLearn())BE.saveProgress(this.user.id,this.state).then(()=>setSync("Сохранено")).catch(()=>setSync("Не удалось сохранить — проверьте интернет",true))},700)}};
function setSync(t,bad){const el=$("syncState");if(el){el.textContent=t;el.style.color=bad?"var(--bad)":""}}
const role=()=>App.profile?App.profile.role:null;
const isStaff=()=>["mentor","admin"].includes(role());
const canLearn=()=>["intern","mentor","admin"].includes(role());
const passed=(st,id)=>!!(st.res[id]&&st.res[id].best/st.res[id].total>=PASS);
function isOpen(id){if(isStaff())return true;const S=App.state;
 if(id.startsWith("day-")){const n=+id.split("-")[1];return n===1||passed(S,"day-"+(n-1))}
 if(id.startsWith("exam-")||id==="final")return passed(S,"day-6");return true}

/* ================= Экран входа ================= */
function authView(mode,msg){
 const demo=BE.mode==="demo";
 const title={login:"Вход",register:"Регистрация",reset:"Восстановление пароля",newpw:"Новый пароль"}[mode];
 const f=(id,l,t,ac)=>`<label class="f" for="${id}">${l}<input id="${id}" type="${t}" autocomplete="${ac}" required></label>`;
 let body="";
 if(mode==="login")body=f("a_email","Электронная почта","email","email")+f("a_pw","Пароль","password","current-password")+`<button class="primary" type="submit">Войти</button><div class="row small"><a href="#" data-mode="register">Нет аккаунта? Зарегистрироваться</a>${demo?"":`<a href="#" data-mode="reset">Забыли пароль?</a>`}</div>`;
 if(mode==="register")body=f("a_name","Имя и фамилия","text","name")+f("a_email","Электронная почта","email","email")+f("a_pw","Пароль (не меньше 6 символов)","password","new-password")+f("a_pw2","Повторите пароль","password","new-password")+`<button class="primary" type="submit">Зарегистрироваться</button><p class="small muted">После регистрации администратор откроет вам доступ стажёра или наставника.</p><div class="row small"><a href="#" data-mode="login">Уже есть аккаунт? Войти</a></div>`;
 if(mode==="reset")body=f("a_email","Электронная почта","email","email")+`<button class="primary" type="submit">Отправить ссылку</button><div class="row small"><a href="#" data-mode="login">Назад ко входу</a></div>`;
 if(mode==="newpw")body=f("a_pw","Новый пароль","password","new-password")+`<button class="primary" type="submit">Сохранить пароль</button>`;
 return `<div class="auth"><div class="auth-card"><div class="auth-brand">${LOGO("auth-logo")}<div><b>Retention Academy</b><span>Clopos · обучение отдела Retention</span></div></div>
 <h1>${title}</h1>${demo?`<div class="note">Демо-режим: база данных не подключена, аккаунты хранятся только в этом браузере. Как подключить — в файле README.</div>`:""}
 <form id="authForm" novalidate>${body}<p id="authMsg" class="small" role="status">${msg||""}</p></form></div></div>`}
function bindAuth(mode){
 document.querySelectorAll("[data-mode]").forEach(a=>a.onclick=e=>{e.preventDefault();showAuth(a.dataset.mode)});
 $("authForm").onsubmit=async e=>{e.preventDefault();const m=$("authMsg");const btn=e.target.querySelector("button[type=submit]");m.style.color="";
  const v=id=>($(id)?$(id).value.trim():"");
  try{btn.disabled=true;
   if(mode==="login"){if(!v("a_email")||!v("a_pw"))throw new Error("Введите почту и пароль.");await BE.signIn(v("a_email"),$("a_pw").value)}
   if(mode==="register"){if(!v("a_name"))throw new Error("Укажите имя и фамилию.");if(!/^\S+@\S+\.\S+$/.test(v("a_email")))throw new Error("Проверьте адрес почты.");if($("a_pw").value.length<6)throw new Error("Пароль — не меньше 6 символов.");if($("a_pw").value!==$("a_pw2").value)throw new Error("Пароли не совпадают.");
    const r=await BE.signUp(v("a_email"),$("a_pw").value,v("a_name"));if(r.needsConfirm){showAuth("login",`Мы отправили письмо на ${esc(v("a_email"))}. Подтвердите почту по ссылке из письма и войдите.`);return}}
   if(mode==="reset"){await BE.reset(v("a_email"));m.textContent="Ссылка для смены пароля отправлена на почту.";btn.disabled=false;return}
   if(mode==="newpw"){if($("a_pw").value.length<6)throw new Error("Пароль — не меньше 6 символов.");await BE.setPassword($("a_pw").value);App.recovery=false;await boot();return}
   await boot()
  }catch(ex){m.style.color="var(--bad)";m.textContent=errText(ex);btn.disabled=false}}}
function errText(ex){const s=String(ex&&ex.message||ex);
 if(/Invalid login/i.test(s))return "Неверная почта или пароль.";if(/Email not confirmed/i.test(s))return "Почта не подтверждена. Откройте письмо и перейдите по ссылке.";if(/already registered/i.test(s))return "Такая почта уже зарегистрирована. Войдите или восстановите пароль.";if(/rate limit/i.test(s))return "Слишком много попыток. Подождите минуту.";if(/Failed to fetch|NetworkError/i.test(s))return "Нет связи с сервером. Проверьте интернет.";return s}
function showAuth(mode,msg){document.body.classList.add("auth-mode");$("app").innerHTML=authView(mode,msg);bindAuth(mode)}

/* ================= Загрузка ================= */
async function boot(){
 if(App.recovery){showAuth("newpw");return}
 App.user=await BE.currentUser();
 if(!App.user){showAuth("login");return}
 try{App.profile=await BE.profile(App.user.id)}catch(e){App.profile=null}
 if(!App.profile){showGate("Профиль ещё создаётся","Обновите страницу через несколько секунд. Если сообщение не исчезает, база данных настроена не полностью — см. README.");return}
 if(role()==="pending"){showGate("Заявка отправлена","Администратор откроет вам доступ стажёра или наставника. После этого обновите страницу.");return}
 if(role()==="blocked"){showGate("Доступ закрыт","Обратитесь к руководителю отдела.");return}
 const cached=LS.get("clopos-academy-cache-"+App.user.id);
 let remote=null;try{remote=await BE.loadProgress(App.user.id)}catch(e){}
 App.state=Object.assign(blank(),remote||cached||{});
 document.body.classList.remove("auth-mode");shell();render()}
function showGate(t,m){document.body.classList.add("auth-mode");$("app").innerHTML=`<div class="auth"><div class="auth-card"><div class="auth-brand">${LOGO("auth-logo")}<div><b>Retention Academy</b><span>${esc(App.profile?App.profile.full_name||App.user.email:"")}</span></div></div><h1>${t}</h1><p>${m}</p><div class="row"><button class="primary" id="gRe">Обновить</button><button id="gOut">Выйти</button></div></div></div>`;
 $("gRe").onclick=()=>boot();$("gOut").onclick=async()=>{await BE.signOut();boot()}}

/* ================= Каркас ================= */
function shell(){
 $("app").innerHTML=`<header class="top"><a class="brand" href="#start">${LOGO("brand-mark",true)}<span>Retention Academy<small>Clopos · обучение · 6 дней</small></span></a><span class="spacer"></span>
 <a href="#modules" class="toplink">Все модули</a>${isStaff()?`<a href="#team" class="toplink">${role()==="admin"?"Команда и доступы":"Мои стажёры"}</a>`:""}
 <div class="progress-pill" title="Ваш прогресс"><span id="progTxt">0 / 9</span><span class="bar"><i id="progBar"></i></span></div>
 <div class="who"><span class="who-name">${esc(App.profile.full_name||App.user.email)}</span><span class="chip ${role()==="intern"?"info":"ok"}">${ROLES[role()]}</span><button id="logout" class="sm">Выйти</button></div></header>
 ${BE.mode==="demo"?`<div class="demo-bar">Демо-режим: регистрация и прогресс хранятся только в этом браузере. Для общей работы команды подключите базу данных по инструкции в README.</div>`:""}
 <div class="shell"><nav class="side" id="sideNav" aria-label="Карта курса"></nav><main><div class="navsel"><label class="f" for="navSelect">Раздел<select id="navSelect"></select></label></div><div id="views"></div></main></div>`;
 $("logout").onclick=async()=>{await BE.signOut();App.user=null;App.profile=null;location.hash="";boot()};
 $("navSelect").onchange=e=>location.hash=e.target.value}

const ROUTES=()=>["start",...DAY_IDS,"final",...EXAM_IDS,"modules","glossary",...(isStaff()?["team"]:[])];
function route(){const h=location.hash.slice(1);return ROUTES().includes(h)?h:"start"}
function renderNav(){const cur=route(),S=App.state;
 const dl=id=>{const d=DAYS[id],o=isOpen(id),p=passed(S,id);return `<a href="#${id}" class="${o?"":"locked"}" ${cur===id?'aria-current="page"':""}><span class="dn ${p?"done":cur===id?"cur":""}">${p?"✓":o?d.n:"🔒"}</span><span>${d.title}</span></a>`};
 $("sideNav").innerHTML=`<div class="grp">Старт</div><a href="#start" ${cur==="start"?'aria-current="page"':""}>Программа курса</a>${isStaff()?`<a href="#team" ${cur==="team"?'aria-current="page"':""}>${role()==="admin"?"Команда и доступы":"Мои стажёры"}</a>`:""}<div class="grp">Обучение · 6 дней</div>${DAY_IDS.map(dl).join("")}<div class="grp">Итоговая аттестация</div><a href="#final" class="${isOpen("final")?"":"locked"}" ${cur==="final"?'aria-current="page"':""}>Обзор тестов</a>${EXAM_IDS.map((id,i)=>{const r=S.res[id];return `<a href="#${id}" class="${isOpen(id)?"":"locked"}" ${cur===id?'aria-current="page"':""}>Тест ${i+1} · ${EXAMS[id][0]}${r?`<span class="st">${r.best}/${r.total}</span>`:""}</a>`}).join("")}<div class="grp">Справочник</div><a href="#modules" ${cur==="modules"?'aria-current="page"':""}>Все модули (${MODS.length+OTHER.length+APPS.length})</a><a href="#glossary" ${cur==="glossary"?'aria-current="page"':""}>Глоссарий</a>`;
 const label=id=>id==="start"?"Программа курса":id==="team"?"Команда":DAYS[id]?`День ${DAYS[id].n}. ${DAYS[id].title}${isOpen(id)?"":" 🔒"}`:id==="final"?"Итоговая аттестация":EXAMS[id]?`Тест ${EXAM_IDS.indexOf(id)+1}. ${EXAMS[id][0]}`:id==="glossary"?"Глоссарий":"Все модули";
 $("navSelect").innerHTML=ROUTES().map(id=>`<option value="${id}" ${id===cur?"selected":""}>${label(id)}</option>`).join("");
 const all=[...DAY_IDS,...EXAM_IDS],done=all.filter(id=>passed(S,id)).length;$("progTxt").textContent=`${done} / ${all.length}`;$("progBar").style.width=(done/all.length*100)+"%"}

function render(){if(!App.user||!canLearn())return;const id=route(),v=$("views");let html;
 if(id==="start")html=viewStart();else if(DAYS[id])html=viewDay(id);else if(id==="final")html=viewFinal();else if(EXAMS[id])html=viewExam(id);else if(id==="glossary")html=viewGloss();else if(id==="team")html=`<div id="teamBox"><p class="muted">Загружаю данные команды…</p></div>`;else html=viewMods();
 v.innerHTML=`<section class="view">${html}<footer class="foot">Clopos Retention Academy · основано на регламенте, скрипте и материалах отдела Retention и демо-кабинете Clopos. <span id="syncState"></span></footer></section>`;
 if(DAYS[id]&&isOpen(id)){document.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{App.state.step[id]=+b.dataset.step;App.save();drawStep(id)});drawStep(id)}
 if(EXAMS[id]&&isOpen(id))startQuiz(id,$("quizBox"),()=>`<a href="#final">К списку тестов</a>`);
 if(id==="glossary")bindGloss();if(id==="modules")bindMods();if(id==="team")loadTeam();
 renderNav();window.scrollTo(0,0)}

/* ================= Экраны курса ================= */
function viewStart(){const S=App.state;
 return `<div class="hero"><div class="prose"><span class="eyebrow">Clopos · отдел Retention · программа курса</span><h1>6 дней обучения сотрудника Retention</h1><p class="lead">Каждый день — уроки по шагам, видео и тренажёры по демо-кабинету, практика и проверка из 15 вопросов. Следующий день открывается после проверки на 80%. В конце — три итоговых теста по 50 вопросов.</p></div>${LOGO_OUT}</div>
 <div class="days">${DAY_IDS.map(id=>{const d=DAYS[id],o=isOpen(id),r=S.res[id];return `<a class="dcard ${o?"":"locked"}" href="#${id}"><span class="num">${d.n}<small>ДЕНЬ</small></span><span><h3>${d.title}</h3><p>${d.goal}</p></span>${passed(S,id)?`<span class="chip ok">✓ ${r.best}/${r.total}</span>`:o?`<span class="chip info">открыт</span>`:`<span class="chip plain">🔒 после дня ${d.n-1}</span>`}</a>`}).join("")}
 <a class="dcard ${isOpen("final")?"":"locked"}" href="#final"><span class="num">★<small>ФИНАЛ</small></span><span><h3>Итоговая аттестация</h3><p>Три теста по 50 вопросов: компания и MRR, продукт, скрипт и регламент.</p></span>${isOpen("final")?`<span class="chip info">${EXAM_IDS.filter(x=>passed(S,x)).length} / 3 сдано</span>`:`<span class="chip plain">🔒 после дня 6</span>`}</a></div>
 ${isStaff()?`<div class="note info">У вас роль «${ROLES[role()]}»: все дни и тесты открыты. Прогресс стажёров — в разделе <a href="#team">${role()==="admin"?"«Команда и доступы»":"«Мои стажёры»"}</a>.</div>`:""}`}
function lockedView(msg,back){return `<div class="panel" style="align-items:flex-start"><span class="chip plain">🔒 закрыто</span><h2>${msg}</h2><p class="muted">Курс проходится по порядку.</p><a href="#${back}">Вернуться →</a></div>`}
function viewDay(id){const d=DAYS[id];if(!isOpen(id))return lockedView(`День ${d.n} откроется после проверки дня ${d.n-1}`,"day-"+(d.n-1));
 const steps=stepList(id);
 return `<div class="prose"><span class="eyebrow">День ${d.n} из 6</span><h1>${d.title}</h1><p class="lead">${d.goal}</p></div>
 <div class="steps">${steps.map((s,i)=>`<button data-step="${i}">${s.icon} <span>${s.t}</span></button>`).join("")}</div><div id="stepBox"></div>`}
function stepList(id){const d=DAYS[id];const a=d.lessons.map((l,i)=>({k:"l",i,t:l.t,icon:(i+1)+"."}));if(d.tours.length)a.push({k:"m",t:"Видео и тренажёры",icon:"▶"});a.push({k:"p",t:"Практика в демо",icon:"✎"});a.push({k:"q",t:"Проверка дня",icon:"✓"});return a}
function drawStep(id){const d=DAYS[id],S=App.state,box=$("stepBox");const steps=stepList(id),n=steps.length;let st=Math.min(S.step[id]||0,n-1);
 S.seen[id]=S.seen[id]||[];if(!S.seen[id].includes(st)){S.seen[id].push(st);App.save()}
 document.querySelectorAll("[data-step]").forEach(b=>{const i=+b.dataset.step;b.classList.toggle("cur",i===st);b.classList.toggle("seen",S.seen[id].includes(i)&&i!==st)});
 const cur=steps[st];const nav=`<div class="stepnav"><button id="prevS" ${st===0?"disabled":""}>← Назад</button>${st<n-1?`<button class="primary" id="nextS">${steps[st+1].k==="q"?"К проверке дня →":"Дальше →"}</button>`:""}</div>`;
 const head=`<span class="eyebrow">Шаг ${st+1} из ${n}</span><h2>${cur.t}</h2>`;
 if(cur.k==="l"){const L=d.lessons[cur.i];box.innerHTML=`<article class="lesson">${head}<div class="body ${L.b?"wide":""}">${L.h()}</div>${nav}</article>`;if(L.b)L.b()}
 else if(cur.k==="m"){box.innerHTML=`<article class="lesson">${head}<p class="muted small">Сначала посмотрите видео, затем повторите путь в тренажёре: нажимайте на экране туда, куда нужно нажать в кабинете.</p><div class="media-list">${d.tours.map(tid=>mediaCard(tid)).join("")}</div>${nav}</article>`;bindMedia(d.tours)}
 else if(cur.k==="p"){S.tasks[id]=S.tasks[id]||[];box.innerHTML=`<article class="lesson">${head}<p class="small muted">Выполняйте задания в демо-кабинете. Ничего не удаляйте и не сохраняйте — только смотрите. Ответ открывайте после того, как сделали задание сами.</p><div>${d.tasks.map((t,i)=>`<div class="task"><input type="checkbox" id="t_${id}_${i}" ${S.tasks[id][i]?"checked":""}><div class="tb"><label for="t_${id}_${i}"><b>Задание ${i+1}.</b> ${t[0]}</label>${t[1]?`<details><summary>Ответ для самопроверки</summary><div>${t[1]}</div></details>`:`<span class="small muted">Обсудите результат с наставником.</span>`}</div></div>`).join("")}</div>${nav}</article>`;
  d.tasks.forEach((_,i)=>$(`t_${id}_${i}`).onchange=e=>{S.tasks[id][i]=e.target.checked;App.save()})}
 else{const r=S.res[id];box.innerHTML=`<article class="lesson">${head}<p class="small muted">${QD[id].length} вопросов, проходной балл 80%. ${r?`Лучший результат: ${r.best}/${r.total}.`:""}</p><div id="quizBox"></div>${nav}</article>`;
  startQuiz(id,$("quizBox"),pass=>pass?`<a href="#${d.n<6?"day-"+(d.n+1):"final"}">${d.n<6?"Перейти к дню "+(d.n+1):"К итоговой аттестации"} →</a>`:"")}
 $("prevS").onclick=()=>{S.step[id]=st-1;App.save();drawStep(id);toTop()};const nx=$("nextS");if(nx)nx.onclick=()=>{S.step[id]=st+1;App.save();drawStep(id);toTop()}}
function toTop(){window.scrollTo({top:0,behavior:"smooth"})}

/* ================= Видео и тренажёры ================= */
function mediaCard(tid){const t=TOUR_MAP[tid];if(!t)return "";const S=App.state;
 return `<div class="media"><div class="media-head"><h3>${t.title}</h3><span class="row" style="gap:6px">${S.vids[tid]?'<span class="chip ok">видео ✓</span>':""}${S.sims[tid]?'<span class="chip ok">тренажёр ✓</span>':""}</span></div>
 <div class="grid2"><div><span class="eyebrow">Видео</span><video id="v_${tid}" controls preload="none" playsinline poster="media/${tid}-poster.jpg"><source src="media/${tid}.mp4" type="video/mp4"></video></div>
 <div><span class="eyebrow">Тренажёр</span><div class="sim" id="s_${tid}"></div></div></div></div>`}
function bindMedia(list){list.forEach(tid=>{const v=$("v_"+tid);if(v)v.addEventListener("ended",()=>{App.state.vids[tid]=true;App.save()});sim(tid,0,0)})}
function sim(tid,step,miss){const t=TOUR_MAP[tid],box=$("s_"+tid);if(!t||!box)return;
 if(step>=t.steps.length){App.state.sims[tid]=true;App.save();box.innerHTML=`<div class="sim-frame"><img src="media/${t.endImg}" alt="Результат: ${esc(t.title)}"></div><p class="sim-text ok">✓ ${t.end}</p><button class="sm" id="sr_${tid}">Пройти ещё раз</button>`;$("sr_"+tid).onclick=()=>sim(tid,0,0);return}
 const s=t.steps[step],[x,y,w,h]=s.box,W=1440,H=900;
 box.innerHTML=`<p class="sim-text">Шаг ${step+1} из ${t.steps.length}. ${s.text}</p><div class="sim-frame" id="sf_${tid}"><img src="media/${s.img}" alt="Экран демо-кабинета, шаг ${step+1}"><span class="hot ${miss>=2?"show":""}" style="left:${(x-8)/W*100}%;top:${(y-8)/H*100}%;width:${(w+16)/W*100}%;height:${(h+16)/H*100}%"></span></div><p class="small muted" id="sm_${tid}">${miss>=2?"Подсказка: нажмите на выделенную область.":miss?"Не здесь. Попробуйте ещё раз.":"Нажмите на нужное место на экране."}</p>`;
 $("sf_"+tid).onclick=e=>{const r=e.currentTarget.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W,py=(e.clientY-r.top)/r.height*H;const pad=14;
  if(px>=x-pad&&px<=x+w+pad&&py>=y-pad&&py<=y+h+pad)sim(tid,step+1,0);else sim(tid,step,miss+1)}}

/* ================= Тесты ================= */
let run=null;window.__quiz=()=>run;
function startQuiz(id,box,onDone){const qs=QD[id].map((q,i)=>{if(!Array.isArray(q))return{i,o:null};const o=[0,1,2,3];for(let k=3;k>0;k--){const r=Math.floor(Math.random()*(k+1));[o[k],o[r]]=[o[r],o[k]]}return{i,o}});
 run={id,box,onDone,pos:0,ans:[],qs};drawQ()}
function drawQ(){const {id,box}=run,Q=QD[id],cur=run.qs[run.pos],q=Q[cur.i],a=run.ans[run.pos];
 const bar=Q.map((_,k)=>`<i class="${k<run.ans.length?(run.ans[k].ok?"r":"w"):(k===run.pos?"c":"")}"></i>`).join("");let body;
 if(Array.isArray(q)){body=`<p class="qt">${q[0]}</p><div class="opts">${cur.o.map((j,k)=>{let c="";if(a){if(j===0)c="right";else if(j===a.pick)c="wrong"}return `<button class="opt ${c}" data-pick="${j}" ${a?"disabled":""}><span class="k">${"АБВГ"[k]}</span><span>${q[1][j]}</span></button>`}).join("")}</div>${a?`<div class="expl"><b>${a.ok?"Верно.":"Неверно."}</b> ${q[2]}</div>`:""}`}
 else{body=`<p class="qt">${q.q}</p><form class="numans" id="numForm"><input id="numIn" inputmode="decimal" autocomplete="off" placeholder="Ответ числом" ${a?"disabled":""} value="${a?esc(a.raw):""}" aria-label="Ваш ответ"><span class="mono muted">${q.unit||""}</span>${a?"":`<button class="primary" type="submit">Ответить</button>`}</form>${a?`<div class="expl"><b>${a.ok?"Верно.":"Неверно. Правильный ответ: "+numTxt(q.num)+" "+(q.unit||"")+"."}</b> ${q.e}</div>`:""}`}
 box.innerHTML=`<div class="q"><div class="row" style="justify-content:space-between"><span class="qn">ВОПРОС ${run.pos+1} / ${Q.length}</span><div class="qbar" aria-hidden="true">${bar}</div></div>${body}${a?`<div class="row"><button class="primary" id="nextQ">${run.pos+1<Q.length?"Следующий вопрос":"Посмотреть результат"}</button></div>`:""}</div>`;
 box.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{const p=+b.dataset.pick;run.ans[run.pos]={pick:p,ok:p===0};drawQ();box.querySelector("#nextQ")?.focus({preventScroll:true})});
 const f=box.querySelector("#numForm");if(f&&!a)f.onsubmit=e=>{e.preventDefault();const raw=$("numIn").value.trim();if(!raw)return;const v=parseFloat(raw.replace(/[\s ]/g,"").replace(",","."));run.ans[run.pos]={raw,ok:isFinite(v)&&Math.abs(v-q.num)<=(q.tol||0)+1e-9};drawQ();box.querySelector("#nextQ")?.focus({preventScroll:true})};
 const nx=box.querySelector("#nextQ");if(nx)nx.onclick=()=>{if(run.pos+1<Q.length){run.pos++;drawQ();box.scrollIntoView({block:"start",behavior:"smooth"})}else finishQuiz()}}
function finishQuiz(){const {id,box,onDone}=run,Q=QD[id],S=App.state;const score=run.ans.filter(a=>a.ok).length,total=Q.length,pass=score/total>=PASS;
 const wrong=run.qs.map((o,k)=>run.ans[k].ok?null:(Array.isArray(Q[o.i])?Q[o.i][0]:Q[o.i].q)).filter(Boolean);
 const prev=S.res[id];S.res[id]={best:Math.max(score,prev?prev.best:0),last:score,total,tries:(prev?prev.tries:0)+1,date:new Date().toISOString(),wrong};App.save();renderNav();
 const title=EXAMS[id]?EXAMS[id][0]:"Проверка дня "+DAYS[id].n,d=new Date();
 box.innerHTML=`<div class="grid2" style="align-items:start"><div class="receipt" role="status"><div class="c big">CLOPOS ACADEMY</div><div class="c">Отдел Retention</div><hr><div class="ln"><span>СОТРУДНИК</span><span>${esc(App.profile.full_name||"")}</span></div><div class="ln"><span>ДАТА</span><span>${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</span></div><div class="ln"><span>ТЕСТ</span><span>${esc(title)}</span></div><hr>
 <div class="ln big"><span>ИТОГО</span><span>${score} / ${total}</span></div><div class="ln"><span>РЕЗУЛЬТАТ</span><span>${Math.round(score/total*100)}%</span></div><div class="ln"><span>СТАТУС</span><span class="${pass?"pass":"fail"}">${pass?"ЗАЧЁТ":"ПЕРЕСДАЧА"}</span></div><hr><div class="c">Результат виден наставнику</div></div>
 <div class="panel"><h3>${pass?"Пройдено":"Нужно 80% и выше"}</h3>${wrong.length?`<p class="small muted">Ошибки (${wrong.length}):</p>`:""}${run.qs.map((o,k)=>{if(run.ans[k].ok)return"";const q=Q[o.i];return `<p class="small"><b>${Array.isArray(q)?q[0]:q.q}</b><br><span style="color:var(--ok)">Верно: ${Array.isArray(q)?q[1][0]:numTxt(q.num)+" "+(q.unit||"")}</span></p>`}).join("")}
 <div class="row"><button id="retry">Пройти ещё раз</button>${onDone(pass)}</div></div></div>`;$("retry").onclick=()=>startQuiz(id,box,onDone)}
function viewFinal(){if(!isOpen("final"))return lockedView("Итоговая аттестация откроется после проверки дня 6","day-6");const S=App.state;
 return `<div class="prose"><span class="eyebrow">Итоговая аттестация</span><h1>Три итоговых теста</h1><p class="lead">По 50 вопросов, есть задачи с расчётами. Зачёт — 80%. Результаты видит наставник.</p></div>
 <div class="grid3">${EXAM_IDS.map((id,i)=>{const r=S.res[id];return `<a class="dcard" style="grid-template-columns:1fr" href="#${id}"><span><span class="eyebrow">Тест ${i+1} · ${QD[id].length} вопросов</span><h3 style="margin-top:4px">${EXAMS[id][0]}</h3><p>${EXAMS[id][1]}</p><p style="margin-top:8px">${r?`<span class="chip ${passed(S,id)?"ok":"bad"}">лучший: ${r.best}/${r.total}</span>`:`<span class="chip plain">не сдан</span>`}</p></span></a>`}).join("")}</div>`}
function viewExam(id){if(!isOpen(id))return lockedView("Итоговые тесты откроются после проверки дня 6","day-6");
 return `<div class="prose"><span class="eyebrow">Итоговый тест ${EXAM_IDS.indexOf(id)+1} из 3 · ${QD[id].length} вопросов · зачёт 80%</span><h1>${EXAMS[id][0]}</h1><p class="lead">${EXAMS[id][1]}.</p></div><div id="quizBox"></div>`}
function viewGloss(){return `<div class="prose"><span class="eyebrow">Справочник</span><h1>Глоссарий</h1></div><input class="search" id="glq" placeholder="Например, NRR или фудкост" autocomplete="off" aria-label="Поиск по терминам"><div class="gl" id="glList"></div>`}
function bindGloss(){const draw=q=>{q=(q||"").toLowerCase().trim();const r=GLOSSARY.filter(g=>!q||(g[0]+" "+g[1]).toLowerCase().includes(q));$("glList").innerHTML=r.length?r.map(g=>`<div class="t"><b>${g[0]}</b><span>${g[1]}</span></div>`).join(""):`<p class="muted">Ничего не найдено.</p>`};$("glq").oninput=e=>draw(e.target.value);draw("")}
function viewMods(){const paid=MODS.filter(m=>m[2]!=="бесплатно").length;
 return `<div class="prose"><span class="eyebrow">Справочник</span><h1>Все модули Clopos</h1><p class="lead">Все модули из демо-кабинета (${P("Модули → Все")}): что делает каждый, когда его предлагать и что в нём настраивается.</p></div>
 <div class="kpis"><div class="kpi"><span class="v">${MODS.length}</span><span class="l">модуль для Узбекистана</span></div><div class="kpi"><span class="v">${paid}</span><span class="l">платных</span></div><div class="kpi"><span class="v">${MODS.length-paid}</span><span class="l">бесплатных</span></div><div class="kpi"><span class="v">${OTHER.length}</span><span class="l">интеграций для других стран</span></div></div>
 <h2>Модули для клиентов в Узбекистане</h2>${modTable()}<h2>Сторонние приложения</h2>${tbl(["Приложение","Что известно"],APPS)}<h2>Интеграции для других стран</h2><p class="small muted">Есть в меню кабинета, но для бренда в Узбекистане не открываются. Клиентам в Узбекистане их не предлагаем.</p>${tbl(["Интеграция","Что это"],OTHER)}`}

/* ================= Команда: администратор и наставник ================= */
function summarize(st){st=Object.assign(blank(),st||{});const days=DAY_IDS.filter(id=>passed(st,id)).length,ex=EXAM_IDS.filter(id=>passed(st,id)).length;
 const curDay=DAY_IDS.find(id=>!passed(st,id));const tasks=DAY_IDS.reduce((a,id)=>a+(st.tasks[id]||[]).filter(Boolean).length,0),tTotal=DAY_IDS.reduce((a,id)=>a+DAYS[id].tasks.length,0);
 const sims=Object.keys(st.sims||{}).length,vids=Object.keys(st.vids||{}).length;return {st,days,ex,curDay,tasks,tTotal,sims,vids}}
const dt=s=>s?new Date(s).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
let TEAM={profiles:[],progress:{},sel:null,msg:""};
async function loadTeam(){const box=$("teamBox");try{const [pr,pg]=await Promise.all([BE.listProfiles(),BE.listProgress()]);TEAM.profiles=pr||[];TEAM.progress={};(pg||[]).forEach(r=>TEAM.progress[r.user_id]=r);drawTeam()}catch(e){box.innerHTML=`<div class="note">Не удалось загрузить данные команды: ${esc(errText(e))}</div>`}}
function drawTeam(){const box=$("teamBox");if(!box)return;const admin=role()==="admin";const me=App.user.id;
 const mentors=TEAM.profiles.filter(p=>p.role==="mentor"||p.role==="admin");
 const interns=TEAM.profiles.filter(p=>p.role==="intern"&&(admin||p.mentor_id===me));
 const pend=TEAM.profiles.filter(p=>p.role==="pending");
 const name=p=>esc(p.full_name||p.email);
 let html=`<div class="prose"><span class="eyebrow">${admin?"Администратор":"Наставник"}</span><h1>${admin?"Команда и доступы":"Мои стажёры"}</h1><p class="lead">${admin?"Назначайте роли зарегистрированным сотрудникам и закрепляйте стажёров за наставниками. Ниже — прогресс всех стажёров.":"Прогресс и результаты стажёров, закреплённых за вами."}</p></div><div class="row"><button id="tRe" class="sm">Обновить данные</button></div>`;
 if(admin){html+=`<h2>Пользователи${pend.length?` <span class="chip warn">${pend.length} ждут доступа</span>`:""}</h2><div class="tbl-wrap"><table><thead><tr><th>Сотрудник</th><th>Почта</th><th>Роль</th><th>Наставник</th><th>Регистрация</th></tr></thead><tbody>${TEAM.profiles.map(p=>`<tr><td><b>${name(p)}</b></td><td class="small">${esc(p.email)}</td><td>${p.id===me?`<span class="chip ok">${ROLES[p.role]}</span>`:`<select data-role="${p.id}" aria-label="Роль: ${name(p)}">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${p.role===k?"selected":""}>${v}</option>`).join("")}</select>`}</td><td>${p.role==="intern"?`<select data-mentor="${p.id}" aria-label="Наставник: ${name(p)}"><option value="">— не назначен —</option>${mentors.map(m=>`<option value="${m.id}" ${p.mentor_id===m.id?"selected":""}>${name(m)}</option>`).join("")}</select>`:"—"}</td><td class="small">${dt(p.created_at)}</td></tr>`).join("")}</tbody></table></div><p id="roleMsg" class="small muted" role="status">${esc(TEAM.msg)}</p>`}
 html+=`<h2>Прогресс стажёров</h2>`;
 if(!interns.length)html+=`<p class="muted">${admin?"Пока нет пользователей с ролью «Стажёр».":"За вами пока не закреплены стажёры. Их назначает администратор."}</p>`;
 else html+=`<div class="tbl-wrap"><table><thead><tr><th>Стажёр</th><th>Дни</th><th>Проверки дней</th><th>Итоговые тесты</th><th>Практика</th><th>Видео / тренажёры</th><th>Активность</th><th></th></tr></thead><tbody>${interns.map(p=>{const pr=TEAM.progress[p.id];const s=summarize(pr&&pr.state);
  return `<tr><td><b>${name(p)}</b><br><span class="small muted">${s.curDay?"Сейчас: день "+DAYS[s.curDay].n:"Все дни пройдены"}</span></td><td><span class="mono">${s.days}/6</span><div class="minibar"><i style="width:${s.days/6*100}%"></i></div></td>
  <td>${DAY_IDS.map(id=>chipRes(s.st,id,DAYS[id].n)).join("")}</td><td>${EXAM_IDS.map((id,i)=>chipRes(s.st,id,"Т"+(i+1))).join("")}</td><td class="mono">${s.tasks}/${s.tTotal}</td><td class="mono">${s.vids}/${(window.TOURS||[]).length} · ${s.sims}/${(window.TOURS||[]).length}</td><td class="small">${dt(pr&&pr.updated_at)}</td><td><button class="sm" data-open="${p.id}">Подробнее</button></td></tr>`}).join("")}</tbody></table></div>`;
 if(TEAM.sel){const p=TEAM.profiles.find(x=>x.id===TEAM.sel);if(p)html+=detail(p)}
 box.innerHTML=html;$("tRe").onclick=loadTeam;
 box.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{TEAM.sel=b.dataset.open;drawTeam();$("detailBox")?.scrollIntoView({behavior:"smooth"})});
 const msg=t=>{TEAM.msg=t;const m=$("roleMsg");if(m)m.textContent=t};
 box.querySelectorAll("[data-role]").forEach(s=>s.onchange=async()=>{const p=TEAM.profiles.find(x=>x.id===s.dataset.role);try{await BE.setRole(p.id,s.value,s.value==="intern"?p.mentor_id:null);p.role=s.value;msg(`Роль «${ROLES[s.value]}» сохранена для ${p.full_name||p.email}.`);drawTeam()}catch(e){msg("Не удалось сохранить: "+errText(e));s.value=p.role}});
 box.querySelectorAll("[data-mentor]").forEach(s=>s.onchange=async()=>{const p=TEAM.profiles.find(x=>x.id===s.dataset.mentor);try{await BE.setRole(p.id,"intern",s.value||null);p.mentor_id=s.value||null;msg("Наставник назначен.");drawTeam()}catch(e){msg("Не удалось сохранить: "+errText(e))}})}
function chipRes(st,id,label){const r=st.res[id];if(!r)return `<span class="chip plain" title="не пройден">${label}</span>`;return `<span class="chip ${r.best/r.total>=PASS?"ok":"bad"}" title="лучший ${r.best}/${r.total}, попыток ${r.tries}">${label}: ${Math.round(r.best/r.total*100)}%</span>`}
function detail(p){const pr=TEAM.progress[p.id],s=summarize(pr&&pr.state),st=s.st;
 const row=(id,title,tasks)=>{const r=st.res[id];const seen=(st.seen[id]||[]).length;return `<tr><td><b>${title}</b></td>${tasks?`<td class="mono">${seen}/${stepList(id).length}</td><td class="mono">${(st.tasks[id]||[]).filter(Boolean).length}/${DAYS[id].tasks.length}</td>`:`<td>—</td><td>—</td>`}<td class="mono">${r?`${r.best}/${r.total} (последний ${r.last})`:"—"}</td><td class="mono">${r?r.tries:0}</td><td class="small">${r&&r.wrong&&r.wrong.length?`<details><summary>${r.wrong.length} ошибок в последней попытке</summary><ul>${li(r.wrong.map(esc))}</ul></details>`:r?"без ошибок":"—"}</td></tr>`};
 return `<div class="panel" id="detailBox"><div class="row" style="justify-content:space-between"><h2>${esc(p.full_name||p.email)}</h2><button class="sm" id="dClose">Закрыть</button></div><p class="small muted">${esc(p.email)} · последняя активность: ${dt(pr&&pr.updated_at)}</p>
 <div class="tbl-wrap"><table><thead><tr><th>Этап</th><th>Шаги</th><th>Практика</th><th>Лучший результат</th><th>Попыток</th><th>Ошибки</th></tr></thead><tbody>${DAY_IDS.map(id=>row(id,`День ${DAYS[id].n}. ${DAYS[id].title}`,true)).join("")}${EXAM_IDS.map((id,i)=>row(id,`Тест ${i+1}. ${EXAMS[id][0]}`,false)).join("")}</tbody></table></div></div>`}
document.addEventListener("click",e=>{if(e.target&&e.target.id==="dClose"){TEAM.sel=null;drawTeam()}});

/* ================= Старт ================= */
window.addEventListener("hashchange",()=>{if(App.user&&canLearn())render()});
BE.onAuth((ev)=>{if(ev==="PASSWORD_RECOVERY"){App.recovery=true;showAuth("newpw")}});
boot();
})();
