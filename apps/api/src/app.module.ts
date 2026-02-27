import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransitModule } from './transit/transit.module';

@Module({
  imports: [TransitModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
