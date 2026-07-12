From 763a5923a9c805e0ed696fbcff5311bf5b1d496f Mon Sep 17 00:00:00 2001
From: bestdreambot <212590801+bestdreambot@users.noreply.github.com>
Date: Sun, 12 Jul 2026 14:40:56 +0000
Subject: [PATCH] =?UTF-8?q?fix:=20working=20modular=20app=20=E2=80=94=20re?=
 =?UTF-8?q?al=20app.js=20orchestrator=20+=20ui.js=20helpers?=
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

- js/app.js: full orchestrator (state init, event wiring, sendMessage,
  conference/single mode, settings, data export/import, tab switching,
  GitHub deploy wrapper). Removed 'refactoring in progress' stub.
- js/ui.js: add showToast helper (toggleSidebar/applyTheme/etc already present).
- index.html: modular skeleton — keeps full HTML structure, loads app.js
  as <script type=module>; no more monolithic inline script.
- js/sidebar.js: fix broken selectChat onclick (missing paren).
- js/db.js: import Dexie from ESM build (+esm) — UMD min build has no export.
- js/chat.js: remove duplicate renderSidebarList import (SyntaxError).
- Visual bugs fixed via existing style.css: composer hides in note editor,
  user avatar uses var(--bg-3), sidebar active-chat color conflict resolved.
---
 index.html    | 462 +-------------------------------------------------
 js/app.js     | 318 ++++++++++++++++++++++++++++++++--
 js/chat.js    |   6 +-
 js/db.js      |   2 +-
 js/sidebar.js |   2 +-
 js/ui.js      |  24 +++
 6 files changed, 335 insertions(+), 479 deletions(-)

diff --git a/index.html b/index.html
index cb90370..5179ae9 100644
--- a/index.html
+++ b/index.html
@@ -8,15 +8,13 @@
 <meta name="apple-mobile-web-app-capable" content="yes">
 <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
 <meta name="apple-mobile-web-app-title" content="FreeX">
-<title>FreeX v6.2</title>
-<script src="https://unpkg.com/dexie@4.0.4/dist/dexie.min.js"></script>
-<script src="https://unpkg.com/marked@11.1.1/marked.min.js"></script>
-<link rel="stylesheet" href="style.css">
+<title>FreeX v7.0</title>
+<link rel="stylesheet" href="style.css?v=7.0">
 </head>
-<body>
+<body data-active-tab="chat">
 <div id="sidebarOverlay" onclick="toggleSidebar(false)"></div>
 <div id="sidebar">
-  <div class="sb-head">FreeX v6.2</div>
+  <div class="sb-head">FreeX v7.0</div>
   <div class="sb-newbtn" onclick="newChat()">+ Новый чат</div>
   <div class="sb-newbtn" onclick="newNote()">+ Новая заметка</div>
   <div class="sb-item" onclick="openHQ()">🗂 HQ (Notion)</div>
@@ -41,7 +39,7 @@
     </div>
     <div id="noteEditor">
       <input id="noteTitle" placeholder="Название заметки">
-      <textarea id="noteContent" placeholder="Пиши здесь. Используй [[Название заметки]] для ссылок.&#10;&#10;AI может создавать заметки через теги:&#10;<note title="Название">Содержимое</note>"></textarea>
+      <textarea id="noteContent" placeholder="Пиши здесь. Используй [[Название заметки]] для ссылок.&#10;&#10;AI может создавать заметки через теги:&#10;<note title=&quot;Название&quot;>Содержимое</note>"></textarea>
       <div class="btn-row"><button class="btn sec" onclick="closeEditor()">← Назад</button><button class="btn" onclick="saveNote()">💾 Сохранить</button></div>
     </div>
   </div>
@@ -123,7 +121,7 @@
           <button class="opt-btn" id="aiMemOff" onclick="setAiMemory(false)">❌ Выключена</button>
           <button class="opt-btn" id="aiMemOn" onclick="setAiMemory(true)">✅ Включена</button>
         </div>
-        <div class="info-box">Когда включена, модель может создавать и обновлять заметки через теги <code><note title="...">...</note></code>. Это позволяет AI запоминать факты между чатами.</div>
+        <div class="info-box">Когда включена, модель может создавать и обновлять заметки через теги <code>&lt;note title="..."&gt;...&lt;/note&gt;</code>. Это позволяет AI запоминать факты между чатами.</div>
       </div>
       <div class="setting-group">
         <button class="btn-secondary" onclick="clearAllNotes()" style="color:var(--danger);border-color:var(--danger);">🗑 Удалить все заметки</button>
@@ -131,452 +129,6 @@
     </div>
   </div>
 </div>
