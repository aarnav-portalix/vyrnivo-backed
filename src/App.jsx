import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import LegalCenter,{legalSections} from './Legal.jsx';
import HumanCheck from './HumanCheck.jsx';

const icons={
 download:<><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></>,
 youtube:<><rect x="3" y="5" width="18" height="14" rx="5"/><path d="m10 9 5 3-5 3Z"/></>,
 instagram:<><rect x="3" y="3" width="18" height="18" rx="6"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 discover:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 check:<path d="m5 12 4 4L19 6"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 paste:<><rect x="8" y="5" width="12" height="16" rx="2"/><path d="M11 3h6v4h-6zm-6 6H4v12h11"/></>,
 copy:<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
 play:<path d="m9 6 10 6-10 6z"/>,
 tune:<><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
 music:<><path d="M9 17V5l11-2v12M9 9l11-2"/><circle cx="6" cy="17" r="3"/><circle cx="17" cy="15" r="3"/></>,
 video:<><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/></>,
 external:<><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>,
 engine:<><circle cx="12" cy="12" r="9"/><path d="m10 8 5 4-5 4z"/></>,
 about:<><circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/></>,
 users:<><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></>,
 activity:<><path d="M2 12h4l3-7 6 14 3-7h4"/></>
};
function Icon({name,size=19,...props}){return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{icons[name]}</svg>;}
function saved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
const pages=['download','engine','discover','about'];
const faqs=[
 ['How do I download?','Paste a public link, choose a format, and press Download. Save or share the temporary file link when ready.'],
 ['Do YouTube downloads work?','Yes, eligible public videos can work. Vyrnivo may automatically try a backup engine if the main one is unavailable. Some videos still fail because of access restrictions or rate limits.'],
 ['Can I download Instagram Reels?','Some public Reels work; private or restricted Reels may not.'],
 ['How long do files stay available?','Usually 10 minutes after preparation, or less if the server restarts.'],
 ['Why might I see human verification?','When the anti-bot check is enabled, you may need to verify before preparing a download.'],
 ['Do I need an account?','No. Vyrnivo currently works without signing in.']
];
const isYouTube=url=>/(?:youtube\.com|youtu\.be)/i.test(url||'');
const publicMediaKinds=new Set(['video','short','instagram']);
const discoverTypes={youtube:[['all','All'],['videos','Videos'],['shorts','Shorts'],['channels','Channels'],['playlists','Playlists']],instagram:[['reels','Reels'],['creators','Creators']]};
function friendlyError(message,source){
 const m=String(message||'');
 if(/429|rate.limit|blocking this render server|too many requests/i.test(m))return 'The source is rate-limiting this server. Try again later or use another public link.';
 if(/403|sign.in|login|blocked|not allow/i.test(m))return 'This video could not be accessed. Try another public link.';
 if(/processing|busy/i.test(m))return 'Another video is being prepared. Try again shortly.';
 if(/format|quality/i.test(m))return 'That format is unavailable for this video. Try MP4 at 720p.';
 if(/expired/i.test(m))return 'This download link has expired. Start again.';
 if(m.length>150)return 'Could not prepare this video. Try a different link.';
 return m||('Could not download this '+source+' video.');
}
function Preview({item,onClose}){
 useEffect(()=>{const close=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[onClose]);
 useEffect(()=>{
  if(item.kind!=='instagram')return;
  let live=true;
  const load=()=>{
   if(window.instgrm?.Embeds?.process){window.instgrm.Embeds.process();return}
   if(document.querySelector('script[data-vyrnivo-instagram]'))return;
   const tag=document.createElement('script');tag.src='https://www.instagram.com/embed.js';tag.async=true;tag.dataset.vyrnivoInstagram='yes';tag.onload=()=>{if(live)window.instgrm?.Embeds?.process()};document.body.appendChild(tag)
  };load();return()=>{live=false}
 },[item.url,item.kind]);
 return <div className="overlay" onClick={onClose}><section className="player" role="dialog" aria-modal="true" aria-label={item.title||'Video preview'} onClick={e=>e.stopPropagation()}>
  <div className="player-header"><h2>{item.title||'Video preview'}</h2><button className="round-btn" aria-label="Close preview" onClick={onClose}><Icon name="close"/></button></div>
  {item.kind==='instagram'
   ? <div className="instagram-frame"><blockquote key={item.url} className="instagram-media" data-instgrm-permalink={item.url} data-instgrm-version="14"><a href={item.url} target="_blank" rel="noopener noreferrer">Watch on Instagram</a></blockquote></div>
   : <iframe title={item.title} src={'https://www.youtube-nocookie.com/embed/'+item.id} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>}
  <a className="player-original" href={item.url||'https://www.youtube.com/watch?v='+item.id} rel="noopener noreferrer" target="_blank">Open original <Icon name="external" size={15}/></a>
 </section></div>;
}
function App(){
 const initialPage=location.hash.slice(1);
 const [page,setPage]=useState(pages.includes(initialPage)?initialPage:legalSections.includes(initialPage)?'about':'download');
 const [legalSection,setLegalSection]=useState(legalSections.includes(initialPage)?initialPage:'privacy');
 const [url,setUrl]=useState('');
 const [mode,setMode]=useState(()=>saved('vyrnivo-mode','Video + audio'));
 const [quality,setQuality]=useState(()=>saved('vyrnivo-quality','720p'));
 const [container,setContainer]=useState('MP4');
 const [more,setMore]=useState(false);
 const [status,setStatus]=useState(null);
 const [humanStatus,setHumanStatus]=useState({enabled:false,siteKey:null});
 const [humanCheckOpen,setHumanCheckOpen]=useState(false);
 const [statusExpanded,setStatusExpanded]=useState(false);
 const [presence,setPresence]=useState(null);
 const [searchSource,setSearchSource]=useState('youtube');
 const [searchKind,setSearchKind]=useState('all');
 const [searchUrl,setSearchUrl]=useState('');
 const [job,setJob]=useState(()=>saved('dw3lastJob',null));
 const [busy,setBusy]=useState(false);
 const [formError,setFormError]=useState('');
 const [convertUrl,setConvertUrl]=useState('');
 const [convertFormat,setConvertFormat]=useState('MP4');
 const [convertBusy,setConvertBusy]=useState(false);
 const [convertError,setConvertError]=useState('');
 const [alternatives,setAlternatives]=useState([]);
 const [alternativesNotice,setAlternativesNotice]=useState('');
 const [discoverBusy,setDiscoverBusy]=useState(false);
 const [query,setQuery]=useState('');
 const [searching,setSearching]=useState(false);
 const [results,setResults]=useState([]);
 const [searched,setSearched]=useState('');
 const [searchError,setSearchError]=useState('');
 const [searchNote,setSearchNote]=useState('');
 const [preview,setPreview]=useState(null);
 const [toast,setToast]=useState('');
 const [tick,setTick]=useState(Date.now());
 const notifyTimer=useRef(null);
 const searchAbort=useRef(null);
 const inputRef=useRef(null);
 const showToast=message=>{setToast(message);clearTimeout(notifyTimer.current);notifyTimer.current=setTimeout(()=>setToast(''),3500)};
 const refreshStatus=async()=>{try{const r=await fetch('/api/downloads/status');const s=await r.json();setStatus(r.ok?s:{enabled:false})}catch{setStatus({enabled:false})}};
 useEffect(()=>{let alive=true;fetch('/api/security/status').then(r=>{if(!r.ok)throw Error('Security status unavailable');return r.json()}).then(data=>{if(alive)setHumanStatus({enabled:data.enabled===true,siteKey:data.enabled===true?data.siteKey:null})}).catch(()=>{if(alive)setHumanStatus({enabled:false,siteKey:null})});return()=>{alive=false}},[]);
 useEffect(()=>{
  refreshStatus();
  const statusTimer=setInterval(refreshStatus,30000);
  const onHash=()=>{const next=location.hash.slice(1);setPage(pages.includes(next)?next:legalSections.includes(next)?'about':'download');if(legalSections.includes(next))setLegalSection(next)};
  window.addEventListener('hashchange',onHash);
  return()=>{clearInterval(statusTimer);window.removeEventListener('hashchange',onHash)};
 },[]);
 useEffect(()=>{
  const key='vyrnivo-active-browser-id';
  let id;
  try{id=localStorage.getItem(key)}catch{}
  if(!/^[a-f0-9-]{36}$/i.test(id||'')){
   id=crypto.randomUUID();
   try{localStorage.setItem(key,id)}catch{}
  }
  let live=true,pending=false;
  const heartbeat=async()=>{
   if(!live||pending||document.visibilityState==='hidden')return;
   pending=true;
   try{
    const r=await fetch('/api/presence/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
    if(!r.ok)throw Error('Presence unavailable');
    const data=await r.json();
    if(live)setPresence(data);
   }catch{if(live)setPresence(null)}
   finally{pending=false}
  };
  const timer=setInterval(heartbeat,25000);
  document.addEventListener('visibilitychange',heartbeat);
  window.addEventListener('focus',heartbeat);
  heartbeat();
  return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',heartbeat);window.removeEventListener('focus',heartbeat)};
 },[]);
 useEffect(()=>persist('vyrnivo-mode',mode),[mode]);
 useEffect(()=>persist('vyrnivo-quality',quality),[quality]);
 useEffect(()=>persist('dw3lastJob',job),[job]);
 useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{
  if(!job?.id||job.state!=='processing')return;
  let alive=true;let requestInFlight=false;
  const poll=async()=>{
   if(requestInFlight||!alive)return;requestInFlight=true;
   try{
    const r=await fetch((job.engine==='converter'?'/api/converter/':'/api/downloads/')+job.id);
    const data=await r.json();
    if(alive){if(r.ok){setJob(data);if(data.state==='failed')refreshStatus()}else setJob(p=>({...p,state:'failed',error:data.error||'Download no longer available.'}))}
   }catch{if(alive)setFormError('Connection interrupted. You can try again.')}
   finally{requestInFlight=false}
  };
  poll();const interval=setInterval(poll,2400);
  return()=>{alive=false;clearInterval(interval)}
 },[job?.id,job?.state,job?.engine]);
 useEffect(()=>{if(job?.state==='ready'&&job.expiresAt<=tick)setJob(p=>p?.state==='ready'?{...p,state:'expired',downloadUrl:null}:p)},[tick,job?.state,job?.expiresAt]);
 const nav=next=>{if(!pages.includes(next))return;if(next!==page){setQuery('');setResults([]);setSearched('');setSearchError('');setSearchNote('');searchAbort.current?.abort();setSearching(false)}setPage(next);location.hash=next;window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 const openLegal=section=>{if(!legalSections.includes(section))return;setLegalSection(section);setPage('about');location.hash=section;requestAnimationFrame(()=>document.getElementById('legal-center')?.scrollIntoView({block:'start',behavior:'smooth'}))};
 const switchSearchSource=next=>{if(next===searchSource)return;searchAbort.current?.abort();setSearching(false);setSearchSource(next);setSearchKind(next==='instagram'?'reels':'all');setQuery('');setResults([]);setSearched('');setSearchError('');setSearchNote('');setSearchUrl('')};
 const switchSearchKind=next=>{if(next===searchKind)return;searchAbort.current?.abort();setSearching(false);setSearchKind(next);setResults([]);setSearched('');setSearchError('');setSearchNote('');setSearchUrl('')};
 const setDownloadMode=next=>{setMode(next);setContainer(next==='Audio only'?'MP3':'MP4');if(next==='Audio only')setQuality('Best available');else if(quality==='Best available')setQuality('720p')};
 async function pasteLink(){
  try{
   const clip=(await navigator.clipboard.readText()).trim();
   if(!/^https?:\/\//i.test(clip)){showToast('Copy a video link first.');return}
   setUrl(clip);setFormError('');inputRef.current?.focus()
  }catch{showToast('Tap the link field and use Paste.')}
 }
 const freeBackupCompatible=(mode==='Video + audio'&&container==='MP4')||(mode==='Audio only'&&container==='MP3');
 const freeBackupReady=status?.freeFallbackEnabled&&freeBackupCompatible&&Number(status?.backupRetryAt||0)<=tick;
 const youtubeUnavailable=isYouTube(url)&&Number(status?.youtubeRetryAt)>tick&&!freeBackupReady;
 async function startDownload(e,verifiedToken=null){
  e?.preventDefault?.();
  const link=url.trim();
  if(!/^https:\/\//i.test(link)){setFormError('Paste a YouTube or Instagram video link.');inputRef.current?.focus();return}
  if(status?.enabled===false){setFormError('Downloader is offline. Try again shortly.');return}
  if(busy)return;
  if(humanStatus.enabled&&!verifiedToken){setHumanCheckOpen(true);return}
  setHumanCheckOpen(false);
  setBusy(true);setFormError('');setJob(null);
  try{
   const r=await fetch('/api/downloads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link,mode,quality:mode==='Audio only'?'Best available':quality,container,...(humanStatus.enabled?{turnstileToken:verifiedToken}:{})})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Could not start download.');
   setJob(data);
   if(data.state==='ready')showToast('Your file is ready.')
  }catch(e){setFormError(friendlyError(e.message,isYouTube(link)?'YouTube':'Instagram'));refreshStatus()}
  finally{setBusy(false)}
 }
 async function findAlternatives(){
  if(discoverBusy)return;
  const link=convertUrl.trim();
  if(!isYouTube(link)){setConvertError('Enter a YouTube video link to search for licensed alternatives.');return}
  setDiscoverBusy(true);setConvertError('');setAlternatives([]);setAlternativesNotice('');
  try{
   const r=await fetch('/api/converter/discover?url='+encodeURIComponent(link));
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Could not search Wikimedia Commons.');
   setAlternatives(data.alternatives||[]);
   setAlternativesNotice(data.notice||'');
  }catch(error){setConvertError(String(error?.message||'Licensed source search failed.'))}
  finally{setDiscoverBusy(false)}
 }
 async function convertAlternative(candidateId){
  if(convertBusy)return;
  setConvertError('');setConvertBusy(true);setJob(null);
  try{
   const r=await fetch('/api/converter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidateId,output:convertFormat})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Could not start conversion.');
   setJob(data);
  }catch(error){setConvertError(String(error.message||'Conversion failed.'))}
  finally{setConvertBusy(false)}
 }
 async function startConversion(e){
  e?.preventDefault?.();
  if(convertBusy)return;
  if(isYouTube(convertUrl.trim())&&!/\b(?:aqz-KE-bpKQ|jNQXAC9IVRw)\b/.test(convertUrl))return findAlternatives();
  if(status?.enabled===false){setConvertError('The converter is temporarily offline.');return}
  setConvertError('');setConvertBusy(true);setJob(null);
  try{
   const response=await fetch('/api/converter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:convertUrl.trim(),output:convertFormat})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Could not start conversion.');
   setJob(data);
  }catch(error){setConvertError(String(error.message||'Conversion failed.'))}
  finally{setConvertBusy(false)}
 }
 async function copyLink(){
  try{await navigator.clipboard.writeText(location.origin+job.downloadUrl);showToast('Link copied!')}
  catch{showToast('Hold the Download button to copy its link.')}
 }
 async function search(e){
  e?.preventDefault?.();
  const q=query.trim();if(q.length<2){setSearchError('Enter at least two characters.');return}
  searchAbort.current?.abort();const controller=new AbortController();searchAbort.current=controller;
  setSearching(true);setSearchError('');setSearchNote('');setResults([]);setSearched(q);
  try{
   const r=await fetch('/api/search/'+searchSource+'?q='+encodeURIComponent(q)+'&kind='+encodeURIComponent(searchKind),{signal:controller.signal});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Search unavailable.');
   setResults(data.items||[]);setSearchNote(data.notice||'');setSearchUrl(data.searchUrl||'');
  }catch(e){if(e.name!=='AbortError')setSearchError('Search unavailable. Try again.')}
  finally{if(searchAbort.current===controller)setSearching(false)}
 }
 const chooseResult=item=>{
  if(!publicMediaKinds.has(item.kind))return;
  setUrl(item.url||'https://www.youtube.com/watch?v='+item.id);
  setFormError('');setPreview(null);nav('download');
  showToast('Link added. Choose a format and download.')
 };
 const isInstagram=searchSource==='instagram';
 const seconds=job?.expiresAt?Math.max(0,Math.ceil((job.expiresAt-tick)/1000)):0;
 const original=job?.error&&isYouTube(url)?url:null;
 const primaryBlocked=Number(status?.youtubeRetryAt)>tick;
 const backupBlocked=Number(status?.backupRetryAt)>tick;
 const remaining=until=>{const seconds=Math.max(0,Math.ceil((Number(until||0)-tick)/1000));return seconds>=60?Math.ceil(seconds/60)+' min':seconds+' sec'};
 const overallServiceLabel=status?.enabled===false?'Offline':primaryBlocked?(status?.freeFallbackEnabled&&!backupBlocked?'Backup ready to try':'Limited'):'Ready to try';
 const formatDuration=seconds=>{
  const value=Math.max(0,Math.floor(seconds||0));
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
 };
 const elapsedProcessing=job?.createdAt?Math.max(0,Math.floor((tick-job.createdAt)/1000)):(job?.elapsedSeconds||0);
 const remainingEstimate=Number.isFinite(job?.estimatedTotalSeconds)
  ?Math.max(0,Math.ceil(job.estimatedTotalSeconds-elapsedProcessing)):job?.estimatedSecondsRemaining;
 const measuredProgress=Number.isFinite(job?.progressPercent);
 const jobView=<>
     {job?.state==='processing'&&<div className="download-result pending" role="status" aria-live="polite"><div className="loading-spinner" aria-hidden="true"/><div className="processing-copy"><strong>{job.engine==='converter'?'Converting your file':'Preparing your file'}</strong><p>{job.stage||'Working on your media…'}</p><div className="processing-time"><span>Elapsed <b>{formatDuration(elapsedProcessing)}</b></span><span>{Number.isFinite(remainingEstimate)?remainingEstimate>0?<>About <b>{formatDuration(remainingEstimate)}</b> left</>:'Finishing…':'Calculating time…'}</span></div></div><div className="loading-track" aria-label={measuredProgress?'Processing '+Math.round(job.progressPercent)+' percent':'Processing'}><span className={measuredProgress?'measured':'indeterminate'} style={measuredProgress?{width:Math.max(3,Math.min(100,job.progressPercent))+'%'}:{}}/></div><p className="processing-note">Time remaining is an estimate. Network speeds and video formats can change it.</p></div>}
     {job?.state==='ready'&&<div className="download-result ready" role="status"><div className="ready-heading"><Icon name="check" size={21}/><div><strong>{job.sourceMetadata?.alternateVersion?'Licensed excerpt ready':'Ready to save'}</strong><p>{(job.bytes/1048576).toFixed(1)} MB · Expires in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</p></div></div><div className="ready-actions"><a href={job.downloadUrl} className="cta" download>Download file <Icon name="download" size={18}/></a><button type="button" onClick={copyLink} className="outline-btn"><Icon name="copy" size={17}/> Copy link</button></div>{job.sourceMetadata?.alternateVersion&&<div className="converter-license" role="note"><strong>{job.sourceMetadata.videoTitle} — not the full YouTube upload</strong><span>{job.sourceMetadata.attribution} · <a href={job.sourceMetadata.sourcePage} target="_blank" rel="noopener noreferrer">Source</a> · <a href={job.sourceMetadata.licenseUrl} target="_blank" rel="noopener noreferrer">{job.sourceMetadata.license}</a> · Converted by Vyrnivo</span></div>}</div>}
     {job?.state==='failed'&&<div className="message error" role="alert"><span>{friendlyError(job.error,isYouTube(url)?'YouTube':'Instagram')} {isYouTube(url)&&quality==='2160p · 4K'?'This video or backup may not offer 4K.':''}</span>{isYouTube(url)&&quality==='2160p · 4K'&&<button type="button" onClick={()=>{setQuality('720p');setMore(true);setJob(null);setFormError('Quality changed to 720p. Try Download again.')}}>Try 720p</button>}{isYouTube(url)&&<a href={url} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={14}/></a>}</div>}
     {job?.state==='expired'&&<div className="message warning">Link expired. Submit the video again.</div>}

 </>;
 return <div className="app-shell">
  <div className="ambient" aria-hidden="true"><span/><span/></div>
  <header className="topbar">
   <a className="logo" href="#download" onClick={e=>{e.preventDefault();nav('download')}}><span className="logo-icon"><img src="/favicon.svg" width="39" height="39" alt=""/></span>vyrnivo<span className="logo-dot">.</span></a>
   <nav aria-label="Main navigation" className="tabs">
    {pages.map(p=><button key={p} type="button" className={'tab '+(page===p?'active':'')} aria-current={page===p?'page':undefined} onClick={()=>nav(p)}><Icon name={p} size={18}/><span>{p==='download'?'Download':p==='engine'?'Our Engine':p==='discover'?'Discover':'About'}</span></button>)}
   </nav>
  </header>
  <main className="content" id="main-content">
   <div className="hero">
    <p className="kicker">{page==='download'?'YOUR MEDIA, YOUR WAY':page==='engine'?'BUILT BY AARNAV':page==='discover'?'FIND YOUR NEXT FAVORITE':'BEYOND THE DOWNLOAD'}</p>
    <h1>{page==='download'?<>Save the <em>moment.</em></>:page==='engine'?<>Our own <em>engine.</em></>:page==='discover'?<>Explore & <em>discover.</em></>:<>About <em>Vyrnivo.</em></>}</h1>
    <p>{page==='download'?'Paste a link. Pick a format. Download.':page==='engine'?'Explore our first-party media converter and licensed sources.':page==='discover'?'Discover videos, Shorts, channels, playlists, Reels and creators.':'FAQs, privacy, terms, and everything about Vyrnivo.'}</p>
   </div>
   {page==='download'&&
     <section className="panel" aria-label="Video downloader">
     <form onSubmit={startDownload}>
      <div className="url-row"><Icon name="download" size={20}/><input ref={inputRef} type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" autoComplete="url" spellCheck={false} value={url} onChange={e=>{setUrl(e.target.value);setFormError('')}} placeholder="Paste a YouTube or Instagram link" aria-label="Video URL"/>
       {url?<button type="button" className="icon-action" aria-label="Clear URL" onClick={()=>{setUrl('');setFormError('');inputRef.current?.focus()}}><Icon name="close" size={18}/></button>:<button type="button" className="paste-btn" onClick={pasteLink}><Icon name="paste" size={16}/> Paste</button>}
      </div>
      <div className="format-tabs" role="group" aria-label="Download format">
       {[['Video + audio','Video'],['Audio only','Audio'],['Video only','Video only']].map(([value,label])=><button type="button" key={value} className={'format-tab '+(mode===value?'active':'')} aria-pressed={mode===value} onClick={()=>setDownloadMode(value)}>{label}</button>)}
      </div>
      <div className="form-actions">
       <button className={'options-btn '+(more?'is-open':'')} type="button" aria-expanded={more} aria-controls="download-options" onClick={()=>setMore(v=>!v)}><Icon name="tune" size={18}/> {mode==='Audio only'?container:quality} <span aria-hidden="true">{more?'−':'+'}</span></button>
       <button type="submit" className="cta" disabled={busy||status?.enabled===false}>{busy?'Starting…':'Download'}<Icon name="arrow" size={19}/></button>
      </div>
      {more&&<div className="advanced" id="download-options">
       {mode!=='Audio only'&&<label>Quality<select value={quality} onChange={e=>setQuality(e.target.value)}>{['720p','1080p','1440p','2160p · 4K','Best available'].map(x=><option key={x}>{x}</option>)}</select></label>}
       <label>File type<select value={container} onChange={e=>setContainer(e.target.value)}>{(mode==='Audio only'?['MP3','M4A','WAV','Original audio']:['MP4','WebM','MKV']).map(x=><option key={x}>{x}</option>)}</select></label>
      </div>}
     </form>
     {formError&&<div className="message error" role="alert"><span>{formError}</span>{original&&<a href={original} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={14}/></a>}</div>}
     {youtubeUnavailable&&!formError&&<div className="message warning" role="status">This server is temporarily rate-limited. You can try another link; some downloads may still fail until the source or backup recovers.</div>}
     {status?.enabled===false&&<div className="message warning" role="alert">Downloader is offline. <button type="button" onClick={refreshStatus}>Retry</button></div>}
     <div className="live-dashboard" aria-label="Live downloader status">
      <div className="live-overview">
       <div className="live-service"><span className={'live-dot '+(status?.enabled===false?'off':primaryBlocked&&!status?.freeFallbackEnabled?'warning':'on')}/><span><strong>Downloader status</strong><small>{overallServiceLabel}</small></span></div>
       <div className="live-visitors" aria-label="Estimated active visitors"><Icon name="users" size={16}/><strong>{Number.isInteger(presence?.online)?presence.online:'—'}</strong><span>online</span></div>
       <button type="button" className="status-toggle" aria-expanded={statusExpanded} onClick={()=>setStatusExpanded(x=>!x)}>{statusExpanded?'Hide details':'Details'} <Icon name="activity" size={15}/></button>
      </div>
      {statusExpanded&&<div className="provider-details">
       <div className="provider-item"><div><strong>Main engine</strong></div><span className={'provider-state '+(primaryBlocked?'limited':'')}>{status?.enabled===false?'Offline':primaryBlocked?'Temporarily limited':'Ready to try'}</span></div>
       <div className="provider-item"><div><strong>Backup engine</strong></div><span className={'provider-state '+(backupBlocked?'limited':'')}>{!status?.freeFallbackEnabled?'Unavailable':backupBlocked?'Temporarily limited':'Ready to try'}</span></div>
       <p className="status-footnote">Status may change when a download starts. “Ready to try” does not guarantee every video. The online count estimates active browsers, not individual people.</p>
       <button type="button" className="refresh-status" onClick={refreshStatus}><Icon name="activity" size={15}/> Refresh engine status</button>
      </div>}
      <div className="discover-teaser"><span>Looking for something to download? Search videos and Reels in Discover.</span><button type="button" onClick={()=>nav('discover')}><Icon name="search" size={15}/> Open Discover <Icon name="arrow" size={15}/></button></div>
     </div>
     {jobView}
    </section>
    }

   {page==='engine'&&<section className="panel engine-panel" aria-label="Vyrnivo's own media engine">
    <div className="engine-intro"><strong>Vyrnivo Converter</strong><p>Our FFmpeg-powered converter works with approved public media files and searches for independently hosted Creative Commons alternatives. An alternative may be a clip, not the original YouTube upload.</p></div>
     <details className="converter-tool engine-tool" id="vyrnivo-converter" open>
      <summary><span><Icon name="tune" size={18}/> Vyrnivo Converter <small>Our own engine · Beta</small></span><span className="converter-plus" aria-hidden="true">+</span></summary>
      <div className="converter-body">
       <p>Convert approved files to MP4 or MP3, or paste a YouTube link to search Wikimedia Commons for separately hosted, freely licensed alternatives. Related files may be clips, edits or different versions—not the original YouTube upload.</p>
       <form onSubmit={startConversion}>
        <label className="converter-label" htmlFor="converter-url">Approved direct media URL or licensed YouTube trial link</label>
        <input id="converter-url" type="url" required value={convertUrl} onChange={e=>{setConvertUrl(e.target.value);setConvertError('');setAlternatives([]);setAlternativesNotice('')}} placeholder="https://…/video.webm" autoComplete="url" spellCheck={false}/>
        <div className="converter-options">
         <label htmlFor="converter-output">Output <select id="converter-output" value={convertFormat} onChange={e=>setConvertFormat(e.target.value)}><option>MP4</option><option>MP3</option></select></label>
         <button type="submit" className="cta" disabled={convertBusy||status?.enabled===false}>{convertBusy?'Starting…':isYouTube(convertUrl)&&!/\b(?:aqz-KE-bpKQ|jNQXAC9IVRw)\b/.test(convertUrl)?'Find licensed sources':'Convert file'}<Icon name="arrow" size={16}/></button>
        </div>
       </form>
       {isYouTube(convertUrl)&&<button type="button" className="converter-sample" disabled={discoverBusy} onClick={findAlternatives}>{discoverBusy?'Searching Commons…':'Search Commons for licensed alternatives to this video'} <Icon name="search" size={14}/></button>}
       <div className="converter-examples"><button className="converter-sample" type="button" onClick={()=>{setConvertUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');setConvertFormat('MP4');setConvertError('')}}>Try a licensed YouTube-link example (33-second excerpt)</button><button className="converter-sample" type="button" onClick={()=>{setConvertUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw');setConvertFormat('MP4');setConvertError('')}}>Try a full CC-licensed YouTube-linked video (19 seconds)</button><button className="converter-sample" type="button" onClick={()=>{setConvertUrl('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');setConvertFormat('MP4');setConvertError('')}}>Try a free CC0 sample video</button></div>
       {convertUrl.includes('jNQXAC9IVRw')&&<div className="converter-license" role="note"><strong>Separately hosted full 19-second Creative Commons copy</strong><span>Me at the zoo · Jawed Karim and Yakov Lapitsky · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a> · <a href="https://commons.wikimedia.org/wiki/File:Me_at_the_zoo.webm" target="_blank" rel="noopener noreferrer">Source</a> · Not retrieved from YouTube</span></div>}
       {convertUrl.includes('aqz-KE-bpKQ')&&<div className="converter-license" role="note"><strong>Licensed alternate clip — not the full YouTube video</strong><span>Converts a 33-second extract of Big Buck Bunny hosted on Wikimedia Commons. Credit: © Blender Foundation / www.bigbuckbunny.org · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a> · <a href="https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_extract.ogv" target="_blank" rel="noopener noreferrer">Source</a></span></div>}
       {discoverBusy&&<p role="status" className="alternatives-status">Searching Wikimedia Commons for approved media…</p>}
       {alternativesNotice&&<p role="status" className="alternatives-status">{alternativesNotice}</p>}
       {!!alternatives.length&&<div className="alternatives-list" aria-label="Licensed alternatives">{alternatives.map(option=><article className="alternative-card" key={option.id}>
        <strong>{option.title}</strong><p>{(option.size/1048576).toFixed(1)} MB · {option.license} · Independently hosted</p>
        <p>May be a clip or different version. Not the YouTube upload.</p>
        <div className="alternative-actions"><a href={option.sourcePage} target="_blank" rel="noopener noreferrer">Review original and attribution <Icon name="external" size={14}/></a><button type="button" disabled={convertBusy} className="outline-btn" onClick={()=>convertAlternative(option.id)}>Convert this file to {convertFormat}</button></div>
       </article>)}</div>}
       {convertError&&<div className="message error" role="alert">{convertError}</div>}
       <p className="converter-hint">30 MB source limit · 2-minute output maximum · file expires 10 minutes after conversion · only convert media you have permission to use.</p>
      </div>
     </details>
    {jobView}
   </section>}
   {page==='about'&&<section className="about-intro"><h2>All the extras, neatly organized.</h2><p>Frequently asked questions, policies, and everything else about Vyrnivo.</p><div className="about-notes"><span>Free to use</span><span>10-minute file links</span><span>No account needed</span></div></section>}
   {page==='about'&&<section className="faq" id="faq" aria-labelledby="faq-title">
    <div className="faq-head"><p className="faq-eyebrow">Need a hand?</p><h2 id="faq-title">Frequently asked questions</h2></div>
    <div className="faq-items">{faqs.map(([question,answer])=><details key={question} className="faq-item"><summary><span>{question}</span><span className="faq-plus" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
   </section>}
   {page==='about'&&<LegalCenter selected={legalSection} onSelect={openLegal}/>} 
   {page==='discover'&&<section className="discover-hub" aria-label="Search videos and public Reels">
     <div className="discover-intro"><strong>Find videos, Shorts & creators</strong><p>Browse public search results. Preview media, open channels or profiles, and send eligible video links to Download. Some content may be unavailable.</p></div>
     <div className="search-mode-tabs" role="group" aria-label="Search platform"><button type="button" className={searchSource==='youtube'?'active':''} aria-pressed={searchSource==='youtube'} onClick={()=>switchSearchSource('youtube')}><Icon name="youtube" size={16}/> YouTube</button><button type="button" className={searchSource==='instagram'?'active':''} aria-pressed={searchSource==='instagram'} onClick={()=>switchSearchSource('instagram')}><Icon name="instagram" size={16}/> Instagram</button></div>
    <div className="discover-filters" role="group" aria-label="Result type">{discoverTypes[searchSource].map(([value,label])=><button key={value} type="button" aria-pressed={searchKind===value} className={searchKind===value?'active':''} onClick={()=>switchSearchKind(value)}>{label}</button>)}</div>
    <section className="discovery" aria-label={isInstagram?'Instagram search':'YouTube search'}>
     <form className="search-panel" onSubmit={search}>
      <div className="search-input"><Icon name="search"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={isInstagram?(searchKind==='creators'?'Search creator names or @handles…':'Search Reels, topics, hashtags…'):(searchKind==='channels'?'Search YouTube channels…':searchKind==='shorts'?'Search Shorts…':'Search videos, channels and music…')} aria-label={isInstagram?'Search Instagram':'Search YouTube'}/></div>
      <button type="submit" className="cta" disabled={searching}>{searching?'Searching…':'Search'} <Icon name="arrow" size={18}/></button>
     </form>
     {searchError&&<div className="message error" role="alert">{searchError}</div>}
     {!!searchNote&&searched&&<p className="search-source-note" role="status">{searchNote} {searchUrl&&<a href={searchUrl} target="_blank" rel="noopener noreferrer">Open original search <Icon name="external" size={13}/></a>}</p>}
     {searching&&<div className="search-loading" role="status"><span className="loading-spinner"/> Searching…</div>}
     {!searching&&searched&&<div className="result-heading"><span>{results.length?results.length+' results for “'+searched+'”':'Results for “'+searched+'”'}</span>{results.length>0&&<button type="button" onClick={()=>{setResults([]);setSearched('');setQuery('')}}>Clear</button>}</div>}
     {!searching&&searched&&!results.length&&!searchError&&<div className="empty-results"><Icon name="search" size={28}/><strong>No accessible results returned</strong><p>Try another search term, use a different filter, or open the source website's complete search.</p>{searchUrl&&<a href={searchUrl} target="_blank" rel="noopener noreferrer">Open original search <Icon name="external" size={15}/></a>}</div>}
     {!!results.length&&<div className="results">
      {results.map(item=><article className="media-card" key={item.kind+'-'+item.id}>
       <div className="media-image">{publicMediaKinds.has(item.kind)?<button className="media-art-action" type="button" onClick={()=>setPreview(item)} aria-label={'Preview '+item.title}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" decoding="async"/>:<span className="reel-art"><Icon name={isInstagram?'instagram':'video'} size={36}/><small>{item.kind==='instagram'?'REEL':'VIDEO'}</small></span>}<span className="play-bubble"><Icon name="play" size={18}/></span></button>:<a className="media-art-action" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={'Open '+item.title}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" decoding="async"/>:<span className="reel-art"><Icon name={isInstagram?'instagram':'youtube'} size={34}/><small>{item.kind==='creator'?'CREATOR':item.kind==='channel'?'CHANNEL':'PLAYLIST'}</small></span>}</a>}</div>
       <div className="media-content"><span className="media-kind">{item.kind==='short'?'SHORT':String(item.kind||'video').toUpperCase()}</span><h2 title={item.title}>{item.title}</h2><p>{item.creator||'Public search result'}</p><div className="media-actions">{publicMediaKinds.has(item.kind)?<><button type="button" className="outline-btn" onClick={()=>setPreview(item)}>Preview</button><button type="button" className="mini-primary" onClick={()=>chooseResult(item)}>Use link <Icon name="arrow" size={16}/></button></>:<a className="outline-btn" href={item.url} target="_blank" rel="noopener noreferrer">{item.kind==='playlist'?'Open playlist':item.kind==='creator'?'Open creator':'Open channel'} <Icon name="external" size={14}/></a>}</div></div>
      </article>)}
     </div>}
    </section>
    </section>}
  </main>
  <footer className="footer"><span className="footer-brand">vyrnivo</span><span className="footer-credit">Built by Aarnav</span><nav className="footer-links" aria-label="Policies"><a href="#privacy" onClick={e=>{e.preventDefault();openLegal('privacy')}}>Privacy</a><a href="#terms" onClick={e=>{e.preventDefault();openLegal('terms')}}>Terms</a><a href="#copyright" onClick={e=>{e.preventDefault();openLegal('copyright')}}>Copyright</a><a href="#disclaimer" onClick={e=>{e.preventDefault();openLegal('disclaimer')}}>Notice</a></nav><span className="footer-note">Only save content you have permission to download.</span></footer>
  {humanCheckOpen&&humanStatus.enabled&&<HumanCheck siteKey={humanStatus.siteKey} onVerified={token=>startDownload(null,token)} onClose={()=>setHumanCheckOpen(false)}/>}
  {preview&&<Preview item={preview} onClose={()=>setPreview(null)}/>}
  {toast&&<div className="toast" role="status"><Icon name="check" size={18}/>{toast}</div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
