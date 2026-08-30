/**
 * Lightweight test server helper.
 *
 * Avoids adding a new dependency (e.g. supertest) for tests: starts a given
 * Express app on an ephemeral port and returns a base URL plus a close()
 * function. Requests are made with Node's built-in fetch.
 */
export async function startTestServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
    server.on('error', reject);
  });
}
