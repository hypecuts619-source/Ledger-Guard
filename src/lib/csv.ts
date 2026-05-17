import Papa from 'papaparse';
import { Transaction } from './db';

export function parseCSV(file: File): Promise<Omit<Transaction, 'id'>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mapped = results.data.map((row: any) => {
          // Helper to find columns regardless of casing or exact naming
          const getVal = (keys: string[]) => {
            const key = Object.keys(row).find((k) => 
              keys.some(expected => k.toLowerCase().trim().includes(expected))
            );
            return key ? String(row[key]) : '';
          };

          const rawAmount = getVal(['amount', 'value', 'cost', 'price', 'total']);
          const amount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, '')) || 0;

          return {
            date: getVal(['date', 'time', 'timestamp']),
            description: getVal(['description', 'desc', 'name', 'payee', 'memo']),
            amount,
            category: getVal(['category', 'type', 'group']),
            account: getVal(['account', 'bank', 'source'])
          };
        });
        resolve(mapped);
      },
      error: (err) => reject(err),
    });
  });
}
