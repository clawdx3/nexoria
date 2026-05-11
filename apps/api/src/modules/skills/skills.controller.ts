import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { CreateSkillDto, SkillResponseDto } from './dto/create-skill.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [SkillResponseDto] })
  findAll(): Promise<SkillResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: SkillResponseDto })
  async findOne(@Param('id') id: string): Promise<SkillResponseDto> {
    const skill = await this.service.findOne(id);
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }
    return skill;
  }

  @Post()
  @ApiResponse({ status: 201, type: SkillResponseDto })
  create(@Body() dto: CreateSkillDto): Promise<SkillResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: SkillResponseDto })
  update(@Param('id') id: string, @Body() dto: Partial<CreateSkillDto>): Promise<SkillResponseDto | null> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
