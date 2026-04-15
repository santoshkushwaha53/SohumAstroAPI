import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'SohumAstroAPI',
      version: '1.0.0',
      description:
        'Production-ready Vedic & Western astrology API powered by Swiss Ephemeris',
      contact: { name: 'Sohum Astro', email: 'api@sohumastra.com' },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}${config.API_PREFIX}`,
        description: 'Local development',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: config.API_KEY_HEADER,
        },
      },
      schemas: {
        BirthInput: {
          type: 'object',
          required: ['date', 'time', 'latitude', 'longitude'],
          properties: {
            date: { type: 'string', example: '1990-06-15', description: 'YYYY-MM-DD' },
            time: { type: 'string', example: '14:30:00', description: 'HH:mm:ss (local time)' },
            latitude: { type: 'number', example: 28.6139 },
            longitude: { type: 'number', example: 77.209 },
            timezone: { type: 'string', example: '+05:30' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            details: { type: 'object' },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/api/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
