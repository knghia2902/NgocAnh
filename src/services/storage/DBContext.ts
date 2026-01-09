import { openDB, type DBSchema } from 'idb';

interface MyDB extends DBSchema {
    keyval: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'ngocanh-portfolio-db';
const STORE_NAME = 'keyval';

export class DBContext {
    private dbPromise;

    constructor() {
        this.dbPromise = openDB<MyDB>(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME);
            },
        });
    }

    async get<T>(key: string): Promise<T | undefined> {
        return (await this.dbPromise).get(STORE_NAME, key);
    }

    async set(key: string, val: any) {
        return (await this.dbPromise).put(STORE_NAME, val, key);
    }

    async delete(key: string) {
        return (await this.dbPromise).delete(STORE_NAME, key);
    }

    async clear() {
        return (await this.dbPromise).clear(STORE_NAME);
    }
}

export const dbContext = new DBContext();
