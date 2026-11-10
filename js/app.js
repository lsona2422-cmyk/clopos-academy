/* Clopos Retention Academy — приложение: вход, роли, курс, тесты, кабинет наставника. Тексты — t() из i18n.js. */
(function(){
"use strict";
const CFG=window.ACADEMY_CONFIG||{};
const ADMIN_EMAIL=String(CFG.adminEmail||"lsona2422@gmail.com").toLowerCase();
const ROLE_KEYS=["intern","mentor","admin","blocked"];
const isOwnerEmail=e=>String(e||"").toLowerCase()===ADMIN_EMAIL;
const roleName=r=>t("role_"+r);
const TOUR_MAP=Object.fromEntries((window.TOURS||[]).map(x=>[x.id,x]));
const PASS=0.8;

/* ================= Хранилище браузера ================= */
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
  async setRole(uid,role,mentor){ok(await sb.rpc("admin_set_role",{target:uid,new_role:role,new_mentor:mentor||null}))},
  async setName(uid,name){ok(await sb.rpc("admin_set_name",{target:uid,new_name:name}))},
  async resetProgress(uid,stage){ok(await sb.rpc("admin_reset_progress",{target:uid,stage:stage||null}))},
  async deleteUser(uid){ok(await sb.rpc("admin_delete_user",{target:uid}))},
  async adminSetPassword(uid,pw){ok(await sb.rpc("admin_set_password",{target:uid,new_password:pw}))},
  async confirmEmail(uid){ok(await sb.rpc("admin_confirm_email",{target:uid}))},
  async userStatus(){return ok(await sb.rpc("admin_user_status"))||[]}
 };
}
function LocalBackend(){
 const K="clopos-academy-demo";
 let mem=LS.get(K)||{users:{},progress:{},session:null};
 Object.values(mem.users).forEach(u=>{if(u.role==="pending")u.role="intern";if(isOwnerEmail(u.email))u.role="admin"});
 const put=()=>LS.set(K,mem);
 const me=()=>mem.session&&mem.users[mem.session]?{id:mem.session,email:mem.users[mem.session].email}:null;
 const visible=(uid)=>{const u=mem.users[uid];if(!u)return [];if(u.role==="admin")return Object.keys(mem.users);if(u.role==="mentor")return Object.keys(mem.users).filter(id=>id===uid||mem.users[id].mentor_id===uid);return [uid]};
 const err=m=>new Error(m);
 const adm=()=>{if(mem.users[mem.session]?.role!=="admin")throw err("forbidden")};
 let cbs=[];
 return {mode:"demo",
  async currentUser(){return me()},
  onAuth(cb){cbs.push(cb)},
  async signUp(email,pw,name){email=email.trim().toLowerCase();if(Object.values(mem.users).some(u=>u.email===email))throw err("User already registered");
   const id="u"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
   mem.users[id]={email,pw,full_name:name,role:isOwnerEmail(email)?"admin":"intern",mentor_id:null,created_at:new Date().toISOString()};mem.session=id;put();cbs.forEach(c=>c("SIGNED_IN",me()));return {needsConfirm:false}},
  async signIn(email,pw){email=email.trim().toLowerCase();const id=Object.keys(mem.users).find(k=>mem.users[k].email===email);if(!id||mem.users[id].pw!==pw)throw err("Invalid login credentials");mem.session=id;mem.users[id].last_sign_in=new Date().toISOString();put();cbs.forEach(c=>c("SIGNED_IN",me()))},
  async reset(){throw err("demo")},
  async setPassword(pw){if(mem.session)mem.users[mem.session].pw=pw;put()},
  async signOut(){mem.session=null;put();cbs.forEach(c=>c("SIGNED_OUT",null))},
  async profile(uid){const u=mem.users[uid];return u?{id:uid,email:u.email,full_name:u.full_name,role:u.role,mentor_id:u.mentor_id,created_at:u.created_at}:null},
  async loadProgress(uid){return mem.progress[uid]?mem.progress[uid].state:null},
  async saveProgress(uid,state){mem.progress[uid]={state,updated_at:new Date().toISOString()};put()},
  async listProfiles(){return visible(mem.session).map(id=>({id,email:mem.users[id].email,full_name:mem.users[id].full_name,role:mem.users[id].role,mentor_id:mem.users[id].mentor_id,created_at:mem.users[id].created_at}))},
  async listProgress(){return visible(mem.session).filter(id=>mem.progress[id]).map(id=>({user_id:id,state:mem.progress[id].state,updated_at:mem.progress[id].updated_at}))},
  async setRole(uid,role,mentor){adm();if(isOwnerEmail(mem.users[uid].email))throw err(t("owner_note"));if(uid===mem.session)throw err("forbidden");mem.users[uid].role=role;mem.users[uid].mentor_id=role==="intern"?(mentor||null):null;put()},
  async setName(uid,name){adm();mem.users[uid].full_name=String(name||"").trim().slice(0,120);put()},
  async resetProgress(uid,stage){adm();if(!stage)delete mem.progress[uid];else if(mem.progress[uid]&&mem.progress[uid].state.res)delete mem.progress[uid].state.res[stage];put()},
  async deleteUser(uid){adm();if(isOwnerEmail(mem.users[uid].email))throw err(t("owner_note"));if(uid===mem.session)throw err("forbidden");delete mem.users[uid];delete mem.progress[uid];Object.values(mem.users).forEach(u=>{if(u.mentor_id===uid)u.mentor_id=null});put()},
  async adminSetPassword(uid,pw){adm();if(String(pw).length<6)throw err(t("v_pw6"));if(isOwnerEmail(mem.users[uid].email)&&uid!==mem.session)throw err("forbidden");mem.users[uid].pw=pw;put()},
  async confirmEmail(){adm()},
  async userStatus(){adm();return Object.keys(mem.users).map(id=>({id,confirmed:true,last_sign_in:mem.users[id].last_sign_in||null}))}
 };
}
const useSupa=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase&&window.supabase.createClient);
const BE=useSupa?SupaBackend():LocalBackend();

/* ================= Состояние ================= */
const blank=()=>({step:{},seen:{},tasks:{},res:{},card:{},sims:{},vids:{},last:null});
const App=window.App={user:null,profile:null,state:blank(),recovery:false,
 save(){this.state.last=new Date().toISOString();LS.set("clopos-academy-cache-"+(this.user?this.user.id:"x"),this.state);clearTimeout(this._t);this._t=setTimeout(()=>{if(this.user&&canLearn())BE.saveProgress(this.user.id,this.state).then(()=>setSync(t("saved"))).catch(()=>setSync(t("save_failed"),true))},700)}};
