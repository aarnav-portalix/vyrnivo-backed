// The public app can call its own API without exposing the server-to-server token.
// Cross-origin writes are rejected. GET download links use unguessable job IDs.
export function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    const host = String(req.headers.host || '');
    return Boolean(host) && origin.host === host &&
      (origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)));
  } catch { return false; }
}
export function hasBackendToken(req, env) {
  return Boolean(env.DOWNLOAD_API_TOKEN) &&
    req.headers.authorization === 'Bearer ' + env.DOWNLOAD_API_TOKEN;
}
export function allowApi(req, env) {
  if (hasBackendToken(req, env)) return true;
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  return sameOrigin(req);
}
export function allowFileUpload(req, env) {
  if (hasBackendToken(req, env)) return true;
  return sameOrigin(req) && (!env.APP_ORIGIN || req.headers.origin === env.APP_ORIGIN);
}
