import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsIn(['ios', 'android', 'web']) platform!: 'ios' | 'android' | 'web';
}
