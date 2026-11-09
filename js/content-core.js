/* Общая часть содержания: помощники, логотип и тренажёры. Тексты — через t() из i18n.js,
   данные конкретного языка — в content-ru.js / content-uz.js / content-en.js. */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=n=>isFinite(n)?Math.round(n).toLocaleString("ru-RU").replace(/[  ,]/g," "):"—";
const pct=n=>isFinite(n)?(Math.round(n*10)/10).toLocaleString("ru-RU")+"%":"—";
const numTxt=n=>{const s=String(n).split(".");return fmt(+s[0])+(s[1]?","+s[1]:"")};
const li=a=>a.map(x=>"<li>"+x+"</li>").join("");
const P=s=>'<span class="path">'+s+'</span>';
const $=id=>document.getElementById(id);
const tbl=(head,rows)=>`<div class="tbl-wrap"><table>${head?`<thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>`:""}<tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td>${i===0&&head?"<b>"+c+"</b>":c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const price=p=>p?p+" $":t("free");

/* ===== Логотип Clopos ===== */
const LOGO=(cls,label)=>`<svg class="${cls}" viewBox="0 0 64 64" ${label?'role="img" aria-label="Clopos"':'aria-hidden="true"'}><circle cx="32" cy="32" r="32" fill="#1E6FE8"/><rect x="14.5" y="14.5" width="16.5" height="16.5" rx="3.6" fill="#fff"/><rect x="33" y="14.5" width="16.5" height="16.5" rx="3.6" fill="#fff"/><rect x="14.5" y="33" width="16.5" height="16.5" rx="3.6" fill="#fff"/><rect x="34.4" y="34.4" width="13.7" height="13.7" rx="2.6" fill="none" stroke="#fff" stroke-width="2.8"/></svg>`;
const LOGO_OUT=`<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="6" width="24" height="24" rx="5" fill="#fff" opacity=".95"/><rect x="34" y="6" width="24" height="24" rx="5" fill="#fff" opacity=".95"/><rect x="6" y="34" width="24" height="24" rx="5" fill="#fff" opacity=".95"/><rect x="36" y="36" width="20" height="20" rx="4" fill="none" stroke="#fff" stroke-width="3.5"/></svg>`;

/* ===== Тренажёры ===== */
function mrrCalc(){return `<div class="tool"><span class="eyebrow">${t("t_mrr")}</span>
<div class="form-grid">${[["m_start",10000],["m_new",600],["m_exp",300],["m_rea",100],["m_con",150],["m_ch",400],["m_cl",250],["m_lost",5]].map(([id,v])=>`<label class="f" for="${id}">${t(id)}<input type="number" id="${id}" value="${v}"></label>`).join("")}</div>
<div class="kpis" id="mrrOut"></div><p class="small muted" id="mrrTxt"></p></div>`}
function bindMrr(){const g=id=>+$(id).value||0;const r=()=>{const st=g("m_start"),nw=g("m_new"),ex=g("m_exp"),re=g("m_rea"),co=g("m_con"),ch=g("m_ch"),cl=g("m_cl"),lo=g("m_lost");
 const net=nw+ex+re-co-ch,end=st+net,nrr=st?(st+ex-co-ch)/st*100:NaN,lc=cl?lo/cl*100:NaN,rc=st?ch/st*100:NaN,arpu=cl?st/cl:NaN;
 $("mrrOut").innerHTML=`<div class="kpi ${net>=0?"ok":"bad"}"><span class="v">${net>=0?"+":""}${fmt(net)} $</span><span class="l">${t("k_net")}</span></div><div class="kpi"><span class="v">${fmt(end)} $</span><span class="l">${t("k_end")}</span></div><div class="kpi ${nrr>=100?"ok":"warn"}"><span class="v">${pct(nrr)}</span><span class="l">${t("k_nrr")}</span></div><div class="kpi"><span class="v">${pct(lc)}</span><span class="l">${t("k_lc")}</span></div><div class="kpi"><span class="v">${pct(rc)}</span><span class="l">${t("k_rc")}</span></div><div class="kpi"><span class="v">${fmt(arpu)} $</span><span class="l">${t("k_arpu")}</span></div><div class="kpi"><span class="v">${lc?fmt(arpu/(lc/100)):"—"} $</span><span class="l">${t("k_ltv")}</span></div>`;
 $("mrrTxt").textContent=nrr>=100?t("mrr_up"):t("mrr_down")};
 ["m_start","m_new","m_exp","m_rea","m_con","m_ch","m_cl","m_lost"].forEach(id=>$(id).oninput=r);r()}

function payCalc(){return `<div class="tool"><span class="eyebrow">${t("t_pay")}</span>
<label class="f" for="p_tar" style="max-width:280px">${t("tariff")}<select id="p_tar"><option value="29">${t("tar_start")}</option><option value="59" selected>${t("tar_std")}</option></select></label>
<div class="grid3 small">${PAYMODS.map((m,i)=>`<label class="row" for="pm${i}" style="gap:8px"><input type="checkbox" id="pm${i}" ${i===1||i===2?"checked":""}> ${m[0]} <span class="muted mono">${m[1]} $</span></label>`).join("")}</div>
<div class="kpis" id="payOut"></div></div>`}
function bindPay(){const r=()=>{let s=+$("p_tar").value;PAYMODS.forEach((m,i)=>{if($("pm"+i).checked)s+=m[1]});
 $("payOut").innerHTML=`<div class="kpi"><span class="v">${fmt(s)} $</span><span class="l">${t("k_client_mrr")}</span></div><div class="kpi"><span class="v">${fmt(s*12)} $</span><span class="l">${t("k_year")}</span></div><div class="kpi bad"><span class="v">−${fmt(s)} $</span><span class="l">${t("k_churn_if")}</span></div>`};
 $("p_tar").onchange=r;PAYMODS.forEach((_,i)=>$("pm"+i).onchange=r);r()}

function revCalc(){return `<div class="tool"><span class="eyebrow">${t("t_rev")}</span>
<div class="tbl-wrap"><table><thead><tr><th></th><th class="num">${t("prev_p")}</th><th class="num">${t("cur_p")}</th></tr></thead><tbody>
<tr><td>${t("rev_sum")}</td><td><input type="number" id="r_rev1" value="186000000" aria-label="${t("rev_sum")} 1"></td><td><input type="number" id="r_rev2" value="167400000" aria-label="${t("rev_sum")} 2"></td></tr>
<tr><td>${t("checks_n")}</td><td><input type="number" id="r_chk1" value="3100" aria-label="${t("checks_n")} 1"></td><td><input type="number" id="r_chk2" value="3060" aria-label="${t("checks_n")} 2"></td></tr></tbody></table></div>
<div class="kpis" id="revOut"></div><p id="revTxt" class="small"></p></div>`}
function bindRev(){const r=()=>{const g=id=>+$(id).value||0;const rv1=g("r_rev1"),rv2=g("r_rev2"),c1=g("r_chk1"),c2=g("r_chk2");const a1=c1?rv1/c1:NaN,a2=c2?rv2/c2:NaN;
 const d=(x,y)=>y?(x-y)/y*100:NaN;const dr=d(rv2,rv1),dc=d(c2,c1),da=d(a2,a1);const cls=v=>v<=-5?"bad":v<0?"warn":"ok";const sg=v=>(v>0?"+":"")+pct(v);
 $("revOut").innerHTML=`<div class="kpi ${cls(dr)}"><span class="v">${sg(dr)}</span><span class="l">${t("k_rev")}</span></div><div class="kpi ${cls(dc)}"><span class="v">${sg(dc)}</span><span class="l">${t("k_checks")}</span></div><div class="kpi ${cls(da)}"><span class="v">${sg(da)}</span><span class="l">${t("k_avg",fmt(a1),fmt(a2))}</span></div>`;
 $("revTxt").innerHTML=!isFinite(dr)?t("rev_none"):dr>=0?t("rev_ok"):Math.abs(dc)>=Math.abs(da)?t("rev_traffic"):t("rev_avg")};
 ["r_rev1","r_rev2","r_chk1","r_chk2"].forEach(id=>$(id).oninput=r);r()}

function fcCalc(){return `<div class="tool"><span class="eyebrow">${t("t_fc")}</span>
<p class="small muted">${t("fc_note")}</p>
<label class="f" for="fc_price" style="max-width:240px">${t("fc_price")}<input type="number" id="fc_price" value="25000"></label>
<div class="tbl-wrap"><table><thead><tr><th>${t("th_ingr")}</th><th class="num">${t("th_qty")}</th><th class="num">${t("th_unit_price")}</th><th class="num">${t("th_cost")}</th><th></th></tr></thead><tbody id="fcRows"></tbody></table></div>
<div class="row"><button id="fcAdd">${t("add_ingr")}</button></div><div class="kpis" id="fcOut"></div></div>`}
function bindFc(){const N=t("ingr_names");let fc=[[N[0],0.2,50000],[N[1],0.1,0],[N[2],0.01,15000],[N[3],0.03,20000]];
 const calc=()=>{let s=0;fc.forEach((x,i)=>{const c=x[1]*x[2];s+=c;const el=$("fcc"+i);if(el)el.textContent=fmt(c)});const p=+$("fc_price").value||0;const f=p?s/p*100:NaN;const k=f<=30?"ok":f<=38?"warn":"bad";
  $("fcOut").innerHTML=`<div class="kpi"><span class="v">${fmt(s)}</span><span class="l">${t("k_cost")}</span></div><div class="kpi ${k}"><span class="v">${pct(f)}</span><span class="l">${t("k_fc")}</span></div><div class="kpi"><span class="v">${fmt(p-s)}</span><span class="l">${t("k_margin")}</span></div><div class="kpi"><span class="v">${s?pct((p-s)/s*100):"—"}</span><span class="l">${t("k_markup")}</span></div><div class="kpi"><span class="v">${p?pct((p-s)/p*100):"—"}</span><span class="l">${t("k_gm")}</span></div>`};
 const draw=()=>{$("fcRows").innerHTML=fc.map((x,i)=>`<tr><td><input id="fcn${i}" value="${esc(x[0])}" aria-label="${t("th_ingr")}"></td><td><input type="number" step="any" id="fcq${i}" value="${x[1]}" aria-label="${t("th_qty")}"></td><td><input type="number" id="fcp${i}" value="${x[2]}" aria-label="${t("th_unit_price")}"></td><td class="num" id="fcc${i}"></td><td><button aria-label="${t("del")}" data-del="${i}" style="padding:4px 10px">×</button></td></tr>`).join("");
  fc.forEach((x,i)=>{$("fcn"+i).oninput=e=>{x[0]=e.target.value};$("fcq"+i).oninput=e=>{x[1]=+e.target.value;calc()};$("fcp"+i).oninput=e=>{x[2]=+e.target.value;calc()}});
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{fc.splice(+b.dataset.del,1);draw()});calc()};
 $("fc_price").oninput=calc;$("fcAdd").onclick=()=>{fc.push([t("new_ingr"),0,0]);draw()};draw()}

function meCalc(){return `<div class="tool"><span class="eyebrow">${t("t_me")}</span>
<p class="small">${t("me_note")}</p>
<div class="tbl-wrap"><table><thead><tr><th>${t("th_dish")}</th><th class="num">${t("th_sold")}</th><th class="num">${t("th_price")}</th><th class="num">${t("th_cost")}</th><th class="num">${t("th_margin")}</th><th>${t("th_cat")}</th></tr></thead><tbody id="meRows"></tbody></table></div>
<div class="grid2 small"><div><span class="chip ok">${t("star")}</span> ${t("star_t")}</div><div><span class="chip info">${t("horse")}</span> ${t("horse_t")}</div><div><span class="chip warn">${t("puzzle")}</span> ${t("puzzle_t")}</div><div><span class="chip bad">${t("dog")}</span> ${t("dog_t")}</div></div></div>`}
function bindMe(){let me=[["Plov",420,45000,18000],["Lag'mon",310,38000,12000],["Shashlik",180,65000,30000],["Sezer salat",95,42000,13000],["Somsa",520,12000,5500],["Medovik",60,35000,9000]];
 const calc=()=>{const tq=me.reduce((a,x)=>a+x[1],0),tm=me.reduce((a,x)=>a+x[1]*(x[2]-x[3]),0),avg=tq?tm/tq:0,pt=me.length?.7/me.length:0;
  me.forEach((x,i)=>{const m=x[2]-x[3],pop=(tq?x[1]/tq:0)>=pt,hi=m>=avg;const [c,l]=pop&&hi?["ok","star"]:pop?["info","horse"]:hi?["warn","puzzle"]:["bad","dog"];$("mem"+i).textContent=fmt(m);$("mek"+i).innerHTML=`<span class="chip ${c}">${t(l)}</span>`})};
 $("meRows").innerHTML=me.map((x,i)=>`<tr><td><input id="men${i}" value="${esc(x[0])}" aria-label="${t("th_dish")}"></td><td><input type="number" id="meq${i}" value="${x[1]}" aria-label="${t("th_sold")}"></td><td><input type="number" id="mep${i}" value="${x[2]}" aria-label="${t("th_price")}"></td><td><input type="number" id="mec${i}" value="${x[3]}" aria-label="${t("th_cost")}"></td><td class="num" id="mem${i}"></td><td id="mek${i}"></td></tr>`).join("");
 me.forEach((x,i)=>["n","q","p","c"].forEach((f,j)=>$("me"+f+i).oninput=e=>{x[j]=j?+e.target.value:e.target.value;calc()}));calc()}

function churnBlock(){return `<div class="tool"><span class="eyebrow">${t("t_churn")}</span><div id="churnList">${CHURN.map((c,i)=>`<label class="check" for="ch${i}"><input type="checkbox" id="ch${i}" data-w="${c[1]}"><span>${c[0]}</span><span class="w">+${c[1]}</span></label>`).join("")}</div><div class="gauge"><i id="churnBar"></i></div><div id="churnOut"></div></div>`}
function bindChurn(){const max=CHURN.reduce((a,c)=>a+c[1],0);const upd=()=>{let s=0;document.querySelectorAll("#churnList input").forEach(i=>{if(i.checked)s+=+i.dataset.w});
 const lv=s>=7?["bad","risk_hi"]:s>=3?["warn","risk_mid"]:["ok","risk_lo"];
 const b=$("churnBar");b.style.width=Math.min(100,s/max*160)+"%";b.style.background=`var(--${lv[0]})`;$("churnOut").innerHTML=`<p><span class="chip ${lv[0]}">${t(lv[1])} · ${s} ${t("points")}</span></p><p class="small" style="margin-top:6px">${t(lv[1]+"_t")}</p>`};
 document.querySelectorAll("#churnList input").forEach(i=>i.onchange=upd);upd()}

function cardBlock(){const F=t("card_fields");return `<div class="tool" id="cardPanel"><span class="eyebrow">${t("t_card")}</span><div class="form-grid">
${["k_name","k_tariff","k_biz","k_reason","k_need","k_deal","k_todo","k_date"].map((id,i)=>`<label class="f" for="${id}">${F[i][0]}<input id="${id}" data-card placeholder="${esc(F[i][1])}"></label>`).join("")}</div>
<div class="row"><button class="primary" id="copyCard">${t("copy_crm")}</button><button id="clearCard">${t("clear")}</button><span id="copyMsg" class="mono small muted"></span></div></div>`}
function bindCard(){const st=App.state;st.card=st.card||{};document.querySelectorAll("[data-card]").forEach(el=>{el.value=st.card[el.id]||"";el.oninput=()=>{st.card[el.id]=el.value;App.save()}});
 $("copyCard").onclick=()=>{const s=[...document.querySelectorAll("[data-card]")].map(el=>el.closest("label").childNodes[0].textContent.trim()+": "+(el.value||"—")).join("\n");copyText(s,$("copyMsg"),$("cardPanel"))};
 $("clearCard").onclick=()=>{st.card={};App.save();document.querySelectorAll("[data-card]").forEach(el=>el.value="")}}
function copyText(s,msg,host){const fb=()=>{msg.textContent=t("copy_manual");let ta=host.querySelector("textarea.fb");if(!ta){ta=document.createElement("textarea");ta.className="fb";ta.setAttribute("aria-label",t("copy_aria"));ta.style.cssText="width:100%;min-height:150px;font:inherit";host.appendChild(ta)}ta.value=s;ta.select()};
 try{navigator.clipboard.writeText(s).then(()=>msg.textContent=t("copied")).catch(fb)}catch(e){fb()}}

function modTable(){const groups=[t("all"),...new Set(MODS.map(m=>m[1]))];return `<input class="search" id="modq" placeholder="${t("mod_search")}" autocomplete="off" aria-label="${t("mod_aria")}">
<div class="row" id="modf">${groups.map((g,i)=>`<button data-g="${esc(g)}" class="${i?"":"primary"} sm">${g}</button>`).join("")}</div>
<div class="tbl-wrap"><table><thead><tr><th>${t("th_module")}</th><th class="num">${t("th_price_m")}</th><th>${t("th_does")}</th><th>${t("th_when")}</th><th>${t("th_settings")}</th></tr></thead><tbody id="modRows"></tbody></table></div>`}
function bindMods(){const ALL=t("all");let g=ALL;const draw=()=>{const q=$("modq").value.toLowerCase().trim();$("modRows").innerHTML=MODS.filter(m=>(g===ALL||m[1]===g)&&(!q||m.join(" ").toLowerCase().includes(q))).map(m=>`<tr><td><b>${m[0]}</b><br><span class="small muted">${m[1]}</span></td><td class="num">${price(m[2])}</td><td>${m[4]}<br><span class="small muted">${t("in_cabinet")} «${m[3]}»</span></td><td>${m[5]}</td><td class="small">${m[6]||"—"}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">${t("nothing_found")}</td></tr>`};
 $("modq").oninput=draw;document.querySelectorAll("#modf button").forEach(b=>b.onclick=()=>{g=b.dataset.g;document.querySelectorAll("#modf button").forEach(x=>x.classList.toggle("primary",x===b));draw()});draw()}
