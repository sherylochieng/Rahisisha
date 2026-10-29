// =============================================================
// products.routes.js
// Maps HTTP methods + URLs to controller functions.
//
// This file has ONE job — wiring.
// No logic lives here. No database queries. No validation.
// All of that is in products.controller.js.
//
// When a request arrives at /v1/products, Express looks here
// to find which function should handle it, then calls that function.
// =============================================================

import { Router } from 'express';
import {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/products.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// GET  /v1/products       → list all products (paginated)
// POST /v1/products       → create a new product
router.get('/',    asyncHandler(listProducts));
router.post('/',   asyncHandler(createProduct));

// GET    /v1/products/:id → fetch one product
// PATCH  /v1/products/:id → partially update a product
// DELETE /v1/products/:id → soft delete a product
router.get('/:id',    asyncHandler(getProduct));
router.patch('/:id', asyncHandler(updateProduct));
router.delete('/:id', asyncHandler(deleteProduct));

export default router;