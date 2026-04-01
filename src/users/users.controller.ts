import { Controller, Get, Put, Body, Param, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    
    if (updateUserDto.color) {
      await this.chatService.updateUserColor(user.username, updateUserDto.color);
      this.chatGateway.notifyColorUpdate(user.username, updateUserDto.color);
    }
    
    return {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        color: user.color,
      },
    };
  }
}
