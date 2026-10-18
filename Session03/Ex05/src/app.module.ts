import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { MemoryCounterStorage } from "./storage/memory-counter.storage";
import { DefensePolicy } from "./policy/defense.policy";
import { DefenseEngineService } from "./enforcement/defense-engine.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [MemoryCounterStorage, DefensePolicy, DefenseEngineService],
})
export class AppModule {}
