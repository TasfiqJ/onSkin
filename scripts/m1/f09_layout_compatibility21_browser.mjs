// Reuse the unchanged real Expo-web flow and retain exact dispatched pointer coordinates.
// Keyboard content is excluded. Native iPhone and VoiceOver remain NOT_RUN.
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const NativeWebSocket = globalThis.WebSocket;
const coordinates = [];
globalThis.WebSocket = class extends NativeWebSocket {
  send(data) {
    const { method, params } = JSON.parse(data);
    if (method?.startsWith('Input.')) {
      const { type, x, y, button, deltaX, deltaY, touchPoints } = params ?? {};
      coordinates.push({ at: Date.now(), method, type, x, y, button, deltaX, deltaY, touchPoints });
    }
    return super.send(data);
  }
};
try {
  await import('./f09_manual_compare20_browser.mjs');
} finally {
  globalThis.WebSocket = NativeWebSocket;
  if (process.argv[2] && existsSync(process.argv[2])) {
    writeFileSync(
      path.resolve(process.argv[2], 'dispatch-coordinates21.json'),
      JSON.stringify(coordinates, null, 2) + '\n',
    );
  }
}
