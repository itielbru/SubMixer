import * as os from 'os';
import * as path from 'path';

// Minimal Electron stub for unit tests. Only covers the surface the modules
// under test actually touch (app.getPath).
export const app = {
  getPath: (name: string): string => path.join(os.tmpdir(), 'submixer-test', name),
};

export default { app };
