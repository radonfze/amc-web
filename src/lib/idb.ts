export const DB_NAME = 'pryzo_technician_db';
export const DB_VERSION = 1;

export const STORES = {
    VISITS_TODAY: 'visits_today',
    PENDING_VISITS: 'pending_visits',
    PENDING_PHOTOS: 'pending_photos',
    CACHED_CONTRACTS: 'cached_contracts',
    CACHED_LOCATIONS: 'cached_locations',
};

// Generic IDB Wrapper
export const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject('IndexedDB error: ' + (event.target as IDBOpenDBRequest).error?.message);
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Store: visits_today (id as keyPath)
            if (!db.objectStoreNames.contains(STORES.VISITS_TODAY)) {
                db.createObjectStore(STORES.VISITS_TODAY, { keyPath: 'id' });
            }

            // Store: pending_visits (autoIncrement id)
            if (!db.objectStoreNames.contains(STORES.PENDING_VISITS)) {
                db.createObjectStore(STORES.PENDING_VISITS, { keyPath: 'local_id', autoIncrement: true });
            }

            // Store: pending_photos (autoIncrement id)
            if (!db.objectStoreNames.contains(STORES.PENDING_PHOTOS)) {
                db.createObjectStore(STORES.PENDING_PHOTOS, { keyPath: 'local_id', autoIncrement: true });
            }

            // Store: cached_contracts (id as keyPath)
            if (!db.objectStoreNames.contains(STORES.CACHED_CONTRACTS)) {
                db.createObjectStore(STORES.CACHED_CONTRACTS, { keyPath: 'id' });
            }

            // Store: cached_locations (id as keyPath)
            if (!db.objectStoreNames.contains(STORES.CACHED_LOCATIONS)) {
                db.createObjectStore(STORES.CACHED_LOCATIONS, { keyPath: 'id' });
            }
        };
    });
};

export const getStore = async (storeName: string, mode: IDBTransactionMode) => {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
};

// Helpers
export const putItem = async (storeName: string, item: any) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getAllItems = async (storeName: string) => {
    const db = await openDB();
    return new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteItem = async (storeName: string, key: IDBValidKey) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const clearStore = async (storeName: string) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};
