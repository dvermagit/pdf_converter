import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import {
  FiSend,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiBarChart2,
  FiTrendingUp,
  FiActivity,
  FiZap,
} from 'react-icons/fi';
import type { DashboardStats } from '../../types';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: typeof FiSend;
  gradient: string;
  trend?: string;
}

function StatCard({ label, value, icon, gradient, trend }: StatCardProps) {
  return (
    <Box
      bg="#111827"
      border="1px solid"
      borderColor="#1f2937"
      borderRadius="16px"
      p={5}
      position="relative"
      overflow="hidden"
      transition="all 0.3s ease"
      _hover={{
        transform: 'translateY(-2px)',
        borderColor: '#374151',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}
    >
      {/* Gradient accent */}
      <Box
        position="absolute"
        top="0"
        right="0"
        w="80px"
        h="80px"
        borderRadius="0 16px 0 80px"
        bg={gradient}
        opacity="0.1"
      />

      <Flex justify="space-between" align="flex-start" mb={3}>
        <Flex
          align="center"
          justify="center"
          w="42px"
          h="42px"
          borderRadius="12px"
          bg={gradient}
        >
          <Icon as={icon} color="white" boxSize={5} />
        </Flex>
        {trend && (
          <Flex align="center" gap={1}>
            <Icon as={FiTrendingUp} color="#25D366" boxSize={3} />
            <Text fontSize="xs" color="#25D366" fontWeight="600">
              {trend}
            </Text>
          </Flex>
        )}
      </Flex>

      <Text fontSize="2xl" fontWeight="800" color="white" lineHeight="1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text fontSize="xs" color="#6b7280" mt={1} fontWeight="500" textTransform="uppercase" letterSpacing="0.05em">
        {label}
      </Text>
    </Box>
  );
}

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards: StatCardProps[] = [
    {
      label: 'Total Campaigns',
      value: stats.totalCampaigns,
      icon: FiBarChart2,
      gradient: 'linear-gradient(135deg, #a855f7, #6366f1)',
    },
    {
      label: 'Sent Today',
      value: stats.sentToday,
      icon: FiZap,
      gradient: 'linear-gradient(135deg, #25D366, #128C7E)',
    },
    {
      label: 'Delivery Rate',
      value: `${stats.deliveryRate}%`,
      icon: FiCheckCircle,
      gradient: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
    },
    {
      label: 'Active Campaigns',
      value: stats.activeCampaigns,
      icon: FiActivity,
      gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    },
    {
      label: 'Total Sent',
      value: stats.totalSent,
      icon: FiSend,
      gradient: 'linear-gradient(135deg, #14b8a6, #25D366)',
    },
    {
      label: 'Delivered',
      value: stats.totalDelivered,
      icon: FiCheckCircle,
      gradient: 'linear-gradient(135deg, #25D366, #22c55e)',
    },
    {
      label: 'Failed',
      value: stats.totalFailed,
      icon: FiAlertTriangle,
      gradient: 'linear-gradient(135deg, #f43f5e, #ef4444)',
    },
    {
      label: 'Pending',
      value: stats.totalPending,
      icon: FiClock,
      gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    },
  ];

  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)',
      }}
      gap={4}
    >
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </Box>
  );
}
