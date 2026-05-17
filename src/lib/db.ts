import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Transaction {
  id?: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

interface LedgerDB extends DBSchema {
  transactions: {
    key: number;
    value: Transaction;
    indexes: { 'by-date': string };
  };
}

let dbPromise: Promise<IDBPDatabase<LedgerDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<LedgerDB>('ledgerguard-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-date', 'date');
        }
      },
    });
  }
  return dbPromise;
}

export async function addTransactions(txs: Omit<Transaction, 'id'>[]) {
  const db = await initDB();
  const tx = db.transaction('transactions', 'readwrite');
  await Promise.all(txs.map((t) => tx.store.add(t as Transaction)));
  await tx.done;
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await initDB();
  return db.getAll('transactions');
}

export async function clearTransactions() {
  const db = await initDB();
  return db.clear('transactions');
}
