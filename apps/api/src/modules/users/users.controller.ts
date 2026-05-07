import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get(':id')
  @ApiResponse({ status: 200, type: UserResponseDto })
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: UserResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204, description: 'User deactivated' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