function setSync(s,bad){const el=$("syncState");if(el){el.textContent=s;el.style.color=bad?"var(--bad)":""}}
const role=()=>App.profile?App.profile.role:null;
const isStaff=()=>["mentor","admin"].includes(role());
const canLearn=()=>["intern","mentor","admin"].includes(role());
const passed=(st,id)=>!!(st.res[id]&&st.res[id].best/st.res[id].total>=PASS);
function isOpen(id){if(isStaff())return true;const S=App.state;
 if(id.startsWith("day-")){const n=+id.split("-")[1];return n===1||passed(S,"day-"+(n-1))}
 if(id.startsWith("exam-")||id==="final")return passed(S,"day-6");return true}

/* ================= Переключатель языка ================= */
function langSwitch(){return `<label class="langsw" for="langSel"><span class="sr">${t("lang")}</span><select id="langSel" aria-label="${t("lang")}">${Object.entries(LANGS).map(([k,v])=>`<option value="${k}" ${k===LANG?"selected":""}>${v}</option>`).join("")}</select></label>`}
function bindLang(){const s=$("langSel");if(s)s.onchange=()=>setLang(s.value)}

/* ================= Экран входа ================= */
function authView(mode,msg){
 const demo=BE.mode==="demo";
 const title={login:t("auth_login"),register:t("auth_register"),reset:t("auth_reset"),newpw:t("auth_newpw")}[mode];
 const f=(id,l,ty,ac)=>`<label class="f" for="${id}">${l}<input id="${id}" type="${ty}" autocomplete="${ac}" required></label>`;
 let body="";
 if(mode==="login")body=f("a_email",t("f_email"),"email","email")+f("a_pw",t("f_pw"),"password","current-password")+`<button class="primary" type="submit">${t("btn_login")}</button><div class="row small"><a href="#" data-mode="register">${t("link_to_register")}</a>${demo?"":`<a href="#" data-mode="reset">${t("link_forgot")}</a>`}</div>`;
 if(mode==="register")body=f("a_name",t("f_name"),"text","name")+f("a_email",t("f_email"),"email","email")+f("a_pw",t("f_pw6"),"password","new-password")+f("a_pw2",t("f_pw2"),"password","new-password")+`<button class="primary" type="submit">${t("btn_register")}</button><p class="small muted">${t("reg_hint")}</p><div class="row small"><a href="#" data-mode="login">${t("link_to_login")}</a></div>`;
 if(mode==="reset")body=f("a_email",t("f_email"),"email","email")+`<button class="primary" type="submit">${t("btn_send_link")}</button><p class="small muted">${t("reset_hint")}</p><div class="row small"><a href="#" data-mode="login">${t("link_back_login")}</a></div>`;
 if(mode==="newpw")body=f("a_pw",t("f_newpw"),"password","new-password")+f("a_pw2",t("f_pw2"),"password","new-password")+`<button class="primary" type="submit">${t("btn_save_pw")}</button>${App.recovery?"":`<div class="row small"><a href="#" id="pwCancel">${t("link_cancel")}</a></div>`}`;
 return `<div class="auth"><div class="auth-card"><div class="auth-top"><div class="auth-brand">${LOGO("auth-logo")}<div><b>Retention Academy</b><span>${t("brand_sub_auth")}</span></div></div>${langSwitch()}</div>
 <h1>${title}</h1>${demo?`<div class="note">${t("demo_auth_note")}</div>`:""}
 <form id="authForm" novalidate>${body}<p id="authMsg" class="small" role="status">${msg||""}</p></form></div></div>`}
function bindAuth(mode){
 bindLang();
 document.querySelectorAll("[data-mode]").forEach(a=>a.onclick=e=>{e.preventDefault();showAuth(a.dataset.mode)});
 const pc=$("pwCancel");if(pc)pc.onclick=e=>{e.preventDefault();boot()};
 $("authForm").onsubmit=async e=>{e.preventDefault();const m=$("authMsg");const btn=e.target.querySelector("button[type=submit]");m.style.color="";
  const v=id=>($(id)?$(id).value.trim():"");
  try{btn.disabled=true;
   if(mode==="login"){if(!v("a_email")||!v("a_pw"))throw new Error(t("v_email_pw"));await BE.signIn(v("a_email"),$("a_pw").value)}
   if(mode==="register"){if(!v("a_name"))throw new Error(t("v_name"));if(!/^\S+@\S+\.\S+$/.test(v("a_email")))throw new Error(t("v_email"));if($("a_pw").value.length<6)throw new Error(t("v_pw6"));if($("a_pw").value!==$("a_pw2").value)throw new Error(t("v_pw_match"));
    const r=await BE.signUp(v("a_email"),$("a_pw").value,v("a_name"));if(r.needsConfirm){showAuth("login",t("msg_sent_confirm",esc(v("a_email"))));return}}
   if(mode==="reset"){await BE.reset(v("a_email"));m.textContent=t("msg_reset_sent");btn.disabled=false;return}
   if(mode==="newpw"){if($("a_pw").value.length<6)throw new Error(t("v_pw6"));if($("a_pw").value!==$("a_pw2").value)throw new Error(t("v_pw_match"));await BE.setPassword($("a_pw").value);App.recovery=false;await boot();return}
   await boot()
  }catch(ex){m.style.color="var(--bad)";m.textContent=errText(ex);btn.disabled=false}}}
function errText(ex){const s=String(ex&&ex.message||ex);
 if(/Invalid login/i.test(s))return t("e_invalid");if(/Email not confirmed/i.test(s))return t("e_unconfirmed");if(/already registered/i.test(s))return t("e_exists");if(/email rate limit|over_email_send_rate_limit/i.test(s))return t("e_email_rate");if(/rate limit/i.test(s))return t("e_rate");if(/Failed to fetch|NetworkError/i.test(s))return t("e_network");return s}
function showAuth(mode,msg){document.body.classList.add("auth-mode");$("app").innerHTML=authView(mode,msg);bindAuth(mode)}

