function setupLink(origin, code) {
  const url = new URL('/staff', origin);
  url.hash = new URLSearchParams({ invite: code }).toString();
  return url.href;
}

export async function invite(provider, email, resetting = false) {
  const action = await provider.auth.generatePasswordResetLink(email);
  if (!provider.mail) return; // Firebase already recorded the message in its emulator outbox.
  const code = new URL(action).searchParams.get('oobCode');
  if (!code) throw new Error('Firebase returned an invalid action link.');
  if (!/^[a-zA-Z0-9_-]{16,2048}$/.test(code)) throw new Error('Invalid password setup code format.');
  if (process.env.TEAM_AUTH_MODE === 'production') {
    const tenantId = process.env.TEAM_FIREBASE_TENANT;
    const apiKey = process.env.TEAM_BROWSER_API_KEY;
    if (!apiKey || new URL(action).searchParams.get('tenantId') !== tenantId) throw new Error('Incorrect invitation configuration.');
    // Firebase's check-only request cannot change the account or consume the link.
    const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=' + encodeURIComponent(apiKey), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Referer: provider.portalOrigin + '/' },
      body: JSON.stringify({ oobCode: code, tenantId }),
    });
    const check = await response.json();
    if (!response.ok || check.requestType !== 'PASSWORD_RESET' || check.email?.toLowerCase() !== email.toLowerCase()) {
      console.error('Invitation pre-delivery validation failed', response.status);
      throw new Error('Could not validate the new invitation.');
    }
  }
  const link = setupLink(provider.portalOrigin, code);
  const recovery = new URL('/staff?recover=1', provider.portalOrigin).href;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + provider.mail.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: provider.mail.sender, to: [email], subject: resetting ? 'Reset your Solaria Team Portal password' : 'Your Solaria Team Portal invitation',
      text: 'Set your password for the Solaria Team Portal using this one-time link:\n' + link + '\n\nIf your email app changes the link, open ' + recovery + ' and enter this private setup code: ' + code,
      html: '<p>' + (resetting ? 'You requested a Team Portal password reset.' : 'You have been invited to the Solaria Team Portal.') + '</p><p><a href="' + link + '">Set your password</a></p>' +
        '<p>If the button says your link expired, <a href="' + recovery + '">open Team Login recovery</a> and enter this private setup code from this email:</p><p><code>' + code + '</code></p>' }),
  });
  if (!response.ok) throw new Error('Invitation delivery failed.');
}

// Local operator view of the emulator's existing outbox. No second store.
export async function outbox(provider, role) {
  const response = await fetch(provider.base + '/emulator/v1/projects/' + provider.projectId + '/oobCodes');
  if (!response.ok) throw new Error('Local outbox unavailable.');
  const { oobCodes } = await response.json();
  const messages = [];
  for (const item of oobCodes.filter(item => item.requestType === 'PASSWORD_RESET').reverse()) {
    const user = await provider.auth.getUserByEmail(item.email).catch(err => {
      if (err.code !== 'auth/user-not-found') throw err;
    });
    if (user && !user.disabled && (user.customClaims?.role === 'staff' ||
        (role === 'owner' && user.customClaims?.role === 'board-admin'))) messages.push(item);
  }
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local invitation outbox</title><main><h1>Local invitation outbox</h1>' +
    messages.map(item => '<p>' + item.email.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';') +
      ' · <a href="' + setupLink(provider.portalOrigin, item.oobCode) + '">Set your password</a></p>').join('') +
    (messages.length ? '' : '<p>No pending invitations.</p>') + '</main>';
}
