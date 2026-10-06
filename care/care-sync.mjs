import { emptyState, importBackup } from './model.mjs';
import { createDocumentSync } from './vendor/account/document-sync.mjs';

export function createCareSync(options) {
  return createDocumentSync({ ...options, emptyState, validateState: importBackup, scope: 'synk-care', cachePrefix: 'synk.care.account.v1.' });
}
