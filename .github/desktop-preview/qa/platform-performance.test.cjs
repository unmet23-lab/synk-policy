'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validate,applySourceOverlay,MANIFEST,sha}=require('../build-platform-performance.cjs'),{configFor}=require('../build.cjs');
test('pinned Platform overlay changes only two reviewed runtime files',t=>{
  assert.equal(validate().ok,true);const tempRoot=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(tempRoot,'synk-platform-performance-'));
  t.after(()=>{const relative=path.relative(tempRoot,root);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));fs.rmSync(root,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'src'));for(const entry of MANIFEST.files)fs.copyFileSync(path.join(__dirname,'../frozen/platform',entry.file),path.join(root,entry.file));
  const result=applySourceOverlay(root);assert.equal(result.files.length,2);for(const entry of result.files)assert.equal(sha(path.join(root,entry.file)),entry.afterSHA256);
  assert.throws(()=>applySourceOverlay(root),/Baseline source differs/);
});
test('Platform artifact version can change while original builder defaults stay unchanged',()=>{
  assert.match(configFor('platform','arm64','stage','out',[]).artifactName,/0\.4\.1/);
  assert.match(configFor('platform','arm64','stage','out',[],'0.4.3').artifactName,/0\.4\.3/);
  for(const arch of ['arm64','x64'])for(const child of MANIFEST.mac[arch].packages)assert.equal(child.version,'0.4.1');
  for(const pin of MANIFEST.windows.additionalLegacyPins){assert.equal(pin.version,'0.4.2');assert.equal(pin.installer,undefined);}
});
