import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    if (process.env.MODE == "Dev") {
        // Set up Swagger
        const config = new DocumentBuilder()
            .setTitle('Anchor Within API')
            .setDescription('API documentation for Anchor Within')
            .setVersion('1.0')
            .addBearerAuth()
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api', app, document); // Swagger UI at /api
    }

    app.useGlobalPipes(new ValidationPipe);
    app.enableCors();

    await app.listen(process.env.PORT ?? 3000);
    console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
    console.log(`📄 Swagger UI available at http://localhost:${process.env.PORT}/api`);
}
bootstrap();

