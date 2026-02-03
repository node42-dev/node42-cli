# Node42 Local JSON DB – Usage Guide

This is a lightweight local document store used by the Node42 CLI.  
It is **not a database server** — it is a structured JSON file with helper functions.

Location (Linux/macOS):
```
~/.node42/db.json
```

---

## Purpose

Designed for:

- Artefact history
- Participant lookups
- File references
- UUID tracking
- Small usage statistics
- Local cache

Intended scale: **1 – 10,000 records**.

---

## Data Structure

Example `db.json`:

```json
{
  "user": {},
  "artefacts": [],
}
```

Collections are flexible and can hold any object structure.

---

## Core Functions

```js
const db = require("./db");
```

### load()

Reads the JSON file into memory.

```js
const db = db.load();
```

If the file does not exist, returns a default structure.

---

### save(database)

Writes the in-memory object back to disk.

```js
db.save(database);
```

Always called after insert/update/delete.

---

### get(collection)

Returns a collection array or an empty array.

```js
const artefacts = db.get("artefacts");
```

Safe — never throws if missing.

---

### insert(collection, item)

Adds an item and persists.

```js
db.insert("artefacts", {
  id: "uuid",
  participantId: "0007:123",
  createdAt: Date.now()
});
```

---

### find(collection, predicate)

Filters a collection.

```js
const results = db.find("artefacts", x => x.participantId === pid);
```

Works well for thousands of entries.

---

## Indexing (Fast Lookup)

### indexBy(list, key)

Builds an in-memory index for repeated queries.

```js
const artefacts = db.get("artefacts");
const byPid = db.indexBy(artefacts, "participantId");

const results = byPid["0007:123"] ?? [];
```

Use when:
- Many lookups
- Same key repeatedly
- Performance matters

---

## Optional Advanced Helpers

### indexByFn(list, fn)

Derived or computed keys.

```js
const byDay = db.indexByFn(list, x => x.createdAt.slice(0, 10));
```

Now **byDay** looks like:
```json
{
  "2026-01-29": [ {...}, {...} ],
  "2026-01-30": [ {...} ]
}
```

Retrieve all items for a day
```js
const items = byDay["2026-01-29"] ?? [];
```
---

### indexByMap(list, key)

Same as `indexBy` but uses `Map` instead of plain object.
Useful if keys are numbers or objects instead of strings.

---

## Typical CLI Workflow

### Insert Record
```js
db.insert("artefacts", obj);
```

### Simple Search
```js
db.find("artefacts", x => x.id === uuid);
```

### Repeated Search
```js
const list = db.get("artefacts");
const idx = db.indexBy(list, "participantId");
```

---

## Performance Expectations

| Records | Performance |
|--------|------------|
| 1k     | Instant |
| 5k     | Instant |
| 10k    | Fine |
| 50k    | Noticeable |
| 100k+  | Consider SQLite |

---

## File Safety

Recommended permissions:

```
chmod 600 ~/.node42/db.json
```


## When to Upgrade to SQLite

- 100k+ records
- Complex joins
- Multi-field queries
- Concurrent writes

---

## Summary

This system is:

- Portable
- Dependency-free
- Easy to debug
- Perfect for CLI tools
- Sufficient for long-term local storage

It behaves like a **tiny embedded document database**, not a server DB.
