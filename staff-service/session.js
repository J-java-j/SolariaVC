import destinations from './destinations.json' with { type: 'json' };

export function destination(id, local) {
  if (/^envelope-[A-Z0-9]{12}$/.test(id)) return { href: '/sign/e/' + id.slice(9) };
  if (!Object.hasOwn(destinations, id)) return null;
  const item = destinations[id];
  return item.local && !local ? null : item;
}

const lifetime = 8 * 60 * 60;
export function browserSession(provider) {
  const name = provider.base ? 'solaria_team_local' : '__Host-solaria_team';
  const attributes = '; Path=/; HttpOnly; SameSite=Lax' + (provider.base ? '' : '; Secure');
  return {
    header(value) { return name + '=' + value + attributes + '; Max-Age=' + lifetime; },
    read(req) {
      return (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='))?.slice(name.length + 1);
    },
    async issue(token) {
      const value = await provider.auth.createSessionCookie(token, { expiresIn: lifetime * 1000 });
      return name + '=' + value + attributes + '; Max-Age=' + lifetime;
    },
    clear: name + '=' + attributes + '; Max-Age=0',
    sameOrigin(req) {
      if (req.headers['x-team-request'] !== '1') return false;
      const origin = req.headers.origin;
      if (origin === provider.portalOrigin) return true;
      return Boolean(provider.base && /^127\.0\.0\.1:\d+$/.test(req.headers.host) && origin === 'http://' + req.headers.host);
    },
  };
}
