import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { IncomingMessage } from 'http';
import { AppModule } from './app.module';

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
    const allowedOrigins = (
        process.env.CORS_ORIGINS ??
        process.env.DASHBOARD_ORIGINS ??
        process.env.FRONTEND_URL ??
        'https://admin.halalconnect.space'
    )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Origin is not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
