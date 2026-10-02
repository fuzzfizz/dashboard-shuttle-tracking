import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createNullRedisClient, createRedisClient } from '../src/services/redis-client.js';

describe('Redis Client Service', () => {
  describe('createNullRedisClient', () => {
    test('returns standard interface with isReady = false', () => {
      const client = createNullRedisClient();
      assert.ok(client);
      assert.ok(client.pub);
      assert.ok(client.sub);
      assert.ok(client.cache);
      assert.strictEqual(typeof client.isReady, 'function');
      assert.strictEqual(typeof client.close, 'function');
      assert.strictEqual(client.isReady(), false);
    });

    test('no-op methods execute safely and return expected falsy/empty values', async () => {
      const client = createNullRedisClient();

      const pubRes = await client.pub.publish('test-channel', 'msg');
      assert.strictEqual(pubRes, 0);

      await client.sub.subscribe('test-channel');
      await client.sub.unsubscribe('test-channel');

      const hsetRes = await client.cache.hset('key', 'field', 'val');
      assert.strictEqual(hsetRes, 0);

      const hgetallRes = await client.cache.hgetall('key');
      assert.deepStrictEqual(hgetallRes, {});

      const hgetRes = await client.cache.hget('key', 'field');
      assert.strictEqual(hgetRes, null);

      const scanRes = await client.cache.scan('0');
      assert.deepStrictEqual(scanRes, ['0', []]);

      await client.close();
      assert.strictEqual(client.isReady(), false);
    });
  });

  describe('createRedisClient fallback behavior', () => {
    test('initializes without throwing when given unreachable address', async () => {
      // Unreachable port
      const client = createRedisClient({
        url: 'redis://127.0.0.1:59999',
        logger: {
          warn: () => {},
          debug: () => {},
          info: () => {},
        },
      });

      assert.ok(client);
      assert.strictEqual(typeof client.isReady, 'function');
      assert.strictEqual(typeof client.close, 'function');
      assert.strictEqual(client.isReady(), false);

      // Should be safe to close
      await client.close();
    });
  });
});
