// =============================================================================
// jest.config.js — Jest test runner configuration
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Jest was built before ES modules (import/export) became standard
// - Without this config, Jest crashes on the first import statement
// - This file tells Jest: "this project uses ES modules, handle them correctly"
//
// SYSTEM DESIGN PRINCIPLE: Configuration as Code
// - All tool settings live in a file, not in your head
// - Anyone who clones this repo gets the same test behaviour automatically
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every project that uses Jest + ES modules ("type":"module" in package.json)
// - If you use CommonJS (require/module.exports) you don't need this
// - You will need this in every modern Node.js project with tests
//
// TRADEOFFS:
// + Jest works correctly with import/export
// + One config file, applies to all tests
// - Adds one extra file to the project
// - experimentalVmModules is still "experimental" but it is the
//   standard approach and stable enough for production use
//
// =============================================================================

export default {
  // Tell Jest to use the experimental VM module runner
  // This is what makes import/export work inside test files
  testEnvironment: 'node',

  // This is the key line — without it Jest cannot handle ES module imports
  transform: {},

  // Where Jest looks for test files
  // Any file ending in .test.js inside the tests/ folder will be picked up
  testMatch: ['**/tests/**/*.test.js'],
};