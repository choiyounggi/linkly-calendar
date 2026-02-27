import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransitModule } from './transit/transit.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [TransitModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
