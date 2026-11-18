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
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
 warning:<><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
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
const pages=['download','discover','about'];
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
function nativeDiscoverUrl(platform,kind,query){
 const q=String(query||'').trim();
 if(platform==='instagram'){
  const hashtag=q.match(/^#([\p{L}\p{N}_]{2,80})$/u);
  if(hashtag)return 'https://www.instagram.com/explore/tags/'+encodeURIComponent(hashtag[1])+'/';
  return 'https://www.instagram.com/explore/search/keyword/?q='+encodeURIComponent(q);
 }
 const sp={videos:'EgIQAQ==',shorts:'EgIQCQ==',channels:'EgIQAg==',playlists:'EgIQAw=='};
 const url=new URL('https://www.youtube.com/results');
 url.searchParams.set('search_query',q);
 if(sp[kind])url.searchParams.set('sp',sp[kind]);
 return url.href;
}
const discoverTypes={youtube:[['all','All'],['videos','Videos'],['shorts','Shorts'],['channels','Channels'],['playlists','Playlists']],instagram:[['reels','Reels'],['creators','Creators']]};
function friendlyError(message,source){
 const m=String(message||'');
 if(/429|rate.limit|blocking this render server|too many requests/i.test(m))return 'The source is rate-limiting this server. Try again later or use another public link.';
 if(/403|sign.in|login|blocked|not allow/i.test(m))return 'This video could not be accessed. Try another public link.';
 if(/processing|busy/i.test(m))return 'Another video is being prepared. Try again shortly.';
 if(/format|quality|retriev|backup|provider|source/i.test(m))return 'This video could not be prepared in that quality. Try another quality, such as 720p or Best available.';
 if(/expired/i.test(m))return 'This download link has expired. Start again.';
 if(m.length>150)return 'Could not prepare this video. Try a different link.';
 return m||('Could not download this '+source+' video.');
}
function AuroraVisual(){return <div className="motion-hero" aria-hidden="true">
 <div className="motion-grid"/>
 <div className="motion-heading"><span className="motion-word" data-text="VYRNIVO">VYRNIVO</span></div>
 <div className="motion-baseline"><span className="motion-index">01 / MEDIA, UNCOMPLICATED</span><span className="motion-rule"><i/></span><span className="motion-end">READY WHEN YOU ARE</span></div>
 </div>}
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
 const [selectedResult,setSelectedResult]=useState(null);
 const [mode,setMode]=useState(()=>{const stored=saved('vyrnivo-mode','Video + audio');return ['Video + audio','Video only','Audio only'].includes(stored)?stored:'Video + audio'});
 const [quality,setQuality]=useState(()=>saved('vyrnivo-quality','720p'));
 const [container,setContainer]=useState(()=>saved('vyrnivo-mode','Video + audio')==='Audio only'?'MP3':'MP4');
 const [audioBitrate,setAudioBitrate]=useState('320 kbps');
 const [more,setMore]=useState(false);
 const [status,setStatus]=useState(null);
 const [humanStatus,setHumanStatus]=useState({enabled:false,siteKey:null});
 const [humanCheckOpen,setHumanCheckOpen]=useState(false);
 const [statusExpanded,setStatusExpanded]=useState(false);
 const [presence,setPresence]=useState(null);
 const [searchSource,setSearchSource]=useState('youtube');
 const [searchKind,setSearchKind]=useState('all');
 const [searchUrl,setSearchUrl]=useState('');
 const [indexedSearchUrl,setIndexedSearchUrl]=useState('');
 const [suggestedProfile,setSuggestedProfile]=useState(null);
 const [job,setJob]=useState(null);
 const [busy,setBusy]=useState(false);
 const [formError,setFormError]=useState('');
 const [query,setQuery]=useState('');
 const [searching,setSearching]=useState(false);
 const [results,setResults]=useState([]);
 const [searched,setSearched]=useState('');
 const [searchError,setSearchError]=useState('');
 const [searchNote,setSearchNote]=useState('');
 const [preview,setPreview]=useState(null);
 const [toast,setToast]=useState(null);
 const [tick,setTick]=useState(Date.now());
 const notifyTimer=useRef(null);
 const searchAbort=useRef(null);
 const inputRef=useRef(null);
 const panelRef=useRef(null);
 const showToast=(message,type='info')=>{setToast({message,type});clearTimeout(notifyTimer.current);notifyTimer.current=setTimeout(()=>setToast(null),3500)};
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
 useEffect(()=>{
  // Smooth mouse-only spotlight and micro-parallax. No React rerender per pointer event.
  const panel=panelRef.current;
  if(page!=='download'||!panel||!window.matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;
  let frame=0;
  const move=e=>{
   const rect=panel.getBoundingClientRect();
   const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
   const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    panel.style.setProperty('--glow-x',Math.round(x*100)+'%');
    panel.style.setProperty('--glow-y',Math.round(y*100)+'%');
    panel.style.setProperty('--tilt-x',((.5-y)*2.4).toFixed(2)+'deg');
    panel.style.setProperty('--tilt-y',((x-.5)*2.4).toFixed(2)+'deg');
   });
  };
  const reset=()=>{
   cancelAnimationFrame(frame);
   panel.style.setProperty('--tilt-x','0deg');panel.style.setProperty('--tilt-y','0deg');
   panel.style.setProperty('--glow-x','50%');panel.style.setProperty('--glow-y','10%');
  };
  panel.addEventListener('pointermove',move,{passive:true});
  panel.addEventListener('pointerleave',reset);
  return()=>{panel.removeEventListener('pointermove',move);panel.removeEventListener('pointerleave',reset);cancelAnimationFrame(frame)};
 },[page]);
 useEffect(()=>persist('vyrnivo-mode',mode),[mode]);
 useEffect(()=>persist('vyrnivo-quality',quality),[quality]);
 useEffect(()=>{try{localStorage.removeItem('dw3lastJob')}catch{}},[]);
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
 const nav=next=>{if(!pages.includes(next))return;if(next!==page){searchAbort.current?.abort();setSearching(false)}setPage(next);location.hash=next;window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 const openLegal=section=>{if(!legalSections.includes(section))return;setLegalSection(section);setPage('about');location.hash=section;requestAnimationFrame(()=>document.getElementById('legal-center')?.scrollIntoView({block:'start',behavior:'smooth'}))};
 const resetSearchView=()=>{searchAbort.current?.abort();setSearching(false);setResults([]);setSearched('');setSearchError('');setSearchNote('');setSearchUrl('');setIndexedSearchUrl('');setSuggestedProfile(null)};
 const switchSearchSource=next=>{
  if(next===searchSource)return;
  const kind=next==='instagram'?'reels':'all';
  setSearchSource(next);setSearchKind(kind);
  if(query.trim().length>=2&&searched)void runSearch(next,kind,query);
  else resetSearchView();
 };
 const switchSearchKind=next=>{
  if(next===searchKind)return;
  setSearchKind(next);
  if(query.trim().length>=2&&searched)void runSearch(searchSource,next,query);
  else resetSearchView();
 };
 const setDownloadMode=next=>{setJob(null);setMode(next);setContainer(next==='Audio only'?'MP3':'MP4');if(next==='Audio only')setQuality('Best available');else if(quality==='Best available')setQuality('720p')};
 async function pasteLink(){
  try{
   const clip=(await navigator.clipboard.readText()).trim();
   if(!/^https?:\/\//i.test(clip)){showToast('Copy a video link first.','warning');return}
   setUrl(clip);setSelectedResult(null);setJob(null);setFormError('');inputRef.current?.focus()
  }catch{showToast('Tap the link field and use Paste.','warning')}
 }
 const freeBackupCompatible=(mode==='Video + audio'&&container==='MP4')||(mode==='Audio only'&&['MP3','M4A','WAV'].includes(container));
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
   const r=await fetch('/api/downloads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link,mode,quality:mode==='Audio only'?'Best available':quality,container:mode==='Audio only'&&!['MP3','M4A','WAV','Original audio'].includes(container)?'MP3':mode!=='Audio only'&&!['MP4','WebM','MKV'].includes(container)?'MP4':container,...(mode==='Audio only'?{audioBitrate:['WAV','Original audio'].includes(container)?'Source':audioBitrate}:{}),...(selectedResult?.url===link?{suggestedTitle:selectedResult.title}:{}),...(humanStatus.enabled?{turnstileToken:verifiedToken}:{})})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Could not start download.');
   setJob(data);
   if(data.state==='ready')showToast('Your file is ready.','success')
  }catch(e){setFormError(friendlyError(e.message,isYouTube(link)?'YouTube':'Instagram'));refreshStatus()}
  finally{setBusy(false)}
 }
 async function copyLink(){
  try{await navigator.clipboard.writeText(location.origin+job.downloadUrl);showToast('Link copied!','success')}
  catch{showToast('Hold the Download button to copy its link.','warning')}
 }
 async function runSearch(source,kind,term){
  const q=term.trim();if(q.length<2){setSearchError('Enter at least two characters.');return}
  searchAbort.current?.abort();
  const controller=new AbortController();searchAbort.current=controller;
  setSearching(true);setSearchError('');setSearchNote('');setResults([]);setSearched(q);setSearchUrl('');setIndexedSearchUrl('');setSuggestedProfile(null);
  try{
   const r=await fetch('/api/search/'+source+'?q='+encodeURIComponent(q)+'&kind='+encodeURIComponent(kind),{signal:controller.signal});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Search unavailable.');
   if(controller.signal.aborted)return;
   setResults(Array.isArray(data.items)?data.items:[]);
   setSearchNote(data.notice||'');
   setSearchUrl(data.searchUrl||nativeDiscoverUrl(source,kind,q));
   setIndexedSearchUrl(data.indexedSearchUrl||'');
   setSuggestedProfile(data.suggestedProfile||null);
  }catch(e){
   if(e.name!=='AbortError'&&!controller.signal.aborted)setSearchError('Live results are unavailable right now. Search directly on the original platform.');
  }finally{if(searchAbort.current===controller)setSearching(false)}
 }
 function search(e){e?.preventDefault?.();return runSearch(searchSource,searchKind,query)}
 const chooseResult=item=>{
  if(!publicMediaKinds.has(item.kind))return;
  setUrl(item.url||'https://www.youtube.com/watch?v='+item.id);
  setSelectedResult({url:item.url,title:item.title});setJob(null);setFormError('');setPreview(null);nav('download');
  showToast('Link added. Choose a format and download.')
 };
 const isInstagram=searchSource==='instagram';
 const seconds=job?.expiresAt?Math.max(0,Math.ceil((job.expiresAt-tick)/1000)):0;
 const original=job?.error&&isYouTube(url)?url:null;
 const primaryBlocked=Number(status?.youtubeRetryAt)>tick;
 const backupBlocked=Number(status?.backupRetryAt)>tick;
 const remaining=until=>{const seconds=Math.max(0,Math.ceil((Number(until||0)-tick)/1000));return seconds>=60?Math.ceil(seconds/60)+' min':seconds+' sec'};
 const overallServiceLabel=status?.enabled===false?'Offline':primaryBlocked?'Some videos limited':'Ready to try';
 const formatDuration=seconds=>{
  const value=Math.max(0,Math.floor(seconds||0));
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
 };
 const elapsedProcessing=job?.createdAt?Math.max(0,Math.floor((tick-job.createdAt)/1000)):(job?.elapsedSeconds||0);
 const remainingEstimate=job?.state==='processing'
  &&['measured-transfer','reported-extractor','measured-conversion'].includes(job?.progressSource)
  &&Number.isFinite(job?.estimatedSecondsRemaining)
  &&Number.isFinite(job?.progressUpdatedAt)
  &&tick-job.progressUpdatedAt>=0&&tick-job.progressUpdatedAt<7000
  ?Math.max(0,Math.ceil(job.estimatedSecondsRemaining)):null;
 const measuredProgress=Number.isFinite(job?.progressPercent);
 const jobView=<>
     {job?.state==='processing'&&<div className="download-result pending" role="status" aria-live="polite">
       <div className="loading-spinner" aria-hidden="true"/>
       <div className="processing-copy"><strong>Preparing your file</strong><p>{job.stage||'Checking source…'}</p>
        <div className="processing-time"><span>Elapsed <b>{formatDuration(elapsedProcessing)}</b></span>
        <span>{Number.isFinite(remainingEstimate)?<>Estimated <b>{formatDuration(remainingEstimate)}</b> remaining</>:measuredProgress?<b>{Math.round(job.progressPercent)}% {job.progressSource==='measured-transfer'?'transferred':'downloaded'}</b>:'Measuring progress…'}</span></div>
       </div>
       <div className="transfer-stats" aria-label="Live download measurements">
        <span><small>SPEED</small><b>{Number.isFinite(job.speedBytesPerSecond)&&job.speedBytesPerSecond>0?(job.speedBytesPerSecond/1048576).toFixed(2)+' MB/s':'Measuring'}</b></span>
        <span><small>TRANSFERRED</small><b>{Number.isFinite(job.transferredBytes)?(job.transferredBytes/1048576).toFixed(1)+' MB':'—'}{Number.isFinite(job.totalBytes)&&job.totalBytes>0?' / '+(job.totalBytes/1048576).toFixed(1)+' MB':''}</b></span>
        <span><small>PROGRESS</small><b>{measuredProgress?Math.round(job.progressPercent)+'%':'Unknown'}</b></span>
       </div>
       <div className="loading-track" aria-label={measuredProgress?'Reported transfer progress '+Math.round(job.progressPercent)+' percent':'Processing, progress unknown'}><span className={measuredProgress?'measured':'indeterminate'} style={measuredProgress?{width:Math.min(100,Math.max(0,job.progressPercent))+'%'}:{}}/></div>
       <p className="processing-note">{Number.isFinite(remainingEstimate)?'Based on the latest transfer report. Final processing can add time.':'Time remaining appears when measurable progress is available. Elapsed time is accurate.'}</p>
      </div>}
      {job?.state==='ready'&&<div className="download-result ready" role="status"><div className="ready-heading"><Icon name="check" size={21}/><div><strong>{job.sourceMetadata?.alternateVersion?'Licensed excerpt ready':'Ready to save'}</strong><p>{(job.bytes/1048576).toFixed(1)} MB · Expires in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</p></div></div>{mode!=='Audio only'&&<p className="quality-delivered">{job.actualQuality?'Actual video resolution: '+job.actualQuality:'Actual video resolution could not be verified.'}</p>}{job.downloadName&&<div className="file-label" title={job.downloadName}><Icon name="download" size={14}/><span>{job.downloadName}</span></div>}<div className="ready-actions"><a href={job.downloadUrl} className="cta" download={job.downloadName||true}>Save file <Icon name="download" size={18}/></a><button type="button" onClick={copyLink} className="outline-btn"><Icon name="copy" size={17}/> Copy link</button></div>{job.sourceMetadata?.alternateVersion&&<div className="converter-license" role="note"><strong>{job.sourceMetadata.videoTitle} — not the full YouTube upload</strong><span>{job.sourceMetadata.attribution} · <a href={job.sourceMetadata.sourcePage} target="_blank" rel="noopener noreferrer">Source</a> · <a href={job.sourceMetadata.licenseUrl} target="_blank" rel="noopener noreferrer">{job.sourceMetadata.license}</a> · Converted by Vyrnivo</span></div>}</div>}
     {job?.state==='failed'&&<div className="message error" role="alert"><span>{friendlyError(job.error,isYouTube(url)?'YouTube':'Instagram')} {mode!=='Audio only'&&isYouTube(url)&&quality==='2160p · 4K'?'4K may not be available for this video.':''}</span>{mode!=='Audio only'&&<button type="button" onClick={()=>{setQuality('720p');setMore(true);setJob(null);setFormError('Quality changed to 720p. Try Download again.')}}>Try 720p</button>}{isYouTube(url)&&<a href={url} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={14}/></a>}</div>}
     {job?.state==='expired'&&<div className="message warning">Link expired. Submit the video again.</div>}

 </>;
 return <div className="app-shell">
  <div className="ambient" aria-hidden="true"><span/><span/></div>
  <header className="topbar">
   <a className="logo" href="#download" onClick={e=>{e.preventDefault();nav('download')}}><span className="logo-icon"><img src="/favicon.svg" width="39" height="39" alt=""/></span>vyrnivo<span className="logo-dot">.</span></a>
   <nav aria-label="Main navigation" className="tabs">
    {pages.map(p=><button key={p} type="button" className={'tab '+(page===p?'active':'')} aria-current={page===p?'page':undefined} onClick={()=>nav(p)}><Icon name={p} size={18}/><span>{p==='download'?'Download':p==='discover'?'Discover':'About'}</span></button>)}
   </nav>
  </header>
  <main className="content" id="main-content">
   <div className="hero" key={page}><AuroraVisual/>
    <p className="kicker">{page==='download'?'YOUR MEDIA, YOUR WAY':page==='discover'?'FIND YOUR NEXT FAVORITE':'BEYOND THE DOWNLOAD'}</p>
    <h1>{page==='download'?<>Save the <em>moment.</em></>:page==='discover'?<>Explore & <em>discover.</em></>:<>About <em>Vyrnivo.</em></>}</h1>
    <p>{page==='download'?'Paste a link. Pick a format. Download.':page==='discover'?'Discover videos, Shorts, channels, playlists, Reels and creators.':'FAQs, privacy, terms, and everything about Vyrnivo.'}</p>
    {page==='download'&&<div className="flow-steps" aria-hidden="true"><span>01 / Paste link</span><span>02 / Choose quality</span><span>03 / Save</span></div>}
   </div>
   {page==='download'&&
     <section className="panel surface-interactive" ref={panelRef} aria-label="Video downloader">
     <form onSubmit={startDownload}>
      <div className="url-row"><Icon name="download" size={20}/><input ref={inputRef} type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" autoComplete="url" spellCheck={false} value={url} onChange={e=>{setUrl(e.target.value);setSelectedResult(null);setFormError('');setJob(null)}} placeholder="Paste a YouTube or Instagram link" aria-label="Video URL"/>
       {url?<button type="button" className="icon-action" aria-label="Clear URL" onClick={()=>{setUrl('');setSelectedResult(null);setJob(null);setFormError('');inputRef.current?.focus()}}><Icon name="close" size={18}/></button>:<button type="button" className="paste-btn" onClick={pasteLink}><Icon name="paste" size={16}/> Paste</button>}
      </div>
      <div className="format-tabs" role="group" aria-label="Download format">
       {[['Video + audio','Video'],['Audio only','Audio'],['Video only','Video only']].map(([value,label])=><button type="button" key={value} className={'format-tab '+(mode===value?'active':'')} aria-pressed={mode===value} onClick={()=>setDownloadMode(value)}>{label}</button>)}
      </div>
      <div className="form-actions">
       <button className={'options-btn '+(more?'is-open':'')} type="button" aria-expanded={more} aria-controls="download-options" onClick={()=>setMore(v=>!v)}><Icon name="tune" size={18}/> {mode==='Audio only'?(['WAV','Original audio'].includes(container)?container:audioBitrate+' · '+container):quality} <span aria-hidden="true">{more?'−':'+'}</span></button>
       <button type="submit" className="cta" disabled={busy||status?.enabled===false}>{busy?'Starting…':'Download'}<Icon name="arrow" size={19}/></button>
      </div>
      {more&&<div className="advanced" id="download-options">
       {mode!=='Audio only'&&<label>Maximum resolution<select value={quality} onChange={e=>{setQuality(e.target.value);setJob(null)}}>{['720p','1080p','1440p','2160p · 4K','Best available'].map(x=><option key={x}>{x}</option>)}</select><small className="quality-help">Up to the selected resolution, depending on what the source provides. The actual output is checked when possible.</small></label>}
       <label>File type<select value={container} onChange={e=>{setContainer(e.target.value);setJob(null)}}>{(mode==='Audio only'?['MP3','M4A','WAV','Original audio']:['MP4','WebM','MKV']).map(x=><option key={x}>{x}</option>)}</select></label>{mode==='Audio only'&&<p className="audio-format-help">120 and 320 kbps set the output bitrate. Encoding cannot restore quality missing from the original audio.</p>}
       {mode==='Audio only'&&['MP3','M4A'].includes(container)&&<label>Audio quality<select aria-label="Audio quality" value={audioBitrate} onChange={e=>{setAudioBitrate(e.target.value);setJob(null)}}><option>320 kbps</option><option>120 kbps</option></select></label>}
      </div>}
     </form>
     {formError&&<div className="message error" role="alert"><span>{formError}</span>{original&&<a href={original} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={14}/></a>}</div>}
     {youtubeUnavailable&&!formError&&<div className="message warning" role="status">Some videos may be temporarily unavailable. Try another quality or video if needed.</div>}
     {status?.enabled===false&&<div className="message warning" role="alert">Downloader is offline. <button type="button" onClick={refreshStatus}>Retry</button></div>}
     <div className="live-dashboard" aria-label="Live downloader status">
      <div className="live-overview">
       <div className="live-service"><span className={'live-dot '+(status?.enabled===false?'off':primaryBlocked&&!status?.freeFallbackEnabled?'warning':'on')}/><span><strong>Downloader status</strong><small>{overallServiceLabel}</small></span></div>
       <div className="live-visitors" aria-label="Estimated active visitors"><Icon name="users" size={16}/><strong>{Number.isInteger(presence?.online)?presence.online:'—'}</strong><span>online</span></div>
       <button type="button" className="status-toggle" aria-expanded={statusExpanded} onClick={()=>setStatusExpanded(x=>!x)}>{statusExpanded?'Hide details':'Details'} <Icon name="activity" size={15}/></button>
      </div>
      {statusExpanded&&<div className="provider-details">
       <div className="provider-item"><div><strong>Download service</strong></div><span className={'provider-state '+(status?.enabled===false?'limited':'')}>{status?.enabled===false?'Offline':'Available to try'}</span></div>
       <div className="provider-item"><div><strong>Source access</strong></div><span className={'provider-state '+(primaryBlocked?'limited':'')}>{primaryBlocked?'Some videos limited':'Depends on the video'}</span></div>
       <p className="status-footnote">Availability and quality depend on the source. If a download fails, try another quality. Online count estimates browsers, not people.</p>
       <button type="button" className="refresh-status" onClick={refreshStatus}><Icon name="activity" size={15}/> Refresh status</button>
      </div>}
      <div className="discover-teaser"><span>Looking for something to download? Search videos and Reels in Discover.</span><button type="button" onClick={()=>nav('discover')}><Icon name="search" size={15}/> Open Discover <Icon name="arrow" size={15}/></button></div>
     </div>
     {jobView}
    </section>
    }

   {page==='about'&&<section className="about-intro"><h2>All the extras, neatly organized.</h2><p>Frequently asked questions, policies, and everything else about Vyrnivo.</p><div className="about-notes"><span>Free to use</span><span>10-minute file links</span><span>No account needed</span></div></section>}
   {page==='about'&&<section className="developer-section" id="developer" aria-labelledby="developer-title"><div className="developer-header"><span className="developer-eyebrow">THE PERSON BEHIND THE PROJECT</span><h2 id="developer-title">About the Developer</h2></div><p>Vyrnivo is an independent project created by Aarnav12, focused on making media tools easier to use, thoughtfully designed, and accessible across devices.</p><p className="developer-footnote">Developer story and more details coming soon.</p></section>}
   {page==='about'&&<section className="faq" id="faq" aria-labelledby="faq-title">
    <div className="faq-head"><p className="faq-eyebrow">Need a hand?</p><h2 id="faq-title">Frequently asked questions</h2></div>
    <div className="faq-items">{faqs.map(([question,answer])=><details key={question} className="faq-item"><summary><span>{question}</span><span className="faq-plus" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
   </section>}
   {page==='about'&&<LegalCenter selected={legalSection} onSelect={openLegal}/>} 
   {page==='discover'&&<section className="discover-hub" aria-label="Search videos and public Reels">
     <div className="discover-intro"><strong>Find videos, Shorts & creators</strong><p>Search YouTube listings and publicly indexed Instagram Reels or profiles. Only matching source links appear; open the original platform for complete live results.</p></div>
     <div className="search-mode-tabs" role="group" aria-label="Search platform"><button type="button" className={searchSource==='youtube'?'active':''} aria-pressed={searchSource==='youtube'} onClick={()=>switchSearchSource('youtube')}><Icon name="youtube" size={16}/> YouTube</button><button type="button" className={searchSource==='instagram'?'active':''} aria-pressed={searchSource==='instagram'} onClick={()=>switchSearchSource('instagram')}><Icon name="instagram" size={16}/> Instagram</button></div>
    <div className="discover-filters" role="group" aria-label="Result type">{discoverTypes[searchSource].map(([value,label])=><button key={value} type="button" aria-pressed={searchKind===value} className={searchKind===value?'active':''} onClick={()=>switchSearchKind(value)}>{label}</button>)}</div>
    <section className="discovery" aria-label={isInstagram?'Instagram search':'YouTube search'}>
     <form className="search-panel" onSubmit={search}>
      <div className="search-input"><Icon name="search"/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);resetSearchView()}} placeholder={isInstagram?(searchKind==='creators'?'Search creator names or @handles…':'Search Reels, topics, hashtags…'):(searchKind==='channels'?'Search YouTube channels…':searchKind==='shorts'?'Search Shorts…':'Search videos, channels and music…')} aria-label={isInstagram?'Search Instagram':'Search YouTube'}/></div>
      <button type="submit" className="cta" disabled={searching}>{searching?'Searching…':'Search'} <Icon name="arrow" size={18}/></button>
     </form>
     <div className="native-search-bar">
      <span><Icon name="shield-check" size={14}/> Results can differ from a personalized feed</span>
      <a href={nativeDiscoverUrl(searchSource,searchKind,query)} target="_blank" rel="noopener noreferrer">Search on {isInstagram?'Instagram':'YouTube'} <Icon name="external" size={14}/></a>
     </div>
     {searchError&&<div className="message error" role="alert">{searchError}</div>}
     {!!searchNote&&searched&&<p className="search-source-note" role="status">{searchNote}</p>}
     {searching&&<div className="search-loading" role="status"><span className="loading-spinner"/> Searching…</div>}
     {!searching&&searched&&<div className="result-heading"><span>{results.length?results.length+' source matches for “'+searched+'”':'Results for “'+searched+'”'}</span>{results.length>0&&<button type="button" onClick={()=>{setResults([]);setSearched('');setQuery('')}}>Clear</button>}</div>}
     {!searching&&searched&&!results.length&&!searchError&&<div className="empty-results"><Icon name="search" size={28}/><strong>No trustworthy matches returned</strong><p>Rather than show unrelated links, open this search on the original platform for its live results.</p>{suggestedProfile&&<a className="profile-suggestion" href={suggestedProfile.url} target="_blank" rel="noopener noreferrer">Open possible @{suggestedProfile.username} profile (not verified) <Icon name="external" size={15}/></a>}{searchUrl&&<a href={searchUrl} target="_blank" rel="noopener noreferrer">Open original search <Icon name="external" size={15}/></a>}</div>}
     {!!results.length&&<div className="results">
      {results.map(item=><article className="media-card" key={item.kind+'-'+item.id}>
       <div className="media-image">{publicMediaKinds.has(item.kind)?<button className="media-art-action" type="button" onClick={()=>setPreview(item)} aria-label={'Preview '+item.title}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" decoding="async"/>:<span className="reel-art"><Icon name={isInstagram?'instagram':'video'} size={36}/><small>{item.kind==='instagram'?'REEL':'VIDEO'}</small></span>}<span className="play-bubble"><Icon name="play" size={18}/></span></button>:<a className="media-art-action" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={'Open '+item.title}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" decoding="async"/>:<span className="reel-art"><Icon name={isInstagram?'instagram':'youtube'} size={34}/><small>{item.kind==='creator'?'CREATOR':item.kind==='channel'?'CHANNEL':'PLAYLIST'}</small></span>}</a>}</div>
       <div className="media-content"><span className="media-kind">{item.kind==='short'?'SHORT':String(item.kind||'video').toUpperCase()}</span><h2 title={item.title}>{item.title}</h2><p>{item.creator||'Public search result'}</p><div className="media-actions">{publicMediaKinds.has(item.kind)?<><button type="button" className="outline-btn" onClick={()=>setPreview(item)}>Preview</button><button type="button" className="mini-primary" onClick={()=>chooseResult(item)}>Use link <Icon name="arrow" size={16}/></button><a className="source-open-link" href={item.url} target="_blank" rel="noopener noreferrer">View source <Icon name="external" size={13}/></a></>:<a className="outline-btn" href={item.url} target="_blank" rel="noopener noreferrer">{item.kind==='playlist'?'Open playlist':item.kind==='creator'?'Open creator':'Open channel'} <Icon name="external" size={14}/></a>}</div></div>
      </article>)}
     </div>}
    </section>
    </section>}
  </main>
  <footer className="footer"><span className="footer-brand">vyrnivo</span><span className="footer-credit">Built by Aarnav12</span><nav className="footer-links" aria-label="Policies"><a href="#privacy" onClick={e=>{e.preventDefault();openLegal('privacy')}}>Privacy</a><a href="#terms" onClick={e=>{e.preventDefault();openLegal('terms')}}>Terms</a><a href="#copyright" onClick={e=>{e.preventDefault();openLegal('copyright')}}>Copyright</a><a href="#disclaimer" onClick={e=>{e.preventDefault();openLegal('disclaimer')}}>Notice</a></nav><span className="footer-note">Only save content you have permission to download.</span></footer>
  {humanCheckOpen&&humanStatus.enabled&&<HumanCheck siteKey={humanStatus.siteKey} onVerified={token=>startDownload(null,token)} onClose={()=>setHumanCheckOpen(false)}/>}
  {preview&&<Preview item={preview} onClose={()=>setPreview(null)}/>}
  {toast&&<div className={"toast toast-"+toast.type} role={toast.type==="warning"?"alert":"status"}><Icon name={toast.type==="success"?"check":toast.type==="warning"?"warning":"info"} size={18}/><span>{toast.message}</span></div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);

if(typeof window!=='undefined'&&'serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{})},{once:true})}
