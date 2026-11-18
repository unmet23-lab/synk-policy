'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(config|out|mode)=(.+)$/.exec(x);if(!m)throw Error('Unexpected argument');return [m[1],m[2]];}));
if(!['darwin','win32'].includes(process.platform)||(process.platform==='win32'&&args.mode!=='platform')||!['world-online','world-offline','platform'].includes(args.mode))throw Error('Native macOS mode required');
const config=JSON.parse(fs.readFileSync(path.resolve(args.config),'utf8')),out=path.resolve(args.out),client=args.mode==='platform'?'platform':'world',bundle=config.bundles[client];
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output must be new');fs.mkdirSync(out,{recursive:true});
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=sha(bundle.archive);
const isolation=path.join(out,'profile');fs.mkdirSync(isolation);fs.mkdirSync(path.join(out,'tmp'));
const input={...config,platform:process.platform,client,mode:args.mode,out,appData:isolation,archive:bundle.archive,version:bundle.version,runnerArch:process.env.RUNNER_ARCH||null,softwareGpu:process.env.SYNK_QA_SOFTWARE_GPU==="1",visible:process.env.SYNK_QA_VISIBLE==="1",unlimitedFrames:process.env.SYNK_QA_UNLIMITED_FRAMES==="1",prefix:'SYNK_MAC_QA '};
function observe(config){
  process.stderr.write('SYNK_QA_TRACE observer-installed\n');
  const {app,shell}=require('electron'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  app.setPath('appData',config.appData);app.once('ready',()=>{if(!config.visible)app.dock?.hide();});
  // 검정 구 얼굴의 검사 실행 길(손님으로 솔리오까지)은 본체에 심은 이 값으로만 열린다
  if(config.client==='platform')globalThis.__synkNativeQAGuestEntry=true;
  // Only the read/launch root is substituted. The production installation
  // verifier still checks actual DMG-copied metadata, executables and archives.
  require(app.getAppPath()+'/src/program-root.cjs').resolveProgramRoot=()=>config.applications;
  const requests=[],providerRequests=[],opened=[],checks=[],screenshots=[],errors=[],pageErrors=[],startupStates=[];
  let startupWindow,syntheticFeedRequests=0,startupReadyResolve;
  const startupReady=new Promise(resolve=>{startupReadyResolve=resolve;});
  // The candidate version is not public yet. Exercise its real startup gate with
  // a current-version manifest; do not disable the gate or permit installer IO.
  if(config.client==='platform'){
    const updates=require(app.getAppPath()+'/src/platform-update.cjs'),original=updates.createPlatformUpdater;
    // 첫 피드 답은 시작 창이 준비된 뒤에 돌려준다. 느린 러너에서 관문의 4초 먼저 열기가 그보다 앞서 앱 창을 열지 않게 이 실행에서만 늘린다(0.4.96 검수 F3, Windows 사본과 같다)
    const gates=require(app.getAppPath()+'/src/platform-startup-update.cjs'),originalGate=gates.createStartupUpdateGate;
    gates.createStartupUpdateGate=options=>originalGate({...options,earlyOpenMs:60000});
    const runtime=JSON.parse(fs.readFileSync(app.getAppPath()+'/runtime.json','utf8'));
    // 0.4.87: the candidate must pin real signing keys and refuse an unsigned feed; the QA feed is signed by a throwaway key
    // handed only to this isolated updater, never by the publisher's key.
    const pinned=Array.isArray(updates.UPDATE_SIGNING_KEYS)&&updates.UPDATE_SIGNING_KEYS.length>=1&&updates.trustedSigningKeys(updates.UPDATE_SIGNING_KEYS).length===updates.UPDATE_SIGNING_KEYS.length;
    let unsignedRejected=false;try{updates.verifyManifestSignature({schemaVersion:1});}catch(error){unsignedRejected=error.updateCode==='UPDATE_SIGNATURE_INVALID';}
    if(!pinned||!unsignedRejected)throw Error('QA_UPDATE_SIGNING_NOT_ENFORCED');
    const qaKey=crypto.generateKeyPairSync('ed25519'),qaSpki=qaKey.publicKey.export({type:'spki',format:'der'});
    const qaKeys=updates.trustedSigningKeys([{keyId:crypto.createHash('sha256').update(qaSpki).digest('hex').slice(0,16),spki:qaSpki.toString('base64')}]);
    const signQa=value=>({...value,signature:{alg:'ed25519',keyId:qaKeys[0].keyId,value:crypto.sign(null,updates.signedManifestPayload(value),qaKey.privateKey).toString('base64')}});
    updates.createPlatformUpdater=options=>original({...options,trustedKeys:qaKeys,request:async url=>{
      if(url!==updates.MANIFEST_URL)throw Error('QA_INSTALLER_DOWNLOAD_FORBIDDEN');syntheticFeedRequests++;
      await startupReady;
      const manifest={schemaVersion:1,product:'platform',channel:'preview',version:config.version,releaseId:runtime.update.releaseId,buildId:runtime.update.buildId,publishedAt:new Date().toISOString(),artifacts:[{platform:config.platform,arch:config.arch,url:'https://github.com/unmet23-lab/synk-policy/releases/download/'+runtime.update.releaseId+'/qa-never-downloaded.'+(config.platform==='win32'?'exe':'dmg'),bytes:1,sha256:'a'.repeat(64),asarSHA256:'b'.repeat(64)}]};
      return {status:200,headers:{},body:require('node:stream').Readable.from([Buffer.from(JSON.stringify(signQa(manifest)))])};
    },onChange:value=>{startupStates.push(value.state);options.onChange?.(value);}});
  }
  globalThis.fetch=async(...args)=>{providerRequests.push(String(args[0]));throw Error('QA_EMPTY_VAULT_MUST_NOT_FETCH');};
  shell.openExternal=async url=>{opened.push({kind:'external',url});};shell.openPath=async file=>{opened.push({kind:'file',file});return '';};
  let window,contents,finished=false,networkBlocked=config.mode==='world-offline';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);};
  const run=code=>contents.executeJavaScript(code,true);
  async function waitFor(code,label,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){try{if(await run(code))return;}catch{}await sleep(100);}throw Error('TIMEOUT_'+label);}
  // 이름을 함수로 주면 찍은 직후의 상태로 이름을 정한다. 글꼴을 기다리고 0.35초 쉬는 사이에 얼굴 단계가 바뀔 수 있다(0.4.96 Mac 사본 검수 F1)
  async function screenshot(name){await run('document.fonts.ready.then(()=>true)');await sleep(350);const image=await contents.capturePage();const label=typeof name==='function'?await name():name;const file=path.join(config.out,label+'.png');fs.writeFileSync(file,image.toPNG());screenshots.push(file);}
  async function click(selector,expected){await run(`document.querySelector(${JSON.stringify(selector)}).click()`);await waitFor(`location.href===${JSON.stringify(expected)}&&document.readyState==='complete'`,selector);}
  async function finish(ok){if(finished)return;finished=true;const local=requests.filter(r=>{try{const u=new URL(r.url);return ['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&['4280','4191'].includes(u.port);}catch{return false;}});const result={ok:ok&&!errors.length&&!local.length&&!providerRequests.length,mode:config.mode,packaged:app.isPackaged,arch:process.arch,electron:process.versions.electron,archive:app.getAppPath(),visible:window&&!window.isDestroyed()?window.isVisible():false,profileIsolated:app.getPath('userData').startsWith(config.appData+path.sep),installationRoot:config.applications,checks,errors,pageErrors,requests,localhostDevelopmentRequests:local,providerRequests,openRequestsSuppressed:opened,screenshots,realAuthenticationPerformed:false,realProfileTouched:false,managedChildLaunched:false,unlimitedFrames:config.unlimitedFrames,graphicsBackend:config.softwareGpu?"CI-only SwiftShader":"default",runnerArch:config.runnerArch,translated:app.runningUnderARM64Translation===true};process.stdout.write(config.prefix+JSON.stringify(result)+'\n');setTimeout(()=>app.exit(result.ok?0:1),250);}
  const instrumented=new Set();
  function instrument(contents){
    if(instrumented.has(contents))return;instrumented.add(contents);contents.setBackgroundThrottling(false);contents.setAudioMuted(true);
    contents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push({url:details.url,resourceType:details.resourceType,method:details.method,blocked:networkBlocked||config.client==='platform'});callback({cancel:networkBlocked||config.client==='platform'});});
    contents.on('console-message',event=>{if(event.level==='error')pageErrors.push({message:event.message.slice(0,400),source:event.sourceId.split('?')[0],line:event.lineNumber});});
  }
  function observeWindow(created){
    if(config.client==='platform'&&created.webContents.getURL()==='synk-desktop://platform/startup-update.html'){
      startupWindow=created;
      void(async()=>{const end=Date.now()+10000;while(Date.now()<end){if(await created.webContents.executeJavaScript("document.documentElement.dataset.startupReady==='true'",true)){
        const state=await created.webContents.executeJavaScript("(async()=>({status:await window.synkStartupUpdate.getStatus(),desktop:typeof window.synkDesktop,node:typeof require}))()",true);
        check('startup renderer receives its isolated checking IPC',state.status.state==='checking'&&state.desktop==='undefined'&&state.node==='undefined'&&!window,state);
        startupReadyResolve();return;
      }await sleep(50);}throw Error('STARTUP_UI_NOT_READY');})().catch(error=>{errors.push(error.message);void finish(false);});return;
    }
    if(window)return;window=created;if(!config.visible){window.show=()=>{};window.showInactive=()=>{};}else{window.once('ready-to-show',()=>{window.show();window.focus();});}contents=window.webContents;instrument(contents);
    (async()=>{try{
      check('actual packaged native architecture',app.isPackaged&&app.getAppPath()===config.archive&&process.arch===config.arch);
      check('profile isolated before app initialization',app.getPath('userData').startsWith(config.appData+path.sep));
      check('window visibility matches requested QA mode',!window.isVisible()||config.visible);
      if(config.mode==='platform'){
        check('startup gate checks the candidate before opening Platform',!!startupWindow&&startupStates.includes('checking')&&startupStates.includes('current')&&syntheticFeedRequests===1,{states:startupStates,syntheticFeedRequests});
        // 한 번에 묶여 온 바뀜은 옛 값을 차례로 적고 지금 값을 끝에 한 번만 적는다. 바뀜마다 지금 값을 끼우면 차례가 뒤집혔다(0.4.96 검수 E4, Windows 사본과 같다)
        // 얼굴의 단계 바뀜을 앱이 뜨자마자 적어 둔다. 느린 러너에서는 검사기가 welcome을 잡기 전에 얼굴이 묻는 화면으로 커진다(0.4.95 첫 빌드 Mac x64)
        await waitFor("(()=>{const p=document.getElementById('portal-entry');if(!p)return false;if(!window.__orbSeen){const seen=window.__orbSeen=[p.dataset.portalState||''];const add=v=>{const s=v||'';if(seen[seen.length-1]!==s)seen.push(s);};const snap=()=>{if(p.dataset.portalState!=='welcome')return;const l=document.querySelector('.launcher'),c=p.querySelector('.orb-canvas')?.getBoundingClientRect();window.__orbWelcome={auth:p.dataset.portalAuthStatus,active:p.dataset.portalActive,client:p.dataset.orbClient,hidden:!!p.hidden,docActive:document.documentElement.dataset.portalActive,inert:!!l?.inert,inertAttr:!!l?.hasAttribute('inert'),covers:!!c&&c.width>=innerWidth-1&&c.height>=innerHeight-1};};snap();new MutationObserver(list=>{for(const r of list)if(r.attributeName==='data-portal-state')add(r.oldValue);add(p.getAttribute('data-portal-state'));snap();}).observe(p,{attributes:true,attributeOldValue:true,attributeFilter:['data-portal-state','data-portal-auth-status','data-portal-active','data-orb-client','hidden']});}return location.href==='synk-desktop://platform/index.html'&&document.documentElement.dataset.ready==='true';})()",'local-platform');
        const state=await run('(async()=>({environment:await window.synkDesktop.getEnvironment(),auth:await window.synkDesktop.authStatus(),clients:await window.synkDesktop.getClients(),node:typeof require,html:document.body.innerText.length}))()');
        check('Platform local renderer and native environment',state.environment.clientId==='platform'&&state.environment.platform===config.platform&&state.environment.arch===config.arch&&state.environment.version===config.version&&state.environment.nativeShell===true&&state.node==='undefined'&&state.html>100);
        check('Platform empty configured account stays signed out',state.auth.configured===true&&state.auth.signedIn===false);
        const clickVisible=async(selector,name)=>{
          const probe=await run(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return {ok:false,reason:'missing'};const style=getComputedStyle(node),rect=node.getBoundingClientRect();const visible=!node.hidden&&!node.disabled&&!node.closest('[hidden],[inert],[aria-hidden="true"]')&&style.display!=='none'&&style.visibility==='visible'&&style.pointerEvents!=='none'&&Number(style.opacity)>0&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=window.innerWidth&&rect.bottom<=window.innerHeight;const x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=visible?document.elementFromPoint(x,y):null,unobscured=Boolean(hit&&(hit===node||node.contains(hit))),ok=visible&&unobscured;if(ok)node.click();return {ok,visible,unobscured,disabled:Boolean(node.disabled),rect:{left:Math.round(rect.left),top:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height),right:Math.round(rect.right),bottom:Math.round(rect.bottom)},viewport:{width:window.innerWidth,height:window.innerHeight},point:{x:Math.round(x),y:Math.round(y)},hit:hit?{tag:hit.tagName,id:hit.id||null,className:String(hit.className||'')}:null};})()`);
          check(name,probe?.ok===true,probe);
        };
        // 검정 구 얼굴(PC 클라이언트 1단계): 구만 보이고, 누르지 않아도 묻는 화면으로 커지고, 검사 실행 길로 솔리오까지 간다
        // welcome이 이미 지나간 뒤(겹쳐 넘기는 길) 기록으로 통과할 때는 지금 값이 아니라 welcome 때 적어 둔 값(__orbWelcome)으로 판정한다(0.4.96 Mac 사본 검수 P2)
        await waitFor("(()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher');if(!p)return false;if(p.dataset.portalState==='welcome')return !p.hidden&&p.dataset.portalActive==='true'&&p.dataset.portalAuthStatus==='signed-out'&&p.dataset.orbClient==='portal'&&!!l&&l.inert===true;const w=window.__orbWelcome;return (window.__orbSeen||[]).includes('welcome')&&!!w&&!w.hidden&&w.active==='true'&&w.auth==='signed-out'&&w.client==='portal'&&w.inert===true;})()",'orb-welcome');
        const welcome=await run("(()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher'),c=p?.querySelector('.orb-canvas')?.getBoundingClientRect(),w=window.__orbWelcome;if(p?.dataset.portalState!=='welcome'&&w)return {portalState:p?.dataset.portalState,seen:window.__orbSeen||[],portalActive:w.active,orbClient:w.client,portalHidden:w.hidden,docPortalActive:w.docActive,launcherInert:w.inert,launcherInertAttr:w.inertAttr,canvasCovers:w.covers,from:'record'};return {portalState:p?.dataset.portalState,seen:window.__orbSeen||[],portalActive:p?.dataset.portalActive,orbClient:p?.dataset.orbClient,portalHidden:Boolean(p?.hidden),docPortalActive:document.documentElement.dataset.portalActive,launcherInert:Boolean(l?.inert),launcherInertAttr:Boolean(l?.hasAttribute('inert')),canvasCovers:!!c&&c.width>=innerWidth-1&&c.height>=innerHeight-1,from:'live'};})()");
        check('orb starts alone at welcome with launcher inert',(welcome.portalState==='welcome'||welcome.seen.includes('welcome'))&&!(welcome.seen.indexOf('welcome')<0?welcome.seen:welcome.seen.slice(0,welcome.seen.indexOf('welcome'))).some(s=>s&&s!=='welcome')&&welcome.portalActive==='true'&&welcome.orbClient==='portal'&&!welcome.portalHidden&&welcome.docPortalActive==='true'&&welcome.launcherInert&&welcome.launcherInertAttr&&welcome.canvasCovers,welcome);
        await screenshot(async()=>{const state=await run("document.getElementById('portal-entry')?.dataset.portalState||''");return welcome.from==='live'&&state==='welcome'?'platform-orb-welcome':'platform-orb-after-welcome-'+state;});
        // 누르지 않는다. 복원 결과(로그아웃)가 나온 뒤 스스로 커지는 것까지가 검사다
        await waitFor("(()=>{const p=document.getElementById('portal-entry'),s=p?.querySelector('.orb-stage');return !!p&&p.dataset.portalState==='auth'&&s?.dataset.ui==='ask';})()",'orb-auth');
        const ask=await run("(()=>Object.fromEntries([['signin','[data-orb-act=signin]'],['signup','[data-orb-act=signup]'],['code','#portal-invite-input']].map(([name,selector])=>{const node=document.querySelector('#portal-entry '+selector),rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return [name,{text:node.innerText||node.placeholder,visible:!node.hidden&&getComputedStyle(node).visibility==='visible'&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth,unobscured:Boolean(hit&&(hit===node||node.contains(hit)))}];})))()");
        check('orb ask shows sign-in, sign-up and the code field without pressing',ask.signin.visible&&ask.signin.unobscured&&ask.signin.text==='로그인'&&ask.signup.visible&&ask.signup.unobscured&&ask.signup.text==='처음이라면 가입하기'&&ask.code.visible&&ask.code.unobscured,ask);await screenshot('platform-orb-ask');
        await run("document.getElementById('portal-entry').dispatchEvent(new CustomEvent('synk:qa-guest-entry'));true");
        await waitFor("(()=>{const p=document.getElementById('portal-entry'),s=p?.querySelector('.orb-stage');return !!p&&p.dataset.portalState==='entered'&&p.dataset.orbClient==='app'&&s?.dataset.ui==='app';})()",'orb-solio');
        const entered=await run("(async()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher'),auth=await window.synkDesktop.authStatus();return {portalState:p?.dataset.portalState,portalActive:p?.dataset.portalActive,orbClient:p?.dataset.orbClient,say:(p?.querySelector('[data-say]')?.textContent||'').trim(),launcherInert:Boolean(l?.inert),auth};})()");
        check('orb QA guest path reaches the Solio first screen and keeps the account signed out',entered.portalState==='entered'&&entered.portalActive==='false'&&entered.orbClient==='app'&&entered.say==='로그인하면 구독별 남은 양이 여기에 보입니다.'&&entered.launcherInert&&entered.auth.configured===true&&entered.auth.signedIn===false&&entered.auth.status==='signed-out',entered);
        // 방이 다 드러난 뒤 찍는다. 곧바로 찍으면 도착 움직임 도중이라 문장이 아직 보이지 않았다(0.4.95 대역 빌드 캡처, Windows 검사기와 같다)
        await waitFor("(()=>{const s=document.querySelector('#portal-entry .orb-stage'),say=document.querySelector('#portal-entry [data-layer=app] [data-say]');return !!s&&!!say&&s.classList.contains('settled')&&getComputedStyle(say.closest('.rise')||say).opacity==='1';})()",'orb-solio-shown');
        await screenshot('platform-orb-solio');
        for(const id of ['world','messenger']){
          const installed=state.clients.find(x=>x.id===id);check(id+' managed DMG copy recognized by real hash verifier',installed?.status==='installed'&&installed?.canLaunch===true&&installed?.version===config.bundles[id].version,installed);
          const prepared=await run(`window.synkDesktop.prepareClient(${JSON.stringify(id)})`);check(id+' embedded DMG preparation starts',prepared.ok===true);
          await waitFor(`window.synkDesktop.getClients().then(list=>list.find(c=>c.id===${JSON.stringify(id)}).installer.status==='ready')`,id+'-installer-ready',60000);
          const ready=await run(`window.synkDesktop.getClients().then(list=>list.find(c=>c.id===${JSON.stringify(id)}).installer)`);check(id+' real DMG bytes copied and hash verified',ready.status==='ready'&&ready.progress===100&&ready.transferredBytes===ready.totalBytes&&ready.canOpen===true,ready);
        }
        // DMG 준비가 띄운 알림 띠(5.5~12초)가 사라진 뒤 공간 고르기로 간다. 알림 띠가 「설정」을 덮어 첫 빌드 Mac arm64가 떨어졌다
        await waitFor("(()=>{const t=document.getElementById('toast');return !t||t.hidden||getComputedStyle(t).display==='none';})()",'toast-gone',20000);
        // 작은 구 → 공간 고르기 → 「설정」 → 옛 설정 보기(legacy). 내려받기와 보관함 보기는 새 얼굴에서 갈 길이 없어 뺀다(Windows 검사기와 같다)
        await clickVisible('#portal-entry .here-orb','orb small orb visible and unobscured');
        await waitFor("document.querySelector('#portal-entry .orb-stage')?.dataset.ui==='switch'",'orb-switch');await screenshot('platform-orb-switch');
        await clickVisible('#portal-entry [data-foot="settings"]','orb switch settings visible and unobscured');
        await waitFor("document.documentElement.dataset.orbClient==='legacy'&&document.documentElement.dataset.view==='settings'",'orb-legacy-settings');
        // 임시 옛 화면에서는 옛 런처의 잠금이 풀려 눌려야 한다(Windows 검사기와 같다)
        const unlocked=await run("(()=>{const l=document.querySelector('.launcher'),back=document.querySelector('#portal-entry .legacy-back'),r=back?.getBoundingClientRect();return {launcherInert:Boolean(l?.inert),launcherInertAttr:Boolean(l?.hasAttribute('inert')),launcherAriaHidden:l?.getAttribute('aria-hidden')??null,backVisible:!!back&&!back.hidden&&!!r&&r.width>0&&r.height>0};})()");
        check('orb legacy view unlocks the old launcher and shows 「돌아가기」',!unlocked.launcherInert&&!unlocked.launcherInertAttr&&unlocked.launcherAriaHidden===null&&unlocked.backVisible,unlocked);
        await screenshot('platform-legacy-settings');check('Platform boot requires no network',requests.length===0);
      }else if(config.mode==='world-offline'){
        const entry='https://synk.im/account/client.html?product=world';
        await waitFor("location.href==='synk-desktop://status/'&&document.readyState==='complete'&&!!document.querySelector('#retry-connection')",'offline-guide');
        const guide=await run("({text:document.body.innerText,retry:document.querySelector('#retry-connection').href})");
        check('offline guide explains internet',guide.text.includes('인터넷 연결')&&!guide.text.includes('이 기기의 앱 서비스'));
        check('retry points at public HTTPS',guide.retry===entry);
        check('offline guide denies account IPC',await run('window.synkDesktop.authStatus().then(()=>false,()=>true)'));await screenshot('offline-guide');
        networkBlocked=false;await click('#retry-connection',entry);
        const auth=await run('window.synkDesktop.authStatus()');check('retry restores signed-out native account',auth.configured===true&&auth.signedIn===false);await screenshot('offline-reconnected');
      }else{
        const entry='https://synk.im/account/client.html?product=world';
        await waitFor(`location.href===${JSON.stringify(entry)}&&document.readyState==='complete'&&!!document.querySelector('#product-label')`,'public-world');
        const initial=await run('(async()=>({environment:await window.synkDesktop.getEnvironment(),auth:await window.synkDesktop.authStatus(),node:typeof require}))()');
        check('WORLD live HTTPS native environment',initial.environment.clientId==='world'&&initial.environment.platform==='darwin'&&initial.environment.arch===config.arch&&initial.environment.version===config.version&&initial.node==='undefined');
        check('WORLD cold profile configured signed out',initial.auth.configured===true&&initial.auth.signedIn===false);
        const guest=await run("(()=>{const a=document.querySelector('header nav a[href=\"/try/learning-hub/\"]');if(!a)return null;const r=a.getBoundingClientRect();return {text:a.textContent,width:r.width,height:r.height,hidden:!!a.closest('[hidden]'),visibility:getComputedStyle(a).visibility};})()");
        check('visible basic learning header link',guest?.text==='기본 학습'&&guest.width>0&&guest.height>0&&!guest.hidden&&guest.visibility==='visible',guest);await screenshot('world-first-start');
        await click('header nav a[href="/try/learning-hub/"]','https://synk.im/try/learning-hub/');
        check('learning hub denies native account IPC',await run('window.synkDesktop.authStatus().then(()=>false,()=>true)'));await screenshot('learning-hub');
        await click('a[href="/try/runner/"]','https://synk.im/try/runner/');
        await waitFor("!!window.synkRunner?.info?.ready",'runner-ready');check('game denies native account IPC',await run('window.synkDesktop.getEnvironment().then(()=>false,()=>true)'));
        await run("window.__macFrameProbe={start:performance.now(),count:0};requestAnimationFrame(function tick(){window.__macFrameProbe.count++;requestAnimationFrame(tick);});document.querySelector('#start').click()");
        await waitFor("window.synkRunner?.info?.model?.elapsed>1||document.querySelector('#audio-dialog').open",'runner-start',45000);
        const game=await run("({time:document.querySelector('#g-time').textContent,game:!document.querySelector('#game').hidden,audioError:document.querySelector('#audio-dialog').open,model:window.synkRunner.info,frameProbe:{...window.__macFrameProbe,now:performance.now(),visibility:document.visibilityState,focus:document.hasFocus()}})");
        check('actual public runner renders and advances',game.game&&Number(game.time)<90&&!game.audioError&&game.model.world.frames>0&&game.model.voiceClips===16,game);
        await run("document.querySelector('[data-action=left]').click()");check('movement changes real game lane',await run('window.synkRunner.info.model.lane===0'));await screenshot('runner-playing');
        await run("document.querySelector('#pause-button').click()");await waitFor("document.querySelector('#pause-dialog').open",'pause');check('real pause button works',true);
        await run("document.querySelector('#back-home').click()");await waitFor("!document.querySelector('#lobby').hidden",'runner-lobby');contents.navigationHistory.goBack();
        await waitFor("location.pathname==='/try/learning-hub/'&&document.readyState==='complete'",'hub-return');
        await click('a[href="/account/client.html?product=world&play=learning-hub"]','https://synk.im/account/client.html?product=world&play=learning-hub');
        const returned=await run('(async()=>({environment:await window.synkDesktop.getEnvironment(),auth:await window.synkDesktop.authStatus()}))()');check('account return restores native IPC',returned.environment.clientId==='world'&&returned.auth.configured===true&&!returned.auth.signedIn);await screenshot('world-return');
      }
      check('no account provider request with empty vault',providerRequests.length===0);check('no localhost development server requests',requests.every(r=>!/^https?:\/\/(?:127\.0\.0\.1|localhost):(?:4280|4191)(?:\/|$)/.test(r.url)));check('QA window visibility matches requested mode',window.isVisible()===config.visible);await finish(true);
    }catch(error){errors.push(error.stack||error.message);try{await screenshot('failure');checks.push({name:'failure snapshot',ok:false,detail:await run("({url:location.href,text:document.body.innerText.slice(0,1600),runner:window.synkRunner?.info,frameProbe:{...window.__macFrameProbe,now:performance.now(),visibility:document.visibilityState,focus:document.hasFocus()},face:(()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher');return p?{state:p.dataset.portalState,seen:window.__orbSeen||null,welcome:window.__orbWelcome||null,plant:!!window.__orbSeenPlant,auth:p.dataset.portalAuthStatus,active:p.dataset.portalActive,client:p.dataset.orbClient,hidden:p.hidden,launcherInert:l?.inert}:null;})()})")});}catch{}await finish(false);}})();
  }
  // Surface a packaged startup exception before Electron opens a blocking error dialog.
  process.on('uncaughtException',error=>{errors.push('MAIN_STARTUP_EXCEPTION: '+(error.stack||error.message));void finish(false);});
  process.on('unhandledRejection',error=>{errors.push('MAIN_STARTUP_REJECTION: '+(error?.stack||error));void finish(false);});
  app.on('browser-window-created',(_event,created)=>{process.stderr.write('SYNK_QA_TRACE window-created\n');
    if(config.client==='platform'){if(!config.visible){created.show=()=>{};created.showInactive=()=>{};}instrument(created.webContents);/* 얼굴 단계 기록은 앱 창의 dom-ready에서 바로 심는다. did-finish-load 뒤에 심으면 본체가 넘긴 드러남 시각만큼 welcome이 짧아져, 느린 러너에서 welcome을 놓칠 수 있었다(0.4.96 공개 후보 검수 P3). webContents.executeJavaScript는 쪽이 다 실릴 때(did-stop-loading)까지 미뤄지므로 mainFrame.executeJavaScript로 바로 심는다. 미뤄진 채로는 겹쳐 넘기는 길(시작 창이 보이던 실행)에서 welcome이 끝난 뒤에 심겨 Mac 빌드가 welcome을 놓쳤다(0.4.96 첫 빌드 Mac 두 작업). 아래 기다림 식의 심기는 이미 심었으면 그냥 지나간다 */created.webContents.on('dom-ready',()=>{if(created.webContents.getURL()==='synk-desktop://platform/index.html')void created.webContents.mainFrame.executeJavaScript("(()=>{if(window.__orbSeenPlant)return true;window.__orbSeenPlant=true;const plant=p=>{if(window.__orbSeen)return;const seen=window.__orbSeen=[p.dataset.portalState||''];const add=v=>{const s=v||'';if(seen[seen.length-1]!==s)seen.push(s);};const snap=()=>{if(p.dataset.portalState!=='welcome')return;const l=document.querySelector('.launcher'),c=p.querySelector('.orb-canvas')?.getBoundingClientRect();window.__orbWelcome={auth:p.dataset.portalAuthStatus,active:p.dataset.portalActive,client:p.dataset.orbClient,hidden:!!p.hidden,docActive:document.documentElement.dataset.portalActive,inert:!!l?.inert,inertAttr:!!l?.hasAttribute('inert'),covers:!!c&&c.width>=innerWidth-1&&c.height>=innerHeight-1};};snap();new MutationObserver(list=>{for(const r of list)if(r.attributeName==='data-portal-state')add(r.oldValue);add(p.getAttribute('data-portal-state'));snap();}).observe(p,{attributes:true,attributeOldValue:true,attributeFilter:['data-portal-state','data-portal-auth-status','data-portal-active','data-orb-client','hidden']});};const p=document.getElementById('portal-entry');if(p){plant(p);return true;}const o=new MutationObserver(()=>{const q=document.getElementById('portal-entry');if(q){o.disconnect();plant(q);}});o.observe(document.documentElement,{childList:true,subtree:true});return true;})()",true).catch(()=>{});});created.webContents.once('did-finish-load',()=>observeWindow(created));}
    else observeWindow(created);
  });
  return {appData:app.getPath('appData'),archive:app.getAppPath()};
}
// Intel hosted CI has no working hardware GL. This affects only the QA process, not the shipped app.
const graphicsArgs=input.softwareGpu?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
const frameArgs=input.unlimitedFrames?['--disable-frame-rate-limit','--disable-gpu-vsync']:[];
const child=spawn(bundle.executable,[...graphicsArgs,...frameArgs,'--inspect-brk=127.0.0.1:0','--log-file='+path.join(out,'electron.log')],{cwd:out,windowsHide:true,env:{...process.env,TMPDIR:path.join(out,'tmp'),TEMP:path.join(out,'tmp'),TMP:path.join(out,'tmp')},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',ws,connected=false,sequence=0,injected=false,error=null;const pending=new Map();
const trace=(event,detail={})=>process.stderr.write('SYNK_QA_TRACE '+JSON.stringify({event,...detail})+'\n');
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;trace('send',{id,method});const timer=setTimeout(()=>{pending.delete(id);reject(Error('INSPECTOR_TIMEOUT_'+method));},10000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
function connect(url){trace('connect');ws=new WebSocket(url);ws.addEventListener('open',async()=>{trace('open');try{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');}catch(e){error=e.message;trace('connect-error',{error});ws.close();}});ws.addEventListener('message',async event=>{const m=JSON.parse(event.data);if(m.id||m.method==='Debugger.paused'||m.method==='Debugger.resumed')trace('receive',{id:m.id,method:m.method,reason:m.params?.reason,url:m.params?.callFrames?.[0]?.url});if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}return;}if(m.method==='Debugger.paused'&&!injected){injected=true;try{const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:m.params.callFrames[0].callFrameId,expression:'('+observe.toString()+')('+JSON.stringify(input)+')',returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));await rpc('Debugger.resume');}catch(e){error=e.message;child.kill('SIGKILL');}}});}
const timer=setTimeout(()=>{error='Native QA timeout';child.kill('SIGKILL');},170000);
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes(input.prefix))ws?.close();});child.stderr.on('data',data=>{stderr+=data;const m=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(m&&!connected){connected=true;connect(m[1]);}});child.on('error',e=>{error=e.message;});
child.on('close',code=>{clearTimeout(timer);ws?.close();let result;try{result=JSON.parse(stdout.split(/\r?\n/).find(x=>x.startsWith(input.prefix)).slice(input.prefix.length));}catch{}
  const report={checkedAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&!error&&sha(bundle.archive)===before,asarSha256:before,packageBytesUnchanged:sha(bundle.archive)===before,code,error,result,...(!result?.ok?{stderr:stderr.slice(-5000),stdout:stdout.slice(-2000)}:{})};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:result?.checks.filter(c=>c.ok).length,checks:result?.checks.length,error:error||result?.errors}));if(!report.ok)process.exitCode=1;
});
