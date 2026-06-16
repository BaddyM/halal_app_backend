import { IsIn } from 'class-validator';

export class AdQueryDto {
  @IsIn(['HOME_BANNER', 'BETWEEN_MATCHES', 'CHAT_TOP', 'PROFILE_SIDEBAR'])
  placement!: 'HOME_BANNER' | 'BETWEEN_MATCHES' | 'CHAT_TOP' | 'PROFILE_SIDEBAR';
}
