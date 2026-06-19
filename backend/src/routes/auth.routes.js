import { login, me } from '../controllers/auth.controller.js';
import { verifyAuth } from '../middleware/auth.js';

export default async function (app) {
    app.post('/login', login);
    app.get('/me', { preHandler: [verifyAuth] }, me);
}

