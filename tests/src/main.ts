import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.connectMicroservice({
        transport: Transport.TCP,
    });
  
    await app.startAllMicroservices();
    await app.listen(3000);

      

    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();