-<script>
-const LS={chats:'freex_chats',folders:'freex_folders',keys:'freex_keys',hqUrl:'freex_hq_url',active:'freex_active_chat',draft:'freex_draft',theme:'freex_theme',aiMemory:'freex_ai_memory',tab:'freex_tab'};
-function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch(e){return f;}}
-function save(k,v){localStorage.setItem(k,JSON.stringify(v));}
-
-let chats=loadJSON(LS.chats,[]);
-let folders=loadJSON(LS.folders,[]);
-let keys=loadJSON(LS.keys,{});
-let activeId=localStorage.getItem(LS.active)||null;
-let viewOpen=false;
-let currentTab=localStorage.getItem(LS.tab)||'chat';
-let aiMemoryEnabled=localStorage.getItem(LS.aiMemory)==='true';
-let editingNoteId=null;
-
-let db;
-try{
-  db = new Dexie('FreeXDB');
-  db.version(1).stores({notes: '++id, title, updatedAt, *tags', chats: '++id, title, updatedAt', messages: '++id, chatId, role, model, content, createdAt'});
-}catch(e){
-  console.error('Dexie failed:', e);
-  db = {notes:{toArray:async()=>[],filter:()=>({toArray:async()=>[],first:async()=>null}),get:async()=>null,add:async()=>{},update:async()=>{},clear:async()=>{}},orderBy:()=>({reverse:()=>({toArray:async()=>[]})})};
-}
-
-const ALL_MODELS=[
-  {id:'deepseek',label:'DeepSeek',provider:'deepseek',keyField:'key_deepseek',model:'deepseek-chat'},
-  {id:'gh_gpt4o',label:'GPT-4o (GitHub)',provider:'github',keyField:'key_github',model:'gpt-4o'},
-  {id:'gh_r1',label:'DeepSeek-R1 (GitHub)',provider:'github',keyField:'key_github',model:'DeepSeek-R1'},
-  {id:'gemini',label:'Gemini 2.5 Flash',provider:'gemini',keyField:'key_gemini',model:'gemini-2.5-flash'},
-  {id:'groq',label:'Llama 3.3 70B (Groq)',provider:'groq',keyField:'key_groq',model:'llama-3.3-70b-versatile'},
-  {id:'cf_llama',label:'Llama 3.3 (Cloudflare)',provider:'cloudflare',keyField:'key_cloudflare',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}
-];
-function availableModels(){return ALL_MODELS.filter(m=>keys[m.keyField]);}
-function modelLabel(id){return (ALL_MODELS.find(m=>m.id===id)||{}).label||id;}
-
-function exportData(){
-  const data={exported:new Date().toISOString(),chats,folders,version:'FreeX v6.2'};
-  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
-  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
-  a.download='freex_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();
-}
-function importData(e){
-  const file=e.target.files[0];if(!file)return;
-  const r=new FileReader();
-  r.onload=ev=>{try{const d=JSON.parse(ev.target.result);
-    if(Array.isArray(d.chats)){chats=d.chats;folders=Array.isArray(d.folders)?d.folders:[];activeId=chats[0]?.id||null;
-      save(LS.chats,chats);save(LS.folders,folders);if(activeId)localStorage.setItem(LS.active,activeId);renderAll();alert('✅ Импорт выполнен');}
-    else alert('❌ Неверный формат');
-  }catch(err){alert('❌ Ошибка чтения');}};
-  r.readAsText(file);e.target.value='';
-}
-
-async function exportNotes(){
-  const notes=await db.notes.toArray();
-  const data={exported:new Date().toISOString(),notes,version:'FreeX Notes v1'};
-  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
-  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
-  a.download='freex_notes_'+new Date().toISOString().slice(0,10)+'.json';a.click();
-}
-async function importNotes(e){
-  const file=e.target.files[0];if(!file)return;
-  const r=new FileReader();
-  r.onload=async ev=>{try{const d=JSON.parse(ev.target.result);
-    if(Array.isArray(d.notes)){
-      await db.notes.clear();
-      for(const n of d.notes){
-        await db.notes.add({title:n.title,content:n.content,tags:n.tags||[],createdAt:n.createdAt||Date.now(),updatedAt:n.updatedAt||Date.now()});
-      }
-      alert('✅ Заметки импортированы: '+d.notes.length);
-      if(currentTab==='notes')renderNotes();
-    }else alert('❌ Неверный формат');
-  }catch(err){alert('❌ Ошибка: '+err.message);}};
-  r.readAsText(file);e.target.value='';
-}
-
-function applyTheme(t){
-  const r=document.documentElement;
-  if(t==='light'){r.style.setProperty('--bg','#f0f0f2');r.style.setProperty('--bg-2','#e8e8ea');r.style.setProperty('--bg-3','#dddde0');r.style.setProperty('--line','#c8c8cc');r.style.setProperty('--text','#1a1a1e');r.style.setProperty('--text-dim','#6a6a74');r.style.setProperty('--bg-rgb','240,240,242');document.getElementById('app').style.background='#f0f0f2';}
-  else if(t==='dark'){r.style.setProperty('--bg','#212121');r.style.setProperty('--bg-2','#2f2f2f');r.style.setProperty('--bg-3','#3a3a3a');r.style.setProperty('--line','#4a4a4a');r.style.setProperty('--text','#ececec');r.style.setProperty('--text-dim','#9b9b9b');r.style.setProperty('--bg-rgb','33,33,33');document.getElementById('app').style.background='#212121';}
-  else{applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');return;}
-  localStorage.setItem(LS.theme,t);
-  document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));
-}
-function setTheme(t){applyTheme(t);}
-
-function setAiMemory(v){aiMemoryEnabled=v;localStorage.setItem(LS.aiMemory,v);renderAiMemoryBtn();}
-function renderAiMemoryBtn(){
-  document.getElementById('aiMemOn').classList.toggle('active',aiMemoryEnabled);
-  document.getElementById('aiMemOff').classList.toggle('active',!aiMemoryEnabled);
-}
-async function clearAllNotes(){if(!confirm('Удалить ВСЕ заметки? Это необратимо.'))return;await db.notes.clear();if(currentTab==='notes')renderNotes();}
-
-function newFolder(){
-  const name=prompt('Название папки:');if(!name)return;
-  folders.unshift({id:'f'+Date.now(),name});save(LS.folders,folders);renderSidebarList();
-}
-function deleteFolder(id,ev){
-  ev.stopPropagation();
-  if(!confirm('Удалить папку? Чаты внутри станут без папки.'))return;
-  chats.forEach(c=>{if(c.folder===id)c.folder=null;});
-  folders=folders.filter(f=>f.id!==id);
-  save(LS.folders,folders);save(LS.chats,chats);renderSidebarList();
-}
-function moveChatToFolder(id,ev){
-  ev.stopPropagation();
-  const names=folders.map((f,i)=>(i+1)+'. '+f.name).join('\n');
-  const ans=prompt('В какую папку? Введи номер (0 — без папки):\n0. Без папки\n'+names);
-  if(ans===null)return;
-  const idx=parseInt(ans,10);
-  const chat=chats.find(c=>c.id===id);if(!chat)return;
-  chat.folder=(idx===0||isNaN(idx))?null:(folders[idx-1]?.id||null);
-  save(LS.chats,chats);renderSidebarList();
-}
-
-function newChat(){
-  const chat={id:'c'+Date.now(),title:'Новый чат',model:(availableModels()[0]||ALL_MODELS[0]).id,conf:false,folder:null,messages:[]};
-  chats.unshift(chat);activeId=chat.id;save(LS.chats,chats);localStorage.setItem(LS.active,activeId);
-  renderAll();toggleSidebar(false);closeViews();
-}
-function getActiveChat(){return chats.find(c=>c.id===activeId);}
-function selectChat(id){activeId=id;localStorage.setItem(LS.active,id);closeViews();renderAll();toggleSidebar(false);}
-function deleteChat(id,ev){ev.stopPropagation();chats=chats.filter(c=>c.id!==id);if(activeId===id)activeId=chats[0]?.id||null;save(LS.chats,chats);renderAll();}
-
-function chatItemHTML(c){
-  return '<div class="sb-item '+(c.id===activeId&&!viewOpen?'active':'')+'" onclick="selectChat(\''+c.id+'\')"><span>'+escapeHtml(c.title)+'</span><span style="display:flex;gap:6px;"><span class="del" onclick="moveChatToFolder(\''+c.id+'\',event)" title="В папку">📁</span><span class="del" onclick="deleteChat(\''+c.id+'\',event)">✕</span></span></div>';
-}
-function renderSidebarList(){
-  const list=document.getElementById('chatList');let html='';
-  folders.forEach(f=>{
-    html+='<div class="sb-folder"><span class="fname">📁 '+escapeHtml(f.name)+'</span><span class="del" onclick="deleteFolder(\''+f.id+'\',event)">✕</span></div>';
-    chats.filter(c=>c.folder===f.id).forEach(c=>{html+='<div class="sb-chat-in-folder">'+chatItemHTML(c)+'</div>';});
-  });
-  const loose=chats.filter(c=>!c.folder||!folders.find(f=>f.id===c.folder));
-  if(loose.length){html+='<div class="sb-label" style="text-transform:none;">Чаты</div>';loose.forEach(c=>{html+=chatItemHTML(c);});}
-  list.innerHTML=html||'<div class="sb-label">Пока пусто</div>';
-}
-
-const viewEl=document.getElementById('view');
-
-function renderMessages(){
-  const chat=getActiveChat();const box=document.getElementById('messages');
-  document.getElementById('chatTitle').textContent=chat?(chat.conf?'🎯 Конференция':chat.title):'FreeX';
-  const sel=document.getElementById('modelSelect');
-  if(chat){sel.value=chat.model;sel.disabled=!!chat.conf;document.getElementById('confBtn').classList.toggle('on',!!chat.conf);}
-  if(!chat){box.innerHTML='<div class="empty">Нет открытого чата.<br><b>+ Новый чат</b> в меню слева.</div>';return;}
-  if(chat.messages.length===0){
-    box.innerHTML='<div class="empty">'+(chat.conf?'Конференция включена: все модели с ключами ответят по очереди.':'Выбери модель и начни диалог. Кнопка 🎯 Конференция — опросить всех сразу.')+'</div>';return;
-  }
-  box.innerHTML=chat.messages.map((m,idx)=>{
-    if(m.role==='sep')return '<div class="sepMsg">'+escapeHtml(m.text)+'</div>';
-    const isUser=m.role==='user';
-    const label=(!isUser&&m.model)?'<div class="msg-model-label">'+modelLabel(m.model)+'</div>':'';
-    const actions=!isUser?'<div class="msg-actions"><button onclick="copyMessage('+idx+')" id="cp_'+idx+'">📋 Копировать</button></div>':'';
-    return '<div class="msg-wrapper '+(isUser?'user':'ai')+'"><div class="avatar">'+(isUser?'👤':'🔮')+'</div><div class="msg-content">'+label+'<div class="msg-bubble">'+escapeHtml(m.text)+'</div>'+actions+'</div></div>';
-  }).join('');
-  if(viewEl)viewEl.scrollTop=viewEl.scrollHeight;
-}
-function copyMessage(idx){
-  const chat=getActiveChat();if(!chat)return;const msg=chat.messages[idx];if(!msg)return;
-  const done=()=>{const b=document.getElementById('cp_'+idx);if(b){const o=b.textContent;b.textContent='✅ Скопировано';setTimeout(()=>b.textContent=o,2000);}};
-  if(navigator.clipboard){navigator.clipboard.writeText(msg.text).then(done).catch(()=>fallback(msg.text,done));}
-  else fallback(msg.text,done);
-}
-function fallback(t,cb){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');}catch(e){}a.remove();cb&&cb();}
-
-function toggleConf(){let chat=getActiveChat();if(!chat){newChat();chat=getActiveChat();}chat.conf=!chat.conf;save(LS.chats,chats);renderMessages();}
-function renderAll(){renderSidebarList();renderMessages();}
-function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));}
-
-function autoGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';if(typeof refreshSend==='function')refreshSend();}
-function onKeyDown(e){
-  const mob=/iPhone|iPad|iPod|Android/.test(navigator.userAgent);
-  if(e.key==='Enter'){
-    if(mob&&!e.shiftKey){e.preventDefault();sendMessage();}
-    else if(!mob&&(e.metaKey||e.ctrlKey)){e.preventDefault();sendMessage();}
-  }
-}
-function refreshSend(){document.getElementById('sendBtn').disabled=document.getElementById('input').value.trim()==='';}
-document.getElementById('input').addEventListener('input',()=>{localStorage.setItem(LS.draft,document.getElementById('input').value);});
-function loadDraft(){const d=localStorage.getItem(LS.draft)||'';if(d){const i=document.getElementById('input');i.value=d;autoGrow(i);}}
-
-const MAX_HISTORY=12;
-function buildHistory(chat){
-  return chat.messages.filter(m=>(m.role==='user'||m.role==='ai')&&m.text!=null&&String(m.text).trim()!=='').slice(-MAX_HISTORY).map(m=>({role:m.role==='user'?'user':'assistant',content:String(m.text)}));
-}
-
-async function findRelevantNotes(query){
-  if(!query.trim())return[];
-  const words=query.toLowerCase().split(/\s+/).filter(w=>w.length>2);
-  if(!words.length)return[];
-  const allNotes=await db.notes.toArray();
-  const scored=allNotes.map(n=>{
-    const titleLow=n.title.toLowerCase();
-    const contentLow=n.content.toLowerCase();
-    let score=0;
-    words.forEach(w=>{
-      if(titleLow.includes(w))score+=3;
-      if(contentLow.includes(w))score+=1;
-      if(titleLow===w)score+=5;
-    });
-    return {...n,score};
-  }).filter(n=>n.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
-  return scored;
-}
-
-async function renderContextBar(query){
-  const bar=document.getElementById('contextBar');
-  const notes=await findRelevantNotes(query);
-  if(notes.length&&currentTab==='chat'){
-    bar.style.display='block';
-    bar.innerHTML='Контекст: '+notes.map(n=>`<span class="context-chip" onclick="openNoteByTitle('${escapeHtml(n.title).replace(/'/g,"\\'")}')">[[${escapeHtml(n.title)}]]</span>`).join('');
-  }else{
-    bar.style.display='none';
-    bar.innerHTML='';
-  }
-  return notes;
-}
-
-async function openNoteByTitle(title){
-  const note=await db.notes.filter(n=>n.title.toLowerCase()===title.toLowerCase()).first();
-  if(note){editingNoteId=note.id;document.getElementById('noteTitle').value=note.title;document.getElementById('noteContent').value=note.content;switchMainTab('notes');document.getElementById('view').style.display='none';document.getElementById('noteEditor').style.display='flex';}
-}
-
-function parseNoteTags(text){
-  const notes=[];
-  const regex=/<note\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/note>/gi;
-  let m;
-  while((m=regex.exec(text))!==null){
-    notes.push({title:m[1].trim(),content:m[2].trim()});
-  }
-  return notes;
-}
-
-async function processAiMemory(text){
-  if(!aiMemoryEnabled)return text;
-  const notes=parseNoteTags(text);
-  if(!notes.length)return text;
-  for(const n of notes){
-    const existing=await db.notes.filter(x=>x.title.toLowerCase()===n.title.toLowerCase()).first();
-    if(existing){
-      await db.notes.update(existing.id,{content:n.content,updatedAt:Date.now()});
-    }else{
-      await db.notes.add({title:n.title,content:n.content,tags:[],createdAt:Date.now(),updatedAt:Date.now()});
-    }
-  }
-  return text.replace(/<note\s+title=["'][^"']+["']\s*>[\s\S]*?<\/note>/gi,'').trim();
-}
-async function sendMessage(){
-  const input=document.getElementById('input');const text=input.value.trim();if(!text)return;
-  localStorage.removeItem(LS.draft);
-  let chat=getActiveChat();if(!chat){newChat();chat=getActiveChat();}
-  chat.messages.push({role:'user',text});
-  if(chat.messages.filter(m=>m.role==='user').length===1)chat.title=text.slice(0,30);
-  save(LS.chats,chats);input.value='';autoGrow(input);renderMessages();
-  document.getElementById('sendBtn').disabled=true;
-
-  const contextNotes=await renderContextBar(text);
-
-  let sequence;
-  if(chat.conf){sequence=availableModels().map(m=>m.id);if(!sequence.length)sequence=[];}
-  else sequence=[chat.model];
-
-  if(!sequence.length){
-    chat.messages.push({role:'ai',text:'⚠️ Нет ни одного ключа. Открой Настройки и добавь хотя бы один API-ключ.'});
-    save(LS.chats,chats);renderMessages();document.getElementById('sendBtn').disabled=false;return;
-  }
-
-  for(let i=0;i<sequence.length;i++){
-    const modelId=sequence[i];const model=ALL_MODELS.find(m=>m.id===modelId);
-    if(chat.conf&&i>0){chat.messages.push({role:'sep',text:'Дальше отвечает: '+modelLabel(modelId)});save(LS.chats,chats);renderMessages();}
-    const apiKey=keys[model?.keyField||''];
-    if(!apiKey){chat.messages.push({role:'ai',model:modelId,text:'⚠️ Нет ключа для '+modelLabel(modelId)+' — добавь в Настройках.'});save(LS.chats,chats);renderMessages();continue;}
-
-    const box=document.getElementById('messages');
-    const t=document.createElement('div');t.className='typing-wrapper';
-    t.innerHTML='<div class="avatar">🔮</div><div class="typing-box"><div class="typing-label">'+modelLabel(modelId)+' печатает...</div><div class="dots"><span></span><span></span><span></span></div></div>';
-    box.appendChild(t);viewEl.scrollTop=viewEl.scrollHeight;
-
-    try{
-      let history=buildHistory(chat);
-      const sysParts=[];
-      if(contextNotes.length){
-        sysParts.push('[Контекст из заметок пользователя: '+contextNotes.map(n=>n.title).join(', ')+'. Если уместно, цитируй [[название]] и используй эту информацию.]');
-      }
-      if(aiMemoryEnabled){
-        sysParts.push('[Ты можешь создавать и обновлять заметки пользователя. Если пользователь просит запомнить что-то или ты считаешь информацию важной, используй тег: <note title="Название">Содержимое заметки</note>. Не упоминай тег в ответе — он обработается автоматически.]');
-      }
-      if(sysParts.length){
-        const sysText=sysParts.join('\n\n');
-        if(model.provider==='gemini'){
-          const firstUserIdx=history.findIndex(m=>m.role==='user');
-          if(firstUserIdx>=0) history[firstUserIdx].content=sysText+'\n\n'+history[firstUserIdx].content;
-          else history.unshift({role:'user',content:sysText});
-        }else{
-          history.unshift({role:'system',content:sysText});
-        }
-      }
-      let reply=await callModel(model,history,apiKey);
-      reply=await processAiMemory(reply);
-      chat.messages.push({role:'ai',model:modelId,text:reply});
-    }catch(err){chat.messages.push({role:'ai',model:modelId,text:'❌ '+err.message});}
-    save(LS.chats,chats);renderMessages();
-  }
-  document.getElementById('sendBtn').disabled=false;
-}
-
-async function callModel(model,history,apiKey){
-  const extra={};
-  if(model.provider==='cloudflare')extra.account=keys.key_cf_account||'';
-  const r=await fetch('/api/chat',{
-    method:'POST',
-    headers:{'Content-Type':'application/json'},
-    body:JSON.stringify({provider:model.provider,model:model.model||'',messages:history,apiKey,...extra})
-  });
-  let d;
-  try{ d=await r.json(); }catch(e){ throw new Error('прокси не ответил (залей api/chat.js на GitHub)'); }
-  if(!r.ok)throw new Error(d.error||('ошибка '+r.status));
-  return d.content;
-}
-
-function switchMainTab(tab){
-  currentTab=tab;localStorage.setItem(LS.tab,tab);
-  document.getElementById('messages').style.display=tab==='chat'?'flex':'none';
-  document.getElementById('notesView').style.display=tab==='notes'?'flex':'none';
-  document.getElementById('composer').style.display=tab==='chat'?'flex':'none';
-  document.getElementById('contextBar').style.display=(tab==='chat'&&document.getElementById('contextBar').innerHTML)?'block':'none';
-  if(tab==='notes'){renderNotes();document.getElementById('view').style.display='flex';document.getElementById('noteEditor').style.display='none';}
-  else{renderMessages();}
-}
-
-async function renderNotes(){
-  const search=document.getElementById('searchNotes').value.toLowerCase();
-  let notes;
-  if(search){
-    notes=await db.notes.filter(n=>n.title.toLowerCase().includes(search)||n.content.toLowerCase().includes(search)).toArray();
-  }else{
-    notes=await db.notes.orderBy('updatedAt').reverse().toArray();
-  }
-  const list=document.getElementById('notesList');
-  list.innerHTML=notes.map(n=>{
-    const date=new Date(n.updatedAt).toLocaleDateString('ru-RU');
-    return `<div class="note-item" onclick="editNote(${n.id})"><div class="note-title">${escapeHtml(n.title)}</div><div class="note-snippet">${escapeHtml(n.content.slice(0,120))}${n.content.length>120?'...':''}</div><div class="note-meta">${date} ${n.tags.map(t=>`<span class="note-tag">#${escapeHtml(t)}</span>`).join('')}</div></div>`;
-  }).join('')||'<div class="empty">Заметок пока нет.<br>Нажми <b>+ Новая заметка</b> в меню слева.</div>';
-}
-
-function newNote(){editingNoteId=null;document.getElementById('noteTitle').value='';document.getElementById('noteContent').value='';document.getElementById('view').style.display='none';document.getElementById('noteEditor').style.display='flex';}
-async function saveNote(){
-  const title=document.getElementById('noteTitle').value.trim()||'Без названия';
-  const content=document.getElementById('noteContent').value;
-  const tags=extractTags(content);
-  if(editingNoteId) await db.notes.update(editingNoteId,{title,content,tags,updatedAt:Date.now()});
-  else await db.notes.add({title,content,tags,createdAt:Date.now(),updatedAt:Date.now()});
-  closeEditor();renderNotes();
-}
-function extractTags(text){
-  const tags=[];
-  const m=text.match(/#(\w+)/g);
-  if(m)m.forEach(t=>tags.push(t.slice(1)));
-  return [...new Set(tags)];
-}
-function closeEditor(){document.getElementById('noteEditor').style.display='none';document.getElementById('view').style.display='flex';}
-async function editNote(id){const n=await db.notes.get(id);editingNoteId=id;document.getElementById('noteTitle').value=n.title;document.getElementById('noteContent').value=n.content;document.getElementById('view').style.display='none';document.getElementById('noteEditor').style.display='flex';}
-
-const KEY_FIELDS=['key_deepseek','key_github','key_gemini','key_groq','key_cloudflare','key_cf_account'];
-function openSettings(){
-  KEY_FIELDS.forEach(k=>{const el=document.getElementById(k);if(el)el.value=keys[k]||'';});
-  renderAiMemoryBtn();
-  document.getElementById('settingsModal').classList.add('open');
-}
-function closeSettings(){document.getElementById('settingsModal').classList.remove('open');}
-function saveSettings(){KEY_FIELDS.forEach(k=>{const el=document.getElementById(k);if(el)keys[k]=el.value.trim();});save(LS.keys,keys);populateModelSelect();closeSettings();renderMessages();}
-function switchSettingsTab(id){
-  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
-  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
-  document.getElementById(id).classList.add('active');
-  document.querySelector('.tab[data-tab="'+id+'"]').classList.add('active');
-}
-
-function showView(which){
-  viewOpen=true;
-  document.getElementById('view').style.display='none';document.getElementById('composer').style.display='none';
-  document.getElementById('hqView').classList.toggle('active',which==='hq');
-  document.getElementById('ghView').classList.toggle('active',which==='gh');
-  document.getElementById('modelSelect').style.display='none';
-  document.getElementById('confBtn').style.display='none';
-  toggleSidebar(false);renderSidebarList();
-}
-function closeViews(){viewOpen=false;document.getElementById('view').style.display='flex';document.getElementById('composer').style.display='flex';document.getElementById('hqView').classList.remove('active');document.getElementById('ghView').classList.remove('active');document.getElementById('modelSelect').style.display='';document.getElementById('confBtn').style.display='';renderMessages();}
-function openHQ(){showView('hq');document.getElementById('chatTitle').textContent='HQ (Notion)';
-  const url=localStorage.getItem(LS.hqUrl);const fr=document.getElementById('hqFrame'),em=document.getElementById('hqEmpty');
-  if(url){fr.src=url;fr.style.display='block';em.style.display='none';}else{fr.style.display='none';em.style.display='block';}
-}
-function saveHQUrl(){const v=document.getElementById('hqUrlInput').value.trim();if(!v)return;localStorage.setItem(LS.hqUrl,v);openHQ();}
-function openGH(){showView('gh');document.getElementById('chatTitle').textContent='Деплой на GitHub';}
-function onGhPathChange(){
-  const sel=document.getElementById('ghPathSelect');const inp=document.getElementById('ghPath');
-  if(sel.value==='__custom__'){inp.style.display='block';inp.value='';inp.focus();}
-  else{inp.style.display='none';inp.value=sel.value;}
-  const GH_REPO='bestdreambot/freex',GH_BRANCH='main';
-function utf8ToBase64(str){const bytes=new TextEncoder().encode(str);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);}
-async function pushToGitHub(){
-  const token=keys.key_github,status=document.getElementById('ghStatus');
-  const path=document.getElementById('ghPath').value.trim();
-  const content=document.getElementById('ghContent').value;
-  if(!token){status.textContent='Нет GitHub-токена — открой Настройки.';return;}
-  if(!path){status.textContent='Укажи путь к файлу.';return;}
-  if(!content.trim()){status.textContent='Вставь содержимое файла.';return;}
-  document.getElementById('ghPushBtn').disabled=true;status.textContent='Отправляю '+path+'...';
-  try{
-    const apiUrl='https://api.github.com/repos/'+GH_REPO+'/contents/'+path;
-    const getRes=await fetch(apiUrl+'?ref='+GH_BRANCH,{headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}});
-    let sha;
-    if(getRes.ok){sha=(await getRes.json()).sha;}
-    else if(getRes.status!==404){const e=await getRes.json().catch(()=>({}));throw new Error(e.message||('чтение '+getRes.status));}
-    const putRes=await fetch(apiUrl,{method:'PUT',headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:'FreeX: '+(sha?'обновление':'создание')+' '+path+', '+new Date().toISOString(),content:utf8ToBase64(content),sha,branch:GH_BRANCH})});
-    const putData=await putRes.json();
-    if(!putRes.ok)throw new Error(putData.message||'GitHub отклонил запрос');
-    status.textContent='✅ '+(sha?'Обновлён':'Создан')+' '+path+'\nКоммит: '+(putData.commit?.sha?.slice(0,7)||'—')+'\nVercel задеплоит за 1-2 минуты.';
-  }catch(err){status.textContent='Ошибка: '+err.message;}
-  document.getElementById('ghPushBtn').disabled=false;
-}
-
-function toggleSidebar(force){const sb=document.getElementById('sidebar'),ov=document.getElementById('sidebarOverlay');const open=force===undefined?!sb.classList.contains('open'):force;sb.classList.toggle('open',open);ov.classList.toggle('open',open);}
-
-function populateModelSelect(){
-  const sel=document.getElementById('modelSelect');const avail=availableModels();
-  const list=avail.length?avail:ALL_MODELS;
-  sel.innerHTML=list.map(m=>'<option value="'+m.id+'">'+m.label+'</option>').join('');
-  sel.onchange=()=>{const c=getActiveChat();if(c){c.model=sel.value;save(LS.chats,chats);}};
-}
-applyTheme(localStorage.getItem(LS.theme)||'dark');
-populateModelSelect();
-if(!activeId&&chats.length)activeId=chats[0].id;
-renderAll();loadDraft();refreshSend();
-
-const topbar=document.getElementById('topbar');
-const chatTab=document.createElement('button');chatTab.className='tab-btn active';chatTab.textContent='💬 Чат';chatTab.onclick=()=>switchMainTab('chat');
-const notesTab=document.createElement('button');notesTab.className='tab-btn';notesTab.textContent='📝 Заметки';notesTab.onclick=()=>switchMainTab('notes');
-topbar.appendChild(chatTab);topbar.appendChild(notesTab);
-
-const style=document.createElement('style');
-style.textContent='.tab-btn{background:var(--bg-2);color:var(--text-dim);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;flex:none;}.tab-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}';
-document.head.appendChild(style);
-
-switchMainTab(currentTab);
-</script>
+<script type="module" src="js/app.js?v=7.0"></script>
 </body>
 </html>
