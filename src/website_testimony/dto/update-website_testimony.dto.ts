import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteTestimonyDto } from './create-website_testimony.dto';

export class UpdateWebsiteTestimonyDto extends PartialType(CreateWebsiteTestimonyDto) {}
