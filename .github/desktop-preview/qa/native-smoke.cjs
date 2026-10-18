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
  const {app,shell}=require('electron'),fs=require('node:fs'),path=require('node:path');
  app.setPath('appData',config.appData);app.once('ready',()=>{if(!config.visible)app.dock?.hide();});
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
    const runtime=JSON.parse(fs.readFileSync(app.getAppPath()+'/runtime.json','utf8'));
    updates.createPlatformUpdater=options=>original({...options,request:async url=>{
      if(url!==updates.MANIFEST_URL)throw Error('QA_INSTALLER_DOWNLOAD_FORBIDDEN');syntheticFeedRequests++;
      await startupReady;
      const manifest={schemaVersion:1,product:'platform',channel:'preview',version:config.version,releaseId:runtime.update.releaseId,buildId:runtime.update.buildId,publishedAt:new Date().toISOString(),artifacts:[{platform:config.platform,arch:config.arch,url:'https://github.com/unmet23-lab/synk-policy/releases/download/'+runtime.update.releaseId+'/qa-never-downloaded.'+(config.platform==='win32'?'exe':'dmg'),bytes:1,sha256:'a'.repeat(64),asarSHA256:'b'.repeat(64)}]};
      return {status:200,headers:{},body:require('node:stream').Readable.from([Buffer.from(JSON.stringify(manifest))])};
    },onChange:value=>{startupStates.push(value.state);options.onChange?.(value);}});
  }
  globalThis.fetch=async(...args)=>{providerRequests.push(String(args[0]));throw Error('QA_EMPTY_VAULT_MUST_NOT_FETCH');};
  shell.openExternal=async url=>{opened.push({kind:'external',url});};shell.openPath=async file=>{opened.push({kind:'file',file});return '';};
  let window,contents,finished=false,networkBlocked=config.mode==='world-offline';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);};
  const run=code=>contents.executeJavaScript(code,true);
  async function waitFor(code,label,timeout=30000){const start=Date.now();while(Date.now()-start<timeout){try{if(await run(code))return;}catch{}await sleep(100);}throw Error('TIMEOUT_'+label);}
  async function screenshot(name){await run('document.fonts.ready.then(()=>true)');await sleep(350);const file=path.join(config.out,name+'.png');fs.writeFileSync(file,(await contents.capturePage()).toPNG());screenshots.push(file);}
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
        await waitFor("location.href==='synk-desktop://platform/index.html'&&document.documentElement.dataset.ready==='true'",'local-platform');
        const state=await run('(async()=>({environment:await window.synkDesktop.getEnvironment(),auth:await window.synkDesktop.authStatus(),clients:await window.synkDesktop.getClients(),node:typeof require,html:document.body.innerText.length}))()');
        check('Platform local renderer and native environment',state.environment.clientId==='platform'&&state.environment.platform===config.platform&&state.environment.arch===config.arch&&state.environment.version===config.version&&state.environment.nativeShell===true&&state.node==='undefined'&&state.html>100);
        check('Platform empty configured account stays signed out',state.auth.configured===true&&state.auth.signedIn===false);
        for(const id of ['world','messenger']){
          const installed=state.clients.find(x=>x.id===id);check(id+' managed DMG copy recognized by real hash verifier',installed?.status==='installed'&&installed?.canLaunch===true&&installed?.version===config.bundles[id].version,installed);
          const prepared=await run(`window.synkDesktop.prepareClient(${JSON.stringify(id)})`);check(id+' embedded DMG preparation starts',prepared.ok===true);
          await waitFor(`window.synkDesktop.getClients().then(list=>list.find(c=>c.id===${JSON.stringify(id)}).installer.status==='ready')`,id+'-installer-ready',60000);
          const ready=await run(`window.synkDesktop.getClients().then(list=>list.find(c=>c.id===${JSON.stringify(id)}).installer)`);check(id+' real DMG bytes copied and hash verified',ready.status==='ready'&&ready.progress===100&&ready.transferredBytes===ready.totalBytes&&ready.canOpen===true,ready);
        }
        await run("document.querySelector('[data-view=downloads]').click()");await waitFor("document.documentElement.dataset.view==='downloads'",'downloads');
        const installationHelp=await run("(()=>{const n=document.querySelector('#view-downloads .quiet-note'),r=n.getBoundingClientRect();return {text:n.innerText,width:r.width,height:r.height,visible:!document.querySelector('#view-downloads').hidden};})()");
        check('visible installation help matches the OS',installationHelp.visible&&installationHelp.width>0&&installationHelp.height>0&&(config.platform==='darwin'?installationHelp.text.includes('Mac')&&installationHelp.text.includes('Applications'):installationHelp.text.includes('설치')),installationHelp);await screenshot('platform-installation-help');
        await run("document.querySelector('[data-view=library]').click()");await waitFor("document.documentElement.dataset.view==='library'",'library');
        await screenshot('platform-library');check('Platform boot requires no network',requests.length===0);
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
    }catch(error){errors.push(error.stack||error.message);try{await screenshot('failure');checks.push({name:'failure snapshot',ok:false,detail:await run("({url:location.href,text:document.body.innerText.slice(0,1600),runner:window.synkRunner?.info,frameProbe:{...window.__macFrameProbe,now:performance.now(),visibility:document.visibilityState,focus:document.hasFocus()}})")});}catch{}await finish(false);}})();
  }
  // Surface a packaged startup exception before Electron opens a blocking error dialog.
  process.on('uncaughtException',error=>{errors.push('MAIN_STARTUP_EXCEPTION: '+(error.stack||error.message));void finish(false);});
  process.on('unhandledRejection',error=>{errors.push('MAIN_STARTUP_REJECTION: '+(error?.stack||error));void finish(false);});
  app.on('browser-window-created',(_event,created)=>{process.stderr.write('SYNK_QA_TRACE window-created\n');
    if(config.client==='platform'){if(!config.visible){created.show=()=>{};created.showInactive=()=>{};}instrument(created.webContents);created.webContents.once('did-finish-load',()=>observeWindow(created));}
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