-
-}
diff --git a/js/app.js b/js/app.js
index ffe5dbc..f333d64 100644
--- a/js/app.js
+++ b/js/app.js
@@ -1,18 +1,302 @@
-// js/app.js - FreeX v7.0 Main Entry Point
-console.log('%c[FreeX v7.0] Modular version loaded', 'color:#10a37f');
-
-document.addEventListener('DOMContentLoaded', () => {
-  const app = document.getElementById('app');
-  if (app) {
-    app.innerHTML = `
-      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto; text-align: center; color: #eee;">
-        <h1 style="color: #10a37f; margin-bottom: 10px;">FreeX v7.0</h1>
-        <p style="font-size: 18px; color: #aaa;">Модульная структура активирована.</p>
-        <p style="color: #666; margin-top: 20px;">Рефакторинг в процессе. Полная версия скоро будет готова.</p>
-        <button onclick="location.reload()" style="margin-top: 30px; padding: 12px 28px; background: #10a37f; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
-          Перезагрузить
-        </button>
-      </div>
-    `;
+// js/app.js — FreeX v7.0 Main Orchestrator
+// Инициализация приложения + обработчики событий + логика отправки сообщений.
+// НЕ трогает HTML-структуру из index.html (никаких app.innerHTML).
+console.log('%c[FreeX v7.0] Modular app loaded', 'color:#10a37f');
+
+import { LS, ALL_MODELS, KEY_FIELDS, modelLabel } from './config.js';
+import { save, loadJSON, escapeHtml } from './utils.js';
+import { state, setState } from './state.js';
+import { db } from './db.js';
+import { callModel } from './api.js';
+import * as UI from './ui.js';
+import * as Chat from './chat.js';
+import * as Notes from './notes.js';
+import * as Sidebar from './sidebar.js';
+import { pushToGitHub as ghPush } from './github.js';
+
+let chatTabBtn = null;
+let notesTabBtn = null;
+
+/* ─────────────────────────── State init ─────────────────────────── */
+function initState() {
+  setState({
+    chats: loadJSON(LS.chats, []),
+    folders: loadJSON(LS.folders, []),
+    keys: loadJSON(LS.keys, {}),
+    activeId: localStorage.getItem(LS.active) || null,
+    currentTab: localStorage.getItem(LS.tab) || 'chat',
+    aiMemoryEnabled: localStorage.getItem(LS.aiMemory) === 'true',
+    viewOpen: false,
+    editingNoteId: null
+  });
+  if (!state.activeId && state.chats.length) setState({ activeId: state.chats[0].id });
+}
+
+/* ─────────────────────────── Tab switching ──────────────────────── */
+function switchTab(tab) {
+  setState({ currentTab: tab });
+  localStorage.setItem(LS.tab, tab);
+  document.body.dataset.activeTab = tab;
+
+  document.getElementById('messages').style.display = tab === 'chat' ? 'flex' : 'none';
+  document.getElementById('notesView').style.display = tab === 'notes' ? 'flex' : 'none';
+  document.getElementById('noteEditor').style.display = 'none';
+  document.getElementById('view').style.display = 'flex';
+
+  const cb = document.getElementById('contextBar');
+  cb.style.display = (tab === 'chat' && cb.innerHTML) ? 'block' : 'none';
+
+  chatTabBtn && chatTabBtn.classList.toggle('active', tab === 'chat');
+  notesTabBtn && notesTabBtn.classList.toggle('active', tab === 'notes');
+
+  if (tab === 'notes') Notes.renderNotes();
+  else Chat.renderMessages();
+}
+
+/* ─────────────────────────── Settings ───────────────────────────── */
+function openSettings() {
+  KEY_FIELDS.forEach(k => { const el = document.getElementById(k); if (el) el.value = state.keys[k] || ''; });
+  Notes.renderAiMemoryBtn();
+  document.getElementById('settingsModal').classList.add('open');
+}
+function closeSettings() {
+  document.getElementById('settingsModal').classList.remove('open');
+}
+function saveSettings() {
+  KEY_FIELDS.forEach(k => { const el = document.getElementById(k); if (el) state.keys[k] = el.value.trim(); });
+  save(LS.keys, state.keys);
+  Chat.populateModelSelect();
+  closeSettings();
+  Chat.renderMessages();
+  UI.showToast('Ключи сохранены');
+}
+
+/* ──────────────────────── Data export / import ──────────────────── */
+function exportData() {
+  const data = { exported: new Date().toISOString(), chats: state.chats, folders: state.folders, version: 'FreeX v7.0' };
+  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
+  const a = document.createElement('a');
+  a.href = URL.createObjectURL(blob);
+  a.download = 'freex_backup_' + new Date().toISOString().slice(0, 10) + '.json';
+  a.click();
+}
+function importData(e) {
+  const file = e.target.files[0];
+  if (!file) return;
+  const r = new FileReader();
+  r.onload = ev => {
+    try {
+      const d = JSON.parse(ev.target.result);
+      if (Array.isArray(d.chats)) {
+        state.chats = d.chats;
+        state.folders = Array.isArray(d.folders) ? d.folders : [];
+        setState({ activeId: state.chats[0]?.id || null });
+        save(LS.chats, state.chats);
+        save(LS.folders, state.folders);
+        if (state.activeId) localStorage.setItem(LS.active, state.activeId);
+        Chat.renderAll();
+        alert('✅ Импорт выполнен');
+      } else alert('❌ Неверный формат');
+    } catch (err) { alert('❌ Ошибка чтения'); }
+  };
+  r.readAsText(file);
+  e.target.value = '';
+}
+
+/* ─────────────────────── GitHub deploy wrapper ──────────────────── */
+function pushToGitHub() {
+  const path = document.getElementById('ghPath').value.trim();
+  const content = document.getElementById('ghContent').value;
+  const statusEl = document.getElementById('ghStatus');
+  ghPush(path, content, statusEl);
+}
+
+/* ───────────────────────── Send message ─────────────────────────── */
+async function sendMessage() {
+  const input = document.getElementById('input');
+  const text = input.value.trim();
+  if (!text) return;
+  localStorage.removeItem(LS.draft);
+
+  let chat = Chat.getActiveChat();
+  if (!chat) { Chat.newChat(); chat = Chat.getActiveChat(); }
+
+  chat.messages.push({ role: 'user', text });
+  if (chat.messages.filter(m => m.role === 'user').length === 1) chat.title = text.slice(0, 30);
+  save(LS.chats, state.chats);
+  input.value = '';
+  UI.autoGrow(input);
+  UI.refreshSend();
+  Chat.renderMessages();
+  document.getElementById('sendBtn').disabled = true;
+
+  const contextNotes = await Notes.renderContextBar(text);
+
+  let sequence;
+  if (chat.conf) sequence = Chat.availableModels().map(m => m.id);
+  else sequence = [chat.model];
+
+  if (!sequence.length) {
+    chat.messages.push({ role: 'ai', text: '⚠️ Нет ни одного ключа. Открой Настройки и добавь хотя бы один API-ключ.' });
+    save(LS.chats, state.chats);
+    Chat.renderMessages();
+    document.getElementById('sendBtn').disabled = false;
+    return;
   }
-});
\ No newline at end of file
+
+  const viewEl = document.getElementById('view');
+
+  for (let i = 0; i < sequence.length; i++) {
+    const modelId = sequence[i];
+    const model = ALL_MODELS.find(m => m.id === modelId);
+    if (chat.conf && i > 0) {
+      chat.messages.push({ role: 'sep', text: 'Дальше отвечает: ' + modelLabel(modelId) });
+      save(LS.chats, state.chats);
+      Chat.renderMessages();
+    }
+    const apiKey = state.keys[model?.keyField || ''];
+    if (!apiKey) {
+      chat.messages.push({ role: 'ai', model: modelId, text: '⚠️ Нет ключа для ' + modelLabel(modelId) + ' — добавь в Настройках.' });
+      save(LS.chats, state.chats);
+      Chat.renderMessages();
+      continue;
+    }
+
+    const box = document.getElementById('messages');
+    const t = document.createElement('div');
+    t.className = 'typing-wrapper';
+    t.innerHTML = '<div class="avatar">🔮</div><div class="typing-box"><div class="typing-label">' + modelLabel(modelId) + ' печатает...</div><div class="dots"><span></span><span></span><span></span></div></div>';
+    box.appendChild(t);
+    viewEl.scrollTop = viewEl.scrollHeight;
+
+    try {
+      let history = Chat.buildHistory(chat);
+      const sysParts = [];
+      if (contextNotes.length) {
+        sysParts.push('[Контекст из заметок пользователя: ' + contextNotes.map(n => n.title).join(', ') + '. Если уместно, цитируй [[название]] и используй эту информацию.]');
+      }
+      if (state.aiMemoryEnabled) {
+        sysParts.push('[Ты можешь создавать и обновлять заметки пользователя. Если пользователь просит запомнить что-то или ты считаешь информацию важной, используй тег: <note title="Название">Содержимое заметки</note>. Не упоминай тег в ответе — он обработается автоматически.]');
+      }
+      if (sysParts.length) {
+        const sysText = sysParts.join('\n\n');
+        if (model.provider === 'gemini') {
+          const firstUserIdx = history.findIndex(m => m.role === 'user');
+          if (firstUserIdx >= 0) history[firstUserIdx].content = sysText + '\n\n' + history[firstUserIdx].content;
+          else history.unshift({ role: 'user', content: sysText });
+        } else {
+          history.unshift({ role: 'system', content: sysText });
+        }
+      }
+      const extra = {};
+      if (model.provider === 'cloudflare') extra.account = state.keys.key_cf_account || '';
+      let reply = await callModel(model, history, apiKey, extra);
+      reply = await Notes.processAiMemory(reply);
+      chat.messages.push({ role: 'ai', model: modelId, text: reply });
+    } catch (err) {
+      chat.messages.push({ role: 'ai', model: modelId, text: '❌ ' + err.message });
+    }
+    save(LS.chats, state.chats);
+    Chat.renderMessages();
+  }
+  document.getElementById('sendBtn').disabled = false;
+}
+
+/* ─────────────────── Wire global (inline handlers) ──────────────── */
+function exposeGlobals() {
+  // UI helpers
+  window.toggleSidebar = UI.toggleSidebar;
+  window.setTheme = UI.setTheme;
+  window.applyTheme = UI.applyTheme;
+  window.switchSettingsTab = UI.switchSettingsTab;
+  window.onKeyDown = UI.onKeyDown;
+  window.refreshSend = UI.refreshSend;
+  window.showToast = UI.showToast;
+  window.autoGrow = (el) => { UI.autoGrow(el); UI.refreshSend(); };
+
+  // App orchestrator
+  window.sendMessage = sendMessage;
+  window.openSettings = openSettings;
+  window.closeSettings = closeSettings;
+  window.saveSettings = saveSettings;
+  window.exportData = exportData;
+  window.importData = importData;
+  window.switchTab = switchTab;
+  window.pushToGitHub = pushToGitHub;
+
+  // Chat module
+  window.newChat = Chat.newChat;
+  window.selectChat = Chat.selectChat;
+  window.deleteChat = Chat.deleteChat;
+  window.toggleConf = Chat.toggleConf;
+  window.copyMessage = Chat.copyMessage;
+  window.openHQ = Chat.openHQ;
+  window.openGH = Chat.openGH;
+  window.closeViews = Chat.closeViews;
+  window.saveHQUrl = Chat.saveHQUrl;
+  window.onGhPathChange = Chat.onGhPathChange;
+
+  // Sidebar module
+  window.newFolder = Sidebar.newFolder;
+  window.deleteFolder = Sidebar.deleteFolder;
+  window.moveChatToFolder = Sidebar.moveChatToFolder;
+
+  // Notes module
+  window.newNote = Notes.newNote;
+  window.saveNote = Notes.saveNote;
+  window.closeEditor = Notes.closeEditor;
+  window.editNote = Notes.editNote;
+  window.openNoteByTitle = Notes.openNoteByTitle;
+  window.renderNotes = Notes.renderNotes;
+  window.setAiMemory = Notes.setAiMemory;
+  window.exportNotes = Notes.exportNotes;
+  window.importNotes = Notes.importNotes;
+  window.clearAllNotes = Notes.clearAllNotes;
+}
+
+/* ─────────────────── Topbar tab buttons + styles ────────────────── */
+function buildTabButtons() {
+  const topbar = document.getElementById('topbar');
+  chatTabBtn = document.createElement('button');
+  chatTabBtn.className = 'tab-btn active';
+  chatTabBtn.textContent = '💬 Чат';
+  chatTabBtn.onclick = () => switchTab('chat');
+  notesTabBtn = document.createElement('button');
+  notesTabBtn.className = 'tab-btn';
+  notesTabBtn.textContent = '📝 Заметки';
+  notesTabBtn.onclick = () => switchTab('notes');
+  topbar.appendChild(chatTabBtn);
+  topbar.appendChild(notesTabBtn);
+
+  const style = document.createElement('style');
+  style.textContent = '.tab-btn{background:var(--bg-2);color:var(--text-dim);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;flex:none;}.tab-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}';
+  document.head.appendChild(style);
+}
+
+/* ─────────────────────────── Bootstrap ──────────────────────────── */
+function init() {
+  initState();
+  exposeGlobals();
+
+  UI.applyTheme(localStorage.getItem(LS.theme) || 'dark');
+  Chat.populateModelSelect();
+  Chat.renderAll();
+  UI.loadDraft();
+  UI.refreshSend();
+
+  // Save draft on input
+  const inputEl = document.getElementById('input');
+  if (inputEl) inputEl.addEventListener('input', () => {
+    localStorage.setItem(LS.draft, inputEl.value);
+  });
+
+  buildTabButtons();
+  switchTab(state.currentTab);
+}
+
+// Module scripts are deferred, so DOM is ready. Guard just in case.
+if (document.readyState === 'loading') {
+  document.addEventListener('DOMContentLoaded', init);
+} else {
+  init();
+}
diff --git a/js/chat.js b/js/chat.js
index 218c93d..29d76d5 100644
--- a/js/chat.js
+++ b/js/chat.js
@@ -5,7 +5,7 @@ import { state, setState } from './state.js';
 import { db } from './db.js';
 import { callModel } from './api.js';
 import { renderSidebarList } from './sidebar.js';
-import { applyTheme } from './ui.js';
+import { toggleSidebar } from './ui.js';
 
 const viewEl = document.getElementById('view');
 
@@ -189,7 +189,3 @@ export function onGhPathChange() {
   if (sel.value === '__custom__') { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
   else { inp.style.display = 'none'; inp.value = sel.value; }
 }
-
-// Need to import these to avoid circular deps
-import { toggleSidebar } from './ui.js';
-import { renderSidebarList } from './sidebar.js';
diff --git a/js/db.js b/js/db.js
index 578dae8..969f39f 100644
--- a/js/db.js
+++ b/js/db.js
@@ -1,5 +1,5 @@
 // FreeX Database (Dexie)
-import Dexie from 'https://unpkg.com/dexie@4.0.4/dist/dexie.min.js';
+import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4.0.4/+esm';
 
 export const db = new Dexie('FreeXDB');
 db.version(1).stores({
diff --git a/js/sidebar.js b/js/sidebar.js
index c63bbcc..fb77d75 100644
--- a/js/sidebar.js
+++ b/js/sidebar.js
@@ -37,7 +37,7 @@ export function moveChatToFolder(id, ev) {
 }
 
 function chatItemHTML(c) {
-  return '<div class="sb-item ' + (c.id === state.activeId && !state.viewOpen ? 'active' : '') + '" onclick="window.selectChat\'' + c.id + '\')"><span>' + escapeHtml(c.title) + '</span><span style="display:flex;gap:6px;"><span class="del" onclick="window.moveChatToFolder(\'' + c.id + '\',event)" title="В папку">📁</span><span class="del" onclick="window.deleteChat(\'' + c.id + '\',event)">✕</span></span></div>';
+  return '<div class="sb-item ' + (c.id === state.activeId && !state.viewOpen ? 'active' : '') + '" onclick="window.selectChat(\'' + c.id + '\')"><span>' + escapeHtml(c.title) + '</span><span style="display:flex;gap:6px;"><span class="del" onclick="window.moveChatToFolder(\'' + c.id + '\',event)" title="В папку">📁</span><span class="del" onclick="window.deleteChat(\'' + c.id + '\',event)">✕</span></span></div>';
 }
 
 export function renderSidebarList() {
diff --git a/js/ui.js b/js/ui.js
index 82c939a..b01dc4e 100644
--- a/js/ui.js
+++ b/js/ui.js
@@ -68,3 +68,27 @@ export function switchSettingsTab(id) {
   document.getElementById(id).classList.add('active');
   document.querySelector('.tab[data-tab="' + id + '"]').classList.add('active');
 }
+
+let toastTimer = null;
+export function showToast(msg, ms = 2600) {
+  let el = document.getElementById('freexToast');
+  if (!el) {
+    el = document.createElement('div');
+    el.id = 'freexToast';
+    el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);' +
+      'background:var(--bg-3);color:var(--text);border:1px solid var(--line);border-radius:12px;' +
+      'padding:10px 18px;font-size:14px;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
+      'opacity:0;transition:opacity .2s ease,transform .2s ease;pointer-events:none;max-width:80vw;text-align:center;';
+    document.body.appendChild(el);
+  }
+  el.textContent = msg;
+  requestAnimationFrame(() => {
+    el.style.opacity = '1';
+    el.style.transform = 'translateX(-50%) translateY(0)';
+  });
+  clearTimeout(toastTimer);
+  toastTimer = setTimeout(() => {
+    el.style.opacity = '0';
+    el.style.transform = 'translateX(-50%) translateY(20px)';
+  }, ms);
+}
-- 
2.39.5
From 763a5923a9c805e0ed696fbcff5311bf5b1d496f Mon Sep 17 00:00:00 2001
From: bestdreambot <212590801+bestdreambot@users.noreply.github.com>
Date: Sun, 12 Jul 2026 14:40:56 +0000
Subject: [PATCH] =?UTF-8?q?fix:=20working=20modular=20app=20=E2=80=94=20re?=
 =?UTF-8?q?al=20app.js=20orchestrator=20+=20ui.js=20helpers?=
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

- js/app.js: full orchestrator (state init, event wiring, sendMessage,
  conference/single mode, settings, data export/import, tab switching,
  GitHub deploy wrapper). Removed 'refactoring in progress' stub.
- js/ui.js: add showToast helper (toggleSidebar/applyTheme/etc already present).
- index.html: modular skeleton — keeps full HTML structure, loads app.js
  as <script type=module>; no more monolithic inline script.
- js/sidebar.js: fix broken selectChat onclick (missing paren).
- js/db.js: import Dexie from ESM build (+esm) — UMD min build has no export.
- js/chat.js: remove duplicate renderSidebarList import (SyntaxError).
- Visual bugs fixed via existing style.css: composer hides in note editor,
  user avatar uses var(--bg-3), sidebar active-chat color conflict resolved.
---
 index.html    | 462 +-------------------------------------------------
 js/app.js     | 318 ++++++++++++++++++++++++++++++++--
 js/chat.js    |   6 +-
 js/db.js      |   2 +-
 js/sidebar.js |   2 +-
 js/ui.js      |  24 +++
 6 files changed, 335 insertions(+), 479 deletions(-)

diff --git a/index.html b/index.html
index cb90370..5179ae9 100644
--- a/index.html
+++ b/index.html
@@ -8,15 +8,13 @@
 <meta name="apple-mobile-web-app-capable" content="yes">
 <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
 <meta name="apple-mobile-web-app-title" content="FreeX">
-<title>FreeX v6.2</title>
-<script src="https://unpkg.com/dexie@4.0.4/dist/dexie.min.js"></script>
-<script src="https://unpkg.com/marked@11.1.1/marked.min.js"></script>
-<link rel="stylesheet" href="style.css">
+<title>FreeX v7.0</title>
+<link rel="stylesheet" href="style.css?v=7.0">
 </head>
-<body>
+<body data-active-tab="chat">
 <div id="sidebarOverlay" onclick="toggleSidebar(false)"></div>
 <div id="sidebar">
-  <div class="sb-head">FreeX v6.2</div>
+  <div class="sb-head">FreeX v7.0</div>
   <div class="sb-newbtn" onclick="newChat()">+ Новый чат</div>
   <div class="sb-newbtn" onclick="newNote()">+ Новая заметка</div>
   <div class="sb-item" onclick="openHQ()">🗂 HQ (Notion)</div>
@@ -41,7 +39,7 @@
     </div>
     <div id="noteEditor">
       <input id="noteTitle" placeholder="Название заметки">
-      <textarea id="noteContent" placeholder="Пиши здесь. Используй [[Название заметки]] для ссылок.&#10;&#10;AI может создавать заметки через теги:&#10;<note title="Название">Содержимое</note>"></textarea>
+      <textarea id="noteContent" placeholder="Пиши здесь. Используй [[Название заметки]] для ссылок.&#10;&#10;AI может создавать заметки через теги:&#10;<note title=&quot;Название&quot;>Содержимое</note>"></textarea>
       <div class="btn-row"><button class="btn sec" onclick="closeEditor()">← Назад</button><button class="btn" onclick="saveNote()">💾 Сохранить</button></div>
     </div>
   </div>
@@ -123,7 +121,7 @@
           <button class="opt-btn" id="aiMemOff" onclick="setAiMemory(false)">❌ Выключена</button>
           <button class="opt-btn" id="aiMemOn" onclick="setAiMemory(true)">✅ Включена</button>
         </div>
-        <div class="info-box">Когда включена, модель может создавать и обновлять заметки через теги <code><note title="...">...</note></code>. Это позволяет AI запоминать факты между чатами.</div>
+        <div class="info-box">Когда включена, модель может создавать и обновлять заметки через теги <code>&lt;note title="..."&gt;...&lt;/note&gt;</code>. Это позволяет AI запоминать факты между чатами.</div>
       </div>
       <div class="setting-group">
         <button class="btn-secondary" onclick="clearAllNotes()" style="color:var(--danger);border-color:var(--danger);">🗑 Удалить все заметки</button>
@@ -131,452 +129,6 @@
     </div>
   </div>
 </div>
-<script>
-const LS={chats:'freex_chats',folders:'freex_folders',keys:'freex_keys',hqUrl:'freex_hq_url',active:'freex_active_chat',draft:'freex_draft',theme:'freex_theme',aiMemory:'freex_ai_memory',tab:'freex_tab'};
-function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch(e){return f;}}
-function save(k,v){localStorage.setItem(k,JSON.stringify(v));}
-
-let chats=loadJSON(LS.chats,[]);
-let folders=loadJSON(LS.folders,[]);
-let keys=loadJSON(LS.keys,{});
-let activeId=localStorage.getItem(LS.active)||null;
-let viewOpen=false;
-let currentTab=localStorage.getItem(LS.tab)||'chat';
-let aiMemoryEnabled=localStorage.getItem(LS.aiMemory)==='true';
-let editingNoteId=null;
-
-let db;
-try{
-  db = new Dexie('FreeXDB');
-  db.version(1).stores({notes: '++id, title, updatedAt, *tags', chats: '++id, title, updatedAt', messages: '++id, chatId, role, model, content, createdAt'});
-}catch(e){
-  console.error('Dexie failed:', e);
-  db = {notes:{toArray:async()=>[],filter:()=>({toArray:async()=>[],first:async()=>null}),get:async()=>null,add:async()=>{},update:async()=>{},clear:async()=>{}},orderBy:()=>({reverse:()=>({toArray:async()=>[]})})};
-}
-
-const ALL_MODELS=[
-  {id:'deepseek',label:'DeepSeek',provider:'deepseek',keyField:'key_deepseek',model:'deepseek-chat'},
-  {id:'gh_gpt4o',label:'GPT-4o (GitHub)',provider:'github',keyField:'key_github',model:'gpt-4o'},
-  {id:'gh_r1',label:'DeepSeek-R1 (GitHub)',provider:'github',keyField:'key_github',model:'DeepSeek-R1'},
-  {id:'gemini',label:'Gemini 2.5 Flash',provider:'gemini',keyField:'key_gemini',model:'gemini-2.5-flash'},
-  {id:'groq',label:'Llama 3.3 70B (Groq)',provider:'groq',keyField:'key_groq',model:'llama-3.3-70b-versatile'},
-  {id:'cf_llama',label:'Llama 3.3 (Cloudflare)',provider:'cloudflare',keyField:'key_cloudflare',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}
-];
-function availableModels(){return ALL_MODELS.filter(m=>keys[m.keyField]);}
-function modelLabel(id){return (ALL_MODELS.find(m=>m.id===id)||{}).label||id;}
-
-function exportData(){
-  const data={exported:new Date().toISOString(),chats,folders,version:'FreeX v6.2'};
-  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
-  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
-  a.download='freex_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();
-}
-function importData(e){
-  const file=e.target.files[0];if(!file)return;
-  const r=new FileReader();
-  r.onload=ev=>{try{const d=JSON.parse(ev.target.result);
-    if(Array.isArray(d.chats)){chats=d.chats;folders=Array.isArray(d.folders)?d.folders:[];activeId=chats[0]?.id||null;
-      save(LS.chats,chats);save(LS.folders,folders);if(activeId)localStorage.setItem(LS.active,activeId);renderAll();alert('✅ Импорт выполнен');}
-    else alert('❌ Неверный формат');
-  }catch(err){alert('❌ Ошибка чтения');}};
-  r.readAsText(file);e.target.value='';
-}
-
-async function exportNotes(){
-  const notes=await db.notes.toArray();
-  const data={exported:new Date().toISOString(),notes,version:'FreeX Notes v1'};
-  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
-  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
-  a.download='freex_notes_'+new Date().toISOString().slice(0,10)+'.json';a.click();
-}
-async function importNotes(e){
-  const file=e.target.files[0];if(!file)return;
-  const r=new FileReader();
-  r.onload=async ev=>{try{const d=JSON.parse(ev.target.result);
-    if(Array.isArray(d.notes)){
-      await db.notes.clear();
-      for(const n of d.notes){
-        await db.notes.add({title:n.title,content:n.content,tags:n.tags||[],createdAt:n.createdAt||Date.now(),updatedAt:n.updatedAt||Date.now()});
-      }
-      alert('✅ Заметки импортированы: '+d.notes.length);
-      if(currentTab==='notes')renderNotes();
-    }else alert('❌ Неверный формат');
-  }catch(err){alert('❌ Ошибка: '+err.message);}};
-  r.readAsText(file);e.target.value='';
-}
-
-function applyTheme(t){
-  const r=document.documentElement;
-  if(t==='light'){r.style.setProperty('--bg','#f0f0f2');r.style.setProperty('--bg-2','#e8e8ea');r.style.setProperty('--bg-3','#dddde0');r.style.setProperty('--line','#c8c8cc');r.style.setProperty('--text','#1a1a1e');r.style.setProperty('--text-dim','#6a6a74');r.style.setProperty('--bg-rgb','240,240,242');document.getElementById('app').style.background='#f0f0f2';}
-  else if(t==='dark'){r.style.setProperty('--bg','#212121');r.style.setProperty('--bg-2','#2f2f2f');r.style.setProperty('--bg-3','#3a3a3a');r.style.setProperty('--line','#4a4a4a');r.style.setProperty('--text','#ececec');r.style.setProperty('--text-dim','#9b9b9b');r.style.setProperty('--bg-rgb','33,33,33');document.getElementById('app').style.background='#212121';}
-  else{applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');return;}
-  localStorage.setItem(LS.theme,t);
-  document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));
-}
-function setTheme(t){applyTheme(t);}
-
-function setAiMemory(v){aiMemoryEnabled=v;localStorage.setItem(LS.aiMemory,v);renderAiMemoryBtn();}
-function renderAiMemoryBtn(){
-  document.getElementById('aiMemOn').classList.toggle('active',aiMemoryEnabled);
-  document.getElementById('aiMemOff').classList.toggle('active',!aiMemoryEnabled);
-}
-async function clearAllNotes(){if(!confirm('Удалить ВСЕ заметки? Это необратимо.'))return;await db.notes.clear();if(currentTab==='notes')renderNotes();}
-
-function newFolder(){
-  const name=prompt('Название папки:');if(!name)return;
-  folders.unshift({id:'f'+Date.now(),name});save(LS.folders,folders);renderSidebarList();
-}
-function deleteFolder(id,ev){
-  ev.stopPropagation();
-  if(!confirm('Удалить папку? Чаты внутри станут без папки.'))return;
-  chats.forEach(c=>{if(c.folder===id)c.folder=null;});
-  folders=folders.filter(f=>f.id!==id);
-  save(LS.folders,folders);save(LS.chats,chats);renderSidebarList();
-}
-function moveChatToFolder(id,ev){
-  ev.stopPropagation();
-  const names=folders.map((f,i)=>(i+1)+'. '+f.name).join('\n');
-  const ans=prompt('В какую папку? Введи номер (0 — без папки):\n0. Без папки\n'+names);
-  if(ans===null)return;
-  const idx=parseInt(ans,10);
-  const chat=chats.find(c=>c.id===id);if(!chat)return;
-  chat.folder=(idx===0||isNaN(idx))?null:(folders[idx-1]?.id||null);
-  save(LS.chats,chats);renderSidebarList();
-}
-
-function newChat(){
-  const chat={id:'c'+Date.now(),title:'Новый чат',model:(availableModels()[0]||ALL_MODELS[0]).id,conf:false,folder:null,messages:[]};
-  chats.unshift(chat);activeId=chat.id;save(LS.chats,chats);localStorage.setItem(LS.active,activeId);
-  renderAll();toggleSidebar(false);closeViews();
-}
-function getActiveChat(){return chats.find(c=>c.id===activeId);}
-function selectChat(id){activeId=id;localStorage.setItem(LS.active,id);closeViews();renderAll();toggleSidebar(false);}
-function deleteChat(id,ev){ev.stopPropagation();chats=chats.filter(c=>c.id!==id);if(activeId===id)activeId=chats[0]?.id||null;save(LS.chats,chats);renderAll();}
-
-function chatItemHTML(c){
-  return '<div class="sb-item '+(c.id===activeId&&!viewOpen?'active':'')+'" onclick="selectChat(\''+c.id+'\')"><span>'+escapeHtml(c.title)+'</span><span style="display:flex;gap:6px;"><span class="del" onclick="moveChatToFolder(\''+c.id+'\',event)" title="В папку">📁</span><span class="del" onclick="deleteChat(\''+c.id+'\',event)">✕</span></span></div>';
-}
-function renderSidebarList(){
-  const list=document.getElementById('chatList');let html='';
-  folders.forEach(f=>{
-    html+='<div class="sb-folder"><span class="fname">📁 '+escapeHtml(f.name)+'</span><span class="del" onclick="deleteFolder(\''+f.id+'\',event)">✕</span></div>';
-    chats.filter(c=>c.folder===f.id).forEach(c=>{html+='<div class="sb-chat-in-folder">'+chatItemHTML(c)+'</div>';});
-  });
-  const loose=chats.filter(c=>!c.folder||!folders.find(f=>f.id===c.folder));
-  if(loose.length){html+='<div class="sb-label" style="text-transform:none;">Чаты</div>';loose.forEach(c=>{html+=chatItemHTML(c);});}
-  list.innerHTML=html||'<div class="sb-label">Пока пусто</div>';
-}
-
-const viewEl=document.getElementById('view');
-
-function renderMessages(){
-  const chat=getActiveChat();const box=document.getElementById('messages');
-  document.getElementById('chatTitle').textContent=chat?(chat.conf?'🎯 Конференция':chat.title):'FreeX';
-  const sel=document.getElementById('modelSelect');
-  if(chat){sel.value=chat.model;sel.disabled=!!chat.conf;document.getElementById('confBtn').classList.toggle('on',!!chat.conf);}
-  if(!chat){box.innerHTML='<div class="empty">Нет открытого чата.<br><b>+ Новый чат</b> в меню слева.</div>';return;}
-  if(chat.messages.length===0){
-    box.innerHTML='<div class="empty">'+(chat.conf?'Конференция включена: все модели с ключами ответят по очереди.':'Выбери модель и начни диалог. Кнопка 🎯 Конференция — опросить всех сразу.')+'</div>';return;
-  }
-  box.innerHTML=chat.messages.map((m,idx)=>{
-    if(m.role==='sep')return '<div class="sepMsg">'+escapeHtml(m.text)+'</div>';
-    const isUser=m.role==='user';
-    const label=(!isUser&&m.model)?'<div class="msg-model-label">'+modelLabel(m.model)+'</div>':'';
-    const actions=!isUser?'<div class="msg-actions"><button onclick="copyMessage('+idx+')" id="cp_'+idx+'">📋 Копировать</button></div>':'';
-    return '<div class="msg-wrapper '+(isUser?'user':'ai')+'"><div class="avatar">'+(isUser?'👤':'🔮')+'</div><div class="msg-content">'+label+'<div class="msg-bubble">'+escapeHtml(m.text)+'</div>'+actions+'</div></div>';
-  }).join('');
-  if(viewEl)viewEl.scrollTop=viewEl.scrollHeight;
-}
-function copyMessage(idx){
-  const chat=getActiveChat();if(!chat)return;const msg=chat.messages[idx];if(!msg)return;
-  const done=()=>{const b=document.getElementById('cp_'+idx);if(b){const o=b.textContent;b.textContent='✅ Скопировано';setTimeout(()=>b.textContent=o,2000);}};
-  if(navigator.clipboard){navigator.clipboard.writeText(msg.text).then(done).catch(()=>fallback(msg.text,done));}
-  else fallback(msg.text,done);
-}
-function fallback(t,cb){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');}catch(e){}a.remove();cb&&cb();}
-
-function toggleConf(){let chat=getActiveChat();if(!chat){newChat();chat=getActiveChat();}chat.conf=!chat.conf;save(LS.chats,chats);renderMessages();}
-function renderAll(){renderSidebarList();renderMessages();}
-function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));}
-
-function autoGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';if(typeof refreshSend==='function')refreshSend();}
-function onKeyDown(e){
-  const mob=/iPhone|iPad|iPod|Android/.test(navigator.userAgent);
-  if(e.key==='Enter'){
-    if(mob&&!e.shiftKey){e.preventDefault();sendMessage();}
-    else if(!mob&&(e.metaKey||e.ctrlKey)){e.preventDefault();sendMessage();}
-  }
-}
-function refreshSend(){document.getElementById('sendBtn').disabled=document.getElementById('input').value.trim()==='';}
-document.getElementById('input').addEventListener('input',()=>{localStorage.setItem(LS.draft,document.getElementById('input').value);});
-function loadDraft(){const d=localStorage.getItem(LS.draft)||'';if(d){const i=document.getElementById('input');i.value=d;autoGrow(i);}}
-
-const MAX_HISTORY=12;
-function buildHistory(chat){
-  return chat.messages.filter(m=>(m.role==='user'||m.role==='ai')&&m.text!=null&&String(m.text).trim()!=='').slice(-MAX_HISTORY).map(m=>({role:m.role==='user'?'user':'assistant',content:String(m.text)}));
-}
-
-async function findRelevantNotes(query){
-  if(!query.trim())return[];
-  const words=query.toLowerCase().split(/\s+/).filter(w=>w.length>2);
-  if(!words.length)return[];
-  const allNotes=await db.notes.toArray();
-  const scored=allNotes.map(n=>{
-    const titleLow=n.title.toLowerCase();
-    const contentLow=n.content.toLowerCase();
-    let score=0;
-    words.forEach(w=>{
-      if(titleLow.includes(w))score+=3;
-      if(contentLow.includes(w))score+=1;
-      if(titleLow===w)score+=5;
-    });
-    return {...n,score};
-  }).filter(n=>n.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
-  return scored;
-}
-
-async function renderContextBar(query){
-  const bar=document.getElementById('contextBar');
-  const notes=await findRelevantNotes(query);
-  if(notes.length&&currentTab==='chat'){
-    bar.style.display='block';
-    bar.innerHTML='Контекст: '+notes.map(n=>`<span class="context-chip" onclick="openNoteByTitle('${escapeHtml(n.title).replace(/'/g,"\\'")}')">[[${escapeHtml(n.title)}]]</span>`).join('');
-  }else{
-    bar.style.display='none';
-    bar.innerHTML='';
-  }
-  return notes;
-}
-
-async function openNoteByTitle(title){
-  const note=await db.notes.filter(n=>n.title.toLowerCase()===title.toLowerCase()).first();
-  if(note){editingNoteId=note.id;document.getElementById('noteTitle').value=note.title;document.getElementById('noteContent').value=note.content;switchMainTab('notes');document.getElementById('view').style.display='none';document.getElementById('noteEditor').style.display='flex';}
-}
-
-function parseNoteTags(text){
-  const notes=[];
-  const regex=/<note\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/note>/gi;
-  let m;
-  while((m=regex.exec(text))!==null){
-    notes.push({title:m[1].trim(),content:m[2].trim()});
-  }
-  return notes;
-}
-
-async function processAiMemory(text){
-  if(!aiMemoryEnabled)return text;
-  const notes=parseNoteTags(text);
-  if(!notes.length)return text;
-  for(const n of notes){
-    const existing=await db.notes.filter(x=>x.title.toLowerCase()===n.title.toLowerCase()).first();
-    if(existing){
-      await db.notes.update(existing.id,{content:n.content,updatedAt:Date.now()});
-    }else{
-      await db.notes.add({title:n.title,content:n.content,tags:[],createdAt:Date.now(),updatedAt:Date.now()});
-    }
-  }
-  return text.replace(/<note\s+title=["'][^"']+["']\s*>[\s\S]*?<\/note>/gi,'').trim();
-}
-async function sendMessage(){
-  const input=document.getElementById('input');const text=input.value.trim();if(!text)return;
-  localStorage.removeItem(LS.draft);
-  let chat=getActiveChat();if(!chat){newChat();chat=getActiveChat();}
-  chat.messages.push({role:'user',text});
-  if(chat.messages.filter(m=>m.role==='user').length===1)chat.title=text.slice(0,30);
-  save(LS.chats,chats);input.value='';autoGrow(input);renderMessages();
-  document.getElementById('sendBtn').disabled=true;
-
-  const contextNotes=await renderContextBar(text);
-
-  let sequence;
-  if(chat.conf){sequence=availableModels().map(m=>m.id);if(!sequence.length)sequence=[];}
-  else sequence=[chat.model];
-
-  if(!sequence.length){
-    chat.messages.push({role:'ai',text:'⚠️ Нет ни одного ключа. Открой Настройки и добавь хотя бы один API-ключ.'});
-    save(LS.chats,chats);renderMessages();document.getElementById('sendBtn').disabled=false;return;
-  }
-
-  for(let i=0;i<sequence.length;i++){
-    const modelId=sequence[i];const model=ALL_MODELS.find(m=>m.id===modelId);
-    if(chat.conf&&i>0){chat.messages.push({role:'sep',text:'Дальше отвечает: '+modelLabel(modelId)});save(LS.chats,chats);renderMessages();}
-    const apiKey=keys[model?.keyField||''];
-    if(!apiKey){chat.messages.push({role:'ai',model:modelId,text:'⚠️ Нет ключа для '+modelLabel(modelId)+' — добавь в Настройках.'});save(LS.chats,chats);renderMessages();continue;}
-
-    const box=document.getElementById('messages');
-    const t=document.createElement('div');t.className='typing-wrapper';
-    t.innerHTML='<div class="avatar">🔮</div><div class="typing-box"><div class="typing-label">'+modelLabel(modelId)+' печатает...</div><div class="dots"><span></span><span></span><span></span></div></div>';
-    box.appendChild(t);viewEl.scrollTop=viewEl.scrollHeight;
-
-    try{
-      let history=buildHistory(chat);
-      const sysParts=[];
-      if(contextNotes.length){
-        sysParts.push('[Контекст из заметок пользователя: '+contextNotes.map(n=>n.title).join(', ')+'. Если уместно, цитируй [[название]] и используй эту информацию.]');
-      }
-      if(aiMemoryEnabled){
-        sysParts.push('[Ты можешь создавать и обновлять заметки пользователя. Если пользователь просит запомнить что-то или ты считаешь информацию важной, используй тег: <note title="Название">Содержимое заметки</note>. Не упоминай тег в ответе — он обработается автоматически.]');
-      }
-      if(sysParts.length){
-        const sysText=sysParts.join('\n\n');
-        if(model.provider==='gemini'){
-          const firstUserIdx=history.findIndex(m=>m.role==='user');
-          if(firstUserIdx>=0) history[firstUserIdx].content=sysText+'\n\n'+history[firstUserIdx].content;
-          else history.unshift({role:'user',content:sysText});
-        }else{
-          history.unshift({role:'system',content:sysText});
-        }
-      }
-      let reply=await callModel(model,history,apiKey);
-      reply=await processAiMemory(reply);
-      chat.messages.push({role:'ai',model:modelId,text:reply});
-    }catch(err){chat.messages.push({role:'ai',model:modelId,text:'❌ '+err.message});}
-    save(LS.chats,chats);renderMessages();
-  }
-  document.getElementById('sendBtn').disabled=false;
-}
-
-async function callModel(model,history,apiKey){
-  const extra={};
-  if(model.provider==='cloudflare')extra.account=keys.key_cf_account||'';
-  const r=await fetch('/api/chat',{
-    method:'POST',
-    headers:{'Content-Type':'application/json'},
-    body:JSON.stringify({provider:model.provider,model:model.model||'',messages:history,apiKey,...extra})
-  });
-  let d;
-  try{ d=await r.json(); }catch(e){ throw new Error('прокси не ответил (залей api/chat.js на GitHub)'); }
-  if(!r.ok)throw new Error(d.error||('ошибка '+r.status));
-  return d.content;
-}
-
-function switchMainTab(tab){
-  currentTab=tab;localStorage.setItem(LS.tab,tab);
-  document.getElementById('messages').style.display=tab==='chat'?'flex':'none';
-  document.getElementById('notesView').style.display=tab==='notes'?'flex':'none';
-  document.getElementById('composer').style.display=tab==='chat'?'flex':'none';
-  document.getElementById('contextBar').style.display=(tab==='chat'&&document.getElementById('contextBar').innerHTML)?'block':'none';
-  if(tab==='notes'){renderNotes();document.getElementById('view').style.display='flex';document.getElementById('noteEditor').style.display='none';}
-  else{renderMessages();}
-}
-
-async function renderNotes(){
-  const search=document.getElementById('searchNotes').value.toLowerCase();
-  let notes;
-  if(search){
-    notes=await db.notes.filter(n=>n.title.toLowerCase().includes(search)||n.content.toLowerCase().includes(search)).toArray();
-  }else{
-    notes=await db.notes.orderBy('updatedAt').reverse().toArray();
-  }
-  const list=document.getElementById('notesList');
-  list.innerHTML=notes.map(n=>{
-    const date=new Date(n.updatedAt).toLocaleDateString('ru-RU');
-    return `<div class="note-item" onclick="editNote(${n.id})"><div class="note-title">${escapeHtml(n.title)}</div><div class="note-snippet">${escapeHtml(n.content.slice(0,120))}${n.content.length>120?'...':''}</div><div class="note-meta">${date} ${n.tags.map(t=>`<span class="note-tag">#${escapeHtml(t)}</span>`).join('')}</div></div>`;
-  }).join('')||'<div class="empty">Заметок пока нет.<br>Нажми <b>+ Новая заметка</b> в меню слева.</div>';
-}
-
-function newNote(){editingNoteId=null;document.getElementById('noteTitle').value='';document.getElementById('noteContent').value='';document.getElementById('view').style.display='none';document.getElementById('noteEditor').style.display='flex';}
-async function saveNote(){
-  const title=document.getElementById('noteTitle').value.trim()||'Без названия';
-  const content=document.getElementById('noteContent').value;
-  const tags=extractTags(content);
-  if(editingNoteId) await db.notes.update(editingNoteId,{title,content,tags,updatedAt:Date.now()});
-  else await db.notes.add({title,content,tags,createdAt:Date.now(),updatedAt:Date.now()});
-  closeEditor();renderNotes();
-}
-function extractTags(text){
-  const tags=[];
-  const m=text.match(/#(\w+)/g);
-  if(m)m.forEach(t=>tags.push(t.slice(1)));
-  return [...new Set(tags)];
-}
-function closeEditor(){document.getElementById('noteEditor').style.display='none';document.getElementById('view').style.display='flex';}
-async function editNote(id){const n=await db.notes.get(id);editingNoteId=id;document.getElementById('noteTitle').value=n.title;document.getElementById('noteContent').value=n.content;document.getElementById('view').style.display='none';document.getElementById('noteEditor').style.display='flex';}
-
-const KEY_FIELDS=['key_deepseek','key_github','key_gemini','key_groq','key_cloudflare','key_cf_account'];
-function openSettings(){
-  KEY_FIELDS.forEach(k=>{const el=document.getElementById(k);if(el)el.value=keys[k]||'';});
-  renderAiMemoryBtn();
-  document.getElementById('settingsModal').classList.add('open');
-}
-function closeSettings(){document.getElementById('settingsModal').classList.remove('open');}
-function saveSettings(){KEY_FIELDS.forEach(k=>{const el=document.getElementById(k);if(el)keys[k]=el.value.trim();});save(LS.keys,keys);populateModelSelect();closeSettings();renderMessages();}
-function switchSettingsTab(id){
-  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
-  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
-  document.getElementById(id).classList.add('active');
-  document.querySelector('.tab[data-tab="'+id+'"]').classList.add('active');
-}
-
-function showView(which){
-  viewOpen=true;
-  document.getElementById('view').style.display='none';document.getElementById('composer').style.display='none';
-  document.getElementById('hqView').classList.toggle('active',which==='hq');
-  document.getElementById('ghView').classList.toggle('active',which==='gh');
-  document.getElementById('modelSelect').style.display='none';
-  document.getElementById('confBtn').style.display='none';
-  toggleSidebar(false);renderSidebarList();
-}
-function closeViews(){viewOpen=false;document.getElementById('view').style.display='flex';document.getElementById('composer').style.display='flex';document.getElementById('hqView').classList.remove('active');document.getElementById('ghView').classList.remove('active');document.getElementById('modelSelect').style.display='';document.getElementById('confBtn').style.display='';renderMessages();}
-function openHQ(){showView('hq');document.getElementById('chatTitle').textContent='HQ (Notion)';
-  const url=localStorage.getItem(LS.hqUrl);const fr=document.getElementById('hqFrame'),em=document.getElementById('hqEmpty');
-  if(url){fr.src=url;fr.style.display='block';em.style.display='none';}else{fr.style.display='none';em.style.display='block';}
-}
-function saveHQUrl(){const v=document.getElementById('hqUrlInput').value.trim();if(!v)return;localStorage.setItem(LS.hqUrl,v);openHQ();}
-function openGH(){showView('gh');document.getElementById('chatTitle').textContent='Деплой на GitHub';}
-function onGhPathChange(){
-  const sel=document.getElementById('ghPathSelect');const inp=document.getElementById('ghPath');
-  if(sel.value==='__custom__'){inp.style.display='block';inp.value='';inp.focus();}
-  else{inp.style.display='none';inp.value=sel.value;}
-  const GH_REPO='bestdreambot/freex',GH_BRANCH='main';
-function utf8ToBase64(str){const bytes=new TextEncoder().encode(str);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);}
-async function pushToGitHub(){
-  const token=keys.key_github,status=document.getElementById('ghStatus');
-  const path=document.getElementById('ghPath').value.trim();
-  const content=document.getElementById('ghContent').value;
-  if(!token){status.textContent='Нет GitHub-токена — открой Настройки.';return;}
-  if(!path){status.textContent='Укажи путь к файлу.';return;}
-  if(!content.trim()){status.textContent='Вставь содержимое файла.';return;}
-  document.getElementById('ghPushBtn').disabled=true;status.textContent='Отправляю '+path+'...';
-  try{
-    const apiUrl='https://api.github.com/repos/'+GH_REPO+'/contents/'+path;
-    const getRes=await fetch(apiUrl+'?ref='+GH_BRANCH,{headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}});
-    let sha;
-    if(getRes.ok){sha=(await getRes.json()).sha;}
-    else if(getRes.status!==404){const e=await getRes.json().catch(()=>({}));throw new Error(e.message||('чтение '+getRes.status));}
-    const putRes=await fetch(apiUrl,{method:'PUT',headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:'FreeX: '+(sha?'обновление':'создание')+' '+path+', '+new Date().toISOString(),content:utf8ToBase64(content),sha,branch:GH_BRANCH})});
-    const putData=await putRes.json();
-    if(!putRes.ok)throw new Error(putData.message||'GitHub отклонил запрос');
-    status.textContent='✅ '+(sha?'Обновлён':'Создан')+' '+path+'\nКоммит: '+(putData.commit?.sha?.slice(0,7)||'—')+'\nVercel задеплоит за 1-2 минуты.';
-  }catch(err){status.textContent='Ошибка: '+err.message;}
-  document.getElementById('ghPushBtn').disabled=false;
-}
-
-function toggleSidebar(force){const sb=document.getElementById('sidebar'),ov=document.getElementById('sidebarOverlay');const open=force===undefined?!sb.classList.contains('open'):force;sb.classList.toggle('open',open);ov.classList.toggle('open',open);}
-
-function populateModelSelect(){
-  const sel=document.getElementById('modelSelect');const avail=availableModels();
-  const list=avail.length?avail:ALL_MODELS;
-  sel.innerHTML=list.map(m=>'<option value="'+m.id+'">'+m.label+'</option>').join('');
-  sel.onchange=()=>{const c=getActiveChat();if(c){c.model=sel.value;save(LS.chats,chats);}};
-}
-applyTheme(localStorage.getItem(LS.theme)||'dark');
-populateModelSelect();
-if(!activeId&&chats.length)activeId=chats[0].id;
-renderAll();loadDraft();refreshSend();
-
-const topbar=document.getElementById('topbar');
-const chatTab=document.createElement('button');chatTab.className='tab-btn active';chatTab.textContent='💬 Чат';chatTab.onclick=()=>switchMainTab('chat');
-const notesTab=document.createElement('button');notesTab.className='tab-btn';notesTab.textContent='📝 Заметки';notesTab.onclick=()=>switchMainTab('notes');
-topbar.appendChild(chatTab);topbar.appendChild(notesTab);
-
-const style=document.createElement('style');
-style.textContent='.tab-btn{background:var(--bg-2);color:var(--text-dim);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;flex:none;}.tab-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}';
-document.head.appendChild(style);
-
-switchMainTab(currentTab);
-</script>
+<script type="module" src="js/app.js?v=7.0"></script>
 </body>
 </html>
