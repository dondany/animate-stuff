// Local storage for animations, so a workshop works without Wi-Fi.
// Frames are stored as ArrayBuffers rather than Blobs: older iOS versions
// have bugs reading Blobs back out of IndexedDB.

const DB_NAME = 'animation-workshop';
let dbPromise;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('frames', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    Promise.resolve(fn(tx)).then((r) => { result = r; }, reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

export function newId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function listProjects() {
  const all = await run('projects', 'readonly', (tx) => req(tx.objectStore('projects').getAll()));
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id) {
  return run('projects', 'readonly', (tx) => req(tx.objectStore('projects').get(id)));
}

export function saveProject(project) {
  project.updatedAt = Date.now();
  return run('projects', 'readwrite', (tx) => req(tx.objectStore('projects').put(project)));
}

// `fields` can override the defaults, e.g. { name, fps, label } for a scanned sheet.
// `label` is an optional { type, data: ArrayBuffer } image of the child's handwritten name.
export async function createProject(fields = {}) {
  const count = (await listProjects()).length;
  const project = {
    id: newId(),
    name: `Animation ${count + 1}`,
    fps: 6,
    boomerang: false,
    frameIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...fields,
  };
  await saveProject(project);
  return project;
}

export function deleteProject(project) {
  return run(['projects', 'frames'], 'readwrite', (tx) => {
    const frames = tx.objectStore('frames');
    for (const id of project.frameIds) frames.delete(id);
    tx.objectStore('projects').delete(project.id);
  });
}

// Inserts a frame after position `at` (defaults to the end) and saves the project.
export async function addFrame(project, blob, at = project.frameIds.length) {
  const id = newId();
  const data = await blob.arrayBuffer();
  project.frameIds.splice(at, 0, id);
  project.updatedAt = Date.now();
  await run(['projects', 'frames'], 'readwrite', (tx) => {
    tx.objectStore('frames').put({ id, projectId: project.id, type: blob.type, data });
    tx.objectStore('projects').put(project);
  });
  return id;
}

export function removeFrame(project, frameId) {
  project.frameIds = project.frameIds.filter((id) => id !== frameId);
  project.updatedAt = Date.now();
  return run(['projects', 'frames'], 'readwrite', (tx) => {
    tx.objectStore('frames').delete(frameId);
    tx.objectStore('projects').put(project);
  });
}

export async function getFrame(id) {
  const rec = await run('frames', 'readonly', (tx) => req(tx.objectStore('frames').get(id)));
  return rec ? new Blob([rec.data], { type: rec.type }) : null;
}

export async function getFrames(ids) {
  const recs = await run('frames', 'readonly', (tx) => {
    const store = tx.objectStore('frames');
    return Promise.all(ids.map((id) => req(store.get(id))));
  });
  return recs.map((rec) => (rec ? new Blob([rec.data], { type: rec.type }) : null));
}

// Safari wipes site data after 7 days without a visit unless the app is on the
// home screen; asking for persistent storage helps where it's supported.
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
