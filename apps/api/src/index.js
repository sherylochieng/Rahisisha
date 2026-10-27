import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRouter     from './routes/auth/auth.js';
import productsRouter from './routes/products.routes.js';
import ordersRouter   from './routes/orders.routes.js';

// requireAuth and withTenant guard all product and order routes.
// Every request must have a valid JWT AND a valid tenant before
// reaching the controller.
import { requireAuth } from './middleware/requireAuth.js';
import { withTenant }  from './middleware/withTenant.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));

// Auth routes — no middleware needed, these are public
app.use('/v1', authRouter);

// Products and orders — protected by requireAuth + withTenant
// Every request here must pass both middleware checks first
app.use('/v1/products', requireAuth, withTenant, productsRouter);
app.use('/v1/orders',   requireAuth, withTenant, ordersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});