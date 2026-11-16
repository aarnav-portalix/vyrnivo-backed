import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const icons={
 download:<><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></>,
 youtube:<><rect x="3" y="5" width="18" height="14" rx="5"/><path d="m10 9 5 3-5 3Z"/></>,
 instagram:<><rect x="3" y="3" width="18" height="18" rx="6"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 check:<path d="m5 12 4 4L19 6"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 paste:<><rect x="8" y="5" width="12" height="16" rx="2"/><path d="M11 3h6v4h-6zm-6 6H4v12h11"/></>,
 copy:<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
 play:<path d="m9 6 10 6-10 6z"/>,
 tune:<><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
 music:<><path d="M9 17V5l11-2v12M9 9l11-2"/><circle cx="6" cy="17" r="3"/><circle cx="17" cy="15" r="3"/></>,
 video:<><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/></>,
 external:<><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></>
};
function Icon({name,size=19,...props}){return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{icons[name]}</svg>;}
function saved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
const pages=['download','youtube','instagram'];
const faqs=[
 ['How do I download a video?','Paste a public video link, choose the format you want, and press Download. A file link appears if the source allows the download.'],
 ['Does YouTube downloading always work?','No. YouTube may block downloads from this server, even for public videos. If you own the video, you can download it from YouTube Studio.'],
 ['Does Instagram downloading work?','Public Reels can work. Some Reels are private, unavailable, or blocked by Instagram.'],
 ['How long does my download link last?','Prepared files are kept temporarily for up to 10 minutes and may expire sooner if the server restarts.'],
 ['Can I use Vyrnivo on my phone?','Yes. After preparing a supported download, use the Download file button. On iPhone, downloads may appear in the Files app.'],
 ['What is Vyrnivo Converter?','Our online FFmpeg engine converts approved media files to MP4/MP3. Two YouTube-linked examples are supported through independently hosted Creative Commons copies; most YouTube links are not supported.']
];
const isYouTube=url=>/(?:youtube\.com|youtu\.be)/i.test(url||'');
function friendlyError(message,source){
 const m=String(message||'');
 if(/429|rate.limit|blocking this render server|too many requests/i.test(m))return 'YouTube downloads are unavailable right now. Try again later.';
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
 const [page,setPage]=useState(pages.includes(initialPage)?initialPage:'download');
 const [url,setUrl]=useState('');
 const [mode,setMode]=useState(()=>saved('vyrnivo-mode','Video + audio'));
 const [quality,setQuality]=useState(()=>saved('vyrnivo-quality','720p'));
 const [container,setContainer]=useState('MP4');
 const [more,setMore]=useState(false);
 const [status,setStatus]=useState(null);
 const [job,setJob]=useState(()=>saved('dw3lastJob',null));
 const [busy,setBusy]=useState(false);
 const [formError,setFormError]=useState('');
 const [convertUrl,setConvertUrl]=useState('');
 const [convertFormat,setConvertFormat]=useState('MP4');
 const [convertBusy,setConvertBusy]=useState(false);
 const [convertError,setConvertError]=useState('');
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
 useEffect(()=>{refreshStatus();const onHash=()=>{const next=location.hash.slice(1);setPage(pages.includes(next)?next:'download')};window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
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
 const setDownloadMode=next=>{setMode(next);setContainer(next==='Audio only'?'MP3':'MP4');if(next==='Audio only')setQuality('Best available');else if(quality==='Best available')setQuality('720p')};
 async function pasteLink(){
  try{
   const clip=(await navigator.clipboard.readText()).trim();
   if(!/^https?:\/\//i.test(clip)){showToast('Copy a video link first.');return}
   setUrl(clip);setFormError('');inputRef.current?.focus()
  }catch{showToast('Tap the link field and use Paste.')}
 }
 const youtubeUnavailable=isYouTube(url)&&Number(status?.youtubeRetryAt)>tick;
 async function startDownload(e){
  e?.preventDefault?.();
  const link=url.trim();
  if(!/^https:\/\//i.test(link)){setFormError('Paste a YouTube or Instagram video link.');inputRef.current?.focus();return}
  if(status?.enabled===false){setFormError('Downloader is offline. Try again shortly.');return}
  if(youtubeUnavailable){setFormError('YouTube downloads are temporarily unavailable. Try again later.');return}
  if(busy)return;
  setBusy(true);setFormError('');setJob(null);
  try{
   const r=await fetch('/api/downloads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link,mode,quality:mode==='Audio only'?'Best available':quality,container})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Could not start download.');
   setJob(data);
   if(data.state==='ready')showToast('Your file is ready.')
  }catch(e){setFormError(friendlyError(e.message,isYouTube(link)?'YouTube':'Instagram'));refreshStatus()}
  finally{setBusy(false)}
 }
 async function startConversion(e){
  e?.preventDefault?.();
  if(convertBusy)return;
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
   const r=await fetch('/api/search/'+page+'?q='+encodeURIComponent(q),{signal:controller.signal});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Search unavailable.');
   setResults(data.items||[]);setSearchNote(data.notice||'');
  }catch(e){if(e.name!=='AbortError')setSearchError('Search unavailable. Try again.')}
  finally{if(searchAbort.current===controller)setSearching(false)}
 }
 const chooseResult=item=>{
  setUrl(item.url||'https://www.youtube.com/watch?v='+item.id);
  setFormError('');setPreview(null);nav('download');
  showToast('Link added. Choose a format and download.')
 };
 const isSearch=page!=='download';
 const isInstagram=page==='instagram';
 const seconds=job?.expiresAt?Math.max(0,Math.ceil((job.expiresAt-tick)/1000)):0;
 const original=job?.error&&isYouTube(url)?url:null;
 return <div className="app-shell">
  <div className="ambient" aria-hidden="true"><span/><span/></div>
  <header className="topbar">
   <a className="logo" href="#download" onClick={e=>{e.preventDefault();nav('download')}}><span className="logo-icon"><img src="/favicon.svg" width="39" height="39" alt=""/></span>vyrnivo<span className="logo-dot">.</span></a>
   <nav aria-label="Main navigation" className="tabs">
    {pages.map(p=><button key={p} type="button" className={'tab '+(page===p?'active':'')} aria-current={page===p?'page':undefined} onClick={()=>nav(p)}><Icon name={p} size={18}/><span>{p==='download'?'Download':p==='youtube'?'YouTube':'Instagram'}</span></button>)}
   </nav>
  </header>
  <main className="content" id="main-content">
   <div className="hero">
    <p className="kicker">{page==='download'?'YOUR MEDIA, YOUR WAY':'EXPLORE & DISCOVER'}</p>
    <h1>{page==='download'?<>Save the <em>moment.</em></>:<>Find your <em>next favorite.</em></>}</h1>
    <p>{page==='download'?'Paste a link. Pick a format. Download.':isInstagram?'Search public Instagram Reels.':'Search YouTube videos and creators.'}</p>
   </div>
   {page==='download'?
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
       <button type="submit" className="cta" disabled={busy||status?.enabled===false||youtubeUnavailable}>{busy?'Starting…':youtubeUnavailable?'Temporarily unavailable':'Download'}<Icon name="arrow" size={19}/></button>
      </div>
      {more&&<div className="advanced" id="download-options">
       {mode!=='Audio only'&&<label>Quality<select value={quality} onChange={e=>setQuality(e.target.value)}>{['720p','1080p','1440p','2160p · 4K','Best available'].map(x=><option key={x}>{x}</option>)}</select></label>}
       <label>File type<select value={container} onChange={e=>setContainer(e.target.value)}>{(mode==='Audio only'?['MP3','M4A','WAV','Original audio']:['MP4','WebM','MKV']).map(x=><option key={x}>{x}</option>)}</select></label>
      </div>}
     </form>
     {formError&&<div className="message error" role="alert"><span>{formError}</span>{original&&<a href={original} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={14}/></a>}</div>}
     {youtubeUnavailable&&!formError&&<div className="message warning" role="status">YouTube downloads aren't available right now. Try again later.</div>}
     {status?.enabled===false&&<div className="message warning" role="alert">Downloader is offline. <button type="button" onClick={refreshStatus}>Retry</button></div>}
     {job?.state==='processing'&&<div className="download-result pending" role="status" aria-live="polite"><div className="loading-spinner" aria-hidden="true"/><div><strong>{job.engine==='converter'?'Converting your file':'Preparing your file'}</strong><p>This can take a little time.</p></div><div className="loading-track" aria-hidden="true"><span/></div></div>}
     {job?.state==='ready'&&<div className="download-result ready" role="status"><div className="ready-heading"><Icon name="check" size={21}/><div><strong>{job.sourceMetadata?.alternateVersion?'Licensed excerpt ready':'Ready to save'}</strong><p>{(job.bytes/1048576).toFixed(1)} MB · Expires in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</p></div></div><div className="ready-actions"><a href={job.downloadUrl} className="cta" download>Download file <Icon name="download" size={18}/></a><button type="button" onClick={copyLink} className="outline-btn"><Icon name="copy" size={17}/> Copy link</button></div>{job.sourceMetadata?.alternateVersion&&<div className="converter-license" role="note"><strong>{job.sourceMetadata.videoTitle} — not the full YouTube upload</strong><span>{job.sourceMetadata.attribution} · <a href={job.sourceMetadata.sourcePage} target="_blank" rel="noopener noreferrer">Source</a> · <a href={job.sourceMetadata.licenseUrl} target="_blank" rel="noopener noreferrer">{job.sourceMetadata.license}</a> · Converted by Vyrnivo</span></div>}</div>}
     {job?.state==='failed'&&<div className="message error" role="alert">{friendlyError(job.error,isYouTube(url)?'YouTube':'Instagram')}{isYouTube(url)&&<a href={url} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon name="external" size={14}/></a>}</div>}
     {job?.state==='expired'&&<div className="message warning">Link expired. Submit the video again.</div>}
     <details className="converter-tool" id="vyrnivo-converter">
      <summary><span><Icon name="tune" size={18}/> Vyrnivo Converter <small>Our own engine · Beta</small></span><span className="converter-plus" aria-hidden="true">+</span></summary>
      <div className="converter-body">
       <p>Convert approved video and audio files to MP4 or MP3. Our licensed-source trial recognizes two YouTube film links through separately hosted Creative Commons files, one full short video and one excerpt. This is not a general YouTube downloader.</p>
       <form onSubmit={startConversion}>
        <label className="converter-label" htmlFor="converter-url">Approved direct media URL or licensed YouTube trial link</label>
        <input id="converter-url" type="url" required value={convertUrl} onChange={e=>{setConvertUrl(e.target.value);setConvertError('')}} placeholder="https://…/video.webm" autoComplete="url" spellCheck={false}/>
        <div className="converter-options">
         <label htmlFor="converter-output">Output <select id="converter-output" value={convertFormat} onChange={e=>setConvertFormat(e.target.value)}><option>MP4</option><option>MP3</option></select></label>
         <button type="submit" className="cta" disabled={convertBusy||status?.enabled===false}>{convertBusy?'Starting…':'Convert file'}<Icon name="arrow" size={16}/></button>
        </div>
       </form>
       <div className="converter-examples"><button className="converter-sample" type="button" onClick={()=>{setConvertUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');setConvertFormat('MP4');setConvertError('')}}>Try a licensed YouTube-link example (33-second excerpt)</button><button className="converter-sample" type="button" onClick={()=>{setConvertUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw');setConvertFormat('MP4');setConvertError('')}}>Try a full CC-licensed YouTube-linked video (19 seconds)</button><button className="converter-sample" type="button" onClick={()=>{setConvertUrl('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');setConvertFormat('MP4');setConvertError('')}}>Try a free CC0 sample video</button></div>
       {convertUrl.includes('jNQXAC9IVRw')&&<div className="converter-license" role="note"><strong>Separately hosted full 19-second Creative Commons copy</strong><span>Me at the zoo · Jawed Karim and Yakov Lapitsky · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a> · <a href="https://commons.wikimedia.org/wiki/File:Me_at_the_zoo.webm" target="_blank" rel="noopener noreferrer">Source</a> · Not retrieved from YouTube</span></div>}
       {convertUrl.includes('aqz-KE-bpKQ')&&<div className="converter-license" role="note"><strong>Licensed alternate clip — not the full YouTube video</strong><span>Converts a 33-second extract of Big Buck Bunny hosted on Wikimedia Commons. Credit: © Blender Foundation / www.bigbuckbunny.org · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a> · <a href="https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_extract.ogv" target="_blank" rel="noopener noreferrer">Source</a></span></div>}
       {convertError&&<div className="message error" role="alert">{convertError}</div>}
       <p className="converter-hint">30 MB source limit · 2-minute output maximum · file expires 10 minutes after conversion · only convert media you have permission to use.</p>
      </div>
     </details>
    </section>
    : <section className="discovery" aria-label={isInstagram?'Instagram search':'YouTube search'}>
     <form className="search-panel" onSubmit={search}>
      <div className="search-input"><Icon name="search"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={isInstagram?'Search Reels, topics, hashtags, creators…':'Search videos, creators, music…'} aria-label={isInstagram?'Search Instagram':'Search YouTube'}/></div>
      <button type="submit" className="cta" disabled={searching}>{searching?'Searching…':'Search'} <Icon name="arrow" size={18}/></button>
     </form>
     {searchError&&<div className="message error" role="alert">{searchError}</div>}
     {searching&&<div className="search-loading" role="status"><span className="loading-spinner"/> Searching…</div>}
     {!searching&&searched&&<div className="result-heading"><span>{results.length?results.length+' results for “'+searched+'”':'Results for “'+searched+'”'}</span>{results.length>0&&<button type="button" onClick={()=>{setResults([]);setSearched('');setQuery('')}}>Clear</button>}</div>}
     {!searching&&searched&&!results.length&&!searchError&&<div className="empty-results"><Icon name="search" size={28}/><strong>No results found</strong><p>Try a different search or paste a direct video link.</p>{isInstagram&&<a href={'https://www.google.com/search?q='+encodeURIComponent('site:instagram.com/reel/ '+searched)} target="_blank" rel="noopener noreferrer">Search the web <Icon name="external" size={15}/></a>}</div>}
     {!!results.length&&<div className="results">
      {results.map(item=><article className="media-card" key={item.kind+'-'+item.id}>
       <button className="media-image" type="button" onClick={()=>setPreview(item)} aria-label={'Preview '+item.title}>{item.kind==='instagram'?<span className="reel-art"><Icon name="instagram" size={38}/><small>REEL</small></span>:<img src={item.thumbnail} alt="" loading="lazy" decoding="async"/>}<span className="play-bubble"><Icon name="play" size={18}/></span></button>
       <div className="media-content"><h2 title={item.title}>{item.title}</h2><p>{item.creator||'Public video'}</p><div className="media-actions"><button type="button" className="outline-btn" onClick={()=>setPreview(item)}>Preview</button><button type="button" className="mini-primary" onClick={()=>chooseResult(item)}>Use link <Icon name="arrow" size={16}/></button></div></div>
      </article>)}
     </div>}
    </section>}
   {page==='download'&&<section className="faq" id="faq" aria-labelledby="faq-title">
    <div className="faq-head"><p className="faq-eyebrow">Need a hand?</p><h2 id="faq-title">Frequently asked questions</h2></div>
    <div className="faq-items">{faqs.map(([question,answer])=><details key={question} className="faq-item"><summary><span>{question}</span><span className="faq-plus" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
   </section>}
  </main>
  <footer className="footer"><span>vyrnivo</span><span>Only save content you have permission to download.</span></footer>
  {preview&&<Preview item={preview} onClose={()=>setPreview(null)}/>}
  {toast&&<div className="toast" role="status"><Icon name="check" size={18}/>{toast}</div>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
