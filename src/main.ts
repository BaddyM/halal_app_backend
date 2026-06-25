import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
    // Disable Nest's default 100kb body parser so we can raise the limit —
    // ad images arrive as base64 data URLs (up to ~7MB encoded).
    const app = await NestFactory.create(AppModule, { bodyParser: false });
    app.use(json({ limit: '12mb' }));
    app.use(urlencoded({ extended: true, limit: '12mb' }));

    app.setGlobalPrefix('api');
    app.enableCors();
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
