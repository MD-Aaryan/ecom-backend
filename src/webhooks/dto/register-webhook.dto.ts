import { IsUrl, IsArray, IsString, IsOptional } from 'class-validator';

export class RegisterWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsString()
  secret?: string;
}
