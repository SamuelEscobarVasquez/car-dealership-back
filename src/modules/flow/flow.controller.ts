import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FlowService } from './flow.service';
import { CreateFlowDto, UpdateFlowDto } from '../../dto/flow.dto';
import { NodeRegistry } from '../../engine/node-registry';

@Controller('flows')
export class FlowController {
  constructor(
    private readonly flowService: FlowService,
    private readonly nodeRegistry: NodeRegistry,
  ) {}

  @Get()
  async findAll() {
    return this.flowService.findAll();
  }

  @Get('active')
  async findActive() {
    return this.flowService.findActive();
  }

  @Get('node-types')
  getNodeTypes() {
    return {
      types: this.nodeRegistry.getAvailableTypes(),
      definitions: [
        {
          type: 'memory.load',
          label: 'Memory Load',
          description: 'Load conversation history',
          category: 'memory',
          config: {
            maxTurns: { type: 'number', default: 10, description: 'Maximum turns to load' },
          },
        },
        {
          type: 'orchestrator.openai',
          label: 'Orchestrator',
          description: 'Route messages based on intent',
          category: 'ai',
          outputs: ['faq', 'autos', 'dates', 'generic', 'validator'],
          config: {},
        },
        {
          type: 'faq.specialist.openai',
          label: 'FAQ Specialist',
          description: 'Answer FAQ questions',
          category: 'ai',
          config: {
            topK: { type: 'number', default: 5, description: 'Number of FAQs to consider' },
          },
        },
        {
          type: 'generic.response.openai',
          label: 'Generic Response',
          description: 'Generate generic responses',
          category: 'ai',
          config: {},
        },
        {
          type: 'validator.required_fields',
          label: 'Validator',
          description: 'Validate required fields before specialist. Configurable rules per use case.',
          category: 'ai',
          outputs: ['autos', 'dates', 'faq', 'generic'],
          config: {
            useCases: {
              type: 'object',
              default: {
                dates: {
                  extract: 'dates',
                  rules: [
                    { field: 'date', orFields: ['dayOfWeek'], required: true, label: 'fecha o día de la semana' }
                  ]
                },
                autos: {
                  extract: 'autos',
                  rules: [
                    { field: 'maxPrice', orFields: ['minPrice'], required: false, requiredWhenContains: ['barato', 'económico', 'caro', 'lujoso'], label: 'rango de precio' }
                  ]
                }
              },
              description: 'Validation rules per use case with configurable fields, triggers and labels'
            },
          },
        },
        {
          type: 'autos.specialist.openai',
          label: 'Autos Specialist',
          description: 'Search vehicles catalog and respond',
          category: 'ai',
          config: {
            maxResults: { type: 'number', default: 5, description: 'Max vehicles to return' },
          },
        },
        {
          type: 'dates.specialist.openai',
          label: 'Dates Specialist',
          description: 'Search available appointment slots',
          category: 'ai',
          config: {
            maxSlots: { type: 'number', default: 5, description: 'Max slots to return' },
          },
        },
        {
          type: 'response.compose',
          label: 'Response',
          description: 'Compose final response',
          category: 'output',
          config: {},
        },
      ],
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.flowService.findOne(id);
  }

  @Post()
  async create(@Body() createFlowDto: CreateFlowDto) {
    return this.flowService.create(createFlowDto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFlowDto: UpdateFlowDto,
  ) {
    return this.flowService.update(id, updateFlowDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.flowService.delete(id);
  }

  @Post(':id/activate')
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.flowService.activate(id);
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.flowService.deactivate(id);
  }
}