/* ================= Загрузка ================= */
async function boot(){
 if(App.recovery){showAuth("newpw");return}
 App.user=await BE.currentUser();
 if(!App.user){showAuth("login");return}
 try{App.profile=await BE.profile(App.user.id)}catch(e){App.profile=null}
 if(!App.profile){showGate(t("gate_profile_t"),t("gate_profile_m"));return}
 if(role()==="pending"){showGate(t("gate_pending_t"),t("gate_pending_m"));return}
 if(role()==="blocked"){showGate(t("gate_blocked_t"),t("gate_blocked_m"));return}
 const cached=LS.get("clopos-academy-cache-"+App.user.id);
 let remote=null;try{remote=await BE.loadProgress(App.user.id)}catch(e){}
 App.state=Object.assign(blank(),remote||(BE.mode==="demo"?cached:null)||{});
 document.body.classList.remove("auth-mode");shell();render()}
function showGate(ti,m){document.body.classList.add("auth-mode");$("app").innerHTML=`<div class="auth"><div class="auth-card"><div class="auth-top"><div class="auth-brand">${LOGO("auth-logo")}<div><b>Retention Academy</b><span>${esc(App.profile?App.profile.full_name||App.user.email:"")}</span></div></div>${langSwitch()}</div><h1>${ti}</h1><p>${m}</p><div class="row"><button class="primary" id="gRe">${t("btn_refresh")}</button><button id="gOut">${t("btn_logout")}</button></div></div></div>`;
 bindLang();$("gRe").onclick=()=>boot();$("gOut").onclick=async()=>{await BE.signOut();boot()}}

/* ================= Каркас ================= */
const teamLabel=()=>role()==="admin"?t("nav_team_admin"):t("nav_team_mentor");
function shell(){
 $("app").innerHTML=`<header class="top"><a class="brand" href="#start">${LOGO("brand-mark",true)}<span>Retention Academy<small>${t("brand_sub")}</small></span></a><span class="spacer"></span>
 <a href="#modules" class="toplink">${t("nav_modules")}</a>${isStaff()?`<a href="#team" class="toplink">${teamLabel()}</a>`:""}
 <div class="progress-pill" title="${t("progress_title")}"><span id="progTxt">0 / 9</span><span class="bar"><i id="progBar"></i></span></div>
 ${langSwitch()}<div class="who"><span class="who-name">${esc(App.profile.full_name||App.user.email)}</span><span class="chip ${role()==="intern"?"info":"ok"}">${roleName(role())}</span><button id="chpw" class="sm">${t("btn_change_pw")}</button><button id="logout" class="sm">${t("btn_logout")}</button></div></header>
 ${BE.mode==="demo"?`<div class="demo-bar">${t("demo_bar")}</div>`:""}
 <div class="shell"><nav class="side" id="sideNav" aria-label="${t("nav_program")}"></nav><main><div class="navsel"><label class="f" for="navSelect">${t("nav_section")}<select id="navSelect"></select></label></div><div id="views"></div></main></div>`;
 bindLang();
 $("chpw").onclick=()=>showAuth("newpw");
 $("logout").onclick=async()=>{await BE.signOut();App.user=null;App.profile=null;location.hash="";boot()};
 $("navSelect").onchange=e=>location.hash=e.target.value}

const ROUTES=()=>["start",...DAY_IDS,"final",...EXAM_IDS,"modules","glossary",...(isStaff()?["team"]:[])];
function route(){const h=location.hash.slice(1);return ROUTES().includes(h)?h:"start"}
function renderNav(){const cur=route(),S=App.state;const ac=id=>cur===id?'aria-current="page"':"";
 const dl=id=>{const d=DAYS[id],o=isOpen(id),p=passed(S,id);return `<a href="#${id}" class="${o?"":"locked"}" ${ac(id)}><span class="dn ${p?"done":cur===id?"cur":""}">${p?"✓":o?d.n:"🔒"}</span><span>${d.title}</span></a>`};
 $("sideNav").innerHTML=`<div class="grp">${t("grp_start")}</div><a href="#start" ${ac("start")}>${t("nav_program")}</a>${isStaff()?`<a href="#team" ${ac("team")}>${teamLabel()}</a>`:""}<div class="grp">${t("grp_learning")}</div>${DAY_IDS.map(dl).join("")}<div class="grp">${t("grp_final")}</div><a href="#final" class="${isOpen("final")?"":"locked"}" ${ac("final")}>${t("nav_final_overview")}</a>${EXAM_IDS.map((id,i)=>{const r=S.res[id];return `<a href="#${id}" class="${isOpen(id)?"":"locked"}" ${ac(id)}>${t("test_n",i+1)} · ${EXAMS[id][0]}${r?`<span class="st">${r.best}/${r.total}</span>`:""}</a>`}).join("")}<div class="grp">${t("grp_ref")}</div><a href="#modules" ${ac("modules")}>${t("nav_modules")} (${MODS.length+OTHER.length+APPS.length})</a><a href="#glossary" ${ac("glossary")}>${t("nav_glossary")}</a>`;
 const label=id=>id==="start"?t("nav_program"):id==="team"?t("opt_team"):DAYS[id]?t("opt_day",DAYS[id].n,DAYS[id].title)+(isOpen(id)?"":" 🔒"):id==="final"?t("opt_final"):EXAMS[id]?t("opt_test",EXAM_IDS.indexOf(id)+1,EXAMS[id][0]):id==="glossary"?t("nav_glossary"):t("nav_modules");
 $("navSelect").innerHTML=ROUTES().map(id=>`<option value="${id}" ${id===cur?"selected":""}>${label(id)}</option>`).join("");
 const all=[...DAY_IDS,...EXAM_IDS],done=all.filter(id=>passed(S,id)).length;$("progTxt").textContent=`${done} / ${all.length}`;$("progBar").style.width=(done/all.length*100)+"%"}

function render(){if(!App.user||!canLearn())return;const id=route(),v=$("views");let html;
 if(id==="start")html=viewStart();else if(DAYS[id])html=viewDay(id);else if(id==="final")html=viewFinal();else if(EXAMS[id])html=viewExam(id);else if(id==="glossary")html=viewGloss();else if(id==="team")html=`<div id="teamBox"><p class="muted">${t("team_loading")}</p></div>`;else html=viewMods();
 v.innerHTML=`<section class="view">${html}<footer class="foot">${t("footer")} <span id="syncState"></span></footer></section>`;
 if(DAYS[id]&&isOpen(id)){document.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{App.state.step[id]=+b.dataset.step;App.save();drawStep(id)});drawStep(id)}
 if(EXAMS[id]&&isOpen(id))startQuiz(id,$("quizBox"),()=>`<a href="#final">${t("to_tests")}</a>`);
 if(id==="glossary")bindGloss();if(id==="modules")bindMods();if(id==="team")loadTeam();
 renderNav();window.scrollTo(0,0)}

