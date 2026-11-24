// In the local connected stack both the Vite entry and the Node origin enforce
// this before serving private Sign pages or forwarding private Sign API calls.
export async function guardTeamDestination(req, res, portal = '', service = 'http://127.0.0.1:8787') {
  const path = new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean).join('/');
  const api = /^api\/sign\/(team|envelopes|folders|me)(?:\/|$)/.exec(path);
  const envelope = /^sign\/e\/([A-Z0-9]{12})$/.exec(path);
  let id;
  if (path === 'sign/team' || api?.[1] === 'team') id = 'sign-team';
  else if (path === 'sign/queue') id = 'sign-queue';
  else if (envelope) id = 'envelope-' + envelope[1];
  else if (api) id = 'documents';
  else return false;
  let status;
  try {
    const cookie = (req.headers.cookie || '').split(';').map(pair => pair.trim())
      .filter(pair => /^(?:solaria_team_local|__Host-solaria_team)=/.test(pair)).join('; ');
    const check = await fetch(service + '/guard/' + id, {
      headers: { cookie }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    status = check.status;
  } catch { status = 503; }
  if (status === 204) return false;
  res.setHeader('Cache-Control', 'no-store');
  if (api?.[1] === 'me' && (status === 401 || status === 403)) {
    // /sign is also the public recipient entry. Only offer the sender workspace
    // if both the portal and Sign have authenticated this browser.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"user":null}'); return true;
  }
  if (!api && status === 401) {
    res.writeHead(303, { Location: portal + '/staff?launch=' + id });
    res.end(); return true;
  }
  const message = status === 403 ? 'Access denied' : status === 401 ? 'Please sign in.' : 'Team portal unavailable.';
  res.writeHead([401, 403].includes(status) ? status : 503, { 'Content-Type': api ? 'application/json' : 'text/html; charset=utf-8' });
  res.end(api ? JSON.stringify({ error: message }) : '<!doctype html><title>' + message + '</title><h1>' + message + '</h1>');
  return true;
}
