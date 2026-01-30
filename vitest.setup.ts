// ABOUTME: Vitest setup file to configure test environment.
// ABOUTME: Uses separate test database to avoid affecting dev data.

// Override DATABASE_URL to use a separate test database
process.env.DATABASE_URL = 'file:./test.db';
