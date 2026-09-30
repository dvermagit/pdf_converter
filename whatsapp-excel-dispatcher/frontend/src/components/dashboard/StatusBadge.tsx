import { Box, Text } from '@chakra-ui/react';
import type { RecipientStatus, CampaignStatus } from '../../types';

const statusConfig: Record<
  string,
  { label: string; bg: string; color: string; glow?: string }
> = {
  // Campaign statuses
  validating: { label: 'Validating', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  validated: { label: 'Validated', bg: 'rgba(37,211,102,0.15)', color: '#25D366' },
  processing: { label: 'Processing', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  scheduled: { label: 'Scheduled', bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' },
  in_progress: {
    label: 'In Progress',
    bg: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    glow: '0 0 12px rgba(245,158,11,0.3)',
  },
  completed: { label: 'Completed', bg: 'rgba(37,211,102,0.15)', color: '#25D366' },
  failed: { label: 'Failed', bg: 'rgba(244,63,94,0.15)', color: '#f43f5e' },
  cancelled: { label: 'Cancelled', bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },

  // Recipient statuses
  pending: { label: 'Pending', bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  queued: { label: 'Queued', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  sending: {
    label: 'Sending',
    bg: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    glow: '0 0 12px rgba(245,158,11,0.3)',
  },
  sent: { label: 'Sent', bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  delivered: { label: 'Delivered', bg: 'rgba(37,211,102,0.15)', color: '#25D366' },
  read: {
    label: 'Read',
    bg: 'rgba(37,211,102,0.2)',
    color: '#25D366',
    glow: '0 0 12px rgba(37,211,102,0.3)',
  },
};

interface StatusBadgeProps {
  status: RecipientStatus | CampaignStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    bg: 'rgba(107,114,128,0.15)',
    color: '#9ca3af',
  };

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      gap={1.5}
      px={size === 'sm' ? 2.5 : 3}
      py={size === 'sm' ? 1 : 1.5}
      borderRadius="full"
      bg={config.bg}
      boxShadow={config.glow}
      transition="all 0.2s"
    >
      {/* Pulsing dot for active statuses */}
      {['sending', 'in_progress', 'processing'].includes(status) && (
        <Box
          w="6px"
          h="6px"
          borderRadius="full"
          bg={config.color}
          animation="pulse 2s infinite"
          css={{
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.4 },
            },
          }}
        />
      )}
      <Text
        fontSize={size === 'sm' ? 'xs' : 'sm'}
        fontWeight="600"
        color={config.color}
        letterSpacing="0.02em"
      >
        {config.label}
      </Text>
    </Box>
  );
}
