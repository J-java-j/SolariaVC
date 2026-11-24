import { staffServer } from './api.js';
import { configuredProvider } from './provider.js';

staffServer(configuredProvider()).listen(8787, '127.0.0.1', () => {
  console.log('Local staff API listening at http://127.0.0.1:8787');
});