/* ================= Экраны курса ================= */
function viewStart(){const S=App.state;
 return `<div class="hero"><div class="prose"><span class="eyebrow">${t("start_eyebrow")}</span><h1>${t("start_title")}</h1><p class="lead">${t("start_lead")}</p></div>${LOGO_OUT}</div>
 <div class="days">${DAY_IDS.map(id=>{const d=DAYS[id],o=isOpen(id),r=S.res[id];return `<a class="dcard ${o?"":"locked"}" href="#${id}"><span class="num">${d.n}<small>${t("day_word")}</small></span><span><h3>${d.title}</h3><p>${d.goal}</p></span>${passed(S,id)?`<span class="chip ok">✓ ${r.best}/${r.total}</span>`:o?`<span class="chip info">${t("chip_open")}</span>`:`<span class="chip plain">${t("chip_after_day",d.n-1)}</span>`}</a>`}).join("")}
 <a class="dcard ${isOpen("final")?"":"locked"}" href="#final"><span class="num">★<small>${t("final_word")}</small></span><span><h3>${t("final_card_title")}</h3><p>${t("final_card_text")}</p></span>${isOpen("final")?`<span class="chip info">${t("chip_exams_done",EXAM_IDS.filter(x=>passed(S,x)).length)}</span>`:`<span class="chip plain">${t("chip_after_day6")}</span>`}</a></div>
 ${isStaff()?`<div class="note info">${t("staff_note",roleName(role()),`<a href="#team">«${teamLabel()}»</a>`)}</div>`:""}`}
function lockedView(msg,back){return `<div class="panel" style="align-items:flex-start"><span class="chip plain">${t("locked_chip")}</span><h2>${msg}</h2><p class="muted">${t("locked_text")}</p><a href="#${back}">${t("back")}</a></div>`}
function viewDay(id){const d=DAYS[id];if(!isOpen(id))return lockedView(t("locked_day",d.n,d.n-1),"day-"+(d.n-1));
 const steps=stepList(id);
 return `<div class="prose"><span class="eyebrow">${t("day_of",d.n)}</span><h1>${d.title}</h1><p class="lead">${d.goal}</p></div>
 <div class="steps">${steps.map((s,i)=>`<button data-step="${i}">${s.icon} <span>${s.t}</span></button>`).join("")}</div><div id="stepBox"></div>`}
function stepList(id){const d=DAYS[id];const a=d.lessons.map((l,i)=>({k:"l",i,t:l.t,icon:(i+1)+"."}));if(d.tours.length)a.push({k:"m",t:t("step_media"),icon:"▶"});a.push({k:"p",t:t("step_practice"),icon:"✎"});a.push({k:"q",t:t("step_check"),icon:"✓"});return a}
function drawStep(id){const d=DAYS[id],S=App.state,box=$("stepBox");const steps=stepList(id),n=steps.length;let st=Math.min(S.step[id]||0,n-1);
 S.seen[id]=S.seen[id]||[];if(!S.seen[id].includes(st)){S.seen[id].push(st);App.save()}
 document.querySelectorAll("[data-step]").forEach(b=>{const i=+b.dataset.step;b.classList.toggle("cur",i===st);b.classList.toggle("seen",S.seen[id].includes(i)&&i!==st)});
 const cur=steps[st];const nav=`<div class="stepnav"><button id="prevS" ${st===0?"disabled":""}>${t("btn_prev")}</button>${st<n-1?`<button class="primary" id="nextS">${steps[st+1].k==="q"?t("btn_to_check"):t("btn_next")}</button>`:""}</div>`;
 const head=`<span class="eyebrow">${t("step_of",st+1,n)}</span><h2>${cur.t}</h2>`;
 if(cur.k==="l"){const L=d.lessons[cur.i];const M=(d.more||[])[cur.i];box.innerHTML=`<article class="lesson">${head}<div class="body ${L.b?"wide":""}">${L.h()}${M?`<div class="more">${M}</div>`:""}</div>${nav}</article>`;if(L.b)L.b()}
 else if(cur.k==="m"){const note=t("media_lang_note");box.innerHTML=`<article class="lesson">${head}<p class="muted small">${t("media_hint")}</p>${note?`<div class="note info">${note}</div>`:""}<div class="media-list">${d.tours.map(tid=>mediaCard(tid)).join("")}</div>${nav}</article>`;bindMedia(d.tours)}
 else if(cur.k==="p"){S.tasks[id]=S.tasks[id]||[];box.innerHTML=`<article class="lesson">${head}<p class="small muted">${t("practice_hint")}</p><div>${d.tasks.map((x,i)=>`<div class="task"><input type="checkbox" id="t_${id}_${i}" ${S.tasks[id][i]?"checked":""}><div class="tb"><label for="t_${id}_${i}"><b>${t("task_n",i+1)}</b> ${x[0]}</label>${x[1]?`<details><summary>${t("self_check")}</summary><div>${x[1]}</div></details>`:`<span class="small muted">${t("discuss_mentor")}</span>`}</div></div>`).join("")}</div>${nav}</article>`;
  d.tasks.forEach((_,i)=>$(`t_${id}_${i}`).onchange=e=>{S.tasks[id][i]=e.target.checked;App.save()})}
 else{const r=S.res[id];box.innerHTML=`<article class="lesson">${head}<p class="small muted">${t("check_info",QD[id].length)} ${r?t("best_result",r.best,r.total):""}</p><div id="quizBox"></div>${nav}</article>`;
  startQuiz(id,$("quizBox"),ok=>ok?`<a href="#${d.n<6?"day-"+(d.n+1):"final"}">${d.n<6?t("go_day",d.n+1):t("go_final")} →</a>`:"")}
 $("prevS").onclick=()=>{S.step[id]=st-1;App.save();drawStep(id);toTop()};const nx=$("nextS");if(nx)nx.onclick=()=>{S.step[id]=st+1;App.save();drawStep(id);toTop()}}
function toTop(){window.scrollTo({top:0,behavior:"smooth"})}

