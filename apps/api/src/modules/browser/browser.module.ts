import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrowserService } from './browser.service';
import { BrowserToolsProvider } from './browser-tools.provider';

@Module({
  imports: [ConfigModule],
  providers: [BrowserService, BrowserToolsProvider],
  exports: [BrowserService],
})
export class BrowserModule {}
