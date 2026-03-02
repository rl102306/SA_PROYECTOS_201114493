import { Order } from '../../domain/entities/Order';
import { IOrderRepository, OrderFilters } from '../../domain/interfaces/IOrderRepository';

export interface GetAllOrdersDTO {
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
}

export class GetAllOrdersUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(dto: GetAllOrdersDTO): Promise<Order[]> {
    const filters: OrderFilters = {};

    if (dto.statuses && dto.statuses.length > 0) {
      filters.statuses = dto.statuses;
    }
    if (dto.dateFrom) {
      filters.dateFrom = new Date(dto.dateFrom);
    }
    if (dto.dateTo) {
      filters.dateTo = new Date(dto.dateTo);
    }
    if (dto.userId) {
      filters.userId = dto.userId;
    }

    return await this.orderRepository.findAll(filters);
  }
}
