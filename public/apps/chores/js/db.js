const DB_NAME = 'chores-db';
const STORES = ['people', 'chores', 'completions'];

const DEFAULT_CHORES = ['Cook', 'Dishes', 'Trash', 'Vacuum'];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll(store) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function put(store, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(tx.error);
      })
  );
}

function remove(store, id) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getPeople() {
  return getAll('people');
}
export async function addPerson(name) {
  return put('people', { id: makeId(), name });
}
export async function removePerson(id) {
  return remove('people', id);
}

export async function getChores() {
  const chores = await getAll('chores');
  if (chores.length > 0) return chores;
  // First run: seed the default chore list.
  const seeded = [];
  for (const name of DEFAULT_CHORES) {
    seeded.push(await put('chores', { id: makeId(), name }));
  }
  return seeded;
}
export async function addChore(name) {
  return put('chores', { id: makeId(), name });
}
export async function removeChore(id) {
  return remove('chores', id);
}

export async function getCompletions() {
  return getAll('completions');
}
export async function setCompletion(id, done) {
  return put('completions', { id, done });
}