/* ================= Видео и тренажёры ================= */
function mediaCard(tid){const x=TOUR_MAP[tid];if(!x)return "";const S=App.state;
 return `<div class="media"><div class="media-head"><h3>${x.title}</h3><span class="row" style="gap:6px">${S.vids[tid]?`<span class="chip ok">${t("chip_video_done")}</span>`:""}${S.sims[tid]?`<span class="chip ok">${t("chip_sim_done")}</span>`:""}</span></div>
 <div class="grid2"><div><span class="eyebrow">${t("video")}</span><video id="v_${tid}" controls preload="none" playsinline poster="media/${tid}-poster.jpg"><source src="media/${tid}.mp4" type="video/mp4"></video></div>
 <div><span class="eyebrow">${t("simulator")}</span><div class="sim" id="s_${tid}"></div></div></div></div>`}
function bindMedia(list){list.forEach(tid=>{const v=$("v_"+tid);if(v)v.addEventListener("ended",()=>{App.state.vids[tid]=true;App.save()});sim(tid,0,0)})}
function sim(tid,step,miss){const x=TOUR_MAP[tid],box=$("s_"+tid);if(!x||!box)return;
 if(step>=x.steps.length){App.state.sims[tid]=true;App.save();box.innerHTML=`<div class="sim-frame"><img src="media/${x.endImg}" alt="${esc(t("alt_result",x.title))}"></div><p class="sim-text ok">✓ ${x.end}</p><button class="sm" id="sr_${tid}">${t("sim_again")}</button>`;$("sr_"+tid).onclick=()=>sim(tid,0,0);return}
 const s=x.steps[step],[bx,by,bw,bh]=s.box,W=1440,H=900;
 box.innerHTML=`<p class="sim-text">${t("sim_step",step+1,x.steps.length)} ${s.text}</p><div class="sim-frame" id="sf_${tid}"><img src="media/${s.img}" alt="${esc(t("alt_screen",step+1))}"><span class="hot ${miss>=2?"show":""}" style="left:${(bx-8)/W*100}%;top:${(by-8)/H*100}%;width:${(bw+16)/W*100}%;height:${(bh+16)/H*100}%"></span></div><p class="small muted" id="sm_${tid}">${miss>=2?t("sim_hint2"):miss?t("sim_miss"):t("sim_tap")}</p>`;
 $("sf_"+tid).onclick=e=>{const r=e.currentTarget.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W,py=(e.clientY-r.top)/r.height*H;const pad=14;
  if(px>=bx-pad&&px<=bx+bw+pad&&py>=by-pad&&py<=by+bh+pad)sim(tid,step+1,0);else sim(tid,step,miss+1)}}

/* ================= Тесты ================= */
let run=null;window.__quiz=()=>run;
function startQuiz(id,box,onDone){const qs=QD[id].map((q,i)=>{if(!Array.isArray(q))return{i,o:null};const o=[0,1,2,3];for(let k=3;k>0;k--){const r=Math.floor(Math.random()*(k+1));[o[k],o[r]]=[o[r],o[k]]}return{i,o}});
 run={id,box,onDone,pos:0,ans:[],qs};drawQ()}
function drawQ(){const {id,box}=run,Q=QD[id],cur=run.qs[run.pos],q=Q[cur.i],a=run.ans[run.pos];
 const bar=Q.map((_,k)=>`<i class="${k<run.ans.length?(run.ans[k].ok?"r":"w"):(k===run.pos?"c":"")}"></i>`).join("");let body;
 if(Array.isArray(q)){body=`<p class="qt">${q[0]}</p><div class="opts">${cur.o.map((j,k)=>{let c="";if(a){if(j===0)c="right";else if(j===a.pick)c="wrong"}return `<button class="opt ${c}" data-pick="${j}" ${a?"disabled":""}><span class="k">${"ABCD"[k]}</span><span>${q[1][j]}</span></button>`}).join("")}</div>${a?`<div class="expl"><b>${a.ok?t("correct"):t("wrong")}</b> ${q[2]}</div>`:""}`}
 else{body=`<p class="qt">${q.q}</p><form class="numans" id="numForm"><input id="numIn" inputmode="decimal" autocomplete="off" placeholder="${t("num_ph")}" ${a?"disabled":""} value="${a?esc(a.raw):""}" aria-label="${t("your_answer")}"><span class="mono muted">${q.unit||""}</span>${a?"":`<button class="primary" type="submit">${t("answer")}</button>`}</form>${a?`<div class="expl"><b>${a.ok?t("correct"):t("wrong_num",numTxt(q.num)+" "+(q.unit||""))}</b> ${q.e}</div>`:""}`}
 box.innerHTML=`<div class="q"><div class="row" style="justify-content:space-between"><span class="qn">${t("q_n",run.pos+1,Q.length)}</span><div class="qbar" aria-hidden="true">${bar}</div></div>${body}${a?`<div class="row"><button class="primary" id="nextQ">${run.pos+1<Q.length?t("next_q"):t("show_result")}</button></div>`:""}</div>`;
 box.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{const p=+b.dataset.pick;run.ans[run.pos]={pick:p,ok:p===0};drawQ();box.querySelector("#nextQ")?.focus({preventScroll:true})});
 const f=box.querySelector("#numForm");if(f&&!a)f.onsubmit=e=>{e.preventDefault();const raw=$("numIn").value.trim();if(!raw)return;const v=parseFloat(raw.replace(/[\s ]/g,"").replace(",","."));run.ans[run.pos]={raw,ok:isFinite(v)&&Math.abs(v-q.num)<=(q.tol||0)+1e-9};drawQ();box.querySelector("#nextQ")?.focus({preventScroll:true})};
 const nx=box.querySelector("#nextQ");if(nx)nx.onclick=()=>{if(run.pos+1<Q.length){run.pos++;drawQ();box.scrollIntoView({block:"start",behavior:"smooth"})}else finishQuiz()}}
