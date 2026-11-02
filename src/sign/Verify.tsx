import { useRef, useState, type ChangeEvent } from 'react';
import { api } from './api';
import { Seal } from './Seal';
import { formatDateTime, Notice, useBusy, Wordmark } from './ui';

type Result = Awaited<ReturnType<typeof api.verify>> & { sha256: string; fileName: string };

async function fingerprint(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function Verify() {
  const [result, setResult] = useState<Result | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useBusy();

  const check = (file?: File) => {
    if (!file) return;
    setResult(null);
    run(async () => {
      const sha256 = await fingerprint(file);
      setResult({ ...(await api.verify(sha256)), sha256, fileName: file.name });
    });
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    check(e.target.files?.[0]);
    e.target.value = '';
  };

  return (
    <div className="desk-center">
      <div className="note note-wide">
        <Wordmark />
        <h1>Check a signed document</h1>
        <p>Choose a PDF you received from Solaria Sign. It stays on your device: we only compare its fingerprint with our records.</p>
        <button type="button" className="primary" disabled={busy} onClick={() => picker.current?.click()}>{busy ? 'Checking' : 'Choose a PDF'}</button>
        <input ref={picker} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
        {error && <Notice>{error}</Notice>}
        {result?.found && (
          <div className="verdict">
            <Seal reference={result.reference!} size={96} />
            <h2>This is the sealed copy</h2>
            <p>"{result.title}" was completed {formatDateTime(result.completedAt)}.</p>
            <dl className="facts">
              <dt>Reference</dt>
              <dd>{result.reference}</dd>
              {result.signers!.map((signer) => [
                <dt key={`${signer.name}-name`}>{signer.name}</dt>,
                <dd key={`${signer.name}-at`}>Signed {formatDateTime(signer.signedAt)}</dd>,
              ])}
              {result.timestamp && <dt>Timestamped</dt>}
              {result.timestamp && <dd>{formatDateTime(result.timestamp.genTime)} by {result.timestamp.tsa}</dd>}
              <dt>SHA-256</dt>
              <dd className="hash">{result.sha256}</dd>
            </dl>
          </div>
        )}
        {result && !result.found && (
          <div className="verdict">
            <h2>No match for this file</h2>
            <p>{result.fileName} is not a sealed copy we hold. Any change to a sealed file, even re-saving it, gives it a new fingerprint.</p>
            <dl className="facts">
              <dt>SHA-256</dt>
              <dd className="hash">{result.sha256}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
