import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ApiFootballClient } from "./api-football.client";
import { ApiFootballService } from "./api-football.service";
import { CacheServiceModule } from "../cache/cache.module";

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    CacheServiceModule,
  ],
  providers: [ApiFootballClient, ApiFootballService],
  exports: [ApiFootballService],
})
export class ApiFootballModule {}