function finishQuiz(){const {id,box,onDone}=run,Q=QD[id],S=App.state;const score=run.ans.filter(a=>a.ok).length,total=Q.length,ok=score/total>=PASS;
 const wrong=run.qs.map((o,k)=>run.ans[k].ok?null:(Array.isArray(Q[o.i])?Q[o.i][0]:Q[o.i].q)).filter(Boolean);
 const prev=S.res[id];S.res[id]={best:Math.max(score,prev?prev.best:0),last:score,total,tries:(prev?prev.tries:0)+1,date:new Date().toISOString(),wrong};App.save();renderNav();
 const title=EXAMS[id]?EXAMS[id][0]:t("check_day_title",DAYS[id].n),d=new Date();
 box.innerHTML=`<div class="grid2" style="align-items:start"><div class="receipt" role="status"><div class="c big">CLOPOS ACADEMY</div><div class="c">${t("receipt_dept")}</div><hr><div class="ln"><span>${t("r_employee")}</span><span>${esc(App.profile.full_name||"")}</span></div><div class="ln"><span>${t("r_date")}</span><span>${d.toLocaleDateString(LOCALE)} ${d.toLocaleTimeString(LOCALE,{hour:"2-digit",minute:"2-digit"})}</span></div><div class="ln"><span>${t("r_test")}</span><span>${esc(title)}</span></div><hr>
 <div class="ln big"><span>${t("r_total")}</span><span>${score} / ${total}</span></div><div class="ln"><span>${t("r_result")}</span><span>${Math.round(score/total*100)}%</span></div><div class="ln"><span>${t("r_status")}</span><span class="${ok?"pass":"fail"}">${ok?t("r_pass"):t("r_fail")}</span></div><hr><div class="c">${t("r_visible")}</div></div>
 <div class="panel"><h3>${ok?t("q_passed"):t("q_need80")}</h3>${wrong.length?`<p class="small muted">${t("q_errors",wrong.length)}</p>`:""}${run.qs.map((o,k)=>{if(run.ans[k].ok)return"";const q=Q[o.i];return `<p class="small"><b>${Array.isArray(q)?q[0]:q.q}</b><br><span style="color:var(--ok)">${t("q_right",Array.isArray(q)?q[1][0]:numTxt(q.num)+" "+(q.unit||""))}</span></p>`}).join("")}
 <div class="row"><button id="retry">${t("retry")}</button>${onDone(ok)}</div></div></div>`;$("retry").onclick=()=>startQuiz(id,box,onDone)}
function viewFinal(){if(!isOpen("final"))return lockedView(t("locked_final"),"day-6");const S=App.state;
 return `<div class="prose"><span class="eyebrow">${t("final_eyebrow")}</span><h1>${t("final_title")}</h1><p class="lead">${t("final_lead")}</p></div>
 <div class="grid3">${EXAM_IDS.map((id,i)=>{const r=S.res[id];return `<a class="dcard" style="grid-template-columns:1fr" href="#${id}"><span><span class="eyebrow">${t("test_card",i+1,QD[id].length)}</span><h3 style="margin-top:4px">${EXAMS[id][0]}</h3><p>${EXAMS[id][1]}</p><p style="margin-top:8px">${r?`<span class="chip ${passed(S,id)?"ok":"bad"}">${t("best",r.best,r.total)}</span>`:`<span class="chip plain">${t("not_passed")}</span>`}</p></span></a>`}).join("")}</div>`}
function viewExam(id){if(!isOpen(id))return lockedView(t("locked_exams"),"day-6");
 return `<div class="prose"><span class="eyebrow">${t("exam_eyebrow",EXAM_IDS.indexOf(id)+1,QD[id].length)}</span><h1>${EXAMS[id][0]}</h1><p class="lead">${EXAMS[id][1]}.</p></div><div id="quizBox"></div>`}
function viewGloss(){return `<div class="prose"><span class="eyebrow">${t("ref")}</span><h1>${t("gloss_title")}</h1></div><input class="search" id="glq" placeholder="${t("gloss_ph")}" autocomplete="off" aria-label="${t("gloss_aria")}"><div class="gl" id="glList"></div>`}
function bindGloss(){const draw=q=>{q=(q||"").toLowerCase().trim();const r=GLOSSARY.filter(g=>!q||(g[0]+" "+g[1]).toLowerCase().includes(q));$("glList").innerHTML=r.length?r.map(g=>`<div class="t"><b>${g[0]}</b><span>${g[1]}</span></div>`).join(""):`<p class="muted">${t("nothing_found")}</p>`};$("glq").oninput=e=>draw(e.target.value);draw("")}
function viewMods(){const paid=MODS.filter(m=>m[2]).length;
 return `<div class="prose"><span class="eyebrow">${t("ref")}</span><h1>${t("mods_title")}</h1><p class="lead">${t("mods_lead",P("Модули → Все"))}</p></div>
 <div class="kpis"><div class="kpi"><span class="v">${MODS.length}</span><span class="l">${t("k_uz")}</span></div><div class="kpi"><span class="v">${paid}</span><span class="l">${t("k_paid")}</span></div><div class="kpi"><span class="v">${MODS.length-paid}</span><span class="l">${t("k_free")}</span></div><div class="kpi"><span class="v">${OTHER.length}</span><span class="l">${t("k_other")}</span></div></div>
 <h2>${t("h_uz")}</h2>${modTable()}<h2>${t("h_apps")}</h2>${tbl([t("th_app"),t("th_known")],APPS)}<h2>${t("h_other")}</h2><p class="small muted">${t("other_note")}</p>${tbl([t("th_integration"),t("th_what")],OTHER)}`}

/* ================= Команда: администратор и наставник ================= */
function summarize(st){st=Object.assign(blank(),st||{});const days=DAY_IDS.filter(id=>passed(st,id)).length,ex=EXAM_IDS.filter(id=>passed(st,id)).length;
 const curDay=DAY_IDS.find(id=>!passed(st,id));const tasks=DAY_IDS.reduce((a,id)=>a+(st.tasks[id]||[]).filter(Boolean).length,0),tTotal=DAY_IDS.reduce((a,id)=>a+DAYS[id].tasks.length,0);
 const sims=Object.keys(st.sims||{}).length,vids=Object.keys(st.vids||{}).length;return {st,days,ex,curDay,tasks,tTotal,sims,vids}}
