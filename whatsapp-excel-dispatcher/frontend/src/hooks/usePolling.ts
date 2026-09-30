import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 10000,
  });
}
