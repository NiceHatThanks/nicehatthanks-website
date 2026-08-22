import appWorker from './app.js';
import { handleAdminRequest } from './admin.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminRequest(request, env);
    }

    return appWorker.fetch(request, env, ctx);
  },
};
