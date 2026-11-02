// RFC 3161 timestamps from an independent authority, embedded as a PDF Document
// Timestamp (ISO 32000-2 12.8.5). This is what lets a sealed file prove its own
// contents and time without trusting Solaria: Solaria is often a party to what it
// seals, and a timestamp signed by a public CA holds no matter who runs the server.
// It needs no Solaria key or certificate, so there is nothing to rotate or leak,
// and only a SHA-256 digest ever leaves this server.
import { createHash, randomBytes } from 'node:crypto';
import { PDFArray, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib';

// Sized from real tokens, which run about 6 to 9 KB with the certificate chain.
const CONTENTS_BYTES = 16384;

const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_TST_INFO = '1.2.840.113549.1.9.16.1.4';

const sha256 = (...parts) => {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest();
};

function derLength(n) {
  if (n < 0x80) return Buffer.from([n]);
  const out = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return Buffer.from([0x80 | out.length, ...out]);
}

const der = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
};

// Tolerates BER indefinite lengths, which some CMS encoders emit.
function readTlv(buf, pos = 0, limit = buf.length) {
  if (pos + 2 > limit) throw new Error('ASN.1: truncated header');
  const tag = buf[pos];
  if ((tag & 0x1f) === 0x1f) throw new Error('ASN.1: high tag numbers unsupported');
  let p = pos + 1;
  let len = buf[p++];
  if (len === 0x80) {
    let q = p;
    while (!(buf[q] === 0 && buf[q + 1] === 0)) q = readTlv(buf, q, limit).end;
    return { tag, start: pos, valueStart: p, valueEnd: q, end: q + 2, buf };
  }
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n > 4 || p + n > limit) throw new Error('ASN.1: bad length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[p++];
  }
  if (p + len > limit) throw new Error('ASN.1: value overruns buffer');
  return { tag, start: pos, valueStart: p, valueEnd: p + len, end: p + len, buf };
}

const value = (n) => n.buf.subarray(n.valueStart, n.valueEnd);
const raw = (n) => n.buf.subarray(n.start, n.end);

function children(n) {
  const out = [];
  for (let p = n.valueStart; p < n.valueEnd;) {
    const c = readTlv(n.buf, p, n.valueEnd);
    out.push(c);
    p = c.end;
  }
  return out;
}

function oidString(n) {
  const v = value(n);
  const head = Math.min(Math.floor(v[0] / 40), 2);
  const parts = [head, v[0] - 40 * head];
  let acc = 0n;
  for (const b of v.subarray(1)) {
    acc = (acc << 7n) | BigInt(b & 0x7f);
    if (!(b & 0x80)) { parts.push(acc); acc = 0n; }
  }
  return parts.join('.');
}

function buildRequest(digest) {
  const nonce = randomBytes(8);
  nonce[0] = (nonce[0] & 0x7f) | 0x40; // positive, with no leading-zero form to get wrong
  const request = der(0x30,
    der(0x02, Buffer.from([1])),
    der(0x30,
      der(0x30, Buffer.from('0609608648016503040201', 'hex'), Buffer.from('0500', 'hex')),
      der(0x04, digest)),
    der(0x02, nonce),
    der(0x01, Buffer.from([0xff])));
  return { request, nonce: nonce.toString('hex') };
}

function parseResponse(respDer) {
  const items = children(readTlv(respDer));
  const status = Number(BigInt(`0x${value(children(items[0])[0]).toString('hex')}`));
  return { status, token: items[1] ? Buffer.from(raw(items[1])) : null };
}

