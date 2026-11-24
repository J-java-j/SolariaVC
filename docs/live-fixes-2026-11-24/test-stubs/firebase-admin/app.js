// Test stand-in for firebase-admin/app: nothing here talks to Google.
export const initializeApp = (options, name) => ({ options, name });
export const applicationDefault = () => ({ getAccessToken: async () => ({ access_token: 'test-only' }) });
