/**
 * Search ranking for publicly indexed links.
 * A valid Instagram URL does not prove that it matches the search query.
 * Reject unrelated and generic listings instead of filling a grid with noise.
 */
const ignores=new Set(['a','an','the','and','or','of','to','in','on','for','by','is','are','with',
 'video','videos','reel','reels','short','shorts','instagram','official','watch','post','posts',
 'page','link','explore','2026','new','latest','www','com']);
const clean=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
export function queryTerms(query){
 const tokens=clean(query).split(' ').filter(Boolean);
 return [...new Set(tokens.filter(t=>t.length>1&&!ignores.has(t)))].slice(0,10);
}
export function matchEvidence(item,query){
 const terms=queryTerms(query);
 const primary=clean([item.title,item.creator,item.username].filter(Boolean).join(' '));
 const supplementary=clean(item.description||item.snippet||'');
 if(!terms.length)return {score:0,matches:0,accepted:false};
 const mainMatched=terms.filter(t=>primary.split(' ').some(w=>w===t||w.startsWith(t)&&t.length>=4));
 const additional=terms.filter(t=>!mainMatched.includes(t)&&supplementary.split(' ').includes(t));
 const count=mainMatched.length+additional.length;
 const fraction=count/terms.length;
 const exact=clean(query);
 const phrase=primary.includes(exact)&&exact.length>=3;
 const accepted=(phrase||count>=Math.ceil(terms.length*.65))&&count>0;
 return {score:mainMatched.length*3+additional.length+(phrase?5:0),matches:count,
  fraction,accepted};
}
export function relevantIndexedItems(items,query,{max=18}={}){
 return (items||[]).map((item,index)=>({item,index,match:matchEvidence(item,query)}))
  .filter(x=>x.match.accepted)
  .sort((a,b)=>b.match.score-a.match.score||a.index-b.index)
  .slice(0,max)
  .map(x=>({...x.item,relevance:x.match.fraction}));
}
export function nativeInstagramSearchUrl(query){
 const q=String(query||'').trim();
 const hashtag=q.match(/^#([\p{L}\p{N}_]{2,80})$/u);
 if(hashtag)return 'https://www.instagram.com/explore/tags/'+encodeURIComponent(hashtag[1])+'/';
 return 'https://www.instagram.com/explore/search/keyword/?q='+encodeURIComponent(q);
}