function parseToken(tokenDer) {
  const top = children(readTlv(tokenDer));
  if (oidString(top[0]) !== OID_SIGNED_DATA) throw new Error('token is not CMS SignedData');
  const signedData = children(children(top[1])[0]);
  const encap = children(signedData[2]);
  if (oidString(encap[0]) !== OID_TST_INFO) throw new Error('token does not hold TSTInfo');
  const octets = children(encap[1])[0];
  const tstInfo = octets.tag === 0x04 ? value(octets) : Buffer.concat(children(octets).map(value));
  const t = children(readTlv(tstInfo));
  const nonceNode = t.slice(5).find((c) => c.tag === 0x02);
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\.\d+)?Z$/.exec(value(t[4]).toString('latin1'));
  if (!m) throw new Error('unexpected genTime');
  return {
    imprint: Buffer.from(value(children(t[2])[1])),
    serial: value(t[3]).toString('hex'),
    genTime: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? ''}Z`,
    nonce: nonceNode ? value(nonceNode).toString('hex').replace(/^(00)+(?=[0-9a-f]{2})/, '') : null,
  };
}

async function requestToken(url, digest, timeoutMs) {
  const { request, nonce } = buildRequest(digest);
  // A redirected POST turns into a GET that returns HTML, so a redirect is a failure.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/timestamp-query', accept: 'application/timestamp-reply' },
    body: request,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { status, token } = parseResponse(Buffer.from(await res.arrayBuffer()));
  if (status > 1 || !token) throw new Error(`rejected with status ${status}`);
  const info = parseToken(token);
  if (!info.imprint.equals(digest)) throw new Error('imprint does not match');
  if (info.nonce !== nonce) throw new Error('nonce does not match');
  return { token, info };
}

// Walks the list once and returns the first bound token, or null with what failed.
export async function requestTimestamp(digest, { urls, timeoutMs = 5000 }) {
  const failures = [];
  for (const url of urls) {
    try {
      const { token, info } = await requestToken(url, digest, timeoutMs);
      return { token, tsa: new URL(url).hostname, genTime: info.genTime, serial: info.serial, failures };
    } catch (e) {
      failures.push(`${new URL(url).hostname}: ${e.cause?.code ?? e.message}`);
    }
  }
  return { token: null, failures };
}

// Adds the empty timestamp field to a document about to be saved. Saving must use
// useObjectStreams:false so the signature dictionary stays as bytes we can patch.
export function addTimestampPlaceholder(doc) {
  const ctx = doc.context;
  const byteRange = PDFArray.withContext(ctx);
  byteRange.push(PDFNumber.of(0));
  for (let i = 0; i < 3; i++) byteRange.push(PDFName.of('**********'));

  const sig = ctx.obj({ Type: 'DocTimeStamp', Filter: 'Adobe.PPKLite', SubFilter: 'ETSI.RFC3161' });
  sig.set(PDFName.of('ByteRange'), byteRange);
  sig.set(PDFName.of('Contents'), PDFHexString.of('0'.repeat(CONTENTS_BYTES * 2)));

  const page = doc.getPages()[0];
  const widget = ctx.obj({
    Type: 'Annot', Subtype: 'Widget', FT: 'Sig', Rect: [0, 0, 0, 0], F: 132, P: page.ref, V: ctx.register(sig),
  });
  widget.set(PDFName.of('T'), PDFString.of('Solaria Sign timestamp'));
  const widgetRef = ctx.register(widget);
  page.node.addAnnot(widgetRef);

  const acro = doc.catalog.getOrCreateAcroForm();
  acro.addField(widgetRef);
  acro.dict.set(PDFName.of('SigFlags'), PDFNumber.of(3));

  // A 1.7 file using an ISO 32000-2 feature declares it, as Acrobat and pyHanko do.
  if (!doc.catalog.has(PDFName.of('Extensions'))) {
    doc.catalog.set(PDFName.of('Extensions'),
      ctx.obj({ ESIC: { Type: 'DeveloperExtensions', BaseVersion: PDFName.of('1.7'), ExtensionLevel: 1 } }));
  }
}

// Fixes the /ByteRange in place, keeping the file length, and returns the digest
// the authority must sign: every byte except the reserved hex string.
export function prepareDigest(saved) {
  const pdf = Buffer.from(saved);
  const hexMark = Buffer.from(`/Contents <${'0'.repeat(64)}`, 'latin1');
  const at = pdf.lastIndexOf(hexMark);
  if (at < 0) throw new Error('timestamp placeholder not found');
  const gapStart = at + '/Contents '.length;
  const gapEnd = gapStart + CONTENTS_BYTES * 2 + 2;
  if (pdf[gapEnd - 1] !== 0x3e) throw new Error('timestamp placeholder has an unexpected size');

  const rangeAt = pdf.lastIndexOf('/ByteRange');
  const rangeEnd = pdf.indexOf(']', rangeAt);
  const slot = pdf.toString('latin1', rangeAt, rangeEnd + 1);
  if (!/^\/ByteRange\s*\[\s*0\s+\/\*{10}\s+\/\*{10}\s+\/\*{10}\s*\]$/.test(slot)) {
    throw new Error('byte range placeholder not found');
  }
  const literal = `/ByteRange [0 ${gapStart} ${gapEnd} ${pdf.length - gapEnd}]`;
  if (literal.length > slot.length) throw new Error('byte range placeholder too short');
  pdf.write(literal.padEnd(slot.length, ' '), rangeAt, 'latin1');

  return { pdf, gapStart, gapEnd, digest: sha256(pdf.subarray(0, gapStart), pdf.subarray(gapEnd)) };
}

export function embedToken({ pdf, gapStart, gapEnd }, token) {
  if (token.length > (gapEnd - gapStart - 2) / 2) throw new Error('timestamp token exceeds reserved space');
  const out = Buffer.from(pdf);
  out.write(token.toString('hex'), gapStart + 1, 'latin1');
  return out;
}

// Re-reads the sealed file itself rather than trusting what was just computed. This
// proves the token names these exact bytes. Whether the authority really signed the
// token is for a PDF validator such as Acrobat, which also checks its certificate chain.
export function checkEmbeddedTimestamp(sealed) {
  const pdf = Buffer.from(sealed);
  const at = pdf.lastIndexOf('/ByteRange');
  const m = /^\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(pdf.toString('latin1', at, at + 80));
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  // A range short of the end of the file means bytes were appended after sealing.
  if (a !== 0 || b >= c || c + d !== pdf.length) return false;
  const gap = pdf.toString('latin1', b, c);
  if (!/^<[0-9a-fA-F]*>$/.test(gap)) return false;
  const contents = Buffer.from(gap.slice(1, -1), 'hex');
  try {
    const token = raw(readTlv(contents));
    // The slot is sized for the largest likely token. The rest stays blank, because
    // nothing hashes these bytes and they must not become a place to change the file.
    if (contents.subarray(token.length).some((byte) => byte !== 0)) return false;
    const info = parseToken(Buffer.from(token));
    return info.imprint.equals(sha256(pdf.subarray(0, b), pdf.subarray(c)));
  } catch {
    return false;
  }
}