-
-}
diff --git a/js/app.js b/js/app.js
index ffe5dbc..f333d64 100644
--- a/js/app.js
+++ b/js/app.js
@@ -1,18 +1,302 @@
-// js/app.js - FreeX v7.0 Main Entry Point
-console.log('%c[FreeX v7.0] Modular version loaded', 'color:#10a37f');
-
-document.addEventListener('DOMContentLoaded', () => {
-  const app = document.getElementById('app');
-  if (app) {
-    app.innerHTML = `
-      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto; text-align: center; color: #eee;">
-        <h1 style="color: #10a37f; margin-bottom: 10px;">FreeX v7.0</h1>
-        <p style="font-size: 18px; color: #aaa;">Модульная структура активирована.</p>
-        <p style="color: #666; margin-top: 20px;">Рефакторинг в процессе. Полная версия скоро будет готова.</p>
-        <button onclick="location.reload()" style="margin-top: 30px; padding: 12px 28px; background: #10a37f; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
-          Перезагрузить
-        </button>
-      </div>
-    `;
+// js/app.js — FreeX v7.0 Main Orchestrator
+// Инициализация приложения + обработчики событий + логика отправки сообщений.
+// НЕ трогает HTML-структуру из index.html (никаких app.innerHTML).
+console.log('%c[FreeX v7.0] Modular app loaded', 'color:#10a37f');
+
+import { LS, ALL_MODELS, KEY_FIELDS, modelLabel } from './config.js';
+import { save, loadJSON, escapeHtml } from './utils.js';
+import { state, setState } from './state.js';
+import { db } from './db.js';
+import { callModel } from './api.js';
+import * as UI from './ui.js';
+import * as Chat from './chat.js';
+import * as Notes from './notes.js';
+import * as Sidebar from './sidebar.js';
+import { pushToGitHub as ghPush } from './github.js';
+
+let chatTabBtn = null;
+let notesTabBtn = null;
+
+/* ─────────────────────────── State init ─────────────────────────── */
+function initState() {
+  setState({
+    chats: loadJSON(LS.chats, []),
+    folders: loadJSON(LS.folders, []),
+    keys: loadJSON(LS.keys, {}),
+    activeId: localStorage.getItem(LS.active) || null,
+    currentTab: localStorage.getItem(LS.tab) || 'chat',
+    aiMemoryEnabled: localStorage.getItem(LS.aiMemory) === 'true',
+    viewOpen: false,
+    editingNoteId: null
+  });
+  if (!state.activeId && state.chats.length) setState({ activeId: state.chats[0].id });
+}
+
+/* ─────────────────────────── Tab switching ──────────────────────── */
+function switchTab(tab) {
+  setState({ currentTab: tab });
+  localStorage.setItem(LS.tab, tab);
+  document.body.dataset.activeTab = tab;
+
+  document.getElementById('messages').style.display = tab === 'chat' ? 'flex' : 'none';
+  document.getElementById('notesView').style.display = tab === 'notes' ? 'flex' : 'none';
+  document.getElementById('noteEditor').style.display = 'none';
+  document.getElementById('view').style.display = 'flex';
+
+  const cb = document.getElementById('contextBar');
+  cb.style.display = (tab === 'chat' && cb.innerHTML) ? 'block' : 'none';
+
+  chatTabBtn && chatTabBtn.classList.toggle('active', tab === 'chat');
+  notesTabBtn && notesTabBtn.classList.toggle('active', tab === 'notes');
+
+  if (tab === 'notes') Notes.renderNotes();
+  else Chat.renderMessages();
+}
+
+/* ─────────────────────────── Settings ───────────────────────────── */
+function openSettings() {
+  KEY_FIELDS.forEach(k => { const el = document.getElementById(k); if (el) el.value = state.keys[k] || ''; });
+  Notes.renderAiMemoryBtn();
+  document.getElementById('settingsModal').classList.add('open');
+}
+function closeSettings() {
+  document.getElementById('settingsModal').classList.remove('open');
+}
+function saveSettings() {
+  KEY_FIELDS.forEach(k => { const el = document.getElementById(k); if (el) state.keys[k] = el.value.trim(); });
+  save(LS.keys, state.keys);
+  Chat.populateModelSelect();
+  closeSettings();
+  Chat.renderMessages();
+  UI.showToast('Ключи сохранены');
+}
+
+/* ──────────────────────── Data export / import ──────────────────── */
+function exportData() {
+  const data = { exported: new Date().toISOString(), chats: state.chats, folders: state.folders, version: 'FreeX v7.0' };
+  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
+  const a = document.createElement('a');
+  a.href = URL.createObjectURL(blob);
+  a.download = 'freex_backup_' + new Date().toISOString().slice(0, 10) + '.json';
+  a.click();
+}
+function importData(e) {
+  const file = e.target.files[0];
+  if (!file) return;
+  const r = new FileReader();
+  r.onload = ev => {
+    try {
+      const d = JSON.parse(ev.target.result);
+      if (Array.isArray(d.chats)) {
+        state.chats = d.chats;
+        state.folders = Array.isArray(d.folders) ? d.folders : [];
+        setState({ activeId: state.chats[0]?.id || null });
+        save(LS.chats, state.chats);
+        save(LS.folders, state.folders);
+        if (state.activeId) localStorage.setItem(LS.active, state.activeId);
+        Chat.renderAll();
+        alert('✅ Импорт выполнен');
+      } else alert('❌ Неверный формат');
+    } catch (err) { alert('❌ Ошибка чтения'); }
+  };
+  r.readAsText(file);
+  e.target.value = '';
+}
+
+/* ─────────────────────── GitHub deploy wrapper ──────────────────── */
+function pushToGitHub() {
+  const path = document.getElementById('ghPath').value.trim();
+  const content = document.getElementById('ghContent').value;
+  const statusEl = document.getElementById('ghStatus');
+  ghPush(path, content, statusEl);
+}
+
+/* ───────────────────────── Send message ─────────────────────────── */
+async function sendMessage() {
+  const input = document.getElementById('input');
+  const text = input.value.trim();
+  if (!text) return;
+  localStorage.removeItem(LS.draft);
+
+  let chat = Chat.getActiveChat();
+  if (!chat) { Chat.newChat(); chat = Chat.getActiveChat(); }
+
+  chat.messages.push({ role: 'user', text });
+  if (chat.messages.filter(m => m.role === 'user').length === 1) chat.title = text.slice(0, 30);
+  save(LS.chats, state.chats);
+  input.value = '';
+  UI.autoGrow(input);
+  UI.refreshSend();
+  Chat.renderMessages();
+  document.getElementById('sendBtn').disabled = true;
+
+  const contextNotes = await Notes.renderContextBar(text);
+
+  let sequence;
+  if (chat.conf) sequence = Chat.availableModels().map(m => m.id);
+  else sequence = [chat.model];
+
+  if (!sequence.length) {
+    chat.messages.push({ role: 'ai', text: '⚠️ Нет ни одного ключа. Открой Настройки и добавь хотя бы один API-ключ.' });
+    save(LS.chats, state.chats);
+    Chat.renderMessages();
+    document.getElementById('sendBtn').disabled = false;
+    return;
   }
-});
\ No newline at end of file
+
+  const viewEl = document.getElementById('view');
+
+  for (let i = 0; i < sequence.length; i++) {
+    const modelId = sequence[i];
+    const model = ALL_MODELS.find(m => m.id === modelId);
+    if (chat.conf && i > 0) {
+      chat.messages.push({ role: 'sep', text: 'Дальше отвечает: ' + modelLabel(modelId) });
+      save(LS.chats, state.chats);
+      Chat.renderMessages();
+    }
+    const apiKey = state.keys[model?.keyField || ''];
+    if (!apiKey) {
+      chat.messages.push({ role: 'ai', model: modelId, text: '⚠️ Нет ключа для ' + modelLabel(modelId) + ' — добавь в Настройках.' });
+      save(LS.chats, state.chats);
+      Chat.renderMessages();
+      continue;
+    }
+
+    const box = document.getElementById('messages');
+    const t = document.createElement('div');
+    t.className = 'typing-wrapper';
+    t.innerHTML = '<div class="avatar">🔮</div><div class="typing-box"><div class="typing-label">' + modelLabel(modelId) + ' печатает...</div><div class="dots"><span></span><span></span><span></span></div></div>';
+    box.appendChild(t);
+    viewEl.scrollTop = viewEl.scrollHeight;
+
+    try {
+      let history = Chat.buildHistory(chat);
+      const sysParts = [];
+      if (contextNotes.length) {
+        sysParts.push('[Контекст из заметок пользователя: ' + contextNotes.map(n => n.title).join(', ') + '. Если уместно, цитируй [[название]] и используй эту информацию.]');
+      }
+      if (state.aiMemoryEnabled) {
+        sysParts.push('[Ты можешь создавать и обновлять заметки пользователя. Если пользователь просит запомнить что-то или ты считаешь информацию важной, используй тег: <note title="Название">Содержимое заметки</note>. Не упоминай тег в ответе — он обработается автоматически.]');
+      }
+      if (sysParts.length) {
+        const sysText = sysParts.join('\n\n');
+        if (model.provider === 'gemini') {
+          const firstUserIdx = history.findIndex(m => m.role === 'user');
+          if (firstUserIdx >= 0) history[firstUserIdx].content = sysText + '\n\n' + history[firstUserIdx].content;
+          else history.unshift({ role: 'user', content: sysText });
+        } else {
+          history.unshift({ role: 'system', content: sysText });
+        }
+      }
+      const extra = {};
+      if (model.provider === 'cloudflare') extra.account = state.keys.key_cf_account || '';
+      let reply = await callModel(model, history, apiKey, extra);
+      reply = await Notes.processAiMemory(reply);
+      chat.messages.push({ role: 'ai', model: modelId, text: reply });
+    } catch (err) {
+      chat.messages.push({ role: 'ai', model: modelId, text: '❌ ' + err.message });
+    }
+    save(LS.chats, state.chats);
+    Chat.renderMessages();
+  }
+  document.getElementById('sendBtn').disabled = false;
+}
+
+/* ─────────────────── Wire global (inline handlers) ──────────────── */
+function exposeGlobals() {
+  // UI helpers
+  window.toggleSidebar = UI.toggleSidebar;
+  window.setTheme = UI.setTheme;
+  window.applyTheme = UI.applyTheme;
+  window.switchSettingsTab = UI.switchSettingsTab;
+  window.onKeyDown = UI.onKeyDown;
+  window.refreshSend = UI.refreshSend;
+  window.showToast = UI.showToast;
+  window.autoGrow = (el) => { UI.autoGrow(el); UI.refreshSend(); };
+
+  // App orchestrator
+  window.sendMessage = sendMessage;
+  window.openSettings = openSettings;
+  window.closeSettings = closeSettings;
+  window.saveSettings = saveSettings;
+  window.exportData = exportData;
+  window.importData = importData;
+  window.switchTab = switchTab;
+  window.pushToGitHub = pushToGitHub;
+
+  // Chat module
+  window.newChat = Chat.newChat;
+  window.selectChat = Chat.selectChat;
+  window.deleteChat = Chat.deleteChat;
+  window.toggleConf = Chat.toggleConf;
+  window.copyMessage = Chat.copyMessage;
+  window.openHQ = Chat.openHQ;
+  window.openGH = Chat.openGH;
+  window.closeViews = Chat.closeViews;
+  window.saveHQUrl = Chat.saveHQUrl;
+  window.onGhPathChange = Chat.onGhPathChange;
+
+  // Sidebar module
+  window.newFolder = Sidebar.newFolder;
+  window.deleteFolder = Sidebar.deleteFolder;
+  window.moveChatToFolder = Sidebar.moveChatToFolder;
+
+  // Notes module
+  window.newNote = Notes.newNote;
+  window.saveNote = Notes.saveNote;
+  window.closeEditor = Notes.closeEditor;
+  window.editNote = Notes.editNote;
+  window.openNoteByTitle = Notes.openNoteByTitle;
+  window.renderNotes = Notes.renderNotes;
+  window.setAiMemory = Notes.setAiMemory;
+  window.exportNotes = Notes.exportNotes;
+  window.importNotes = Notes.importNotes;
+  window.clearAllNotes = Notes.clearAllNotes;
+}
+
+/* ─────────────────── Topbar tab buttons + styles ────────────────── */
+function buildTabButtons() {
+  const topbar = document.getElementById('topbar');
+  chatTabBtn = document.createElement('button');
+  chatTabBtn.className = 'tab-btn active';
+  chatTabBtn.textContent = '💬 Чат';
+  chatTabBtn.onclick = () => switchTab('chat');
+  notesTabBtn = document.createElement('button');
+  notesTabBtn.className = 'tab-btn';
+  notesTabBtn.textContent = '📝 Заметки';
+  notesTabBtn.onclick = () => switchTab('notes');
+  topbar.appendChild(chatTabBtn);
+  topbar.appendChild(notesTabBtn);
+
+  const style = document.createElement('style');
+  style.textContent = '.tab-btn{background:var(--bg-2);color:var(--text-dim);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;flex:none;}.tab-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}';
+  document.head.appendChild(style);
+}
+
+/* ─────────────────────────── Bootstrap ──────────────────────────── */
+function init() {
+  initState();
+  exposeGlobals();
+
+  UI.applyTheme(localStorage.getItem(LS.theme) || 'dark');
+  Chat.populateModelSelect();
+  Chat.renderAll();
+  UI.loadDraft();
+  UI.refreshSend();
+
+  // Save draft on input
+  const inputEl = document.getElementById('input');
+  if (inputEl) inputEl.addEventListener('input', () => {
+    localStorage.setItem(LS.draft, inputEl.value);
+  });
+
+  buildTabButtons();
+  switchTab(state.currentTab);
+}
+
+// Module scripts are deferred, so DOM is ready. Guard just in case.
+if (document.readyState === 'loading') {
+  document.addEventListener('DOMContentLoaded', init);
+} else {
+  init();
+}
diff --git a/js/chat.js b/js/chat.js
index 218c93d..29d76d5 100644
--- a/js/chat.js
+++ b/js/chat.js
@@ -5,7 +5,7 @@ import { state, setState } from './state.js';
 import { db } from './db.js';
 import { callModel } from './api.js';
 import { renderSidebarList } from './sidebar.js';
-import { applyTheme } from './ui.js';
+import { toggleSidebar } from './ui.js';
 
 const viewEl = document.getElementById('view');
 
@@ -189,7 +189,3 @@ export function onGhPathChange() {
   if (sel.value === '__custom__') { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
   else { inp.style.display = 'none'; inp.value = sel.value; }
 }
-
-// Need to import these to avoid circular deps
-import { toggleSidebar } from './ui.js';
-import { renderSidebarList } from './sidebar.js';
diff --git a/js/db.js b/js/db.js
index 578dae8..969f39f 100644
--- a/js/db.js
+++ b/js/db.js
@@ -1,5 +1,5 @@
 // FreeX Database (Dexie)
-import Dexie from 'https://unpkg.com/dexie@4.0.4/dist/dexie.min.js';
+import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4.0.4/+esm';
 
 export const db = new Dexie('FreeXDB');
 db.version(1).stores({
diff --git a/js/sidebar.js b/js/sidebar.js
index c63bbcc..fb77d75 100644
--- a/js/sidebar.js
+++ b/js/sidebar.js
@@ -37,7 +37,7 @@ export function moveChatToFolder(id, ev) {
 }
 
 function chatItemHTML(c) {
-  return '<div class="sb-item ' + (c.id === state.activeId && !state.viewOpen ? 'active' : '') + '" onclick="window.selectChat\'' + c.id + '\')"><span>' + escapeHtml(c.title) + '</span><span style="display:flex;gap:6px;"><span class="del" onclick="window.moveChatToFolder(\'' + c.id + '\',event)" title="В папку">📁</span><span class="del" onclick="window.deleteChat(\'' + c.id + '\',event)">✕</span></span></div>';
+  return '<div class="sb-item ' + (c.id === state.activeId && !state.viewOpen ? 'active' : '') + '" onclick="window.selectChat(\'' + c.id + '\')"><span>' + escapeHtml(c.title) + '</span><span style="display:flex;gap:6px;"><span class="del" onclick="window.moveChatToFolder(\'' + c.id + '\',event)" title="В папку">📁</span><span class="del" onclick="window.deleteChat(\'' + c.id + '\',event)">✕</span></span></div>';
 }
 
 export function renderSidebarList() {
diff --git a/js/ui.js b/js/ui.js
index 82c939a..b01dc4e 100644
--- a/js/ui.js
+++ b/js/ui.js
@@ -68,3 +68,27 @@ export function switchSettingsTab(id) {
   document.getElementById(id).classList.add('active');
   document.querySelector('.tab[data-tab="' + id + '"]').classList.add('active');
 }
+
+let toastTimer = null;
+export function showToast(msg, ms = 2600) {
+  let el = document.getElementById('freexToast');
+  if (!el) {
+    el = document.createElement('div');
+    el.id = 'freexToast';
+    el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);' +
+      'background:var(--bg-3);color:var(--text);border:1px solid var(--line);border-radius:12px;' +
+      'padding:10px 18px;font-size:14px;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
+      'opacity:0;transition:opacity .2s ease,transform .2s ease;pointer-events:none;max-width:80vw;text-align:center;';
+    document.body.appendChild(el);
+  }
+  el.textContent = msg;
+  requestAnimationFrame(() => {
+    el.style.opacity = '1';
+    el.style.transform = 'translateX(-50%) translateY(0)';
+  });
+  clearTimeout(toastTimer);
+  toastTimer = setTimeout(() => {
+    el.style.opacity = '0';
+    el.style.transform = 'translateX(-50%) translateY(20px)';
+  }, ms);
+}
-- 
2.39.5

