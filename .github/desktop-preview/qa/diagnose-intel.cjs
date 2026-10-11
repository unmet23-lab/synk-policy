'use strict';
// Diagnostic only: isolated Electron, real public runner, no game state changes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const backend=process.argv.find(x=>x.startsWith('--backend='))?.slice(10)||'default';
const out=path.resolve(process.env.SYNK_DIAG_OUT||'intel-diagnostics',backend);fs.mkdirSync(out,{recursive:true});
if(!process.versions.electron){
 const cp=require('node:child_process'),flags=backend==='gl'?['--use-gl=angle','--use-angle=gl']:backend==='swiftshader'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
 const p=cp.spawnSync(require('electron'),[...flags,__filename,'--backend='+backend],{encoding:'utf8',timeout:150000,maxBuffer:4e6});
 fs.writeFileSync(path.join(out,'process.log'),(p.stdout||'')+(p.stderr||''));console.log(JSON.stringify({backend,status:p.status,error:p.error?.message}));process.exit(p.status===0?0:1);
}
const {app,BrowserWindow}=require('electron');
app.enableSandbox();app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-intel-diagnostic-')));
const result={backend,arch:process.arch,runnerArch:process.env.RUNNER_ARCH,translated:false,versions:process.versions,events:[],samples:[],errors:[],sandbox:true,inspector:false};
let win,done=false;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function finish(ok){if(done)return;done=true;result.ok=ok;try{result.gpu=await app.getGPUInfo('complete');result.features=app.getGPUFeatureStatus();if(win)fs.writeFileSync(path.join(out,'screen.png'),(await win.webContents.capturePage()).toPNG());}catch(e){result.captureError=e.message;}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({backend,ok,arch:process.arch,samples:result.samples,errors:result.errors}));app.exit(ok?0:1);}
setTimeout(()=>{result.errors.push('diagnostic timeout');finish(false);},135000);
app.on('child-process-gone',(_e,d)=>result.events.push(d));
app.whenReady().then(async()=>{try{
 result.translated=app.runningUnderARM64Translation===true;
 if(process.arch!=='x64')throw Error('Expected actual x64 Electron');
 win=new BrowserWindow({show:true,width:1024,height:768,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});win.webContents.setAudioMuted(true);win.focus();
 win.webContents.on('console-message',e=>{if(e.level==='error')result.errors.push(e.message.slice(0,1000));});
 const run=code=>win.webContents.executeJavaScript(code,true);
 await win.loadURL('data:text/html,<canvas width="64" height="64"></canvas>');
 result.webgl=await run(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');if(!gl)return {ok:false};gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);const pixels=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const ext=gl.getExtension('WEBGL_debug_renderer_info');return {ok:pixels[0]===255,pixels:[...pixels],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};})()`);
 if(!result.webgl.ok)throw Error('WebGL2 unavailable');
 await win.loadURL('https://synk.im/try/runner/');
 const start=Date.now();while(Date.now()-start<30000){if(await run('!!window.synkRunner?.info?.ready'))break;await sleep(200);}
 await run(`(()=>{window.__diag={start:performance.now(),raf:0,timers:0,errors:[],contextLost:0};addEventListener('error',e=>window.__diag.errors.push(e.message));addEventListener('unhandledrejection',e=>window.__diag.errors.push(String(e.reason)));document.addEventListener('webglcontextlost',()=>window.__diag.contextLost++,true);setInterval(()=>window.__diag.timers++,100);requestAnimationFrame(function tick(){window.__diag.raf++;requestAnimationFrame(tick);});document.querySelector('#start').click();})()`);
 for(let i=0;i<12;i++){await sleep(5000);const sample=await run(`({now:performance.now(),probe:window.__diag,visibility:document.visibilityState,focus:document.hasFocus(),info:window.synkRunner.info,audioError:document.querySelector('#audio-dialog').open})`);result.samples.push(sample);console.log(JSON.stringify({backend,seconds:(sample.now-sample.probe.start)/1000,raf:sample.probe.raf,timers:sample.probe.timers,elapsed:sample.info.model?.elapsed,frames:sample.info.world?.frames,errors:sample.probe.errors}));if(sample.info.model?.elapsed>3&&sample.info.world?.frames>30&&!sample.audioError){await finish(true);return;}}
 throw Error('Public game did not advance');
 }catch(e){result.errors.push(e.stack||e.message);await finish(false);}});
