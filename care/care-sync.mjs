import { emptyState, importBackup } from './model.mjs';
import { createDocumentSync } from './vendor/account/document-sync.mjs';

export function createCareSync(options) {
  if (typeof options?.transport !== 'function') throw new TypeError('transport must be a function');
  const transport = (action, body) => options.transport(action, action === 'careSave' ? { ...body, messageLibraryVersion: 1 } : body);
  const requiresConflictReview = (local, remote) => {
    const localPeople = new Map(local.people.map(person => [person.id, person]));
    return remote.people.some(person => Object.hasOwn(person, 'messageLibrary') && !Object.hasOwn(localPeople.get(person.id) ?? {}, 'messageLibrary'));
  };
  return createDocumentSync({ ...options, transport, emptyState, validateState: importBackup, requiresConflictReview, scope: 'synk-care', cachePrefix: 'synk.care.account.v1.' });
}
