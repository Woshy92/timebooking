import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`Frontend expected at ${process.env.FRONTEND_ORIGIN || 'http://localhost:4200'}`);
});