const dt=s=>s?new Date(s).toLocaleString(LOCALE,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
let TEAM={profiles:[],progress:{},status:{},sel:null,msg:""};
async function loadTeam(){const box=$("teamBox");try{const [pr,pg,us]=await Promise.all([BE.listProfiles(),BE.listProgress(),role()==="admin"?BE.userStatus().catch(()=>[]):Promise.resolve([])]);TEAM.profiles=pr||[];TEAM.progress={};(pg||[]).forEach(r=>TEAM.progress[r.user_id]=r);TEAM.status={};(us||[]).forEach(r=>TEAM.status[r.id]=r);drawTeam()}catch(e){box.innerHTML=`<div class="note">${esc(t("team_load_fail",errText(e)))}</div>`}}
function drawTeam(){const box=$("teamBox");if(!box)return;const admin=role()==="admin";const me=App.user.id;
 const mentors=TEAM.profiles.filter(p=>p.role==="mentor"||p.role==="admin");
 const interns=TEAM.profiles.filter(p=>p.role==="intern"&&(admin||p.mentor_id===me));
 const name=p=>esc(p.full_name||p.email);const nT=(window.TOURS||[]).length;
 let html=`<div class="prose"><span class="eyebrow">${admin?t("admin"):t("mentor")}</span><h1>${teamLabel()}</h1><p class="lead">${admin?t("team_admin_lead"):t("team_mentor_lead")}</p></div><div class="row"><button id="tRe" class="sm">${t("btn_reload")}</button></div>`;
 if(admin){const cnt=r=>TEAM.profiles.filter(p=>p.role===r).length;const q=(TEAM.q||"").toLowerCase().trim();
  const list=TEAM.profiles.filter(p=>!q||((p.full_name||"")+" "+p.email).toLowerCase().includes(q));
  html+=`<div class="kpis"><div class="kpi"><span class="v">${TEAM.profiles.length}</span><span class="l">${t("k_users")}</span></div><div class="kpi"><span class="v">${cnt("intern")}</span><span class="l">${t("k_interns")}</span></div><div class="kpi"><span class="v">${cnt("mentor")}</span><span class="l">${t("k_mentors")}</span></div><div class="kpi"><span class="v">${cnt("admin")}</span><span class="l">${t("k_admins")}</span></div><div class="kpi"><span class="v">${cnt("blocked")}</span><span class="l">${t("k_blocked")}</span></div></div>
  <h2>${t("users")}</h2><input class="search" id="uq" placeholder="${t("search_users")}" autocomplete="off" aria-label="${t("search_users")}" value="${esc(TEAM.q||"")}">
  <div class="tbl-wrap"><table><thead><tr><th>${t("th_employee")}</th><th>${t("th_role")}</th><th>${t("th_mentor")}</th><th>${t("th_progress")}</th><th>${t("th_activity")}</th><th>${t("th_reg")}</th><th>${t("th_actions")}</th></tr></thead><tbody>${list.length?list.map(p=>{const own=isOwnerEmail(p.email),self=p.id===me,locked=own||self;const pr=TEAM.progress[p.id];const sm=summarize(pr&&pr.state);
   return `<tr><td><b>${name(p)}</b>${own?` <span class="chip ok">${t("role_owner")}</span>`:""}${self?` <span class="small muted">(${t("you")})</span>`:""}<br><span class="small muted">${esc(p.email)}</span>${TEAM.status[p.id]&&!TEAM.status[p.id].confirmed?`<br><span class="chip warn">${t("unconfirmed")}</span>`:""}</td>
   <td>${locked?`<span class="chip ok">${roleName(p.role)}</span>`:`<select data-role="${p.id}" aria-label="${t("th_role")}: ${name(p)}">${ROLE_KEYS.map(k=>`<option value="${k}" ${p.role===k?"selected":""}>${roleName(k)}</option>`).join("")}</select>`}</td>
   <td>${p.role==="intern"?`<select data-mentor="${p.id}" aria-label="${t("th_mentor")}: ${name(p)}"><option value="">${t("mentor_none")}</option>${mentors.map(m=>`<option value="${m.id}" ${p.mentor_id===m.id?"selected":""}>${name(m)}</option>`).join("")}</select>`:"—"}</td>
   <td style="white-space:nowrap"><span class="mono">${sm.days}/6 · T${sm.ex}/3</span><div class="minibar"><i style="width:${sm.days/6*100}%"></i></div></td><td class="small">${dt(pr&&pr.updated_at)}</td><td class="small">${dt(p.created_at)}${TEAM.status[p.id]&&TEAM.status[p.id].last_sign_in?`<br><span class="muted">${t("last_login",dt(TEAM.status[p.id].last_sign_in))}</span>`:""}</td>
   <td><div class="row" style="gap:6px;min-width:150px"><button class="sm" data-open="${p.id}">${t("btn_details")}</button><button class="sm" data-rename="${p.id}">${t("act_rename")}</button>${own&&!self?"":`<button class="sm" data-pw="${p.id}">${t("act_password")}</button>`}${TEAM.status[p.id]&&!TEAM.status[p.id].confirmed?`<button class="sm" data-confirm="${p.id}">${t("act_confirm")}</button>`:""}${pr?`<button class="sm" data-reset="${p.id}">${t("act_reset")}</button>`:""}${locked?"":`<button class="sm danger" data-del="${p.id}">${t("act_delete")}</button>`}</div></td></tr>`}).join(""):`<tr><td colspan="7" class="muted">${t("no_users_found")}</td></tr>`}</tbody></table></div><p class="small muted">${t("owner_note")}</p><p id="roleMsg" class="small" role="status">${esc(TEAM.msg)}</p>`}
 html+=`<h2>${t("progress_h")}</h2>`;
 if(!interns.length)html+=`<p class="muted">${admin?t("no_interns_admin"):t("no_interns_mentor")}</p>`;
 else html+=`<div class="tbl-wrap"><table><thead><tr><th>${t("th_intern")}</th><th>${t("th_days")}</th><th>${t("th_day_checks")}</th><th>${t("th_exams")}</th><th>${t("th_practice")}</th><th>${t("th_media")}</th><th>${t("th_activity")}</th><th></th></tr></thead><tbody>${interns.map(p=>{const pr=TEAM.progress[p.id];const s=summarize(pr&&pr.state);
  return `<tr><td><b>${name(p)}</b><br><span class="small muted">${s.curDay?t("now_day",DAYS[s.curDay].n):t("all_days_done")}</span></td><td><span class="mono">${s.days}/6</span><div class="minibar"><i style="width:${s.days/6*100}%"></i></div></td>
  <td>${DAY_IDS.map(id=>chipRes(s.st,id,DAYS[id].n)).join("")}</td><td>${EXAM_IDS.map((id,i)=>chipRes(s.st,id,"T"+(i+1))).join("")}</td><td class="mono">${s.tasks}/${s.tTotal}</td><td class="mono">${s.vids}/${nT} · ${s.sims}/${nT}</td><td class="small">${dt(pr&&pr.updated_at)}</td><td><button class="sm" data-open="${p.id}">${t("btn_details")}</button></td></tr>`}).join("")}</tbody></table></div>`;
 if(TEAM.sel){const p=TEAM.profiles.find(x=>x.id===TEAM.sel);if(p)html+=detail(p,admin)}
 box.innerHTML=html;$("tRe").onclick=loadTeam;
 const uq=$("uq");if(uq)uq.oninput=()=>{TEAM.q=uq.value;const pos=uq.selectionStart;drawTeam();const n=$("uq");n.focus();n.setSelectionRange(pos,pos)};
 box.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{TEAM.sel=b.dataset.open;drawTeam();$("detailBox")?.scrollIntoView({behavior:"smooth"})});
 const msg=(s,bad)=>{TEAM.msg=s;const m=$("roleMsg");if(m){m.textContent=s;m.style.color=bad?"var(--bad)":""}};
 const P_=id=>TEAM.profiles.find(x=>x.id===id);
 const act=async(fn,okMsg)=>{try{await fn();TEAM.msg=okMsg;await loadTeam()}catch(e){msg(t("save_fail",errText(e)),true)}};
 box.querySelectorAll("[data-role]").forEach(s=>s.onchange=async()=>{const p=P_(s.dataset.role);try{await BE.setRole(p.id,s.value,s.value==="intern"?p.mentor_id:null);p.role=s.value;if(s.value!=="intern")p.mentor_id=null;TEAM.msg=t("role_saved",roleName(s.value),p.full_name||p.email);drawTeam()}catch(e){msg(t("save_fail",errText(e)),true);s.value=p.role}});
 box.querySelectorAll("[data-mentor]").forEach(s=>s.onchange=async()=>{const p=P_(s.dataset.mentor);try{await BE.setRole(p.id,"intern",s.value||null);p.mentor_id=s.value||null;TEAM.msg=t("mentor_set");drawTeam()}catch(e){msg(t("save_fail",errText(e)),true)}});
 box.querySelectorAll("[data-rename]").forEach(b=>b.onclick=()=>{const p=P_(b.dataset.rename);const v=prompt(t("prompt_name",p.full_name||p.email),p.full_name||"");if(v===null||!v.trim())return;act(()=>BE.setName(p.id,v.trim()),t("done_renamed")).then(()=>{if(p.id===me){App.profile.full_name=v.trim();const w=document.querySelector(".who-name");if(w)w.textContent=v.trim()}})});
 box.querySelectorAll("[data-reset]").forEach(b=>b.onclick=()=>{const p=P_(b.dataset.reset);if(!confirm(t("confirm_reset",p.full_name||p.email)))return;act(()=>BE.resetProgress(p.id,null),t("done_reset",p.full_name||p.email)).then(()=>{if(p.id===me){App.state=blank();LS.set("clopos-academy-cache-"+me,null);renderNav()}})});
 box.querySelectorAll("[data-reset-stage]").forEach(b=>b.onclick=()=>{const p=P_(TEAM.sel),st=b.dataset.resetStage;const lbl=EXAMS[st]?EXAMS[st][0]:t("check_day_title",DAYS[st].n);if(!confirm(t("confirm_reset_stage",lbl,p.full_name||p.email)))return;act(()=>BE.resetProgress(p.id,st),t("done_reset",(p.full_name||p.email)+" · "+lbl)).then(()=>{if(p.id===me){delete App.state.res[st];renderNav()}})});
 box.querySelectorAll("[data-pw]").forEach(b=>b.onclick=()=>{const p=P_(b.dataset.pw);const v=prompt(t("prompt_pw",p.full_name||p.email),"");if(v===null)return;if(v.length<6){msg(t("v_pw6"),true);return}act(()=>BE.adminSetPassword(p.id,v),t("done_pw",p.full_name||p.email))});
 box.querySelectorAll("[data-confirm]").forEach(b=>b.onclick=()=>{const p=P_(b.dataset.confirm);act(()=>BE.confirmEmail(p.id),t("done_confirmed",p.full_name||p.email))});
 box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const p=P_(b.dataset.del);if(!confirm(t("confirm_delete",p.full_name||p.email,p.email)))return;if(TEAM.sel===p.id)TEAM.sel=null;act(()=>BE.deleteUser(p.id),t("done_deleted",p.full_name||p.email))})}
