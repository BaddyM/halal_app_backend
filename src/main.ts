import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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
