import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { FlowDefinition } from '../entities/flow.entity';

export class CreateFlowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  definition: FlowDefinition;
}

export class UpdateFlowDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  definition?: FlowDefinition;
}
