import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AiService } from 'src/chat/ai.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from './admin.guard';

class AdminAiGenerateDto {
  @IsString() @IsNotEmpty() @MaxLength(6000) prompt!: string;
}

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/ai')
export class AdminAiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  async generate(@Body() dto: AdminAiGenerateDto) {
    return { text: await this.ai.generate(dto.prompt) };
  }
}
