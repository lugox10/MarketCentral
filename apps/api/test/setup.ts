import 'reflect-metadata';

// Entorno mínimo para los tests: nunca apuntan a una base real.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';
process.env.API_PORT = '3001';
process.env.CORS_ORIGINS = 'http://localhost:3000';
