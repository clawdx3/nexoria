import { User } from '../../database/entities/user.entity';

export interface AuthenticatedRequest {
  user: User;
}