function chipRes(st,id,label){const r=st.res[id];if(!r)return `<span class="chip plain" title="${t("chip_not_passed")}">${label}</span>`;return `<span class="chip ${r.best/r.total>=PASS?"ok":"bad"}" title="${t("chip_title",r.best,r.total,r.tries)}">${label}: ${Math.round(r.best/r.total*100)}%</span>`}
function detail(p,admin){const pr=TEAM.progress[p.id],s=summarize(pr&&pr.state),st=s.st;
 const row=(id,title,isDay)=>{const r=st.res[id];const seen=(st.seen[id]||[]).length;return `<tr><td><b>${title}</b></td>${isDay?`<td class="mono">${seen}/${stepList(id).length}</td><td class="mono">${(st.tasks[id]||[]).filter(Boolean).length}/${DAYS[id].tasks.length}</td>`:`<td>—</td><td>—</td>`}<td class="mono">${r?t("best_last",r.best,r.total,r.last):"—"}</td><td class="mono">${r?r.tries:0}${admin&&r?` <button class="sm" data-reset-stage="${id}">${t("act_reset_stage")}</button>`:""}</td><td class="small">${r&&r.wrong&&r.wrong.length?`<details><summary>${t("errors_n",r.wrong.length)}</summary><ul>${li(r.wrong.map(esc))}</ul></details>`:r?t("no_errors"):"—"}</td></tr>`};
 return `<div class="panel" id="detailBox"><div class="row" style="justify-content:space-between"><h2>${esc(p.full_name||p.email)}</h2><button class="sm" id="dClose">${t("btn_close")}</button></div><p class="small muted">${esc(p.email)} · ${t("detail_last",dt(pr&&pr.updated_at))}</p>
 <div class="tbl-wrap"><table><thead><tr><th>${t("th_stage")}</th><th>${t("th_steps")}</th><th>${t("th_practice")}</th><th>${t("th_best")}</th><th>${t("th_tries")}</th><th>${t("th_errors")}</th></tr></thead><tbody>${DAY_IDS.map(id=>row(id,t("opt_day",DAYS[id].n,DAYS[id].title),true)).join("")}${EXAM_IDS.map((id,i)=>row(id,t("opt_test",i+1,EXAMS[id][0]),false)).join("")}</tbody></table></div></div>`}
document.addEventListener("click",e=>{if(e.target&&e.target.id==="dClose"){TEAM.sel=null;drawTeam()}});

/* ================= Старт ================= */
window.addEventListener("hashchange",()=>{if(App.user&&canLearn())render()});
BE.onAuth((ev)=>{if(ev==="PASSWORD_RECOVERY"){App.recovery=true;showAuth("newpw")}});
boot();
})();
