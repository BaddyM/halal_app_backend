import { io, Socket } from 'socket.io-client';

// Integration check against a RUNNING server, not a unit test — it failed every
// `npm test` because nothing was listening. Opt in by pointing SMOKE_HOST at a
// live instance, e.g.:
//   SMOKE_HOST=http://localhost:3001 npx jest socket-smoke
const SMOKE_HOST = process.env.SMOKE_HOST;
const describeSmoke = SMOKE_HOST ? describe : describe.skip;

describeSmoke('Socket smoke test', () => {
  let socket: Socket | null = null;

  afterEach(() => {
    if (socket && socket.connected) socket.disconnect();
    socket = null;
  });

  it('connects to /chat namespace', async () => {
    const host = SMOKE_HOST!;
    // Connect to the chat namespace used by the app
    socket = io(host + '/chat', {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      autoConnect: true,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 7000);

      socket!.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });

      socket!.on('connect_error', (err: any) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(socket.connected).toBe(true);
  }, 15000);
});
