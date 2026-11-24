import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Staff from './Staff';
import '../styles.css';

// Vite replaces DEV at build time. Production keeps the original launcher and
// eliminates the preview import, regardless of the URL's query parameters.
const StaffEntry = import.meta.env.DEV
  ? lazy(() => new URLSearchParams(location.search).has('preview') && !location.hash
      && new URLSearchParams(location.search).get('mode') !== 'connected'
      ? import('./portal/PortalPreview')
      : import('./portal/ConnectedPortal'))
  : import.meta.env.VITE_TEAM_PORTAL_ENABLED === 'true'
    ? lazy(() => import('./portal/ConnectedPortal'))
    : Staff;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p className="container-x py-12" role="status">Opening staff workspace…</p>}>
      <StaffEntry />
    </Suspense>
  </StrictMode>
);
