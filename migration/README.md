# HanLearn Data Migration

Build static dictionary file from CC-CEDICT for client-side lookups.

## Why Static Dictionary?

Instead of storing ~124K dictionary entries in Firestore (which incurs read costs), the dictionary is served as a static JSON file. This eliminates database costs while keeping user-specific data (word banks, progress) in Firestore.

## Prerequisites

1. Node.js installed
2. CC-CEDICT dictionary file

## Steps

### 1. Download CC-CEDICT Dictionary

1. Go to https://www.mdbg.net/chinese/dictionary?page=cc-cedict
2. Download the dictionary file (cedict_1_0_ts_utf-8_mdbg.txt.gz)
3. Extract it and rename to `cedict_ts.u8`
4. Place in this `migration/` directory

### 2. Build the Dictionary

```bash
cd migration
node build-dictionary.js
```

This generates `web-client/public/dictionary.json` (~15 MB, 124K entries).

### 3. Deploy

The dictionary file will be served from `/dictionary.json` when the frontend is deployed.

## What's in the Dictionary

Each entry contains:
- `id`: Unique identifier
- `simp`: Simplified Chinese
- `trad`: Traditional Chinese
- `pinyin`: Romanization
- `meaning`: English definitions

## Architecture

- **Static dictionary** (`/dictionary.json`): Served from web host, loaded lazily on first search
- **User data** (Firestore): Auth, word banks, spaced repetition progress
- **Chengyus**: Still loaded from the chengyus.txt file (small dataset)

## Legacy: Firestore Import (Not Recommended)

The `import_firestore.ts` script can import the dictionary to Firestore, but this incurs costs:
- ~124K write operations to populate
- Read costs every time users search

Use the static dictionary approach instead.
