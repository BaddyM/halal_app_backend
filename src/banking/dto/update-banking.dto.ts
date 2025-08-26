import { PartialType } from '@nestjs/swagger';
import { CreateBankingDto } from './create-banking.dto';

export class UpdateBankingDto extends PartialType(CreateBankingDto) {}
