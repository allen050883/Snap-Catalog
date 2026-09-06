import * as SQLite from 'expo-sqlite';

export type Item = {
  id: number;
  name: string;
  character: string | null;
  series: string | null;
  category: string | null;
  color: string | null;
  notes: string | null;
  photoUri: string | null;
  createdAt: number;
};

export type ItemInput = Omit<Item, 'id' | 'createdAt'>;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('snap-catalog.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          character TEXT,
          series TEXT,
          category TEXT,
          color TEXT,
          notes TEXT,
          photoUri TEXT,
          createdAt INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE
        );

        CREATE TABLE IF NOT EXISTS item_tags (
          itemId INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          tagId INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (itemId, tagId)
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function createItem(input: ItemInput, tagNames: string[]): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO items (name, character, series, category, color, notes, photoUri, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.character,
      input.series,
      input.category,
      input.color,
      input.notes,
      input.photoUri,
      Date.now(),
    ],
  );
  const itemId = result.lastInsertRowId;
  await setItemTags(itemId, tagNames);
  return itemId;
}

export async function updateItem(id: number, input: ItemInput, tagNames: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE items SET name = ?, character = ?, series = ?, category = ?, color = ?, notes = ?, photoUri = ?
     WHERE id = ?`,
    [input.name, input.character, input.series, input.category, input.color, input.notes, input.photoUri, id],
  );
  await setItemTags(id, tagNames);
}

export async function deleteItem(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM items WHERE id = ?`, [id]);
}

async function setItemTags(itemId: number, tagNames: string[]) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM item_tags WHERE itemId = ?`, [itemId]);

  const uniqueNames = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
  for (const name of uniqueNames) {
    await db.runAsync(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, [name]);
    const tag = await db.getFirstAsync<{ id: number }>(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`, [name]);
    if (tag) {
      await db.runAsync(`INSERT OR IGNORE INTO item_tags (itemId, tagId) VALUES (?, ?)`, [itemId, tag.id]);
    }
  }
}

export type ItemWithTags = Item & { tags: string[] };

async function attachTags(db: SQLite.SQLiteDatabase, items: Item[]): Promise<ItemWithTags[]> {
  if (items.length === 0) return [];
  const ids = items.map((i) => i.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ itemId: number; name: string }>(
    `SELECT item_tags.itemId as itemId, tags.name as name
     FROM item_tags JOIN tags ON tags.id = item_tags.tagId
     WHERE item_tags.itemId IN (${placeholders})`,
    ids,
  );
  const tagsByItem = new Map<number, string[]>();
  for (const row of rows) {
    const list = tagsByItem.get(row.itemId) ?? [];
    list.push(row.name);
    tagsByItem.set(row.itemId, list);
  }
  return items.map((item) => ({ ...item, tags: tagsByItem.get(item.id) ?? [] }));
}

export async function listItems(search?: string): Promise<ItemWithTags[]> {
  const db = await getDb();
  let items: Item[];
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    items = await db.getAllAsync<Item>(
      `SELECT DISTINCT items.* FROM items
       LEFT JOIN item_tags ON item_tags.itemId = items.id
       LEFT JOIN tags ON tags.id = item_tags.tagId
       WHERE items.name LIKE ? OR items.character LIKE ? OR items.series LIKE ?
          OR items.category LIKE ? OR items.color LIKE ? OR tags.name LIKE ?
       ORDER BY items.createdAt DESC`,
      [like, like, like, like, like, like],
    );
  } else {
    items = await db.getAllAsync<Item>(`SELECT * FROM items ORDER BY createdAt DESC`);
  }
  return attachTags(db, items);
}

export async function getItem(id: number): Promise<ItemWithTags | null> {
  const db = await getDb();
  const item = await db.getFirstAsync<Item>(`SELECT * FROM items WHERE id = ?`, [id]);
  if (!item) return null;
  const [withTags] = await attachTags(db, [item]);
  return withTags;
}

export async function listAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(`SELECT name FROM tags ORDER BY name COLLATE NOCASE`);
  return rows.map((r) => r.name);
}
