import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiUsers } from 'react-icons/fi';
import { StatusBadge } from '../dashboard/StatusBadge';
import type { Campaign } from '../../types';

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate();

  const total = campaign.totalRecipients || 1;
  const progress = Math.round(
    ((campaign.sent + campaign.delivered + campaign.failed) / total) * 100
  );

  const createdDate = new Date(campaign.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Box
      bg="#111827"
      border="1px solid"
      borderColor="#1f2937"
      borderRadius="16px"
      p={5}
      cursor="pointer"
      transition="all 0.3s ease"
      _hover={{
        transform: 'translateY(-2px)',
        borderColor: '#374151',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}
      onClick={() => navigate(`/campaigns/${campaign._id}`)}
    >
      <Flex justify="space-between" align="flex-start" mb={3}>
        <Box flex="1" pr={3}>
          <Text fontSize="md" fontWeight="700" color="white" mb={1} truncate>
            {campaign.name}
          </Text>
          <Text fontSize="xs" color="#6b7280" truncate>
            {campaign.source === 'manual'
              ? '✍️ Added manually'
              : campaign.originalFileName}
          </Text>
        </Box>
        <StatusBadge status={campaign.status} />
      </Flex>

      {/* Progress bar */}
      {['scheduled', 'in_progress', 'completed'].includes(campaign.status) && (
        <Box mb={3}>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="xs" color="#6b7280">
              Progress
            </Text>
            <Text fontSize="xs" color="#9ca3af" fontWeight="600">
              {progress}%
            </Text>
          </Flex>
          <Box h="4px" bg="#1f2937" borderRadius="full" overflow="hidden">
            <Box
              h="full"
              borderRadius="full"
              bg={
                campaign.status === 'completed'
                  ? 'linear-gradient(90deg, #25D366, #128C7E)'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)'
              }
              w={`${progress}%`}
              transition="width 0.5s ease"
            />
          </Box>
        </Box>
      )}

      {/* Stats row */}
      <Flex justify="space-between" align="center" pt={2} borderTop="1px solid" borderColor="#1f2937">
        <Flex align="center" gap={1.5}>
          <Icon as={FiUsers} color="#6b7280" boxSize={3.5} />
          <Text fontSize="xs" color="#9ca3af">
            {campaign.totalRecipients} recipients
          </Text>
        </Flex>
        <Flex align="center" gap={1.5}>
          <Icon as={FiCalendar} color="#6b7280" boxSize={3.5} />
          <Text fontSize="xs" color="#6b7280">
            {createdDate}
          </Text>
        </Flex>
      </Flex>

      {/* Mini stats */}
      {campaign.totalRecipients > 0 && (
        <Flex gap={4} mt={3}>
          <Flex align="center" gap={1}>
            <Box w="6px" h="6px" borderRadius="full" bg="#25D366" />
            <Text fontSize="xs" color="#9ca3af">
              {campaign.sent + campaign.delivered} sent
            </Text>
          </Flex>
          {campaign.failed > 0 && (
            <Flex align="center" gap={1}>
              <Box w="6px" h="6px" borderRadius="full" bg="#f43f5e" />
              <Text fontSize="xs" color="#9ca3af">
                {campaign.failed} failed
              </Text>
            </Flex>
          )}
          {campaign.pending > 0 && (
            <Flex align="center" gap={1}>
              <Box w="6px" h="6px" borderRadius="full" bg="#6b7280" />
              <Text fontSize="xs" color="#9ca3af">
                {campaign.pending} pending
              </Text>
            </Flex>
          )}
        </Flex>
      )}
    </Box>
  );
}
