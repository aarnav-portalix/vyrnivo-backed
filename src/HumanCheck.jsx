import React,{useEffect,useRef,useState} from 'react';

/**
 * Lightweight managed Cloudflare Turnstile dialog, only mounted after the
 * visitor taps Download. On most visits the managed check completes itself;
 * some visitors will be shown a checkbox.
 */
export default function HumanCheck({siteKey,onVerified,onClose}){
 const target=useRef(null);
 const verified=useRef(onVerified);
 const [message,setMessage]=useState('');
 verified.current=onVerified;

 useEffect(()=>{
  let cancelled=false,widgetId=null;
  const load=()=>new Promise((resolve,reject)=>{
   if(window.turnstile?.render){resolve();return}
   let script=document.querySelector('script[data-vyrnivo-turnstile]');
   if(!script){
    script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;script.defer=true;script.dataset.vyrnivoTurnstile='1';
    document.head.appendChild(script);
   }
   script.addEventListener('load',resolve,{once:true});
   script.addEventListener('error',()=>reject(Error('Verification could not load.')),{once:true});
  });
  load().then(()=>{
   if(cancelled||!target.current)return;
   if(!window.turnstile?.render)throw Error('Verification could not start.');
   widgetId=window.turnstile.render(target.current,{
    sitekey:siteKey,
    theme:'dark',
    size:'flexible',
    action:'download',
    appearance:'always',
    callback:token=>{if(!cancelled)verified.current(token)},
    'error-callback':()=>{if(!cancelled)setMessage('Verification could not finish. Please retry.')},
    'expired-callback':()=>{if(!cancelled)setMessage('Verification expired. Please retry.')}
   });
  }).catch(()=>{if(!cancelled)setMessage('Verification could not load. Please retry.')});
  return()=>{
   cancelled=true;
   if(widgetId!==null&&widgetId!==undefined)try{window.turnstile?.remove(widgetId)}catch{}
  };
 },[siteKey]);

 return <div className="overlay human-check-overlay" role="presentation">
  <section className="human-check-dialog" role="dialog" aria-modal="true" aria-label="Verify you are human">
   <span className="human-check-mark" aria-hidden="true">✦</span>
   <h2>One quick security check</h2>
   <p>Verify you're human to prepare your download. This helps keep Vyrnivo available to everyone.</p>
   <div ref={target} className="human-check-widget" aria-label="Cloudflare Turnstile verification"/>
   {message&&<p className="human-check-error" role="alert">{message}</p>}
   <button className="human-check-cancel" type="button" onClick={onClose}>Cancel</button>
  </section>
 </div>;
}
