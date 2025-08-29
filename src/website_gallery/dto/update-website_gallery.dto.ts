import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteGalleryDto } from './create-website_gallery.dto';

export class UpdateWebsiteGalleryDto extends PartialType(CreateWebsiteGalleryDto) {}
