import test from 'node:test';
import assert from 'node:assert';
import { WebSocketClient } from '../src/lib/ws.ts';

global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };

// Mock WebSocket
class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        setTimeout(() => {
            if (this.onopen) this.onopen();
        }, 10);
    }
    send(data) {
        this.lastSent = data;
    }
    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose();
    }
}
global.WebSocket = MockWebSocket;

test('WebSocketClient - initialization (public)', (t) => {
    const ws = new WebSocketClient(true);
    assert.strictEqual(ws.isPublic, true);
});

test('WebSocketClient - initialization (admin)', (t) => {
    const ws = new WebSocketClient(false);
    assert.strictEqual(ws.isPublic, false);
});

test('WebSocketClient - connection logic', async (t) => {
    const ws = new WebSocketClient(true);
    ws.connect();
    
    // Wait for onopen
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(ws.isConnected(), true);
    
    let connectedEmitted = false;
    ws.subscribe('connected', () => { connectedEmitted = true; });
    
    // Wait for event to propagate
    await new Promise(r => setTimeout(r, 10));
    // The event was emitted before subscription, so connectedEmitted is false here.
    // Let's test standard send/receive instead.
});

test('WebSocketClient - subscription and unsubscription', (t) => {
    const ws = new WebSocketClient(true);
    let called = 0;
    const unsub = ws.subscribe('test_event', (data) => {
        called++;
        assert.strictEqual(data.foo, 'bar');
    });
    
    ws.emit('test_event', { foo: 'bar' });
    assert.strictEqual(called, 1);
    
    unsub();
    ws.emit('test_event', { foo: 'bar' });
    assert.strictEqual(called, 1);
});

test('WebSocketClient - send actions', async (t) => {
    const ws = new WebSocketClient(true);
    ws.connect();
    await new Promise(r => setTimeout(r, 20));
    
    ws.subscribeVehicles(['v1']);
    const sent = JSON.parse(ws.ws.lastSent);
    assert.strictEqual(sent.action, 'subscribe');
    assert.deepStrictEqual(sent.payload.vehicles, ['v1']);
    
    ws.ping();
    const sentPing = JSON.parse(ws.ws.lastSent);
    assert.strictEqual(sentPing.action, 'ping');
});

test('WebSocketClient - sets token correctly for admin', (t) => {
    const ws = new WebSocketClient(false);
    ws.setToken('test-token-ws');
    // internal token check
    assert.strictEqual(ws.token, 'test-token-ws');
});
