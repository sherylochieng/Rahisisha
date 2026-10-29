// =============================================================
// orders.routes.js
// Maps HTTP methods + URLs to order controller functions.
//
// One job: wiring. No logic here.
// =============================================================

import { Router } from 'express';
import {
  listOrders,
  createOrder,
  getOrder,
  updateOrderStatus,
} from '../controllers/orders.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// GET  /v1/orders     → list orders (paginated)
// POST /v1/orders     → create a new order
router.get('/', asyncHandler(listOrders));
router.post('/', asyncHandler(createOrder));

// GET   /v1/orders/:id         → fetch one order
   // PATCH /v1/orders/:id         → update status only (state machine)..removed nt compatible with assifgnmnt
router.get('/:id', asyncHandler(getOrder));
router.patch('/:id', asyncHandler(updateOrderStatus));

export default router;
