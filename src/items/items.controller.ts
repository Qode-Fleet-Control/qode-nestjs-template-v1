import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './item.entity';

// Version lives on the controller so the whole resource serves under /v1/items.
// @Version() is a method decorator in Nest 10; the controller-level equivalent
// is the { version } option, which yields the identical URI-versioned surface.
@Controller({ path: 'items', version: '1' })
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateItemDto): Promise<Item> {
    return this.items.create(dto);
  }

  @Get()
  findAll(): Promise<Item[]> {
    return this.items.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Item> {
    return this.items.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ): Promise<Item> {
    return this.items.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.items.remove(id);
  }
}
