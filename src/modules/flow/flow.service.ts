import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flow } from '../../entities/flow.entity';
import { CreateFlowDto, UpdateFlowDto } from '../../dto/flow.dto';

@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(Flow)
    private flowRepository: Repository<Flow>,
  ) {}

  async findAll(): Promise<Flow[]> {
    return this.flowRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Flow> {
    const flow = await this.flowRepository.findOne({ where: { id } });
    if (!flow) {
      throw new NotFoundException(`Flow with ID ${id} not found`);
    }
    return flow;
  }

  async findActive(): Promise<Flow | null> {
    return this.flowRepository.findOne({ where: { isActive: true } });
  }

  async create(createFlowDto: CreateFlowDto): Promise<Flow> {
    const flow = this.flowRepository.create(createFlowDto);
    return this.flowRepository.save(flow);
  }

  async update(id: string, updateFlowDto: UpdateFlowDto): Promise<Flow> {
    const flow = await this.findOne(id);
    Object.assign(flow, updateFlowDto);
    return this.flowRepository.save(flow);
  }

  async delete(id: string): Promise<void> {
    const flow = await this.findOne(id);
    if (flow.isActive) {
      throw new BadRequestException('Cannot delete an active flow');
    }
    await this.flowRepository.remove(flow);
  }

  async activate(id: string): Promise<Flow> {
    // Deactivate all flows first
    await this.flowRepository
      .createQueryBuilder()
      .update(Flow)
      .set({ isActive: false })
      .execute();
    
    // Activate the selected flow
    const flow = await this.findOne(id);
    flow.isActive = true;
    return this.flowRepository.save(flow);
  }

  async deactivate(id: string): Promise<Flow> {
    const flow = await this.findOne(id);
    flow.isActive = false;
    return this.flowRepository.save(flow);
  }
}
