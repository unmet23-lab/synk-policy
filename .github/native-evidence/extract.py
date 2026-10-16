import datetime, hashlib, json, os, pathlib, time, urllib.request, urllib.error, zipfile

BASE = pathlib.Path(__file__).resolve().parent
INPUT = (BASE / 'input.json').read_bytes()
SPEC = json.loads(INPUT)
OUT = pathlib.Path('native-evidence-small')
FULL = pathlib.Path('native-evidence-original-zips')
OUT.mkdir(); FULL.mkdir()
TOKEN = os.environ['GH_TOKEN']
REPO = SPEC['repository']
def sha(b): return hashlib.sha256(b).hexdigest()
def api(route):
    req = urllib.request.Request('https://api.github.com/repos/' + REPO + '/' + route, headers={'Authorization':'Bearer '+TOKEN, 'Accept':'application/vnd.github+json', 'User-Agent':'SYNK-evidence'})
    with urllib.request.urlopen(req, timeout=30) as res: return json.load(res)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None
def download(artifact, destination):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+str(artifact['id'])+'/zip', headers={'Authorization':'Bearer '+TOKEN,'User-Agent':'SYNK-evidence'})
    try: urllib.request.build_opener(NoRedirect).open(req,timeout=30); raise AssertionError('Redirect missing')
    except urllib.error.HTTPError as e:
        assert e.code == 302
        url=e.headers['Location']
    assert url.startswith('https://')
    started=time.monotonic(); digest=hashlib.sha256(); count=0
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'SYNK-evidence'}),timeout=60) as res, destination.open('xb') as out:
        assert res.status==200
        while True:
            block=res.read(1024*1024)
            if not block: break
            assert time.monotonic()-started < 180
            digest.update(block); count+=len(block); out.write(block)
    assert count==artifact['size_in_bytes']
    assert 'sha256:'+digest.hexdigest()==artifact['digest']
    return {'bytes':count,'sha256':digest.hexdigest(),'fullBodyRead':True}

run=api('actions/runs/'+str(SPEC['nativeRun']['id']))
for key in ['id','head_sha','run_attempt','workflow_id','status','conclusion','event','path']: assert run[key]==SPEC['nativeRun'][key],key
jobs=api('actions/runs/'+str(run['id'])+'/attempts/'+str(run['run_attempt'])+'/jobs?per_page=100')['jobs']
assert len(jobs)==3 and all(j['status']=='completed' and j['conclusion']=='success' for j in jobs)
results=[]
for target in SPEC['targets']:
    expected=target['job']; matches=[j for j in jobs if j['id']==expected['id']]
    assert len(matches)==1
    job=matches[0]
    for key in ['id','name','started_at','completed_at','status','conclusion']: assert job[key]==expected[key],key
    rows=[]
    for pin in target['artifacts']:
        artifact=api('actions/artifacts/'+str(pin['id']))
        for key in ['id','name','digest','size_in_bytes','created_at','expired']: assert artifact[key]==pin[key],key
        assert artifact['workflow_run']['id']==run['id'] and artifact['workflow_run']['head_sha']==run['head_sha']
        dest=FULL/(str(pin['id'])+'.zip'); verified=download(artifact,dest)
        files=[]
        with zipfile.ZipFile(dest) as archive:
            names=archive.namelist(); assert len(names)==len(set(names))
            for member in archive.infolist():
                p=pathlib.PurePosixPath(member.filename)
                assert not p.is_absolute() and '..' not in p.parts and '\\' not in member.filename
                assert ((member.external_attr>>16)&0o170000)!=0o120000
            selected=[n for n in names if n.endswith('.json') and not n.endswith('/')]
            assert selected
            for name in selected:
                info=archive.getinfo(name); assert info.file_size <= 8*1024*1024
                data=archive.read(name); json.loads(data)
                rel=pathlib.Path(target['target'])/pin['kind']/name
                output=OUT/rel; output.parent.mkdir(parents=True,exist_ok=True); output.write_bytes(data)
                files.append({'path':rel.as_posix(),'bytes':len(data),'sha256':sha(data),'archivePath':name})
        rows.append({'artifact':pin,'verified':verified,'files':files})
    results.append({'target':target['target'],'job':expected,'artifacts':rows})
report={'ok':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputSHA256':sha(INPUT),'scriptSHA256':sha(pathlib.Path(__file__).read_bytes()),'sourceHash':SPEC['sourceHash'],'nativeRun':SPEC['nativeRun'],'targets':results,'run':{'id':os.environ['GITHUB_RUN_ID'],'attempt':os.environ['GITHUB_RUN_ATTEMPT'],'head':os.environ['GITHUB_SHA'],'ref':os.environ['GITHUB_REF'],'repository':os.environ['GITHUB_REPOSITORY']},'remoteMutations':0,'secretsRecorded':False,'originalFullZIPsPreservedInArtifact':True}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'ok':True,'targets':len(results),'sourceHash':SPEC['sourceHash'],'originalZIPs':sum(len(t['artifacts']) for t in results)}))
