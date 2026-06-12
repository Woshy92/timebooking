import 'express-session';
import { Credentials } from 'google-auth-library';

declare module 'express-session' {
  interface SessionData {
    tokens?: Credentials;
    // Set in /auth/start purely to mark the session as modified so
    // express-session emits a Set-Cookie header (saveUninitialized=false).
    // The OAuth state itself is NOT stored here — it lives in the server-side
    // pendingStates map, bound to the session ID. See auth.routes.ts.
    initialized?: boolean;
    csrfToken?: string;
  }
}
