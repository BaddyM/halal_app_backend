import { Injectable } from '@nestjs/common';
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto';

@Injectable()
export class ProductionService {
  create(createProductionDto: CreateProductionDto) {
    return 'This action adds a new production';
  }

  findAll() {
    return `This action returns all production`;
  }

  findOne(id: number) {
    return `This action returns a #${id} production`;
  }

  update(id: number, updateProductionDto: UpdateProductionDto) {
    return `This action updates a #${id} production`;
  }

  remove(id: number) {
    return `This action removes a #${id} production`;
  }
}
