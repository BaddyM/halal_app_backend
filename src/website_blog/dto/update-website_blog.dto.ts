import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteBlogDto } from './create-website_blog.dto';

export class UpdateWebsiteBlogDto extends PartialType(CreateWebsiteBlogDto) {}
