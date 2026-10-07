import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { IncomingMessage } from 'http';
import { AppModule } from './app.module';

const DEFAULT_ALLOWED_ORIGINS = [
    'https://halalconnect.space',
    'https://www.halalconnect.space',
    'https://admin.halalconnect.space',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

function getAllowedOrigins(): string[] {
    const configured = (
        process.env.CORS_ORIGINS ??
        process.env.DASHBOARD_ORIGINS ??
        process.env.FRONTEND_URL ??
        ''
    )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]));
}

function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) return true;

    try {
        const requestHost = new URL(origin).hostname.toLowerCase();
        return ['localhost', '127.0.0.1'].includes(requestHost)
            || allowedOrigins.some((allowed) => {
                  try {
                      const allowedHost = new URL(allowed).hostname.toLowerCase();
                      return requestHost === allowedHost || requestHost.endsWith(`.${allowedHost}`);
                  } catch {
                      return false;
                  }
              });
    } catch {
        return false;
    }
}

async function bootstrap() {
    // Keep uploads practical: large media should be streamed or stored as files,
    // not forced through oversized JSON bodies. The app still accepts normal
    // profile and form payloads without wasting memory on huge requests.
    const app = await NestFactory.create(AppModule, { bodyParser: false });
    // Keep the exact bytes we received: provider webhook signatures are computed
    // over the raw payload, and re-serialising the parsed JSON does not
    // reproduce it (key order, whitespace and number formatting all differ).
    app.use(
        json({
            limit: '2mb',
            verify: (req: IncomingMessage & { rawBody?: Buffer }, _res, buf) => {
                req.rawBody = buf;
            },
        }),
    );
    app.use(urlencoded({ extended: true, limit: '2mb' }));

    app.setGlobalPrefix('api');
    app.enableCors({
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) return callback(null, true);
            return callback(new Error('Origin is not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
    });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: false,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    if (process.env.MODE === 'Dev') {
        const config = new DocumentBuilder()
            .setTitle('Halal Connect / ZawajHub API')
            .setDescription('Backend for the Halal Connect matrimonial mobile app')
            .setVersion('1.0')
            .addBearerAuth()
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('docs', app, document);
    }

    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`🚀 Server running at http://localhost:${port}/api`);
    if (process.env.MODE === 'Dev') {
        // eslint-disable-next-line no-console
        console.log(`📄 Swagger UI at http://localhost:${port}/docs`);
    }
}
void bootstrap();
