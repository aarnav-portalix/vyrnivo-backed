/**
 * Keep access-control failures distinct from recoverable format failures.
 * Never retry or attempt alternate verification routes for a denied source.
 * Designed for user-facing diagnostic categories, not bypassing restrictions.
 */
export function classifyExtractorFailure(stderr, {source='youtube'}={}){
 const s=String(stderr||'').slice(-10000);
 const youtube=source==='youtube';
 if(/(?:HTTP Error|status(?: code)?)\s*:?\s*429\b|\b429 Too Many Requests\b|\brate[- ]limit(?:ed|ing)?\b|Too Many Requests/i.test(s)){
  return {code:'SOURCE_RATE_LIMITED',retryable:false,accessDenied:true,
   message:youtube?'YouTube is rate-limiting this server. Changing format or converter cannot solve source access.':'The source is rate-limiting the downloader. Please try again later.'};
 }
 if(/sign.?in to confirm|login.required|LOGIN_REQUIRED|not a bot|use --cookies|authentication required|account verification/i.test(s)){
  return {code:'SOURCE_VERIFICATION_REQUIRED',retryable:false,accessDenied:true,
   message:'The source requires verification before it will provide this video. Vyrnivo cannot obtain the original media through this server.'};
 }
 if(/\bHTTP Error 403\b|\b403 Forbidden\b|status code 403\b|access denied|request blocked/i.test(s)){
  return {code:'SOURCE_ACCESS_DENIED',retryable:false,accessDenied:true,
   message:'The source denied access to this media. Trying another output format will not resolve the access restriction.'};
 }
 if(/requested format is not available|format is not available|no video formats|no requested formats|unsupported (?:codec|format)/i.test(s)){
  return {code:'MEDIA_FORMAT_UNAVAILABLE',retryable:true,accessDenied:false,
   message:'The requested media format was unavailable. You can try a different quality or format.'};
 }
 if(/\btimed out\b|network is unreachable|temporary failure in name resolution|connection reset/i.test(s)){
  return {code:'SOURCE_NETWORK_ERROR',retryable:true,accessDenied:false,
   message:'The source connection failed. You can retry when the network is available.'};
 }
 return {code:'EXTRACTION_FAILED',retryable:false,accessDenied:false,
  message:'The original media could not be prepared. The downloader has not verified a playable file.'};
}
