// Only these profiles can receive digital-card exchanges. Keep recipient
// addresses here rather than accepting an address from the browser.
export const CARD_PROFILES = {
  'johnson-jiang': {
    id: 'johnson-jiang',
    first: 'Johnson',
    last: 'Jiang',
    org: 'Solaria Capital',
    title: 'Founder',
    tel: '+17789981228',
    email: 'JohnsonJiang@solariavc.com',
    site: 'https://solariavc.com',
    page: 'https://solariavc.com/card',
    linkedin: 'https://www.linkedin.com/in/johnson-jiang-049b921b3',
  },
  'karl-li': {
    id: 'karl-li',
    first: 'Karl',
    last: 'Li',
    org: 'Solaria Capital',
    title: 'Vice President / Co-Founder',
    tel: '+13238681396',
    email: 'kal126@ucsd.edu',
    site: 'https://solariavc.com',
    page: 'https://solariavc.com/card/karl',
    linkedin: 'https://www.linkedin.com/in/karl-li-b0368b3b6',
  },
};

// Older Johnson cards did not submit a cardId, so missing IDs stay compatible.
export function getCardProfile(cardId = 'johnson-jiang') {
  return typeof cardId === 'string' && Object.hasOwn(CARD_PROFILES, cardId)
    ? CARD_PROFILES[cardId]
    : null;
}
