/**
 * Curated, verified, separately hosted CC-licensed video excerpts.
 * Mapping a YouTube video ID does not grant rights to download its YouTube upload.
 * Each source must be reviewed for provenance, scope and license before addition.
 * This initial pilot intentionally supports one short excerpt, not general downloads.
 */
const EXAMPLES=new Map([
 ['jNQXAC9IVRw',Object.freeze({
   mediaUrl:'https://upload.wikimedia.org/wikipedia/commons/e/e0/Me_at_the_zoo.webm',
   videoTitle:'Me at the zoo — full 19-second video',
   description:'A separately hosted full 19-second Creative Commons copy of Me at the zoo, not a file retrieved from YouTube.',
   originalYoutubeId:'jNQXAC9IVRw',
   sourcePage:'https://commons.wikimedia.org/wiki/File:Me_at_the_zoo.webm',
   license:'Creative Commons Attribution 3.0',
   licenseUrl:'https://creativecommons.org/licenses/by/3.0/',
   attribution:'Jawed Karim and Yakov Lapitsky',
   transformed:'Converted by Vyrnivo from a separately hosted Wikimedia Commons file.',
   durationSeconds:19,
   alternateVersion:true
 })],
 ['aqz-KE-bpKQ',Object.freeze({
   mediaUrl:'https://upload.wikimedia.org/wikipedia/commons/3/3b/Big_Buck_Bunny_extract.ogv',
   videoTitle:'Big Buck Bunny — 33-second excerpt',
   description:'A separately hosted 33-second excerpt from the 2008 film, not a download of the full YouTube upload.',
   originalYoutubeId:'aqz-KE-bpKQ',
   sourcePage:'https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_extract.ogv',
   license:'Creative Commons Attribution 3.0',
   licenseUrl:'https://creativecommons.org/licenses/by/3.0/',
   attribution:'© Blender Foundation / www.bigbuckbunny.org',
   transformed:'Converted by Vyrnivo from a separately hosted Wikimedia Commons excerpt.',
   durationSeconds:33,
   alternateVersion:true
 })]
]);
const YOUTUBE_HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be']);
export function isYoutubeLink(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&YOUTUBE_HOSTS.has(u.hostname.toLowerCase())}catch{return false}
}
export function licensedSourceForYoutube(raw){
 if(!isYoutubeLink(raw))return null;
 const u=new URL(raw);
 if(u.username||u.password||u.port)throw Error('Use a normal HTTPS YouTube video link.');
 let id='';
 if(u.hostname.toLowerCase().endsWith('youtu.be'))id=u.pathname.replace(/^\/|\/$/g,'');
 else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
 else {const m=u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/);id=m?.[1]||''}
 if(!/^[\w-]{11}$/.test(id))throw Error('Paste a single YouTube video link.');
 const source=EXAMPLES.get(id);
 if(!source)throw Error('No approved, separately hosted copy is available for this YouTube video. General YouTube downloads remain unavailable.');
 return source;
}
