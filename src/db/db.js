
/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: AGPL-3.0-only
*/

import { getDbFile } from '../cli/paths.js';

import { createCliJsonFileAdapter } from './adapters/cli.json.db.js';
import { createCliDynamoDbAdapter } from './adapters/cli.dynamo.db.js';

import { 
  N42Error, 
  N42ErrorCode 
} from '../core/error.js';


function createDefaultAdapter() {
  return createCliJsonFileAdapter(getDbFile());
}

export async function getDbAdapter() {
  const procEnvDb = process.env.N42_DB_ADAPTER;
  switch(procEnvDb) {
    case 'cli-aws-dynamo-db': {
      let DynamoDBClient, DynamoDBDocumentClient, fromIni;

      try {
        ({ DynamoDBClient }         = await import('@aws-sdk/client-dynamodb'));
        ({ DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb'));
        ({ fromIni }                = await import('@aws-sdk/credential-provider-ini'));
      } 
      catch {
        throw new N42Error(N42ErrorCode.MODULE_NOT_FOUND, { details: "DynamoDB adapter requires AWS SDK — run: npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/credential-provider-ini" });
      }

      try {
        const isLocal = process.env.AWS_EXECUTION_ENV === undefined;
        const client  = new DynamoDBClient({
          region: process.env.AWS_REGION ?? 'eu-north-1',
          ...(isLocal && {
            credentials: fromIni({ profile: process.env.AWS_PROFILE }),
          }),
        });
        return createCliDynamoDbAdapter(DynamoDBDocumentClient.from(client), process.env.N42_DB_TABLE_CLI);
      }
      catch {
        return createDefaultAdapter();
      }
    }

    case 'cli-json-db': {
      return createCliJsonFileAdapter(getDbFile());
    }
    
    default: {
      return createDefaultAdapter();
    }
  }
}

export function createDb(adapter) {
  return {
    insert:                (collection, item)              => adapter.insert(collection, item),
    update:                (collection, item, key)         => adapter.update(collection, item, key),
    upsert:                (collection, item, key)         => adapter.upsert(collection, item, key),
    replace:               (collection, value)             => adapter.replace(collection, value),
    set:                   (collection, key, value)        => adapter.set(collection, key, value),
    remove:                (collection, keyValue, key)     => adapter.remove(collection, keyValue, key),
    clear:                 (collection)                    => adapter.clear(collection),
    getAll:                (collection)                    => adapter.getAll(collection),
    find:                  (collection, predicate)         => adapter.find(collection, predicate),
    artefactsByParticipant:(collection, pid)               => adapter.artefactsByParticipant(collection, pid),
    invalidateArtefactIndex:()                             => adapter.invalidateArtefactIndex?.(),
  };
}

export function indexBy(list, key) {
  const map = Object.create(null);
  for (const item of list) {
    const k = item?.[key];
    if (k === null) continue;
    (map[k] ??= []).push(item);
  }
  return map;
}

export function indexByFn(list, keyFn) {
  const map = Object.create(null);
  for (const item of list) {
    const k = keyFn(item);
    if (k === null) continue;
    (map[k] ??= []).push(item);
  }
  return map;
}

export function indexByMap(list, key) {
  const map = new Map();
  for (const item of list) {
    const k = item?.[key];
    if (k === null) continue;
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}