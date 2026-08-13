import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly items: Repository<Item>,
  ) {}

  create(dto: CreateItemDto): Promise<Item> {
    const item = this.items.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.items.save(item);
  }

  findAll(): Promise<Item[]> {
    return this.items.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.items.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Item ${id} not found`);
    }
    return item;
  }

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id);
    if (dto.name !== undefined) {
      item.name = dto.name;
    }
    if (dto.description !== undefined) {
      item.description = dto.description ?? null;
    }
    return this.items.save(item);
  }

  async remove(id: string): Promise<void> {
    const result = await this.items.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Item ${id} not found`);
    }
  }
}
