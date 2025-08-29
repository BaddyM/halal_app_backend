import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteContactDto } from './create-website_contact.dto';

export class UpdateWebsiteContactDto extends PartialType(CreateWebsiteContactDto) {}
